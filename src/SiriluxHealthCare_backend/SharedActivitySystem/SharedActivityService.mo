import Array "mo:base/Array";
import Int "mo:base/Int";
import Principal "mo:base/Principal";
import Result "mo:base/Result";
import Text "mo:base/Text";
import Time "mo:base/Time";

import IdentityManager "../IdentityManager/IdentityManager";
import Types "../Types";
import CanisterIDs "../Types/CanisterIDs";
import SharedActivityShardManager "SharedActivityShardManager";

actor class SharedActivityService() {
    private let shardManager : SharedActivityShardManager.SharedActivityShardManager = actor (CanisterIDs.sharedActivityShardManagerCanisterID); // Replace with actual canister ID
    private let identityManager : IdentityManager.IdentityManager = actor (CanisterIDs.identityManagerCanisterID); // Replace with actual canister ID

    public shared func recordSharedActivity(caller : Principal, assetID : Text, recipientID : Text, sharedType : Types.SharedType) : async Result.Result<(), Text> {
        let senderIDResult = await identityManager.getIdentity(caller);
        switch (senderIDResult) {
            case (#ok((senderID, _))) {
                let activityIDResult = await shardManager.getNextActivityID(senderID);
                switch (activityIDResult) {
                    case (#ok(activityID)) {
                        let activity : Types.sharedActivityInfo = {
                            activityID = activityID;
                            assetID = assetID;
                            usedSharedTo = recipientID;
                            time = Int.abs(Time.now());
                            sharedType = sharedType;
                        };

                        let shardResult = await shardManager.getShard(activityID);
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
            case (#err(e)) { #err("Error getting sender ID: " # e) };
        };
    };

    public shared ({ caller }) func getSharedActivities() : async Result.Result<[Types.sharedActivityInfo], Text> {
        let userIDResult = await identityManager.getIdentity(caller);
        switch (userIDResult) {
            case (#ok((userID, _))) {
                let userShardsResult = await shardManager.getUserShards(userID);
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

    public shared func getReceivedActivities(caller : Principal) : async Result.Result<[Types.sharedActivityInfo], Text> {
        let userIDResult = await identityManager.getIdentity(caller);
        switch (userIDResult) {
            case (#ok((userID, _))) {
                let userShardsResult = await shardManager.getUserShards(userID);
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
        let shardResult = await shardManager.getShard(activityID);
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
            let result = await shardManager.updateWasmModule(caller, wasmModule);

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
};
