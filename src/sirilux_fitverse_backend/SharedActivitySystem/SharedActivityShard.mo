import Array "mo:base/Array";
import Principal "mo:base/Principal";
import Result "mo:base/Result";
import Text "mo:base/Text";
import BTree "mo:stableheapbtreemap/BTree";

import Types "../Types";
import CanisterIDs "../Types/CanisterIDs";
actor class SharedActivityShard() {

    private stable var activityMap : BTree.BTree<Text, Types.sharedActivityInfo> = BTree.init<Text, Types.sharedActivityInfo>(null);
    private stable var userSharedMap : BTree.BTree<Text, BTree.BTree<Text, ()>> = BTree.init<Text, BTree.BTree<Text, ()>>(null);
    private stable var userReceivedMap : BTree.BTree<Text, BTree.BTree<Text, ()>> = BTree.init<Text, BTree.BTree<Text, ()>>(null);
    private stable var callerPrincipalUserIDMap = BTree.init<Principal, Text>(?24); // CallerPrincipalUserIDMap is a BTree of caller principal to userID

    // List of permitted principals (e.g., DataAssetService)
    private stable var permittedPrincipals : [Principal] = [Principal.fromText(CanisterIDs.dataAssetCanisterID)]; // Add permitted principals here

    public shared ({ caller }) func insertActivity(userPrincipal : Principal, recipientPrincipal : Principal, activity : Types.sharedActivityInfo) : async Result.Result<(), Text> {

        if (not isPermitted(caller)) {
            return #err("You are not permitted to perform this operation");
        };

        ignore BTree.insert(activityMap, Text.compare, activity.activityID, activity);

        // Update userSharedMap
        switch (BTree.get(userSharedMap, Text.compare, activity.usedSharedBy)) {
            case null {
                let newMap = BTree.init<Text, ()>(null);
                ignore BTree.insert(newMap, Text.compare, activity.activityID, ());
                ignore BTree.insert(userSharedMap, Text.compare, activity.usedSharedBy, newMap);
            };
            case (?existingActivities) {
                ignore BTree.insert(existingActivities, Text.compare, activity.activityID, ());
            };
        };

        ignore BTree.insert(callerPrincipalUserIDMap, Principal.compare, userPrincipal, activity.usedSharedBy);

        // Update userReceivedMap
        switch (BTree.get(userReceivedMap, Text.compare, activity.usedSharedTo)) {
            case null {
                let newMap = BTree.init<Text, ()>(null);
                ignore BTree.insert(newMap, Text.compare, activity.activityID, ());
                ignore BTree.insert(userReceivedMap, Text.compare, activity.usedSharedTo, newMap);
            };
            case (?existingActivities) {
                ignore BTree.insert(existingActivities, Text.compare, activity.activityID, ());
            };
        };

        ignore BTree.insert(callerPrincipalUserIDMap, Principal.compare, recipientPrincipal, activity.usedSharedTo);

        #ok(());
    };

    public shared query ({ caller }) func getActivity(activityID : Text) : async Result.Result<Types.sharedActivityInfo, Text> {

        let userID = getUserID(caller);

        switch (BTree.get(activityMap, Text.compare, activityID)) {
            case (?activity) {
                if (activity.usedSharedTo == userID or activity.usedSharedBy == userID) {
                    #ok(activity);
                } else {
                    #err("You are not permitted to access this activity");
                };
            };
            case null { #err("Activity not found") };
        };
    };

    public shared query ({ caller }) func getUserSharedActivities() : async Result.Result<[Types.sharedActivityInfo], Text> {
        let userID = getUserID(caller);

        switch (BTree.get(userSharedMap, Text.compare, userID)) {
            case (?activityIDs) {
                var activities : [Types.sharedActivityInfo] = [];
                for ((activityID, _) in BTree.entries(activityIDs)) {
                    let activity = BTree.get(activityMap, Text.compare, activityID);
                    switch (activity) {
                        case (?activity) {
                            activities := Array.append(activities, [activity]);
                        };
                        case null {};
                    };
                };
                #ok(activities);
            };
            case null { #ok([]) };
        };
    };

    public shared query ({ caller }) func getUserReceivedActivities() : async Result.Result<[Types.sharedActivityInfo], Text> {
        let userID = getUserID(caller);

        switch (BTree.get(userReceivedMap, Text.compare, userID)) {
            case (?activityIDs) {
                var activities : [Types.sharedActivityInfo] = [];
                for ((activityID, _) in BTree.entries(activityIDs)) {
                    let activity = BTree.get(activityMap, Text.compare, activityID);
                    switch (activity) {
                        case (?activity) {
                            activities := Array.append(activities, [activity]);
                        };
                        case null {};
                    };
                };
                #ok(activities);
            };
            case null { #ok([]) };
        };
    };

    // Helper functions to check if caller is permitted to perform an operation

    private func getUserID(caller : Principal) : Text {
        switch (BTree.get(callerPrincipalUserIDMap, Principal.compare, caller)) {
            case (?userID) { userID };
            case null { return "" };
        };
    };

    private func isPermitted(caller : Principal) : Bool {
        Array.find<Principal>(permittedPrincipals, func(p) { p == caller }) != null;
    };

    public shared ({ caller }) func addPermittedPrincipal(principal : Principal) : async Result.Result<(), Text> {
        if (not isPermitted(caller)) {
            return #err("You are not permitted to perform this operation");
        };
        permittedPrincipals := Array.append(permittedPrincipals, [principal]);
        #ok(());
    };

    public shared ({ caller }) func removePermittedPrincipal(principal : Principal) : async Result.Result<(), Text> {
        if (not isPermitted(caller)) {
            return #err("You are not permitted to perform this operation");
        };
        permittedPrincipals := Array.filter(permittedPrincipals, func(p : Principal) : Bool { p != principal });
        #ok(());
    };
};
