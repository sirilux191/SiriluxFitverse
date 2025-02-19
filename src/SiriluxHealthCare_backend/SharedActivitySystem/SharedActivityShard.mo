import Array "mo:base/Array";
import Result "mo:base/Result";
import Text "mo:base/Text";
import BTree "mo:stableheapbtreemap/BTree";

import Types "../Types";
actor class SharedActivityShard() {
    private var activityMap : BTree.BTree<Text, Types.sharedActivityInfo> = BTree.init<Text, Types.sharedActivityInfo>(null);
    private var userSharedMap : BTree.BTree<Text, [Text]> = BTree.init<Text, [Text]>(null);
    private var userReceivedMap : BTree.BTree<Text, [Text]> = BTree.init<Text, [Text]>(null);

    public shared func insertActivity(activity : Types.sharedActivityInfo) : async Result.Result<(), Text> {
        ignore BTree.insert(activityMap, Text.compare, activity.activityID, activity);

        let parts = Text.split(activity.assetID, #text("-"));
        switch (parts.next(), parts.next(), parts.next()) {
            case (?_, ?userID, ?_) {
                // Update userSharedMap
                switch (BTree.get(userSharedMap, Text.compare, userID)) {
                    case null {
                        ignore BTree.insert(userSharedMap, Text.compare, userID, [activity.activityID]);
                    };
                    case (?existingActivities) {
                        ignore BTree.insert(userSharedMap, Text.compare, userID, Array.append(existingActivities, [activity.activityID]));
                    };
                };
            };
            case _ {
                return #err("Invalid assetID format");
            };
        };

        // Update userReceivedMap
        switch (BTree.get(userReceivedMap, Text.compare, activity.usedSharedTo)) {
            case null {
                ignore BTree.insert(userReceivedMap, Text.compare, activity.usedSharedTo, [activity.activityID]);
            };
            case (?existingActivities) {
                ignore BTree.insert(userReceivedMap, Text.compare, activity.usedSharedTo, Array.append(existingActivities, [activity.activityID]));
            };
        };

        #ok(());
    };

    public shared query func getActivity(activityID : Text) : async Result.Result<Types.sharedActivityInfo, Text> {
        switch (BTree.get(activityMap, Text.compare, activityID)) {
            case (?activity) { #ok(activity) };
            case null { #err("Activity not found") };
        };
    };

    public shared query func getUserSharedActivities(userID : Text) : async Result.Result<[Types.sharedActivityInfo], Text> {
        switch (BTree.get(userSharedMap, Text.compare, userID)) {
            case (?activityIDs) {
                let activities = Array.mapFilter<Text, Types.sharedActivityInfo>(
                    activityIDs,
                    func(id) {
                        BTree.get(activityMap, Text.compare, id);
                    },
                );
                #ok(activities);
            };
            case null { #ok([]) };
        };
    };

    public shared query func getUserReceivedActivities(userID : Text) : async Result.Result<[Types.sharedActivityInfo], Text> {
        switch (BTree.get(userReceivedMap, Text.compare, userID)) {
            case (?activityIDs) {
                let activities = Array.mapFilter<Text, Types.sharedActivityInfo>(
                    activityIDs,
                    func(id) {
                        BTree.get(activityMap, Text.compare, id);
                    },
                );
                #ok(activities);
            };
            case null { #ok([]) };
        };
    };

    public shared func deleteActivitiesForAsset(assetID : Text) : async Result.Result<(), Text> {
        let parts = Text.split(assetID, #text("-"));
        switch (parts.next(), parts.next(), parts.next()) {
            case (?_, ?userID, ?_) {
                // Get activities shared by this user
                switch (BTree.get(userSharedMap, Text.compare, userID)) {
                    case (?activities) {
                        // Create buffers for activities to keep and delete
                        var activitiesToKeep : [Text] = [];
                        var activitiesToDelete : [Text] = [];

                        // Separate activities into keep and delete buffers
                        for (activityID in activities.vals()) {
                            switch (BTree.get(activityMap, Text.compare, activityID)) {
                                case (?activity) {
                                    if (activity.assetID == assetID) {
                                        activitiesToDelete := Array.append(activitiesToDelete, [activityID]);
                                    } else {
                                        activitiesToKeep := Array.append(activitiesToKeep, [activityID]);
                                    };
                                };
                                case null {
                                    activitiesToKeep := Array.append(activitiesToKeep, [activityID]);
                                };
                            };
                        };

                        // Update userSharedMap with activities to keep
                        ignore BTree.insert(userSharedMap, Text.compare, userID, activitiesToKeep);

                        // Process activities to delete
                        for (activityID in activitiesToDelete.vals()) {
                            switch (BTree.get(activityMap, Text.compare, activityID)) {
                                case (?activity) {
                                    // Remove from userReceivedMap
                                    switch (BTree.get(userReceivedMap, Text.compare, activity.usedSharedTo)) {
                                        case (?receivedActivities) {
                                            let updatedReceivedActivities = Array.filter<Text>(
                                                receivedActivities,
                                                func(id) { id != activityID },
                                            );
                                            ignore BTree.insert(userReceivedMap, Text.compare, activity.usedSharedTo, updatedReceivedActivities);
                                        };
                                        case null {};
                                    };

                                    // Remove from activityMap
                                    ignore BTree.delete(activityMap, Text.compare, activityID);
                                };
                                case null {};
                            };
                        };
                        #ok(());
                    };
                    case null { #ok(()) }; // No activities found for this user
                };
            };
            case _ { #err("Invalid asset ID format") };
        };
    };

    // Other necessary functions...
};
