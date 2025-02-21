import Array "mo:base/Array";
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
import BTree "mo:stableheapbtreemap/BTree";

import SharedActivityShard "../SharedActivitySystem/SharedActivityShard";
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

    type Balance = Types.Balance;
    type Metadata = Types.Metadata;
    type ServiceLimit = Types.ServiceLimit;

    // Enum for shard types
    private type ShardType = {
        #Asset;
        #Storage;
        #SharedActivity;
    };

    private type ServiceOperation = {
        #Upload;
        #Share;
        #Delete;
    };

    private let icrcLedger : ICRC2.Service = actor (CanisterIDs.icrc_ledger_canister_id);
    private let identityManager = CanisterTypes.identityManager;

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

    private let MAX_SHARES : Nat = 200;
    private let MAX_UPLOADS : Nat = 50;
    private let MAX_DELETES : Nat = 25;

    private let TOKEN_PER_DATA_MB_PER_SECOND : Nat = 1; // 1 token per 1MB / Second

    private stable var assetShards : BTree.BTree<Text, Principal> = BTree.init<Text, Principal>(?8); // Asset Shards (Shard ID(asset-shard-0), Principal)
    private stable var dataStorageShards : BTree.BTree<Text, Principal> = BTree.init<Text, Principal>(?8); // Data Storage Shards (Shard ID(storage-shard-0), Principal)
    private stable var sharedActivityShards : BTree.BTree<Text, Principal> = BTree.init<Text, Principal>(?8); // Shared Activity Shards (Shard ID(shared-activity-shard-0), Principal)

    private stable var userAssetShardMap : BTree.BTree<Text, BTree.BTree<Text, ()>> = BTree.init<Text, BTree.BTree<Text, ()>>(?128); // User Asset Shards (User ID, Shard ID(asset-shard-0), ())
    private stable var userSharedActivityShardMap : BTree.BTree<Text, BTree.BTree<Text, ()>> = BTree.init<Text, BTree.BTree<Text, ()>>(?128); // User Shared Activity Shards (User ID, Shard ID(shared-activity-shard-0), ())
    private stable var principalTimerMap : BTree.BTree<Principal, Nat> = BTree.init<Principal, Nat>(?128); // Principal Timer Map (Principal, Timer)

    private stable var dataAssetShardWasmModule : [Nat8] = []; // Data Asset Shard Wasm Module (Wasm Module)
    private stable var dataStorageShardWasmModule : [Nat8] = []; // Data Storage Shard Wasm Module (Wasm Module)
    private stable var sharedActivityShardWasmModule : [Nat8] = []; // Shared Activity Shard Wasm Module (Wasm Module)

    private stable var subscriberMap : BTree.BTree<Principal, Types.Balance> = BTree.init<Principal, Types.Balance>(?128); // Subscriber Map (Principal, Balance (remaining tokens, stored dataMB, last Update Time))
    private stable var principalServiceLimitMap : BTree.BTree<Principal, ServiceLimit> = BTree.init<Principal, ServiceLimit>(?128); // Principal Service Limit Map (Principal, Service Limit)

    // ===============================
    // Core Asset Management Functions
    // ===============================
    // Main asset operations (upload, share, delete)
    public shared ({ caller }) func uploadDataAsset(asset : DataAsset) : async Result.Result<(UniqueAssetID, AssetShardPrincipal, StorageShardPrincipal), ErrorText> {

        let serviceLimit = getServiceLimit(caller);

        if (serviceLimit.usedUploads >= serviceLimit.maxUploads) {
            return #err("Upload limit reached" # " " # Nat.toText(serviceLimit.usedUploads) # " " # Nat.toText(serviceLimit.maxUploads));
        };

        let userIDResult = await getUserID(caller);

        switch (userIDResult) {

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

                                ignore updateServiceLimit(caller, #Upload);

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

                            case (#err(e), _) {

                                let revokeResult = await dataStorageShard.revokeAccess(updatedAsset.assetID);
                                switch (revokeResult) {
                                    case (#ok(_)) {
                                        decrementTotalAssetCount();
                                        return #err(e);
                                    };
                                    case (#err(e)) {
                                        // TODO: Retry the revoke operation
                                        return #err(e);
                                    };
                                };
                            };

                            case (_, #err(e)) {

                                let deleteResult = await assetShard.deleteDataAsset(userID, timestamp);
                                switch (deleteResult) {
                                    case (#ok(_)) {
                                        decrementTotalAssetCount();
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
                        decrementTotalAssetCount();
                        return #err(e);
                    };
                    case (_, #err(e)) {
                        decrementTotalAssetCount();
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
        let serviceLimit = getServiceLimit(caller);

        if (serviceLimit.usedShares >= serviceLimit.maxShares) {
            return #err("Share limit reached" # " " # Nat.toText(serviceLimit.usedShares) # " " # Nat.toText(serviceLimit.maxShares));
        };

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
                                                let newServiceLimit : ServiceLimit = {
                                                    serviceLimit with
                                                    usedShares = serviceLimit.usedShares + 1;
                                                };
                                                ignore BTree.insert(principalServiceLimitMap, Principal.compare, caller, newServiceLimit);
                                                #ok("Shared successfully");
                                            };
                                            case (#err(e), _, _) {
                                                #err("Failed to grant access: " # e);
                                            };
                                            case (_, #err(e), _) {
                                                #err("Failed to grant read permission: " # e);
                                            };
                                            case (_, _, #err(e)) {
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
                                    case (#err(e), _) {
                                        // TODO: Retry the delete operation
                                        #err("Failed to delete asset metadata: " # e);
                                    };
                                    case (_, #err(e)) {
                                        // TODO: Retry the delete operation
                                        #err("Failed to delete storage data: " # e);
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

    private func decrementTotalAssetCount() : () {
        totalAssetCount -= 1;
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
            #ok(canisterPrincipal);
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

    public shared ({ caller }) func updateWasmModule(shardType : ShardType, wasmModule : [Nat8]) : async Result.Result<(), Text> {
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

    // Storage operations
    public shared ({ caller }) func updateDataStorageUsedMap(principal : Principal, usedSpace : Int) : async Result.Result<Types.TimeRemaining, Text> {
        for ((_, shardPrincipal) in BTree.entries(dataStorageShards)) {
            if (Principal.equal(shardPrincipal, caller)) {

                let currentTime = Time.now();

                // Get or initialize subscriber balance
                let currentBalance = switch (BTree.get(subscriberMap, Principal.compare, principal)) {
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
                    tokensConsumed := (TOKEN_PER_DATA_MB_PER_SECOND) * (Int.abs(elapsedSeconds)) * currentBalance.dataMB;
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

                let remainingSeconds = Float.fromInt((updatedBalance.tokens) / ((TOKEN_PER_DATA_MB_PER_SECOND) * (updatedBalance.dataMB)));

                ignore BTree.insert(subscriberMap, Principal.compare, principal, updatedBalance);

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

    public shared query ({ caller }) func checkDataStorageUsedMap(principal : Principal, usedSpace : Int) : async Result.Result<Types.TimeRemaining, Text> {
        for ((_, shardPrincipal) in BTree.entries(dataStorageShards)) {
            if (Principal.equal(shardPrincipal, caller)) {
                let currentTime = Time.now();

                // Get or initialize subscriber balance
                let currentBalance = switch (BTree.get(subscriberMap, Principal.compare, principal)) {
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
                    tokensConsumed := (TOKEN_PER_DATA_MB_PER_SECOND) * (Int.abs(elapsedSeconds)) * currentBalance.dataMB;
                };

                // Calculate new data size in MB
                let newDataMB = usedSpace / 1_000_000; // Convert bytes to MB

                // Calculate hypothetical updated balance
                let hypotheticalBalance : Balance = {
                    tokens = currentBalance.tokens - Int.abs(tokensConsumed);
                    dataMB = Int.abs(newDataMB + currentBalance.dataMB);
                    lastUpdateTime = currentTime;
                };

                let remainingSeconds = Float.fromInt((hypotheticalBalance.tokens) / ((TOKEN_PER_DATA_MB_PER_SECOND) * (hypotheticalBalance.dataMB)));

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
    private func deleteAllDataForPrincipal(principal : Principal) : async () {
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

    // Balance management

    public shared query ({ caller }) func getTotalDataBalance(principalText : ?Text) : async Result.Result<Types.Balance, Text> {
        let principal = switch (principalText) {
            case (?text) { Principal.fromText(text) };
            case null { caller };
        };

        switch (BTree.get(subscriberMap, Principal.compare, principal)) {
            case (?balance) { #ok(balance) };
            case null { #err("Not a subscriber") };
        };
    };

    public shared query ({ caller }) func getRemainingStorageTime(principalText : ?Text) : async Result.Result<Types.TimeRemaining, Text> {
        let principal = switch (principalText) {
            case (?text) { Principal.fromText(text) };
            case null { caller };
        };

        switch (BTree.get(subscriberMap, Principal.compare, principal)) {
            case (?balance) {
                if (balance.tokens <= 0 or balance.dataMB <= 0) {
                    return #ok({
                        seconds = 0.0;
                        minutes = 0.0;
                        hours = 0.0;
                        days = 0.0;
                    });
                };

                let remainingSeconds = Float.fromInt(balance.tokens) / ((Float.fromInt(TOKEN_PER_DATA_MB_PER_SECOND)) * Float.fromInt(balance.dataMB));

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

        switch (BTree.get(subscriberMap, Principal.compare, caller)) {
            case (?balance) {
                let updatedBalance : Balance = {
                    tokens = balance.tokens + tokensToadd;
                    dataMB = balance.dataMB;
                    lastUpdateTime = balance.lastUpdateTime;
                };
                ignore BTree.insert(subscriberMap, Principal.compare, caller, updatedBalance);
                #ok("Successfully added tokens to balance");
            };
            case null {
                let newBalance : Balance = {
                    tokens = (tokensToadd);
                    dataMB = 0; // Initialize with 100MB
                    lastUpdateTime = Time.now();
                };
                ignore BTree.insert(subscriberMap, Principal.compare, caller, newBalance);
                #ok("Successfully added tokens to balance");
            };
        };
    };

    // ===============================
    // User & Access Management Functions
    // ===============================
    // User management

    private func getUserID(principal : Principal) : async Result.Result<Text, Text> {

        let identityResult = await identityManager.getIdentity(principal);

        switch (identityResult) {
            case (#ok((id, _))) { #ok(id) };
            case (#err(e)) { #err(e) };
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

    // Service limits
    private func getServiceLimit(principal : Principal) : ServiceLimit {
        switch (BTree.get(principalServiceLimitMap, Principal.compare, principal)) {
            case (?serviceLimit) { serviceLimit };
            case null {
                let newServiceLimit : ServiceLimit = {
                    maxShares = MAX_SHARES;
                    usedShares = 0;
                    maxUploads = MAX_UPLOADS;
                    usedUploads = 0;
                    maxDeletes = MAX_DELETES;
                    usedDeletes = 0;
                };
                ignore BTree.insert(principalServiceLimitMap, Principal.compare, principal, newServiceLimit);
                newServiceLimit;
            };
        };
    };

    private func updateServiceLimit(
        principal : Principal,
        operation : ServiceOperation,
    ) : async () {
        let serviceLimit = getServiceLimit(principal);

        let newServiceLimit = switch (operation) {
            case (#Upload) {
                { serviceLimit with usedUploads = serviceLimit.usedUploads + 1 };
            };
            case (#Share) {
                { serviceLimit with usedShares = serviceLimit.usedShares + 1 };
            };
            case (#Delete) {
                { serviceLimit with usedDeletes = serviceLimit.usedDeletes + 1 };
            };
        };

        ignore BTree.insert(principalServiceLimitMap, Principal.compare, principal, newServiceLimit);
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
