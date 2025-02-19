import Array "mo:base/Array";
import Blob "mo:base/Blob";
import Buffer "mo:base/Buffer";
import Debug "mo:base/Debug";
import Error "mo:base/Error";
import Cycles "mo:base/ExperimentalCycles";
import Float "mo:base/Float";
import Int "mo:base/Int";
import Nat "mo:base/Nat";
import Principal "mo:base/Principal";
import Result "mo:base/Result";
import Text "mo:base/Text";
import Time "mo:base/Time";
import Timer "mo:base/Timer";
import ICRC2 "mo:icrc2-types";
import Ids "mo:incremental-ids";
import BTree "mo:stableheapbtreemap/BTree";

import SharedActivityService "../SharedActivitySystem/SharedActivityService";
import Types "../Types";
import CanisterIDs "../Types/CanisterIDs";
import CanisterTypes "../Types/CanisterTypes";
import Interface "../utility/ic-management-interface";
import DataAssetShard "DataAssetShard";
import DataStorageShard "DataStorageShard";

actor class DataAssetService() = this {

    type DataAsset = Types.DataAsset;
    type DataAssetInfo = Types.DataAssetInfo;
    type SharedType = Types.SharedType;
    type sharedActivityInfo = Types.sharedActivityInfo;
    type Balance = Types.Balance;
    type Metadata = Types.Metadata;

    private let sharedActivityService : SharedActivityService.SharedActivityService = actor (CanisterIDs.sharedActivityCanisterID);
    private let icrcLedger : ICRC2.Service = actor (CanisterIDs.icrc_ledger_canister_id);
    private let identityManager = CanisterTypes.identityManager;

    private stable let ids = Ids.new();
    private let asset_ids = Ids.create(ids, "asset");
    private stable var totalAssetCount : Nat = 1;

    private stable var assetShardCount : Nat = 0;
    private stable var dataStorageShardCount : Nat = 0;

    private let ASSETS_PER_SHARD : Nat = 2_000_000;
    private let DATA_PER_DATA_STORAGE_SHARD : Nat = 40_000;

    private let tokensPerSecond : Nat = 1; // 1 token per 1MB / Second

    private stable let shards : BTree.BTree<Text, Principal> = BTree.init<Text, Principal>(null);
    private stable let dataStorageShards : BTree.BTree<Text, Principal> = BTree.init<Text, Principal>(null);

    private stable var userAssetShardMap : BTree.BTree<Text, [Text]> = BTree.init<Text, [Text]>(?128);
    private stable var principalTimerMap : BTree.BTree<Principal, Nat> = BTree.init<Principal, Nat>(?128);

    private stable var dataAssetShardWasmModule : [Nat8] = [];
    private stable var dataStorageShardWasmModule : [Nat8] = [];

    private stable var subScriberMap : BTree.BTree<Principal, Types.Balance> = BTree.init<Principal, Types.Balance>(?128);
    // private let uploadKeyAssetIDmap = HashMap.HashMap<Text, Text>(0, Text.equal, Text.hash);

    private let IC = "aaaaa-aa";
    private let ic : Interface.Self = actor (IC);

    public shared ({ caller }) func uploadDataAsset(asset : DataAsset) : async Result.Result<(Text, Text), Text> {

        let userIDResult = await getUserID(caller);

        switch (userIDResult) {

            case (#ok(userID)) {

                let assetNumNat = Ids.next(ids, "asset");
                let assetNum = Nat.toText(assetNumNat);
                let timestamp = Int.toText(Time.now());

                let assetShardResult = await getAssetShard(assetNum);
                let dataStorageShardResult = await getDataStorageShard(assetNum);

                switch (assetShardResult, dataStorageShardResult) {
                    case (#ok(assetShard), #ok(dataStorageShard)) {

                        let storageShardID = getDataStorageShardID(assetNum);
                        let storagePrincipal = switch (BTree.get(dataStorageShards, Text.compare, storageShardID)) {
                            case (?principal) { Principal.toText(principal) };
                            case null {
                                return #err("Storage shard principal not found");
                            };
                        };

                        let updatedAsset = {
                            asset with
                            assetID = assetNum # "-" # userID # "-" # timestamp;
                            data = storagePrincipal;
                        };

                        let assetInsertResult = await assetShard.insertDataAsset(userID, timestamp, updatedAsset, caller);
                        let dataStorageResult = await dataStorageShard.grantAccess(caller, updatedAsset.assetID);

                        switch (assetInsertResult, dataStorageResult) {
                            case (#ok(insertDataAssetResult), #ok(_dataStorageAccessResult)) {

                                incrementTotalAssetCount();
                                let shardID = getAssetShardID(assetNum);
                                switch (await updateUserAssetShardMap(userID, shardID)) {
                                    case (#ok(_)) {
                                        #ok(insertDataAssetResult, storagePrincipal);
                                    };
                                    case (#err(e)) {
                                        // TODO: Retry the update operation
                                        return #err(e);
                                    };
                                };

                            };

                            case (#err(e), _) {
                                Ids.Gen.release(asset_ids, (assetNumNat));
                                let revokeResult = await dataStorageShard.revokeAccess(updatedAsset.assetID);
                                switch (revokeResult) {
                                    case (#ok(_)) {
                                        return #err(e);
                                    };
                                    case (#err(e)) {
                                        // TODO: Retry the revoke operation
                                        return #err(e);
                                    };
                                };
                            };

                            case (_, #err(e)) {
                                Ids.Gen.release(asset_ids, (assetNumNat));
                                let deleteResult = await assetShard.deleteDataAsset(userID, timestamp);
                                switch (deleteResult) {
                                    case (#ok(_)) {
                                        return #err(e);
                                    };
                                    case (#err(e)) {
                                        // TODO: Retry the delete operation
                                        return #err(e);
                                    };
                                };

                            };
                        };
                    };

                    case (#err(e), _) {
                        Ids.Gen.release(asset_ids, (assetNumNat));
                        return #err(e);
                    };

                    case (_, #err(e)) {
                        Ids.Gen.release(asset_ids, (assetNumNat));
                        return #err(e);
                    };
                };
            };
            case (#err(e)) {
                return #err("User not found: " # e);
            };
        };
    };

    public shared ({ caller }) func getUserDataAssets() : async Result.Result<[(Text, DataAsset)], Text> {

        let userIDResult = await getUserID(caller);

        switch (userIDResult) {
            case (#ok(userID)) {

                let assetShardsResult = await getUserAssetShards(userID);

                switch (assetShardsResult) {
                    case (#ok(assetShards)) {

                        let allAssets = Buffer.Buffer<(Text, DataAsset)>(0);
                        for (assetShard in assetShards.vals()) {

                            let assetsResult = await assetShard.getUserDataAssets(userID);

                            switch (assetsResult) {
                                case (#ok(assets)) {
                                    allAssets.append(Buffer.fromArray(assets));
                                };
                                case (#err(_)) { /* Skip if error */ };
                            };
                        };

                        #ok(Buffer.toArray(allAssets));

                    };
                    case (#err(e)) {
                        #err(e);
                    };
                };
            };
            case (#err(e)) {
                #err("User not found: " # e);
            };
        };
    };

    public shared ({ caller }) func getDataAsset(assetID : Text) : async Result.Result<DataAsset, Text> {

        let parts = Text.split(assetID, #text("-"));

        switch (parts.next(), parts.next(), parts.next()) {
            case (?assetNum, ?userID, ?timestamp) {

                let assetShardResult = await getAssetShard(assetNum);
                switch (assetShardResult) {
                    case (#ok(assetShard)) {

                        await assetShard.getDataAsset(caller, assetID, userID, timestamp);

                    };
                    case (#err(e)) { return #err(e) };
                };
            };
            case _ {
                return #err("Invalid asset ID format");
            };
        };

    };

    public shared ({ caller }) func updateDataAsset(assetID : Text, metadata : Metadata) : async Result.Result<Text, Text> {

        let userIDResult = await getUserID(caller);

        switch (userIDResult) {
            case (#ok(userID)) {
                let parts = Text.split(assetID, #text("-"));

                switch (parts.next(), parts.next(), parts.next()) {
                    case (?assetNum, ?assetUserID, ?timestamp) {

                        let assetShardResult = await getAssetShard(assetNum);

                        switch (assetShardResult) {
                            case (#ok(assetShard)) {

                                if (userID == assetUserID) {
                                    await assetShard.updateDataAsset(userID, timestamp, metadata);
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

    public shared ({ caller }) func deleteDataAsset(assetID : Text) : async Result.Result<Text, Text> {

        let userIDResult = await getUserID(caller);

        switch (userIDResult) {
            case (#ok(userID)) {

                let parts = Text.split(assetID, #text("-"));

                switch (parts.next(), parts.next(), parts.next()) {
                    case (?assetNum, ?assetUserID, ?timestamp) {

                        if (userID != assetUserID) {
                            return #err("Only the owner can delete this asset");
                        };

                        let assetShardResult = await getAssetShard(assetNum);
                        let dataStorageShardResult = await getDataStorageShard(assetNum);

                        switch (assetShardResult, dataStorageShardResult) {
                            case (#ok(assetShard), #ok(dataStorageShard)) {

                                let deleteResult = await assetShard.deleteDataAsset(userID, timestamp);
                                let storageDeleteResult = await dataStorageShard.deleteData(assetID);
                                let activityDeleteResult = await sharedActivityService.deleteActivitiesForAsset(assetID);

                                switch (deleteResult, storageDeleteResult, activityDeleteResult) {
                                    case (#ok(_), #ok(_), #ok(_)) {
                                        #ok("Asset deleted successfully");
                                    };
                                    case (#err(e), _, _) {
                                        // TODO: Retry the delete operation
                                        #err("Failed to delete asset metadata: " # e);
                                    };
                                    case (_, #err(e), _) {
                                        // TODO: Retry the delete operation
                                        #err("Failed to delete storage data: " # e);
                                    };
                                    case (_, _, #err(e)) {
                                        // TODO: Retry the delete operation
                                        #err("Asset deleted but failed to delete activities: " # e);
                                    };
                                };
                            };
                            case (#err(e), _) {
                                #err("Failed to access asset shard: " # e);
                            };
                            case (_, #err(e)) {
                                #err("Failed to access storage shard: " # e);
                            };
                        };
                    };
                    case _ {
                        #err("Invalid asset ID format");
                    };
                };
            };
            case (#err(e)) {
                #err("Error getting caller ID: " # e);
            };
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

                        let assetShardResult = await getAssetShard(assetNum);
                        let dataStorageShardResult = await getDataStorageShard(assetNum);

                        switch (assetShardResult, dataStorageShardResult) {
                            case (#ok(assetShard), #ok(dataStorageShard)) {

                                let recipientPrincipalResult = await identityManager.getPrincipalByID(recipientID);

                                switch (recipientPrincipalResult) {
                                    case (#ok(recipientPrincipal)) {

                                        let grantResult = await assetShard.grantAccess(assetID, recipientPrincipal);
                                        let grantReadResult = await dataStorageShard.grantReadPermission(assetID, recipientPrincipal, Time.now() + (7 * 24 * 60 * 60 * 1_000_000_000)); // 7 days access

                                        switch (grantResult, grantReadResult) {
                                            case (#ok(_), #ok(_)) {
                                                let recordResult = await sharedActivityService.recordSharedActivity(assetID, recipientID, sharedType, callerID);
                                                switch (recordResult) {
                                                    case (#ok(_)) {
                                                        #ok("Shared successfully");
                                                    };
                                                    case (#err(e)) {

                                                        // let revokeResult = await assetShard.revokeAccess(assetID, recipientPrincipal);
                                                        // let revokeReadResult = await dataStorageShard.revokeReadPermission(assetID, recipientPrincipal);
                                                        #err("Failed to record shared activity: " # e);
                                                    };
                                                };
                                            };
                                            case (#err(e), _) {
                                                // let revokeResult = await assetShard.revokeAccess(assetID, recipientPrincipal);
                                                #err("Failed to grant access: " # e);
                                            };
                                            case (_, #err(e)) {
                                                // let revokeReadResult = await dataStorageShard.revokeReadPermission(assetID, recipientPrincipal);
                                                #err("Failed to grant read permission: " # e);
                                            };
                                        };
                                    };
                                    case (#err(e)) {
                                        #err("Recipient not found: " # e);
                                    };
                                };
                            };
                            case (#err(e), _) {
                                #err("Failed to get shard: " # e);
                            };
                            case (_, #err(e)) {
                                #err("Failed to get storage shard: " # e);
                            };
                        };
                    };
                    case _ { #err("Invalid asset ID format") };
                };
            };
            case (#err(e)) { #err("Error getting caller ID: " # e) };
        };
    };

    public func getSymmetricKeyVerificationKey(assetID : Text) : async Result.Result<Text, Text> {
        let parts = Text.split(assetID, #text("-"));
        switch (parts.next(), parts.next(), parts.next()) {
            case (?assetNum, ?_userID, ?_timestamp) {
                let assetShardResult = await getAssetShard(assetNum);
                switch (assetShardResult) {
                    case (#ok(assetShard)) {
                        #ok(await assetShard.getSymmetricKeyVerificationKey());
                    };
                    case (#err(e)) {
                        #err("Error getting asset shard: " # e);
                    };
                };
            };
            case _ { return #err("Invalid asset ID format") };
        };

    };

    public shared ({ caller }) func getEncryptedSymmetricKeyForAsset(assetID : Text, encryption_public_key : Blob) : async Result.Result<Text, Text> {
        let parts = Text.split(assetID, #text("-"));
        switch (parts.next(), parts.next(), parts.next()) {
            case (?assetNum, ?_userID, ?_timestamp) {
                let assetShardResult = await getAssetShard(assetNum);
                switch (assetShardResult) {
                    case (#ok(assetShard)) {
                        await assetShard.encrypted_symmetric_key_for_asset(caller, assetID, encryption_public_key);
                    };
                    case (#err(e)) {
                        #err("Error getting asset shard: " # e);
                    };
                };
            };
            case _ { return #err("Invalid asset ID format") };
        };

    };

    private func getAssetShard(assetNum : Text) : async Result.Result<DataAssetShard.DataAssetShard, Text> {
        let assetShardID = getAssetShardID(assetNum);
        switch (BTree.get(shards, Text.compare, assetShardID)) {
            case (?principal) {
                #ok(actor (Principal.toText(principal)) : DataAssetShard.DataAssetShard);
            };
            case null {
                let newAssetShardResult = await createAssetShard();
                switch (newAssetShardResult) {
                    case (#ok(newAssetShardPrincipal)) {
                        ignore BTree.insert(shards, Text.compare, assetShardID, newAssetShardPrincipal);
                        assetShardCount += 1;
                        #ok(actor (Principal.toText(newAssetShardPrincipal)) : DataAssetShard.DataAssetShard);
                    };
                    case (#err(e)) {
                        #err(e);
                    };
                };
            };
        };
    };

    private func getAssetShardID(assetNum : Text) : Text {

        switch (Nat.fromText(assetNum)) {
            case (?num) {
                let shardIndex = num / ASSETS_PER_SHARD;
                "shard-" # Nat.toText(shardIndex + 1);
            };
            case null { "shard-0" }; // Default
        };

    };

    private func createAssetShard() : async Result.Result<Principal, Text> {
        if (Array.size(dataAssetShardWasmModule) == 0) {
            return #err("Wasm module not set. Please update the Wasm module first.");
        };

        try {
            let cycles = 10 ** 12;
            Cycles.add<system>(cycles);
            let newCanister = await ic.create_canister({ settings = null });
            let canisterPrincipal = newCanister.canister_id;

            let installResult = await installCodeOnAssetShard(canisterPrincipal);
            switch (installResult) {
                case (#ok(())) {
                    #ok(canisterPrincipal);
                };
                case (#err(e)) {
                    #err(e);
                };
            };
        } catch (e) {
            #err("Failed to create asset shard: " # Error.message(e));
        };
    };

    private func installCodeOnAssetShard(canisterPrincipal : Principal) : async Result.Result<(), Text> {
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

    private func upgradeCodeOnAssetShard(canisterPrincipal : Principal) : async Result.Result<(), Text> {
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

    public shared ({ caller }) func updateAssetShardWasmModule(wasmModule : [Nat8]) : async Result.Result<(), Text> {
        if (not (await isAdmin(caller))) {
            return #err("You are not Admin, only admin can perform this action");
        };
        if (Array.size(wasmModule) < 8) {
            return #err("Invalid WASM module: too small");
        };

        dataAssetShardWasmModule := wasmModule;
        #ok(());
    };

    public shared ({ caller }) func updateExistingAssetShards() : async Result.Result<(), Text> {
        if (not (await isAdmin(caller))) {
            return #err("You are not Admin, only admin can perform this action");
        };
        if (Array.size(dataAssetShardWasmModule) == 0) {
            return #err("Wasm module not set. Please update the Wasm module first.");
        };

        var updatedCount = 0;
        var errorCount = 0;

        for ((shardID, principal) in BTree.entries(shards)) {
            let installResult = await upgradeCodeOnAssetShard(principal);
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

    private func updateUserAssetShardMap(userID : Text, shardID : Text) : async Result.Result<Text, Text> {
        switch (BTree.get(userAssetShardMap, Text.compare, userID)) {
            case null {
                ignore BTree.insert(userAssetShardMap, Text.compare, userID, [shardID]);
            };
            case (?existingArray) {

                let buffer = Buffer.fromArray<Text>(existingArray);
                if (not Buffer.contains<Text>(buffer, shardID, Text.equal)) {
                    buffer.add(shardID);
                    ignore BTree.insert(userAssetShardMap, Text.compare, userID, Buffer.toArray(buffer));
                };
            };
        };
        #ok("User shard map updated successfully and Data Uploaded");
    };

    public func getUserAssetShards(userID : Text) : async Result.Result<[DataAssetShard.DataAssetShard], Text> {
        switch (BTree.get(userAssetShardMap, Text.compare, userID)) {
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

    public query func getAssetShardCount() : async Nat {
        assetShardCount;
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

    public query func getShardPrincipal(shardID : Text) : async Result.Result<Principal, Text> {
        switch (BTree.get(shards, Text.compare, shardID)) {
            case (?principal) { #ok(principal) };
            case null { #err("Shard ID not found") };
        };
    };

    public query func getStorageShardPrincipal(shardID : Text) : async Result.Result<Principal, Text> {
        switch (BTree.get(dataStorageShards, Text.compare, shardID)) {
            case (?principal) { #ok(principal) };
            case null { #err("Shard ID not found") };
        };
    };

    private func getDataStorageShard(assetNum : Text) : async Result.Result<DataStorageShard.DataStorageShard, Text> {
        let shardID = getDataStorageShardID(assetNum);
        switch (BTree.get(dataStorageShards, Text.compare, shardID)) {
            case (?principal) {
                #ok(actor (Principal.toText(principal)) : DataStorageShard.DataStorageShard);
            };
            case null {
                let newShardResult = await createDataStorageShard();
                switch (newShardResult) {
                    case (#ok(newShardPrincipal)) {
                        ignore BTree.insert(dataStorageShards, Text.compare, shardID, newShardPrincipal);
                        dataStorageShardCount += 1;
                        #ok(actor (Principal.toText(newShardPrincipal)) : DataStorageShard.DataStorageShard);
                    };
                    case (#err(e)) {
                        #err(e);
                    };
                };
            };
        };
    };

    private func getDataStorageShardID(assetNum : Text) : Text {
        switch (Nat.fromText(assetNum)) {
            case (?num) {
                let shardIndex = num / DATA_PER_DATA_STORAGE_SHARD;
                "storage-shard-" # Nat.toText(shardIndex + 1);
            };
            case null { "storage-shard-0" }; // Default
        };
    };

    private func createDataStorageShard() : async Result.Result<Principal, Text> {
        if (Array.size(dataStorageShardWasmModule) == 0) {
            return #err("Storage Wasm module not set. Please update the Wasm module first.");
        };

        try {
            let cycles = 10 ** 12;
            Cycles.add<system>(cycles);
            let newCanister = await ic.create_canister({ settings = null });
            let canisterPrincipal = newCanister.canister_id;

            let installResult = await installCodeOnDataStorageShard(canisterPrincipal);
            switch (installResult) {
                case (#ok(())) {
                    #ok(canisterPrincipal);
                };
                case (#err(e)) {
                    #err(e);
                };
            };
        } catch (e) {
            #err("Failed to create storage shard: " # Error.message(e));
        };
    };

    private func installCodeOnDataStorageShard(canisterPrincipal : Principal) : async Result.Result<(), Text> {
        let arg = [];

        try {
            await ic.install_code({
                arg = arg;
                wasm_module = dataStorageShardWasmModule;
                mode = #install;
                canister_id = canisterPrincipal;
            });

            #ok(await ic.start_canister({ canister_id = canisterPrincipal }));

        } catch (e) {
            #err("Failed to install or start code on storage shard: " # Error.message(e));
        };
    };

    private func upgradeCodeOnDataStorageShard(canisterPrincipal : Principal) : async Result.Result<(), Text> {
        let arg = [];

        try {
            await ic.install_code({
                arg = arg;
                wasm_module = dataStorageShardWasmModule;
                mode = #upgrade;
                canister_id = canisterPrincipal;
            });

            #ok(());
        } catch (e) {
            #err("Failed to upgrade code on storage shard: " # Error.message(e));
        };
    };

    public shared ({ caller }) func updateDataStorageWasmModule(wasmModule : [Nat8]) : async Result.Result<(), Text> {
        if (not (await isAdmin(caller))) {
            return #err("You are not Admin, only admin can perform this action");
        };
        if (Array.size(wasmModule) < 8) {
            return #err("Invalid WASM module: too small");
        };

        dataStorageShardWasmModule := wasmModule;
        #ok(());
    };

    public shared ({ caller }) func updateExistingDataStorageShards() : async Result.Result<(), Text> {
        if (not (await isAdmin(caller))) {
            return #err("You are not Admin, only admin can perform this action");
        };
        if (Array.size(dataStorageShardWasmModule) == 0) {
            return #err("Storage Wasm module not set. Please update the Wasm module first.");
        };

        var updatedCount = 0;
        var errorCount = 0;

        for ((shardID, principal) in BTree.entries(dataStorageShards)) {
            let installResult = await upgradeCodeOnDataStorageShard(principal);
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
            #err("Updated " # Nat.toText(updatedCount) # " storage shards, but encountered errors in " # Nat.toText(errorCount) # " shards");
        } else {
            #ok(());
        };
    };

    public shared ({ caller }) func updateDataStorageUsedMap(principal : Principal, usedSpace : Int) : async Result.Result<Types.TimeRemaining, Text> {
        for ((_, shardPrincipal) in BTree.entries(dataStorageShards)) {
            if (Principal.equal(shardPrincipal, caller)) {

                let currentTime = Time.now();

                // Get or initialize subscriber balance
                let currentBalance = switch (BTree.get(subScriberMap, Principal.compare, principal)) {
                    case (?balance) { balance };
                    case null {

                        {
                            tokens = 0;
                            dataMB = 0;
                            lastUpdateTime = currentTime;
                        };
                    };
                };

                // Calculate elapsed time and token consumption
                let elapsedNano = currentTime - currentBalance.lastUpdateTime;
                let elapsedSeconds = Int.div(elapsedNano, 1_000_000_000);
                var tokensConsumed : Int = 0;
                if (currentBalance.dataMB <= 100) {

                } else {
                    tokensConsumed := (tokensPerSecond) * (Int.abs(elapsedSeconds)) * currentBalance.dataMB;
                };

                // Calculate new data size in GB
                let newDataMB = usedSpace / 1_000_000; // Convert bytes to MB
                Debug.print("New Data MB: " # debug_show newDataMB);
                // Update balance
                let updatedBalance : Types.Balance = {
                    tokens = currentBalance.tokens - Int.abs(tokensConsumed);
                    dataMB = Int.abs(newDataMB + currentBalance.dataMB);
                    lastUpdateTime = currentTime;
                };
                Debug.print("Updated Balance: " # debug_show updatedBalance);

                let remainingSeconds = Float.fromInt((updatedBalance.tokens) / ((tokensPerSecond) * (updatedBalance.dataMB)));

                ignore BTree.insert(subScriberMap, Principal.compare, principal, updatedBalance);

                if (currentBalance.dataMB <= 100) {

                    switch (BTree.get(principalTimerMap, Principal.compare, principal)) {
                        case (?value) {
                            Timer.cancelTimer(value);
                        };
                        case (null) {

                        };
                    };

                } else if (remainingSeconds <= (24.0 * 60.0 * 60.0 * 1)) {
                    //Less than 1 Days
                    return #err("Remaining time after updating storage is less than 1 Days Add Tokens or Update Storage");
                } else {
                    let triggerAfter : Nat = Int.abs(Float.toInt(remainingSeconds));
                    let id = Timer.setTimer<system>(
                        #seconds triggerAfter,
                        func() : async () {
                            await deleteAllDataForPrincipal(principal);
                        },
                    );

                    ignore BTree.insert(principalTimerMap, Principal.compare, principal, id);
                };

                return #ok({
                    seconds = remainingSeconds;
                    minutes = remainingSeconds / 60.0;
                    hours = remainingSeconds / (60.0 * 60.0);
                    days = remainingSeconds / (24.0 * 60.0 * 60.0);
                });
            };
        };
        return #err("Caller is not a data storage shard");
    };

    private func deleteAllDataForPrincipal(principal : Principal) : async () {
        // Get user ID from principal
        let userIDResult = await getUserID(principal);
        switch (userIDResult) {
            case (#ok(userID)) {
                // Get all shards associated with the user
                let assetShardsResult = await getUserAssetShards(userID);
                switch (assetShardsResult) {
                    case (#ok(userAssetShards)) {
                        for (assetShard in userAssetShards.vals()) {
                            // Get all assets for user from each shard
                            let assetsResult = await assetShard.getUserDataAssets(userID);
                            switch (assetsResult) {
                                case (#ok(assets)) {
                                    // Delete each asset
                                    for ((_, asset) in assets.vals()) {
                                        ignore await deleteDataAsset(asset.assetID);
                                    };
                                };
                                case (#err(_)) {
                                    /* Continue to next shard if error */
                                };
                            };
                        };
                    };
                    case (#err(_)) { /* Skip if error getting shards */ };
                };
            };
            case (#err(_)) { /* Skip if error getting user ID */ };
        };
    };

    public shared ({ caller }) func getDataStorageUsedMap(page : Nat) : async Result.Result<[(Principal, Types.Balance)], Text> {
        if (not (await isAdmin(caller))) {
            return #err("You are not Admin, only admin can perform this action");
        };

        let pageSize = 500;
        let allEntries = BTree.toArray(subScriberMap);
        let startIndex = page * pageSize;

        if (startIndex >= allEntries.size()) {
            return #ok([]);
        };

        let endIndex = Nat.min(startIndex + pageSize, allEntries.size());
        let pageEntries = Array.tabulate<(Principal, Types.Balance)>(
            endIndex - startIndex,
            func(i) = allEntries[startIndex + i],
        );

        #ok(pageEntries);
    };

    public shared query ({ caller }) func getTotalDataBalanceForPrincipalSelf() : async Result.Result<Types.Balance, Text> {
        switch (BTree.get(subScriberMap, Principal.compare, caller)) {
            case (?balance) { #ok(balance) };
            case null {
                #err(" You are not subscriber");
            };
        };
    };

    public shared query func getTotalDataBalanceForPrincipal(principal : Text) : async Result.Result<Types.Balance, Text> {
        switch (BTree.get(subScriberMap, Principal.compare, Principal.fromText(principal))) {
            case (?balance) { #ok(balance) };
            case null {
                #err(" You are not subscriber");
            };
        };
    };

    // Add helper function to get remaining time for a principal
    public shared query func getRemainingStorageTime(principal : Principal) : async Result.Result<Types.TimeRemaining, Text> {
        switch (BTree.get(subScriberMap, Principal.compare, principal)) {
            case (?balance) {
                if (balance.tokens <= 0 or balance.dataMB <= 0) {
                    return #ok({
                        seconds = 0.0;
                        minutes = 0.0;
                        hours = 0.0;
                        days = 0.0;
                    });
                };

                let remainingSeconds = Float.fromInt(balance.tokens) / ((Float.fromInt(tokensPerSecond)) * Float.fromInt(balance.dataMB));

                #ok({
                    seconds = remainingSeconds;
                    minutes = remainingSeconds / 60.0;
                    hours = remainingSeconds / (60.0 * 60.0);
                    days = remainingSeconds / (24.0 * 60.0 * 60.0);
                });
            };
            case null {
                #err("No balance found for principal");
            };
        };
    };

    // Add method to add tokens to a principal's balance
    public shared ({ caller }) func addTokensToBalance(amount : Nat) : async Result.Result<Text, Text> {
        if (not (await isAdmin(caller))) {
            return #err("Only admin can add tokens");
        };

        let result = await icrcLedger.icrc2_transfer_from({
            from = { owner = caller; subaccount = null };
            spender_subaccount = null;
            to = { owner = Principal.fromActor(this); subaccount = null };
            amount = amount * 100_000_000;
            fee = null;
            memo = ?Text.encodeUtf8("Add Tokens Subscriber: " # debug_show amount);
            created_at_time = null;
        });

        switch (result) {
            case (#Ok(_value)) {

            };
            case (#Err(error)) {
                return #err(debug_show error);
            };
        };

        let tokensToadd = Int.abs(Float.toInt((Float.fromInt(amount) * 24 * 60 * 60 * 30) / 100));

        switch (BTree.get(subScriberMap, Principal.compare, caller)) {
            case (?balance) {
                let updatedBalance : Balance = {
                    tokens = balance.tokens + tokensToadd;
                    dataMB = balance.dataMB;
                    lastUpdateTime = balance.lastUpdateTime;
                };
                ignore BTree.insert(subScriberMap, Principal.compare, caller, updatedBalance);
                #ok("Successfully added tokens to balance");
            };
            case null {
                let newBalance : Balance = {
                    tokens = (tokensToadd);
                    dataMB = 0; // Initialize with 100MB
                    lastUpdateTime = Time.now();
                };
                ignore BTree.insert(subScriberMap, Principal.compare, caller, newBalance);
                #ok("Successfully added tokens to balance");
            };
        };
    };

    public shared ({ caller }) func checkDataStorageUsedMap(principal : Principal, usedSpace : Int) : async Result.Result<Types.TimeRemaining, Text> {
        for ((_, shardPrincipal) in BTree.entries(dataStorageShards)) {
            if (Principal.equal(shardPrincipal, caller)) {
                let currentTime = Time.now();

                // Get or initialize subscriber balance
                let currentBalance = switch (BTree.get(subScriberMap, Principal.compare, principal)) {
                    case (?balance) { balance };
                    case null {
                        {
                            tokens = 0;
                            dataMB = 0;
                            lastUpdateTime = currentTime;
                        };
                    };
                };

                // Calculate elapsed time and token consumption
                let elapsedNano = currentTime - currentBalance.lastUpdateTime;
                let elapsedSeconds = Int.div(elapsedNano, 1_000_000_000);
                var tokensConsumed : Int = 0;
                if (currentBalance.dataMB <= 100) {
                    // No tokens consumed for first 100MB
                } else {
                    tokensConsumed := (tokensPerSecond) * (Int.abs(elapsedSeconds)) * currentBalance.dataMB;
                };

                // Calculate new data size in MB
                let newDataMB = usedSpace / 1_000_000; // Convert bytes to MB

                // Calculate hypothetical updated balance
                let hypotheticalBalance : Balance = {
                    tokens = currentBalance.tokens - Int.abs(tokensConsumed);
                    dataMB = Int.abs(newDataMB + currentBalance.dataMB);
                    lastUpdateTime = currentTime;
                };

                let remainingSeconds = Float.fromInt((hypotheticalBalance.tokens) / ((tokensPerSecond) * (hypotheticalBalance.dataMB)));

                if (currentBalance.dataMB <= 100) {
                    return #ok({
                        seconds = remainingSeconds;
                        minutes = remainingSeconds / 60.0;
                        hours = remainingSeconds / (60.0 * 60.0);
                        days = remainingSeconds / (24.0 * 60.0 * 60.0);
                    });
                } else if (remainingSeconds <= (24.0 * 60.0 * 60.0 * 1)) {
                    return #err("Remaining time after updating storage would be less than 1 day. Add tokens or update storage.");
                };

                return #ok({
                    seconds = remainingSeconds;
                    minutes = remainingSeconds / 60.0;
                    hours = remainingSeconds / (60.0 * 60.0);
                    days = remainingSeconds / (24.0 * 60.0 * 60.0);
                });
            };
        };
        return #err("Caller is not a data storage shard");
    };

    // // By Facility & Professional
    // private func uploadDataAssetForUser(caller : Principal, asset : DataAsset, userID : Text, uploadKey : Text) : async Result.Result<(Text, Text), Text> {

    //     if (uploadKeyAssetIDmap.get(uploadKey) != ?asset.assetID) {
    //         return #err("Not a valid Upload Key or Asset ID with Upload Key doesn't match");
    //     };
    //     uploadKeyAssetIDmap.delete(uploadKey);
    //     let identityResult = await identityManager.getIdentity(caller);
    //     switch (identityResult) {
    //         case (#ok(callerIdentityResult)) {
    //             switch (callerIdentityResult) {
    //                 case (id, callerType) {
    //                     if (callerType != "Professional" and callerType != "Facility") {
    //                         return #err("Only professionals or facilities can upload data for users");
    //                     };

    //                     let userIDPrincipalResult = await identityManager.getPrincipalByID(userID);

    //                     switch (userIDPrincipalResult) {
    //                         case (#ok(userPrincipal)) {
    //                             let parts = Text.split(asset.assetID, #text("-"));
    //                             switch (parts.next(), parts.next(), parts.next()) {
    //                                 case (?assetNum, ?userIDByAsset, ?timestamp) {

    //                                     if (userID != userIDByAsset) {
    //                                         return #err("Check UserIDs submitted and asset ID");
    //                                     };

    //                                     let assetShardResult = await getAssetShard(assetNum);
    //                                     switch (assetShardResult) {
    //                                         case (#ok(assetShard)) {
    //                                             let result = await assetShard.insertDataAsset(userID, timestamp, asset, userPrincipal);
    //                                             switch (result) {
    //                                                 case (#ok(insertDataAssetResult)) {
    //                                                     let shardID = getAssetShardID(assetNum);

    //                                                     let updateResult = await updateUserAssetShardMap(userID, shardID);
    //                                                     switch (updateResult) {
    //                                                         case (#ok(_)) {
    //                                                             return #ok(id, insertDataAssetResult);

    //                                                         };
    //                                                         case (#err(e)) {
    //                                                             return #err("Failed to update user shard map: " # e);
    //                                                         };
    //                                                     };
    //                                                 };
    //                                                 case (#err(e)) {
    //                                                     return #err(e);
    //                                                 };
    //                                             };
    //                                         };
    //                                         case (#err(e)) {
    //                                             #err("Error getting shard: " # e);
    //                                         };
    //                                     };
    //                                 };
    //                                 case _ {
    //                                     return #err("Invalid asset ID format");
    //                                 };
    //                             };
    //                         };
    //                         case (#err(error)) { #err(error) };
    //                     };

    //                 };

    //             };
    //         };
    //         case (#err(error)) { #err(error) };
    //     };
    // };

    // public shared ({ caller }) func uploadAndSignUserDataAsset(asset : DataAsset, userID : Text, uploadKey : Text) : async Result.Result<Text, Text> {

    //     let uploadResult = await uploadDataAssetForUser(caller, asset, userID, uploadKey);

    //     switch (uploadResult) {
    //         case (#ok(value)) {
    //             switch (value) {
    //                 case (id, _resultText) {
    //                     try {
    //                         Cycles.add<system>(25_000_000_000);
    //                         let { signature } = await ic.sign_with_schnorr({
    //                             message = Text.encodeUtf8("Document with Asset ID :" # asset.assetID # " is uploaded by the entity with ID : " #id # " at the timestamp : " # Int.toText(Time.now()) # " for User with ID : " # userID);
    //                             derivation_path = [Principal.toBlob(caller)];
    //                             key_id = {
    //                                 algorithm = #bip340secp256k1;
    //                                 name = "dfx_test_key";
    //                             };
    //                         });
    //                         let signature_hex = Hex.encode(Blob.toArray(signature));
    //                         return #ok(signature_hex);
    //                     } catch (err) {
    //                         return #err(Error.message(err));
    //                     };
    //                 };
    //             };
    //         };
    //         case (#err(error)) { #err(error) };
    //     };

    // };

    // public shared ({ caller }) func getEncryptedSymmetricKeyForAssetForUserDataUpload(userID : Text, encryption_public_key : Blob) : async Result.Result<(Text, Text), Text> {
    //     let identityResult = await identityManager.getIdentity(caller);
    //     switch (identityResult) {
    //         case (#ok(value)) {
    //             switch (value) {
    //                 case (_id, userType) {

    //                     if (userType != "Professional" and userType != "Facility") {
    //                         return #err("Only professionals or facilities can upload data for users");
    //                     };
    //                     let userIDPrincipalResult = await identityManager.getPrincipalByID(userID);
    //                     switch (userIDPrincipalResult) {
    //                         case (#ok(principal)) {
    //                             let assetNum = Nat.toText(Ids.next(ids, "asset"));
    //                             let timestamp = Int.toText(Time.now());
    //                             let assetID = assetNum # "-" # userID # "-" # timestamp;

    //                             let assetShardResult = await getAssetShard(assetNum);
    //                             switch (assetShardResult) {
    //                                 case (#ok(assetShard)) {
    //                                     let encryptionKeyResult = await assetShard.encrypted_symmetric_key_for_asset(principal, assetID, encryption_public_key);
    //                                     switch (encryptionKeyResult) {
    //                                         case (#ok(value)) {
    //                                             uploadKeyAssetIDmap.put(value, assetID);
    //                                             return #ok(assetID, value);
    //                                         };
    //                                         case (#err(error)) { #err(error) };
    //                                     };
    //                                 };
    //                                 case (#err(e)) {
    //                                     #err("Error getting shard: " # e);
    //                                 };
    //                             };
    //                         };
    //                         case (#err(e)) {
    //                             #err(e);
    //                         };
    //                     };
    //                 };

    //             };
    //         };
    //         case (#err(error)) { #err(error) };
    //     };
    // };

};
