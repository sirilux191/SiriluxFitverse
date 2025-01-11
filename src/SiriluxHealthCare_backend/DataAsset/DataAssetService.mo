import Blob "mo:base/Blob";
import Buffer "mo:base/Buffer";
import Error "mo:base/Error";
import Cycles "mo:base/ExperimentalCycles";
import HashMap "mo:base/HashMap";
import Int "mo:base/Int";
import Nat "mo:base/Nat";
import Principal "mo:base/Principal";
import Result "mo:base/Result";
import Text "mo:base/Text";
import Time "mo:base/Time";

import Types "../Types";
import CanisterTypes "../Types/CanisterTypes";
import ManagerCanisterTypes "../Types/ManagerCanisterTypes";
import Hex "../utility/Hex";
import Interface "../utility/ic-management-interface";

actor DataAssetService {
    type DataAsset = Types.DataAsset;
    type DataAssetInfo = Types.DataAssetInfo;
    type SharedType = Types.SharedType;
    type sharedActivityInfo = Types.sharedActivityInfo;

    let ShardManager = ManagerCanisterTypes.dataAssetShardManager;
    let sharedActivityService = CanisterTypes.sharedActivityService;
    let identityManager = CanisterTypes.identityManager;
    let xpRewardSystem = CanisterTypes.xpSystem;

    let ic : Interface.Self = actor ("aaaaa-aa");

    let uploadKeyAssetIDmap = HashMap.HashMap<Text, Text>(0, Text.equal, Text.hash);

    public shared ({ caller }) func uploadDataAsset(asset : DataAsset) : async Result.Result<Text, Text> {
        let userIDResult = await getUserID(caller);
        switch (userIDResult) {
            case (#ok(userID)) {
                let assetNum = await ShardManager.getNextAssetID();
                let timestamp = Int.toText(Time.now());

                let shardResult = await ShardManager.getShard(assetNum);
                switch (shardResult) {
                    case (#ok(shard)) {
                        let updatedAsset = {
                            asset with assetID = assetNum # "-" # userID # "-" # timestamp
                        };
                        let result = await shard.insertDataAsset(userID, timestamp, updatedAsset, caller);
                        switch (result) {
                            case (#ok(insertDataAssetResult)) {
                                let shardID = await ShardManager.getShardIDFromAssetID(assetNum);
                                switch (shardID) {
                                    case (#ok(id)) {
                                        let updateResult = await ShardManager.updateUserShardMap(userID, id);
                                        switch (updateResult) {
                                            case (#ok(_)) {
                                                // Reward XP for the upload
                                                let xpResult = await xpRewardSystem.rewardXPForUpload(userID);
                                                switch (xpResult) {
                                                    case (#ok(xp)) {
                                                        return #ok(insertDataAssetResult);
                                                    };
                                                    case (#err(e)) {
                                                        // XP reward failed, but asset upload was successful
                                                        return #ok(insertDataAssetResult);
                                                    };
                                                };
                                            };
                                            case (#err(e)) {
                                                return #err("Failed to update user shard map: " # e);
                                            };
                                        };
                                    };
                                    case (#err(e)) { return #err(e) };
                                };
                            };
                            case (#err(e)) { return #err(e) };
                        };
                    };
                    case (#err(e)) { return #err(e) };
                };
            };
            case (#err(e)) { return #err("User not found: " # e) };
        };
    };

    public shared ({ caller }) func getUserDataAssets() : async Result.Result<[(Text, DataAsset)], Text> {
        let userIDResult = await ShardManager.getUserID(caller);
        switch (userIDResult) {
            case (#ok(userID)) {
                let shardsResult = await ShardManager.getUserShards(userID);
                switch (shardsResult) {
                    case (#ok(shards)) {
                        let allAssets = Buffer.Buffer<(Text, DataAsset)>(0);
                        for (shard in shards.vals()) {
                            let assetsResult = await shard.getUserDataAssets(userID);
                            switch (assetsResult) {
                                case (#ok(assets)) {
                                    allAssets.append(Buffer.fromArray(assets));
                                };
                                case (#err(_)) { /* Skip if error */ };
                            };
                        };
                        #ok(Buffer.toArray(allAssets));
                    };
                    case (#err(e)) { #err(e) };
                };
            };
            case (#err(e)) { #err("User not found: " # e) };
        };
    };

    public func getDataAsset(caller : Principal, assetID : Text) : async Result.Result<DataAsset, Text> {

        let parts = Text.split(assetID, #text("-"));
        switch (parts.next(), parts.next(), parts.next()) {
            case (?assetNum, ?userID, ?timestamp) {
                let shardResult = await ShardManager.getShard(assetNum);
                switch (shardResult) {
                    case (#ok(shard)) {
                        let hasAccessResult = await shard.hasAccess(caller, assetID);
                        switch (hasAccessResult) {
                            case (true) {

                                let assetResult = await shard.getDataAsset(userID, timestamp);
                                switch (assetResult) {
                                    case (#ok(asset)) { return #ok(asset) };
                                    case (#err(e)) { return #err(e) };
                                };

                            };
                            case (false) {
                                return #err("Caller does not have access to this asset");
                            };
                        };
                    };
                    case (#err(e)) { return #err(e) };
                };
            };
            case _ {
                return #err("Invalid asset ID format");
            };
        };

    };

    public shared ({ caller }) func updateDataAsset(assetID : Text, updatedAsset : DataAsset) : async Result.Result<(), Text> {
        if (not (assetID == updatedAsset.assetID)) {
            return #err("Asset ID are not the same");
        };
        let userIDResult = await getUserID(caller);
        switch (userIDResult) {
            case (#ok(userID)) {
                let parts = Text.split(assetID, #text("-"));
                switch (parts.next(), parts.next(), parts.next()) {
                    case (?assetNum, ?assetUserID, ?timestamp) {
                        let shardResult = await ShardManager.getShard(assetNum);
                        switch (shardResult) {
                            case (#ok(shard)) {
                                if (userID == assetUserID) {
                                    let updateResult = await shard.updateDataAsset(userID, timestamp, updatedAsset);
                                    switch (updateResult) {
                                        case (#ok(_)) { return #ok(()) };
                                        case (#err(e)) {
                                            return #err(e);
                                        };
                                    };
                                } else {
                                    return #err("Only the owner can update this asset");
                                };
                            };
                            case (#err(e)) { return #err(e) };
                        };
                    };
                    case _ { return #err("Invalid asset ID format") };
                };

            };
            case (#err(e)) { return #err("Error getting caller ID: " # e) };
        };
    };

    public shared ({ caller }) func shareDataAsset(assetID : Text, recipientID : Text, sharedType : SharedType) : async Result.Result<Text, Text> {
        let userIDResult = await getUserID(caller);
        switch (userIDResult) {
            case (#ok(callerID)) {
                let parts = Text.split(assetID, #text("-"));
                switch (parts.next(), parts.next(), parts.next()) {
                    case (?assetNum, ?ownerID, ?_timestamp) {
                        if (callerID != ownerID) {
                            return #err("Only the owner can share this asset");
                        };
                        let shardResult = await ShardManager.getShard(assetNum);
                        switch (shardResult) {
                            case (#ok(shard)) {
                                let recipientPrincipalResult = await identityManager.getPrincipalByID(recipientID);
                                switch (recipientPrincipalResult) {
                                    case (#ok(recipientPrincipal)) {
                                        let grantResult = await shard.grantAccess(assetID, recipientPrincipal);
                                        switch (grantResult) {
                                            case (#ok(_)) {

                                                let recordResult = await sharedActivityService.recordSharedActivity(caller, assetID, recipientID, sharedType);
                                                switch (recordResult) {
                                                    case (#ok(_)) {
                                                        #ok("Shared successfully");
                                                    };
                                                    case (#err(e)) {
                                                        #err("Failed to record shared activity: " # e);
                                                    };
                                                };
                                            };
                                            case (#err(e)) {
                                                #err("Failed to grant access: " # e);
                                            };
                                        };
                                    };
                                    case (#err(e)) {
                                        #err("Recipient not found: " # e);
                                    };
                                };
                            };
                            case (#err(e)) { #err("Failed to get shard: " # e) };
                        };
                    };
                    case _ { #err("Invalid asset ID format") };
                };
            };
            case (#err(e)) { #err("Error getting caller ID: " # e) };
        };
    };

    public shared ({ caller }) func getReceivedDataAssets() : async Result.Result<[(Types.sharedActivityInfo, DataAsset)], Text> {
        let userIDResult = await getUserID(caller);
        switch (userIDResult) {
            case (#ok(userID)) {

                let receivedActivitiesResult = await sharedActivityService.getReceivedActivities(caller);
                switch (receivedActivitiesResult) {
                    case (#ok(activities)) {
                        let receivedAssets = Buffer.Buffer<(Types.sharedActivityInfo, DataAsset)>(0);
                        for (activity in activities.vals()) {
                            let assetResult = await getDataAsset(caller, activity.assetID);
                            switch (assetResult) {
                                case (#ok(asset)) {
                                    receivedAssets.add((activity, asset));
                                };
                                case (#err(_)) { /* Skip if error */ };
                            };
                        };
                        #ok(Buffer.toArray(receivedAssets))
                        // #ok(activities);
                    };
                    case (#err(e)) {
                        #err("Failed to get received activities: " # e);
                    };
                };
            };
            case (#err(e)) { #err("Error getting user ID: " # e) };
        };
    };

    // By Facility & Professional
    private func uploadDataAssetForUser(caller : Principal, asset : DataAsset, userID : Text, uploadKey : Text) : async Result.Result<(Text, Text), Text> {

        if (uploadKeyAssetIDmap.get(uploadKey) != ?asset.assetID) {
            return #err("Not a valid Upload Key or Asset ID with Upload Key doesn't match");
        };
        uploadKeyAssetIDmap.delete(uploadKey);
        let identityResult = await identityManager.getIdentity(caller);
        switch (identityResult) {
            case (#ok(callerIdentityResult)) {
                switch (callerIdentityResult) {
                    case (id, callerType) {
                        if (callerType != "Professional" and callerType != "Facility") {
                            return #err("Only professionals or facilities can upload data for users");
                        };

                        let userIDPrincipalResult = await identityManager.getPrincipalByID(userID);

                        switch (userIDPrincipalResult) {
                            case (#ok(userPrincipal)) {
                                let parts = Text.split(asset.assetID, #text("-"));
                                switch (parts.next(), parts.next(), parts.next()) {
                                    case (?assetNum, ?userIDByAsset, ?timestamp) {

                                        if (userID != userIDByAsset) {
                                            return #err("Check UserIDs submitted and asset ID");
                                        };

                                        let shardResult = await ShardManager.getShard(assetNum);
                                        switch (shardResult) {
                                            case (#ok(shard)) {
                                                let result = await shard.insertDataAsset(userID, timestamp, asset, userPrincipal);
                                                switch (result) {
                                                    case (#ok(insertDataAssetResult)) {
                                                        let shardID = await ShardManager.getShardIDFromAssetID(assetNum);
                                                        switch (shardID) {
                                                            case (#ok(id)) {
                                                                let updateResult = await ShardManager.updateUserShardMap(userID, id);
                                                                switch (updateResult) {
                                                                    case (#ok(_)) {
                                                                        // Reward XP for the upload
                                                                        let xpResult = await xpRewardSystem.rewardXPForUpload(userID);
                                                                        switch (xpResult) {
                                                                            case (#ok(xp)) {
                                                                                return #ok(id, insertDataAssetResult);
                                                                            };
                                                                            case (#err(e)) {
                                                                                // XP reward failed, but asset upload was successful
                                                                                return #ok(id, insertDataAssetResult);
                                                                            };
                                                                        };
                                                                    };
                                                                    case (#err(e)) {
                                                                        return #err("Failed to update user shard map: " # e);
                                                                    };
                                                                };
                                                            };
                                                            case (#err(e)) {
                                                                return #err(e);
                                                            };
                                                        };
                                                    };
                                                    case (#err(e)) {
                                                        return #err(e);
                                                    };
                                                };
                                            };
                                            case (#err(e)) {
                                                #err("Error getting shard: " # e);
                                            };
                                        };
                                    };
                                    case _ {
                                        return #err("Invalid asset ID format");
                                    };
                                };
                            };
                            case (#err(error)) { #err(error) };
                        };

                    };

                };
            };
            case (#err(error)) { #err(error) };
        };
    };

    public shared ({ caller }) func uploadAndSignUserDataAsset(asset : DataAsset, userID : Text, uploadKey : Text) : async Result.Result<Text, Text> {

        let uploadResult = await uploadDataAssetForUser(caller, asset, userID, uploadKey);

        switch (uploadResult) {
            case (#ok(value)) {
                switch (value) {
                    case (id, _resultText) {
                        try {
                            Cycles.add<system>(25_000_000_000);
                            let { signature } = await ic.sign_with_schnorr({
                                message = Text.encodeUtf8("Document with Asset ID :" # asset.assetID # " is uploaded by the entity with ID : " #id # " at the timestamp : " # Int.toText(Time.now()) # " for User with ID : " # userID);
                                derivation_path = [Principal.toBlob(caller)];
                                key_id = {
                                    algorithm = #bip340secp256k1;
                                    name = "dfx_test_key";
                                };
                            });
                            let signature_hex = Hex.encode(Blob.toArray(signature));
                            return #ok(signature_hex);
                        } catch (err) {
                            return #err(Error.message(err));
                        };
                    };
                };
            };
            case (#err(error)) { #err(error) };
        };

    };

    // Utility functions
    public shared func getUserID(principal : Principal) : async Result.Result<Text, Text> {
        let identityResult = await identityManager.getIdentity(principal);
        switch (identityResult) {
            case (#ok((id, _))) { #ok(id) };
            case (#err(e)) { #err(e) };
        };
    };

    public shared ({ caller }) func updateDataAssetShardWasmModule(wasmModule : [Nat8]) : async Result.Result<(), Text> {
        let result = await ShardManager.updateWasmModule(caller, wasmModule);

        switch (result) {
            case (#ok(())) {
                #ok(());
            };
            case (#err(e)) {
                #err("Failed to update WASM module: " # e);
            };
        };
    };

    public shared ({ caller }) func getSymmetricKeyVerificationKey(assetID : Text) : async Result.Result<Text, Text> {
        let parts = Text.split(assetID, #text("-"));
        switch (parts.next(), parts.next(), parts.next()) {
            case (?assetNum, ?userID, ?timestamp) {
                let shardResult = await ShardManager.getShard(assetNum);
                switch (shardResult) {
                    case (#ok(shard)) {
                        #ok(await shard.getSymmetricKeyVerificationKey());
                    };
                    case (#err(e)) {
                        #err("Error getting shard: " # e);
                    };
                };
            };
            case _ { return #err("Invalid asset ID format") };
        };

    };

    public shared ({ caller }) func getEncryptedSymmetricKeyForAsset(assetID : Text, encryption_public_key : Blob) : async Result.Result<Text, Text> {
        let parts = Text.split(assetID, #text("-"));
        switch (parts.next(), parts.next(), parts.next()) {
            case (?assetNum, ?userID, ?timestamp) {
                let shardResult = await ShardManager.getShard(assetNum);
                switch (shardResult) {
                    case (#ok(shard)) {
                        await shard.encrypted_symmetric_key_for_asset(caller, assetID, encryption_public_key);
                    };
                    case (#err(e)) {
                        #err("Error getting shard: " # e);
                    };
                };
            };
            case _ { return #err("Invalid asset ID format") };
        };

    };

    public shared ({ caller }) func getEncryptedSymmetricKeyForAssetForUserDataUpload(userID : Text, encryption_public_key : Blob) : async Result.Result<(Text, Text), Text> {
        let identityResult = await identityManager.getIdentity(caller);
        switch (identityResult) {
            case (#ok(value)) {
                switch (value) {
                    case (id, userType) {

                        if (userType != "Professional" and userType != "Facility") {
                            return #err("Only professionals or facilities can upload data for users");
                        };
                        let userIDPrincipalResult = await identityManager.getPrincipalByID(userID);
                        switch (userIDPrincipalResult) {
                            case (#ok(principal)) {
                                let assetNum = await ShardManager.getNextAssetID();
                                let timestamp = Int.toText(Time.now());
                                let assetID = assetNum # "-" # userID # "-" # timestamp;

                                let shardResult = await ShardManager.getShard(assetNum);
                                switch (shardResult) {
                                    case (#ok(shard)) {
                                        let encryptionKeyResult = await shard.encrypted_symmetric_key_for_asset(principal, assetID, encryption_public_key);
                                        switch (encryptionKeyResult) {
                                            case (#ok(value)) {
                                                uploadKeyAssetIDmap.put(value, assetID);
                                                return #ok(assetID, value);
                                            };
                                            case (#err(error)) { #err(error) };
                                        };
                                    };
                                    case (#err(e)) {
                                        #err("Error getting shard: " # e);
                                    };
                                };
                            };
                            case (#err(e)) {
                                #err(e);
                            };
                        };
                    };

                };
            };
            case (#err(error)) { #err(error) };
        };
    };

    public shared ({ caller }) func getUserXP() : async Result.Result<Nat, Text> {
        let userIDResult = await getUserID(caller);
        switch (userIDResult) {
            case (#ok(userID)) {
                await xpRewardSystem.getUserXP(userID);
            };
            case (#err(e)) { #err("Error getting user ID: " # e) };
        };
    };
};
