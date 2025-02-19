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

import IdentityManager "../IdentityManager/IdentityManager";
import Types "../Types";
import CanisterIDs "../Types/CanisterIDs";
import Interface "../utility/ic-management-interface";
import SharedActivityShard "SharedActivityShard";

actor class SharedActivityService() {

    private stable var totalActivityCount : Nat = 0;
    private stable var shardCount : Nat = 0;
    private let ACTIVITIES_PER_SHARD : Nat = 2_000_000;

    private stable let shards : BTree.BTree<Text, Principal> = BTree.init<Text, Principal>(null);
    private stable var userShardMap : BTree.BTree<Text, [Text]> = BTree.init<Text, [Text]>(null);

    private stable var sharedActivityShardWasmModule : [Nat8] = [];

    private let IC = "aaaaa-aa";
    private let ic : Interface.Self = actor (IC);

    private let identityManager : IdentityManager.IdentityManager = actor (CanisterIDs.identityManagerCanisterID); // Replace with actual canister ID

    public shared func recordSharedActivity(assetID : Text, recipientID : Text, sharedType : Types.SharedType, senderID : Text) : async Result.Result<(), Text> {

        let activityIDResult = await getNextActivityID(senderID, recipientID);
        switch (activityIDResult) {
            case (#ok(activityID)) {
                let activity : Types.sharedActivityInfo = {
                    activityID = activityID;
                    assetID = assetID;
                    usedSharedTo = recipientID;
                    time = Int.abs(Time.now());
                    sharedType = sharedType;
                };

                let shardResult = await getShard(activityID);
                switch (shardResult) {
                    case (#ok(shard)) {
                        let result = await shard.insertActivity(activity);
                        switch (result) {
                            case (#ok(_)) {
                                #ok(());
                            };
                            case (#err(e)) { #err(e) };
                        };
                    };
                    case (#err(e)) { #err(e) };
                };
            };
            case (#err(e)) { #err("Error getting activity ID: " # e) };
        };

    };

    public shared ({ caller }) func getSharedActivities() : async Result.Result<[Types.sharedActivityInfo], Text> {
        let userIDResult = await identityManager.getIdentity(caller);
        switch (userIDResult) {
            case (#ok((userID, _))) {
                let userShardsResult = await getUserShards(userID);
                switch (userShardsResult) {
                    case (#ok(userShards)) {
                        var allActivities : [Types.sharedActivityInfo] = [];
                        for (shard in userShards.vals()) {
                            let activitiesResult = await shard.getUserSharedActivities(userID);
                            switch (activitiesResult) {
                                case (#ok(activities)) {
                                    allActivities := Array.append(allActivities, activities);
                                };
                                case (#err(_)) {}; // Skip if error
                            };
                        };
                        #ok(allActivities);
                    };
                    case (#err(e)) { #err("Error getting user shards: " # e) };
                };
            };
            case (#err(e)) { #err("Error getting user ID: " # e) };
        };
    };

    public shared ({ caller }) func getReceivedActivities() : async Result.Result<[Types.sharedActivityInfo], Text> {
        let userIDResult = await identityManager.getIdentity(caller);
        switch (userIDResult) {
            case (#ok((userID, _))) {
                let userShardsResult = await getUserShards(userID);
                switch (userShardsResult) {
                    case (#ok(userShards)) {
                        var allActivities : [Types.sharedActivityInfo] = [];
                        for (shard in userShards.vals()) {
                            let activitiesResult = await shard.getUserReceivedActivities(userID);
                            switch (activitiesResult) {
                                case (#ok(activities)) {
                                    allActivities := Array.append(allActivities, activities);
                                };
                                case (#err(_)) {}; // Skip if error
                            };
                        };
                        #ok(allActivities);
                    };
                    case (#err(e)) { #err("Error getting user shards: " # e) };
                };
            };
            case (#err(e)) { #err("Error getting user ID: " # e) };
        };
    };

    public shared func getSharedActivity(activityID : Text) : async Result.Result<Types.sharedActivityInfo, Text> {
        let shardResult = await getShard(activityID);
        switch (shardResult) {
            case (#ok(shard)) {
                await shard.getActivity(activityID);
            };
            case (#err(e)) { #err("Error getting shard: " # e) };
        };
    };

    public shared ({ caller }) func updateSharedActivityShardWasmModule(wasmModule : [Nat8]) : async Result.Result<Text, Text> {
        if (Principal.fromText(await identityManager.returnAdmin()) == (caller)) {
            // Call the updateWasmModule function of the FacilityShardManager
            let result = await updateWasmModule(wasmModule);

            switch (result) {
                case (#ok(())) {
                    #ok("()");
                };
                case (#err(e)) {
                    #err("Failed to update WASM module: " # e);
                };
            };
        } else {
            #err("You don't have permission to perform this action");
        };
    };

    public func getShard(activityID : Text) : async Result.Result<SharedActivityShard.SharedActivityShard, Text> {
        let shardID = getShardID(activityID);
        switch (BTree.get(shards, Text.compare, shardID)) {
            case (?principal) {
                #ok(actor (Principal.toText(principal)) : SharedActivityShard.SharedActivityShard);
            };
            case null {
                let newShardResult = await createShard();
                switch (newShardResult) {
                    case (#ok(newShardPrincipal)) {
                        ignore BTree.insert(shards, Text.compare, shardID, newShardPrincipal);
                        shardCount += 1;
                        #ok(actor (Principal.toText(newShardPrincipal)) : SharedActivityShard.SharedActivityShard);
                    };
                    case (#err(e)) {
                        #err(e);
                    };
                };
            };
        };
    };

    private func getShardID(activityID : Text) : Text {
        let activityNum = Nat.fromText(activityID);
        switch (activityNum) {
            case (?num) {
                let shardIndex = num / ACTIVITIES_PER_SHARD;
                "shard-" # Nat.toText(shardIndex + 1);
            };
            case null { "shard-0" }; // Default to first shard if invalid activity ID
        };
    };

    public func createShard() : async Result.Result<Principal, Text> {
        if (Array.size(sharedActivityShardWasmModule) == 0) {
            return #err("Wasm module not set. Please update the Wasm module first.");
        };

        try {
            let cycles = 1_000_000_000_000;
            Cycles.add<system>(cycles);
            let newCanister = await ic.create_canister({ settings = null });
            let canisterPrincipal = newCanister.canister_id;

            let _installResult = await ic.install_code({
                arg = [];
                wasm_module = sharedActivityShardWasmModule;
                mode = #install;
                canister_id = canisterPrincipal;
            });

            #ok(canisterPrincipal);

        } catch (e) {
            #err("Failed to create shard: " # Error.message(e));
        };
    };

    private func upgradeCodeOnShard(canisterPrincipal : Principal) : async Result.Result<(), Text> {
        try {
            await ic.install_code({
                arg = [];
                wasm_module = sharedActivityShardWasmModule;
                mode = #upgrade;
                canister_id = canisterPrincipal;
            });
            #ok(());
        } catch (e) {
            #err("Failed to upgrade code on shard: " # Error.message(e));
        };
    };

    // Function to update the WASM module
    public shared ({ caller }) func updateWasmModule(wasmModule : [Nat8]) : async Result.Result<(), Text> {

        if (not (await isAdmin(caller))) {
            return #err("You are not Admin, only admin can perform this action");
        };

        if (Array.size(wasmModule) < 8) {
            return #err("Invalid WASM module: too small");
        };

        sharedActivityShardWasmModule := wasmModule;
        #ok(());
    };

    public shared ({ caller }) func updateExistingShards() : async Result.Result<(), Text> {

        if (not (await isAdmin(caller))) {
            return #err("You are not Admin, only admin can perform this action");
        };

        if (Array.size(sharedActivityShardWasmModule) == 0) {
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
                case (#err(_)) {
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

    public func updateUserShardMap(userID : Text, activityID : Text) : async Result.Result<(), Text> {
        let shardID = getShardID(activityID);
        switch (BTree.get(userShardMap, Text.compare, userID)) {
            case (?shardIDs) {
                switch (Array.find<Text>(shardIDs, func(id) { id == shardID })) {
                    case (null) {
                        let updatedShardIDs = Array.append<Text>(shardIDs, [shardID]);
                        ignore BTree.insert(userShardMap, Text.compare, userID, updatedShardIDs);
                    };
                    case (_) {}; // Shard already exists, do nothing
                };
            };
            case null {
                ignore BTree.insert(userShardMap, Text.compare, userID, [shardID]);
            };
        };
        #ok(());
    };

    public func getUserShards(userID : Text) : async Result.Result<[SharedActivityShard.SharedActivityShard], Text> {
        switch (BTree.get(userShardMap, Text.compare, userID)) {
            case (?shardIDs) {
                let shardBuffer = Buffer.Buffer<SharedActivityShard.SharedActivityShard>(0);
                for (shardID in shardIDs.vals()) {
                    switch (BTree.get(shards, Text.compare, shardID)) {
                        case (?principal) {
                            shardBuffer.add(actor (Principal.toText(principal)) : SharedActivityShard.SharedActivityShard);
                        };
                        case null {
                            // Skip if shard not found
                        };
                    };
                };
                #ok(Buffer.toArray(shardBuffer));
            };
            case null {
                #err("No shards found for user ID: " # userID);
            };
        };
    };

    public func getNextActivityID(userID : Text, recipientID : Text) : async Result.Result<Text, Text> {
        totalActivityCount += 1;
        let activityID = Nat.toText(totalActivityCount);
        let updateResult = await updateUserShardMap(userID, activityID);
        let updateResult2 = await updateUserShardMap(recipientID, activityID);
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

    // Other necessary functions...

    public shared func isAdmin(caller : Principal) : async Bool {
        if (Principal.fromText(await identityManager.returnAdmin()) == (caller)) {
            true;
        } else {
            false;
        };
    };

    public shared func deleteActivitiesForAsset(assetID : Text) : async Result.Result<(), Text> {
        let parts = Text.split(assetID, #text("-"));
        switch (parts.next(), parts.next(), parts.next()) {
            case (?_assetNum, ?userID, ?_timestamp) {
                // Get user's shards from userShardMap
                switch (BTree.get(userShardMap, Text.compare, userID)) {
                    case (?userShards) {
                        var errorCount = 0;

                        // Iterate through user's shards only
                        for (shardID in userShards.vals()) {
                            switch (BTree.get(shards, Text.compare, shardID)) {
                                case (?principal) {
                                    let shard : SharedActivityShard.SharedActivityShard = actor (Principal.toText(principal));
                                    let result = await shard.deleteActivitiesForAsset(assetID);
                                    switch (result) {
                                        case (#err(_)) { errorCount += 1 };
                                        case (#ok(_)) {};
                                    };
                                };
                                case (null) { errorCount += 1 };
                            };
                        };

                        if (errorCount > 0) {
                            #err("Failed to delete activities in " # Nat.toText(errorCount) # " shards");
                        } else {
                            #ok(());
                        };
                    };
                    case (null) {
                        #err("No shards found for user ID: " # userID);
                    };
                };
            };
            case _ {
                #err("Invalid asset ID format");
            };
        };
    };

};
