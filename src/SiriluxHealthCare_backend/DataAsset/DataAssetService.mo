import Array "mo:base/Array";
import Buffer "mo:base/Buffer";
import Error "mo:base/Error";
import Cycles "mo:base/ExperimentalCycles";
import Int "mo:base/Int";
import Nat "mo:base/Nat";
import Principal "mo:base/Principal";
import Result "mo:base/Result";
import Text "mo:base/Text";
import Time "mo:base/Time";
import BTree "mo:stableheapbtreemap/BTree";

import SharedActivityShard "../SharedActivitySystem/SharedActivityShard";
import SubscriptionManager "../Subscription/SubscriptionManager";
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

    type ErrorText = Text;
    type AssetShardPrincipal = Text;
    type UniqueAssetID = Text;
    type StorageShardPrincipal = Text;

    type Metadata = Types.Metadata;

    // Enum for shard types
    private type ShardType = {
        #Asset;
        #Storage;
        #SharedActivity;
    };

    private let identityManager = CanisterTypes.identityManager;
    private let subscriptionManager : SubscriptionManager.SubscriptionManager = actor (CanisterIDs.subscriptionManagerCanisterID);

    private let IC = "aaaaa-aa";
    private let ic : Interface.Self = actor (IC);

    private stable var totalAssetCount : Nat = 1;
    private stable var totalSharedActivityCount : Nat = 1;

    private stable var assetShardCount : Nat = 0;
    private stable var dataStorageShardCount : Nat = 0;
    private stable var sharedActivityShardCount : Nat = 0;

    private let ASSETS_PER_SHARD : Nat = 5_000;
    private let DATA_FILE_PER__SHARD : Nat = 1_000;
    private let SHARED_ACTIVITY_PER_SHARD : Nat = 5_000;

    private stable var assetShards : BTree.BTree<Text, Principal> = BTree.init<Text, Principal>(?8); // Asset Shards (Shard ID(asset-shard-0), Principal)
    private stable var dataStorageShards : BTree.BTree<Text, Principal> = BTree.init<Text, Principal>(?8); // Data Storage Shards (Shard ID(storage-shard-0), Principal)
    private stable var sharedActivityShards : BTree.BTree<Text, Principal> = BTree.init<Text, Principal>(?8); // Shared Activity Shards (Shard ID(shared-activity-shard-0), Principal)

    private stable var userAssetShardMap : BTree.BTree<Text, BTree.BTree<Text, ()>> = BTree.init<Text, BTree.BTree<Text, ()>>(?128); // User Asset Shards (User ID, Shard ID(asset-shard-0), ())
    private stable var userSharedActivityShardMap : BTree.BTree<Text, BTree.BTree<Text, ()>> = BTree.init<Text, BTree.BTree<Text, ()>>(?128); // User Shared Activity Shards (User ID, Shard ID(shared-activity-shard-0), ())

    private stable var dataAssetShardWasmModule : [Nat8] = []; // Data Asset Shard Wasm Module (Wasm Module)
    private stable var dataStorageShardWasmModule : [Nat8] = []; // Data Storage Shard Wasm Module (Wasm Module)
    private stable var sharedActivityShardWasmModule : [Nat8] = []; // Shared Activity Shard Wasm Module (Wasm Module)

    // ===============================
    // Core Asset Management Functions
    // ===============================
    // Main asset operations (upload, share, delete)
    public shared ({ caller }) func uploadDataAsset(asset : DataAsset) : async Result.Result<(UniqueAssetID, AssetShardPrincipal, StorageShardPrincipal), ErrorText> {

        let userIDResult = getUserID(caller);

        switch (await userIDResult) {

            case (#ok(userID)) {

                let assetNumNat = totalAssetCount;
                let assetNum = Nat.toText(assetNumNat);
                let timestamp = Int.toText(Time.now());

                incrementTotalAssetCount();

                // Get the asset shard and data storage shard [async-parallel]
                let assetShardResult = getAssetShard(assetNum);
                let dataStorageShardResult = getDataStorageShard(assetNum);

                switch (await assetShardResult, await dataStorageShardResult) {
                    case (#ok(assetShard), #ok(dataStorageShard)) {

                        let assetShardID = getAssetShardID(assetNum);
                        let assetShardPrincipal = switch (BTree.get(assetShards, Text.compare, assetShardID)) {
                            case (?principal) { Principal.toText(principal) };
                            case null {
                                return #err("Asset shard principal not found");
                            };
                        };

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
                            dataAssetShardPrincipal = assetShardPrincipal;
                            dataStorageShardPrincipal = storagePrincipal;
                        };

                        // Insert the asset and grant access [async-parallel]
                        let assetInsertResult = assetShard.insertDataAsset(userID, timestamp, updatedAsset, caller);
                        let dataStorageResult = dataStorageShard.grantAccess(caller, updatedAsset.assetID);

                        switch (await assetInsertResult, await dataStorageResult) {
                            case (#ok(insertDataAssetResult), #ok(_dataStorageAccessResult)) {

                                let shardID = getAssetShardID(assetNum);

                                switch (updateUserAssetShardMap(userID, shardID)) {
                                    case (#ok(_)) {
                                        #ok(insertDataAssetResult, assetShardPrincipal, storagePrincipal);
                                    };
                                    case (#err(e)) {
                                        // TODO: Retry the update operation
                                        return #err(e);
                                    };
                                };
                            };

                            case (#err(e), #ok(_)) {

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

                            case (#ok(_), #err(e)) {

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
                            case (#err(e), #err(_)) {
                                return #err(e);
                            };

                        };
                    };

                    case (#err(e), _) {

                        return #err(e);
                    };
                    case (_, #err(e)) {

                        return #err(e);
                    };
                };
            };
            case (#err(e)) {
                return #err("User not found: " # e);
            };

        };
    };

    public shared ({ caller }) func shareDataAsset(assetID : Text, recipientID : Text, hours : Nat) : async Result.Result<Text, Text> {

        let userIDResult = getUserID(caller);
        let recipientPrincipalResult = identityManager.getPrincipalByID(recipientID);

        switch (await userIDResult, await recipientPrincipalResult) {
            case (#ok(userID), #ok(recipientPrincipal)) {

                let parts = Text.split(assetID, #text("-"));

                switch (parts.next(), parts.next(), parts.next()) {
                    case (?assetNum, ?ownerID, ?_timestamp) {

                        if (userID != ownerID) {
                            return #err("Only the owner can share this asset");
                        };

                        // Get activity ID first
                        switch (getNextSharedActivityID(userID, recipientID)) {
                            case (#ok(activityID)) {
                                // Get all three shards in parallel
                                let assetShardResult = getAssetShard(assetNum);
                                let dataStorageShardResult = getDataStorageShard(assetNum);
                                let activityShardResult = getSharedActivityShard(activityID);

                                switch (await assetShardResult, await dataStorageShardResult, await activityShardResult) {
                                    case (#ok(assetShard), #ok(dataStorageShard), #ok(activityShard)) {
                                        let assetShardPrincipal = switch (BTree.get(assetShards, Text.compare, getAssetShardID(assetNum))) {
                                            case (?principal) {
                                                Principal.toText(principal);
                                            };
                                            case null {
                                                return #err("Asset shard principal not found");
                                            };
                                        };

                                        let activityShardPrincipal = switch (BTree.get(sharedActivityShards, Text.compare, getSharedActivityShardID(activityID))) {
                                            case (?principal) {
                                                Principal.toText(principal);
                                            };
                                            case null {
                                                return #err("Activity shard principal not found");
                                            };
                                        };

                                        // Create activity info
                                        let activity : Types.sharedActivityInfo = {
                                            activityID = activityID;
                                            assetID = assetID;
                                            usedSharedBy = userID;
                                            usedSharedTo = recipientID;
                                            sharedAt = Time.now();
                                            sharedTill = Time.now() + (hours * 60 * 60 * 1_000_000_000); // hours

                                            assetShardPrincipal = assetShardPrincipal;
                                            activityShardPrincipal = activityShardPrincipal;
                                        };

                                        // Perform all operations in parallel
                                        let grantResult = assetShard.grantAccess(assetID, recipientPrincipal, activity.sharedTill); // hours access
                                        let grantReadResult = dataStorageShard.grantReadPermission(assetID, recipientPrincipal, activity.sharedTill); // hours access
                                        let recordResult = activityShard.insertActivity(caller, recipientPrincipal, activity);

                                        switch (await grantResult, await grantReadResult, await recordResult) {
                                            case (#ok(_), #ok(_), #ok(_)) {

                                                #ok("Shared successfully");
                                            };
                                            case (#err(e), _, _) {
                                                // TODO: Retry the grant operation
                                                #err("Failed to grant access: " # e);
                                            };
                                            case (_, #err(e), _) {
                                                // TODO: Retry the grant read permission operation
                                                #err("Failed to grant read permission: " # e);
                                            };
                                            case (_, _, #err(e)) {
                                                // TODO: Retry the record shared activity operation
                                                #err("Failed to record shared activity: " # e);
                                            };

                                        };
                                    };
                                    case (#err(e), _, _) {
                                        #err("Failed to get asset shard: " # e);
                                    };
                                    case (_, #err(e), _) {
                                        #err("Failed to get storage shard: " # e);
                                    };
                                    case (_, _, #err(e)) {
                                        #err("Failed to get activity shard: " # e);
                                    };
                                };
                            };
                            case (#err(e)) {
                                #err("Failed to generate activity ID: " # e);
                            };
                        };
                    };
                    case _ { #err("Invalid asset ID format") };
                };
            };
            case (#err(e), _) { #err("Error getting caller ID: " # e) };
            case (_, #err(e)) {
                #err("Error getting recipient principal: " # e);
            };

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

                                let deleteResult = assetShard.deleteDataAsset(userID, timestamp);
                                let storageDeleteResult = dataStorageShard.deleteDataByPermittedPrincipal(assetID);

                                switch (await deleteResult, await storageDeleteResult) {
                                    case (#ok(_), #ok(_)) {
                                        #ok("Asset deleted successfully");
                                    };
                                    case (#err(e), #ok(_)) {
                                        // TODO: Retry the delete operation
                                        #err("Failed to delete asset metadata: " # e);
                                    };
                                    case (#ok(_), #err(e)) {
                                        // TODO: Retry the delete operation
                                        #err("Failed to delete storage data: " # e);
                                    };
                                    case (#err(e), #err(_)) {
                                        return #err(e);
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

    private func incrementTotalAssetCount() : () {
        totalAssetCount += 1;
    };

    // ===============================
    // Shard Management & Routing Functions
    // ===============================
    // Shard creation and initialization
    private func createShard(shardType : ShardType) : async Result.Result<Principal, Text> {
        let wasmModule = getWasmModule(shardType);
        if (Array.size(wasmModule) == 0) {
            return #err("Wasm module not set for " # getShardTypeString(shardType) # " shard. Please update the Wasm module first.");
        };

        try {
            let cycles = 10 ** 12;
            Cycles.add<system>(cycles);
            let newCanister = await ic.create_canister({ settings = null });
            let canisterPrincipal = newCanister.canister_id;

            let _installResult = await ic.install_code({
                arg = [];
                wasm_module = wasmModule;
                mode = #install;
                canister_id = canisterPrincipal;
            });

            await ic.start_canister({ canister_id = canisterPrincipal });
            let addAllDataServiceShardsResult = await subscriptionManager.addAllDataServiceShards(canisterPrincipal);
            switch (addAllDataServiceShardsResult) {
                case (#ok(_)) {
                    #ok(canisterPrincipal);
                };
                case (#err(e)) {
                    #err(e);
                };
            };

        } catch (e) {
            #err("Failed to create " # getShardTypeString(shardType) # " shard: " # Error.message(e));
        };
    };

    private func createAssetShard() : async Result.Result<Principal, Text> {
        await createShard(#Asset);
    };

    private func createDataStorageShard() : async Result.Result<Principal, Text> {
        await createShard(#Storage);
    };

    private func createSharedActivityShard() : async Result.Result<Principal, Text> {
        await createShard(#SharedActivity);
    };
    // Shard routing and access
    private func getAssetShard(assetNum : Text) : async Result.Result<DataAssetShard.DataAssetShard, Text> {
        let assetShardID = getAssetShardID(assetNum);
        switch (BTree.get(assetShards, Text.compare, assetShardID)) {
            case (?principal) {
                #ok(actor (Principal.toText(principal)) : DataAssetShard.DataAssetShard);
            };
            case null {
                let newAssetShardResult = await createAssetShard();
                switch (newAssetShardResult) {
                    case (#ok(newAssetShardPrincipal)) {
                        ignore BTree.insert(assetShards, Text.compare, assetShardID, newAssetShardPrincipal);
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

    private func getSharedActivityShard(activityID : Text) : async Result.Result<SharedActivityShard.SharedActivityShard, Text> {
        let shardID = getSharedActivityShardID(activityID);
        switch (BTree.get(sharedActivityShards, Text.compare, shardID)) {
            case (?principal) {
                #ok(actor (Principal.toText(principal)) : SharedActivityShard.SharedActivityShard);
            };
            case null {
                let newShardResult = await createSharedActivityShard();
                switch (newShardResult) {
                    case (#ok(newShardPrincipal)) {
                        ignore BTree.insert(sharedActivityShards, Text.compare, shardID, newShardPrincipal);
                        sharedActivityShardCount += 1;
                        #ok(actor (Principal.toText(newShardPrincipal)) : SharedActivityShard.SharedActivityShard);
                    };
                    case (#err(e)) {
                        #err(e);
                    };
                };
            };
        };
    };
    // Shard ID management
    private func getShardID(num : Text, shardType : { #Asset; #Storage; #Activity }) : Text {
        let (prefix, itemsPerShard) = switch (shardType) {
            case (#Asset) ("asset-shard-", ASSETS_PER_SHARD);
            case (#Storage) ("storage-shard-", DATA_FILE_PER__SHARD);
            case (#Activity) ("shared-activity-shard-", SHARED_ACTIVITY_PER_SHARD);
        };

        switch (Nat.fromText(num)) {
            case (?n) {
                let shardIndex = n / itemsPerShard;
                prefix # Nat.toText(shardIndex + 1);
            };
            case null { prefix # "0" };
        };
    };

    private func getAssetShardID(assetNum : Text) : Text {
        getShardID(assetNum, #Asset);
    };

    private func getDataStorageShardID(assetNum : Text) : Text {
        getShardID(assetNum, #Storage);
    };

    private func getSharedActivityShardID(activityID : Text) : Text {
        getShardID(activityID, #Activity);
    };
    // Shard code management
    private func upgradeCodeOnShard(shardType : ShardType, canisterPrincipal : Principal) : async Result.Result<(), Text> {
        let wasmModule = getWasmModule(shardType);
        try {
            await ic.install_code({
                arg = [];
                wasm_module = wasmModule;
                mode = #upgrade;
                canister_id = canisterPrincipal;
            });
            #ok(());
        } catch (e) {
            #err("Failed to upgrade code on " # getShardTypeString(shardType) # " shard: " # Error.message(e));
        };
    };

    public shared ({ caller }) func updateExistingShards(shardType : ShardType) : async Result.Result<(), Text> {
        if (not (await isAdmin(caller))) {
            return #err("You are not Admin, only admin can perform this action");
        };

        let wasmModule = getWasmModule(shardType);
        if (Array.size(wasmModule) == 0) {
            return #err("Wasm module not set for " # getShardTypeString(shardType) # " shard. Please update the Wasm module first.");
        };

        var updatedCount = 0;
        var errorCount = 0;
        let shardMap = switch (shardType) {
            case (#Asset) { assetShards };
            case (#Storage) { dataStorageShards };
            case (#SharedActivity) { sharedActivityShards };
        };

        for ((shardID, principal) in BTree.entries(shardMap)) {
            let installResult = await upgradeCodeOnShard(shardType, principal);
            switch (installResult) {
                case (#ok(())) { updatedCount += 1 };
                case (#err(_)) { errorCount += 1 };
            };
        };

        if (errorCount > 0) {
            #err("Updated " # Nat.toText(updatedCount) # " shards, but encountered errors in " # Nat.toText(errorCount) # " shards");
        } else {
            #ok(());
        };
    };

    public shared ({ caller }) func updateDataAssetWasmModule(shardType : ShardType, wasmModule : [Nat8]) : async Result.Result<(), Text> {
        if (not (await isAdmin(caller))) {
            return #err("You are not Admin, only admin can perform this action");
        };

        if (Array.size(wasmModule) < 8) {
            return #err("Invalid WASM module: too small");
        };

        switch (shardType) {
            case (#Asset) { dataAssetShardWasmModule := wasmModule };
            case (#Storage) { dataStorageShardWasmModule := wasmModule };
            case (#SharedActivity) {
                sharedActivityShardWasmModule := wasmModule;
            };
        };
        #ok(());
    };

    // ===============================
    // Storage & Data Management Functions
    // ===============================
    private func deleteDataAssetInternal(assetID : Text, caller : Principal) : async Result.Result<Text, Text> {

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

                                let deleteResult = assetShard.deleteDataAsset(userID, timestamp);
                                let storageDeleteResult = dataStorageShard.deleteDataByPermittedPrincipal(assetID);

                                switch (await deleteResult, await storageDeleteResult) {
                                    case (#ok(_), #ok(_)) {
                                        #ok("Asset deleted successfully");
                                    };
                                    case (#err(e), #ok(_)) {
                                        // TODO: Retry the delete operation
                                        #err("Failed to delete asset metadata: " # e);
                                    };
                                    case (#ok(_), #err(e)) {
                                        // TODO: Retry the delete operation
                                        #err("Failed to delete storage data: " # e);
                                    };
                                    case (#err(e), #err(_)) {
                                        return #err(e);
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

    // Storage operations
    public shared ({ caller }) func deleteAllDataForPrincipal(principal : Principal) : async Result.Result<(), Text> {
        if (not (await isPrincipalPermitted(caller))) {
            return #err("You are not permitted to perform this action");
        };
        // Get user ID from principal
        let userIDResult = await getUserID(principal);
        switch (userIDResult) {
            case (#ok(userID)) {
                // Get all shards associated with the user
                let assetShardsResult = getUserAssetShards(userID);
                switch (assetShardsResult) {
                    case (#ok(userAssetShards)) {
                        for (assetShard in userAssetShards.vals()) {
                            // Get all assets for user from each shard
                            let assetsResult = await assetShard.getUserDataAssetsByService(userID);
                            switch (assetsResult) {
                                case (#ok(assets)) {
                                    // Delete each asset
                                    for ((_, asset) in assets.vals()) {
                                        ignore await deleteDataAssetInternal(asset.assetID, principal);
                                    };
                                };
                                case (#err(_)) {
                                    /* Continue to next shard if error */
                                };
                            };
                        };
                        #ok(());
                    };
                    case (#err(_)) {
                        #err("Error getting shards");
                    };
                };
            };
            case (#err(_)) {
                #err("Error getting user ID");
            };
        };
    };

    // ===============================
    // User & Access Management Functions
    // ===============================
    // User management

    private func getUserID(principal : Principal) : async Result.Result<Text, Text> {

        let identityResult = await identityManager.getIdentity(?principal);

        switch (identityResult) {
            case (#ok((id, _))) { #ok(id) };
            case (#err(e)) { #err(e) };
        };

    };

    private func isPrincipalPermitted(principal : Principal) : async Bool {
        if (Principal.fromText(CanisterIDs.subscriptionManagerCanisterID) == (principal)) {
            true;
        } else {
            false;
        };
    };

    private func isAdmin(caller : Principal) : async Bool {
        if (Principal.fromText(await identityManager.returnAdmin()) == (caller)) {
            true;
        } else {
            false;
        };
    };

    // User-shard mapping
    private func updateUserShardMap(
        userID : Text,
        shardID : Text,
        mapType : { #Asset; #Activity },
    ) : Result.Result<Text, Text> {
        let targetMap = switch (mapType) {
            case (#Asset) userAssetShardMap;
            case (#Activity) userSharedActivityShardMap;
        };

        switch (BTree.get(targetMap, Text.compare, userID)) {
            case null {
                let newMap = BTree.init<Text, ()>(?128);
                ignore BTree.insert(newMap, Text.compare, shardID, ());
                ignore BTree.insert(targetMap, Text.compare, userID, newMap);
            };
            case (?existingMap) {
                ignore BTree.insert(existingMap, Text.compare, shardID, ());
            };
        };
        #ok("User shard map updated successfully");
    };

    private func updateUserAssetShardMap(userID : Text, shardID : Text) : Result.Result<Text, Text> {
        updateUserShardMap(userID, shardID, #Asset);
    };

    private func updateUserSharedActivityShardMap(userID : Text, activityID : Text) : Result.Result<(), Text> {
        let shardID = getSharedActivityShardID(activityID);
        switch (updateUserShardMap(userID, shardID, #Activity)) {
            case (#ok(_)) #ok(());
            case (#err(e)) #err(e);
        };
    };

    private func getUserAssetShards(userID : Text) : Result.Result<[DataAssetShard.DataAssetShard], Text> {
        switch (BTree.get(userAssetShardMap, Text.compare, userID)) {
            case null { #err("No shards found for user") };
            case (?shardIDs) {
                let shardActors = Buffer.Buffer<DataAssetShard.DataAssetShard>(0);
                for ((shardID, _) in BTree.entries(shardIDs)) {
                    switch (BTree.get(assetShards, Text.compare, shardID)) {
                        case (?principal) {
                            shardActors.add(actor (Principal.toText(principal)) : DataAssetShard.DataAssetShard);
                        };
                        case null {
                            /* Skip if shard not found */
                        };
                    };
                };
                #ok(Buffer.toArray(shardActors));
            };
        };
    };

    public query func getUserAssetShardsPrincipal(userID : Text) : async Result.Result<[Principal], Text> {
        switch (BTree.get(userAssetShardMap, Text.compare, userID)) {
            case null { #err("No shards found for user") };
            case (?shardIDs) {
                let shardPrincipal = Buffer.Buffer<Principal>(0);
                for ((shardID, _) in BTree.entries(shardIDs)) {
                    switch (BTree.get(assetShards, Text.compare, shardID)) {
                        case (?principal) { shardPrincipal.add(principal) };
                        case null {
                            /* Skip if shard not found */
                        };
                    };

                };
                #ok(Buffer.toArray(shardPrincipal));
            };
        };
    };

    public query func getUserSharedActivityShardsPrincipal(userID : Text) : async Result.Result<[Principal], Text> {
        switch (BTree.get(userSharedActivityShardMap, Text.compare, userID)) {
            case null { #err("No shards found for user") };
            case (?shardIDs) {
                let shardPrincipal = Buffer.Buffer<Principal>(0);
                for ((shardID, _) in BTree.entries(shardIDs)) {
                    switch (BTree.get(sharedActivityShards, Text.compare, shardID)) {
                        case (?principal) { shardPrincipal.add(principal) };
                        case null {
                            /* Skip if shard not found */
                        };
                    };
                };
                #ok(Buffer.toArray(shardPrincipal));
            };
        };
    };

    // ===============================
    // Activity Management Functions
    // ===============================

    // Activity operations

    private func getNextSharedActivityID(userID : Text, recipientID : Text) : Result.Result<Text, Text> {
        totalSharedActivityCount += 1;
        let activityID = Nat.toText(totalSharedActivityCount);
        let updateResult = updateUserSharedActivityShardMap(userID, activityID);
        let updateResult2 = updateUserSharedActivityShardMap(recipientID, activityID);
        switch (updateResult, updateResult2) {
            case (#ok(_), #ok(_)) {
                #ok(activityID);
            };
            case (#err(e), _) {
                #err("Failed to update user shard map: " # e);
            };
            case (_, #err(e)) {
                #err("Failed to update recipient shard map: " # e);
            };
        };
    };

    // ===============================
    // Utility Functions
    // ===============================

    private func getWasmModule(shardType : ShardType) : [Nat8] {
        switch (shardType) {
            case (#Asset) { dataAssetShardWasmModule };
            case (#Storage) { dataStorageShardWasmModule };
            case (#SharedActivity) { sharedActivityShardWasmModule };
        };
    };

    private func getShardTypeString(shardType : ShardType) : Text {
        switch (shardType) {
            case (#Asset) { "asset" };
            case (#Storage) { "storage" };
            case (#SharedActivity) { "shared-activity" };
        };
    };

};
