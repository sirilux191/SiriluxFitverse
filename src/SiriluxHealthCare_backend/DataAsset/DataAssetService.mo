import Array "mo:base/Array";
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
import BTree "mo:stableheapbtreemap/BTree";

import SharedActivityService "../SharedActivitySystem/SharedActivityService";
import Types "../Types";
import CanisterIDs "../Types/CanisterIDs";
import CanisterTypes "../Types/CanisterTypes";
import Hex "../utility/Hex";
import Interface "../utility/ic-management-interface";
import DataAssetShard "DataAssetShard";

actor DataAssetService {
    type DataAsset = Types.DataAsset;
    type DataAssetInfo = Types.DataAssetInfo;
    type SharedType = Types.SharedType;
    type sharedActivityInfo = Types.sharedActivityInfo;

    let sharedActivityService : SharedActivityService.SharedActivityService = actor (CanisterIDs.sharedActivityCanisterID);
    let identityManager = CanisterTypes.identityManager;

    private stable var totalAssetCount : Nat = 1;
    private stable var shardCount : Nat = 0;
    private let ASSETS_PER_SHARD : Nat = 200_000;
    private stable let shards : BTree.BTree<Text, Principal> = BTree.init<Text, Principal>(null);
    private stable var userShardMap : BTree.BTree<Text, [Text]> = BTree.init<Text, [Text]>(null);
    private stable var dataAssetShardWasmModule : [Nat8] = [];

    private let IC = "aaaaa-aa";
    private let ic : Interface.Self = actor (IC);

    let uploadKeyAssetIDmap = HashMap.HashMap<Text, Text>(0, Text.equal, Text.hash);

    public shared ({ caller }) func uploadDataAsset(asset : DataAsset) : async Result.Result<Text, Text> {
        let userIDResult = await getUserID(caller);
        switch (userIDResult) {
            case (#ok(userID)) {
                let assetNum = await getNextAssetID();
                let timestamp = Int.toText(Time.now());

                let shardResult = await getShard(assetNum);
                switch (shardResult) {
                    case (#ok(shard)) {
                        let updatedAsset = {
                            asset with assetID = assetNum # "-" # userID # "-" # timestamp
                        };
                        let result = await shard.insertDataAsset(userID, timestamp, updatedAsset, caller);
                        switch (result) {
                            case (#ok(_insertDataAssetResult)) {

                                incrementTotalAssetCount();
                                let shardID = getShardID(assetNum);
                                await updateUserShardMap(userID, shardID);

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
        let userIDResult = await getUserID(caller);
        switch (userIDResult) {
            case (#ok(userID)) {
                let shardsResult = await getUserShards(userID);
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

    public shared ({ caller }) func getDataAsset(assetID : Text) : async Result.Result<DataAsset, Text> {

        let parts = Text.split(assetID, #text("-"));
        switch (parts.next(), parts.next(), parts.next()) {
            case (?assetNum, ?userID, ?timestamp) {
                let shardResult = await getShard(assetNum);
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
                        let shardResult = await getShard(assetNum);
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
                        let shardResult = await getShard(assetNum);
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

                                        let shardResult = await getShard(assetNum);
                                        switch (shardResult) {
                                            case (#ok(shard)) {
                                                let result = await shard.insertDataAsset(userID, timestamp, asset, userPrincipal);
                                                switch (result) {
                                                    case (#ok(insertDataAssetResult)) {
                                                        let shardID = getShardID(assetNum);

                                                        let updateResult = await updateUserShardMap(userID, shardID);
                                                        switch (updateResult) {
                                                            case (#ok(_)) {
                                                                return #ok(id, insertDataAssetResult);

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

    public func getSymmetricKeyVerificationKey(assetID : Text) : async Result.Result<Text, Text> {
        let parts = Text.split(assetID, #text("-"));
        switch (parts.next(), parts.next(), parts.next()) {
            case (?assetNum, ?userID, ?timestamp) {
                let shardResult = await getShard(assetNum);
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
                let shardResult = await getShard(assetNum);
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
                                let assetNum = await getNextAssetID();
                                let timestamp = Int.toText(Time.now());
                                let assetID = assetNum # "-" # userID # "-" # timestamp;

                                let shardResult = await getShard(assetNum);
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

    public func getShard(assetNum : Text) : async Result.Result<DataAssetShard.DataAssetShard, Text> {
        let shardID = getShardID(assetNum);
        switch (BTree.get(shards, Text.compare, shardID)) {
            case (?principal) {
                #ok(actor (Principal.toText(principal)) : DataAssetShard.DataAssetShard);
            };
            case null {
                let newShardResult = await createShard();
                switch (newShardResult) {
                    case (#ok(newShardPrincipal)) {
                        ignore BTree.insert(shards, Text.compare, shardID, newShardPrincipal);
                        shardCount += 1;
                        #ok(actor (Principal.toText(newShardPrincipal)) : DataAssetShard.DataAssetShard);
                    };
                    case (#err(e)) {
                        #err(e);
                    };
                };
            };
        };
    };

    private func getShardID(assetNum : Text) : Text {

        switch (Nat.fromText(assetNum)) {
            case (?num) {
                let shardIndex = num / ASSETS_PER_SHARD;
                "shard-" # Nat.toText(shardIndex + 1);
            };
            case null { "shard-0" }; // Default
        };

    };

    private func createShard() : async Result.Result<Principal, Text> {
        if (Array.size(dataAssetShardWasmModule) == 0) {
            return #err("Wasm module not set. Please update the Wasm module first.");
        };

        try {
            let cycles = 10 ** 12;
            Cycles.add<system>(cycles);
            let newCanister = await ic.create_canister({ settings = null });
            let canisterPrincipal = newCanister.canister_id;

            let installResult = await installCodeOnShard(canisterPrincipal);
            switch (installResult) {
                case (#ok(())) {
                    #ok(canisterPrincipal);
                };
                case (#err(e)) {
                    #err(e);
                };
            };
        } catch (e) {
            #err("Failed to create shard: " # Error.message(e));
        };
    };

    private func installCodeOnShard(canisterPrincipal : Principal) : async Result.Result<(), Text> {
        let arg = [];

        try {
            await ic.install_code({
                arg = arg;
                wasm_module = dataAssetShardWasmModule;
                mode = #install;
                canister_id = canisterPrincipal;
            });

            await ic.start_canister({ canister_id = canisterPrincipal });
            #ok(());
        } catch (e) {
            #err("Failed to install or start code on shard: " # Error.message(e));
        };
    };

    private func upgradeCodeOnShard(canisterPrincipal : Principal) : async Result.Result<(), Text> {
        let arg = [];

        try {
            await ic.install_code({
                arg = arg;
                wasm_module = dataAssetShardWasmModule;
                mode = #upgrade;
                canister_id = canisterPrincipal;
            });

            #ok(());
        } catch (e) {
            #err("Failed to install or start code on shard: " # Error.message(e));
        };
    };

    public shared ({ caller }) func updateWasmModule(wasmModule : [Nat8]) : async Result.Result<(), Text> {
        if (not (await isAdmin(caller))) {
            return #err("You are not Admin, only admin can perform this action");
        };
        if (Array.size(wasmModule) < 8) {
            return #err("Invalid WASM module: too small");
        };

        dataAssetShardWasmModule := wasmModule;
        #ok(());
    };

    public shared ({ caller }) func updateExistingShards() : async Result.Result<(), Text> {
        if (not (await isAdmin(caller))) {
            return #err("You are not Admin, only admin can perform this action");
        };
        if (Array.size(dataAssetShardWasmModule) == 0) {
            return #err("Wasm module not set. Please update the Wasm module first.");
        };

        var updatedCount = 0;
        var errorCount = 0;

        for ((shardID, principal) in BTree.entries(shards)) {
            let installResult = await upgradeCodeOnShard(principal);
            switch (installResult) {
                case (#ok(())) {
                    updatedCount += 1;
                };
                case (#err(_err)) {
                    errorCount += 1;
                };
            };
        };

        if (errorCount > 0) {
            #err("Updated " # Nat.toText(updatedCount) # " shards, but encountered errors in " # Nat.toText(errorCount) # " shards");
        } else {
            #ok(());
        };
    };

    private func updateUserShardMap(userID : Text, shardID : Text) : async Result.Result<Text, Text> {
        switch (BTree.get(userShardMap, Text.compare, userID)) {
            case null {
                let newBuffer = Buffer.Buffer<Text>(1);
                newBuffer.add(shardID);
                ignore BTree.insert(userShardMap, Text.compare, userID, Buffer.toArray(newBuffer));
            };
            case (?existingArray) {

                let buffer = Buffer.fromArray<Text>(existingArray);
                if (not Buffer.contains<Text>(buffer, shardID, Text.equal)) {
                    buffer.add(shardID);
                    ignore BTree.insert(userShardMap, Text.compare, userID, Buffer.toArray(buffer));
                };
            };
        };
        #ok("User shard map updated successfully and Data Uploaded");
    };

    public func getUserShards(userID : Text) : async Result.Result<[DataAssetShard.DataAssetShard], Text> {
        switch (BTree.get(userShardMap, Text.compare, userID)) {
            case null { #err("No shards found for user") };
            case (?shardIDs) {
                let shardActors = Buffer.Buffer<DataAssetShard.DataAssetShard>(shardIDs.size());
                for (shardID in shardIDs.vals()) {
                    switch (BTree.get(shards, Text.compare, shardID)) {
                        case (?principal) {
                            shardActors.add(actor (Principal.toText(principal)) : DataAssetShard.DataAssetShard);
                        };
                        case null { /* Skip if shard not found */ };
                    };
                };
                #ok(Buffer.toArray(shardActors));
            };
        };
    };

    public shared func isAdmin(caller : Principal) : async Bool {
        if (Principal.fromText(await identityManager.returnAdmin()) == (caller)) {
            true;
        } else {
            false;
        };
    };

    public query func getTotalAssetCount() : async Nat {
        totalAssetCount;
    };

    public query func getShardCount() : async Nat {
        shardCount;
    };

    public query func getAssetsPerShard() : async Nat {
        ASSETS_PER_SHARD;
    };

    private func getUserID(principal : Principal) : async Result.Result<Text, Text> {
        let identityResult = await identityManager.getIdentity(principal);
        switch (identityResult) {
            case (#ok((id, _))) { #ok(id) };
            case (#err(e)) { #err(e) };
        };
    };

    private func incrementTotalAssetCount() : () {
        totalAssetCount += 1;
    };

    private func getNextAssetID() : async Text {

        Nat.toText(totalAssetCount - 1);
    };

    public query func getShardPrincipal(shardID : Text) : async Result.Result<Principal, Text> {
        switch (BTree.get(shards, Text.compare, shardID)) {
            case (?principal) { #ok(principal) };
            case null { #err("Shard ID not found") };
        };
    };

    // private func getShardIDFromAssetID(assetID : Text) : async Result.Result<Text, Text> {
    //     let shardID = getShardID(assetID);
    //     switch (BTree.get(shards, Text.compare, shardID)) {
    //         case (?principal) { #ok(shardID) };
    //         case null { #err("Shard ID not found") };
    //     };
    // };

};
