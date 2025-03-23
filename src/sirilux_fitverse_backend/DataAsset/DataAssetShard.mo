import Array "mo:base/Array";
import Blob "mo:base/Blob";
import Buffer "mo:base/Buffer";
import Principal "mo:base/Principal";
import Result "mo:base/Result";
import Text "mo:base/Text";
import Time "mo:base/Time";
import BTree "mo:stableheapbtreemap/BTree";

import Types "../Types";
import CanisterIDs "../Types/CanisterIDs";
import CanisterTypes "../Types/CanisterTypes";
import Hex "../utility/Hex";

actor class DataAssetShard() {

    let vetkd_system_api = CanisterTypes.vetkd_system_api;

    private stable var dataAssetStorageMap = BTree.init<Text, BTree.BTree<Text, Types.DataAsset>>(?24); // DataAssetStorage is a BTree of userID to a BTree of created timestamp to a DataAsset
    private stable var data_AssetID_AccessPrincipal_Map = BTree.init<Text, BTree.BTree<Principal, ?Time.Time>>(?24); // DataAssetID_AccessPrincipal_Map is a BTree of assetID to a BTree of principals with access timestamp
    private stable var data_AccessPrincipal_AssetID_Map = BTree.init<Principal, BTree.BTree<Text, ?Time.Time>>(?24); // DataAccessPrincipal_AssetID_Map is a BTree of principal to a BTree of assetIDs with access timestamp
    private stable var callerPrincipalUserIDMap = BTree.init<Principal, Text>(?24); // CallerPrincipalUserIDMap is a BTree of caller principal to userID

    // List of permitted principals (e.g., DataAssetService)
    private stable var permittedPrincipals : [Principal] = [Principal.fromText(CanisterIDs.dataAssetCanisterID)]; // Add permitted principals here

    public shared ({ caller }) func insertDataAsset(userID : Text, timestamp : Text, asset : Types.DataAsset, userPrincipal : Principal) : async Result.Result<Text, Text> {
        if (not isPermitted(caller)) {
            return #err("You are not permitted to perform this operation");
        };

        switch (BTree.get(dataAssetStorageMap, Text.compare, userID)) {
            case null {

                let newTree = BTree.init<Text, Types.DataAsset>(null);

                ignore BTree.insert(newTree, Text.compare, timestamp, asset);
                ignore BTree.insert(dataAssetStorageMap, Text.compare, userID, newTree);
            };
            case (?existingTree) {
                ignore BTree.insert(existingTree, Text.compare, timestamp, asset);

            };
        };

        ignore BTree.insert(callerPrincipalUserIDMap, Principal.compare, userPrincipal, userID);

        // Update dataAssetID_AccessPrincipal_Map

        switch (BTree.get(data_AssetID_AccessPrincipal_Map, Text.compare, asset.assetID)) {
            case null {
                let newTree = BTree.init<Principal, ?Time.Time>(null);
                ignore BTree.insert(newTree, Principal.compare, userPrincipal, null);
                ignore BTree.insert(data_AssetID_AccessPrincipal_Map, Text.compare, asset.assetID, newTree);
            };
            case (?principalTree) {
                ignore BTree.insert(principalTree, Principal.compare, userPrincipal, null);
            };
        };

        // Update dataAccessPrincipal_AssetID_Map

        switch (BTree.get(data_AccessPrincipal_AssetID_Map, Principal.compare, userPrincipal)) {
            case null {
                let newTree = BTree.init<Text, ?Time.Time>(null);
                ignore BTree.insert(newTree, Text.compare, asset.assetID, null);
                ignore BTree.insert(data_AccessPrincipal_AssetID_Map, Principal.compare, userPrincipal, newTree);
            };
            case (?assetTree) {
                ignore BTree.insert(assetTree, Text.compare, asset.assetID, null);
            };
        };
        #ok(asset.assetID);
    };

    public shared query ({ caller }) func getDataAsset(assetID : Text) : async Result.Result<Types.DataAsset, Text> {
        switch (hasAccess(caller, assetID)) {
            case (#ok(true)) {
                let parts = Text.split(assetID, #text("-"));
                switch (parts.next(), parts.next(), parts.next()) {
                    case (?_assetNum, ?userID, ?timestamp) {
                        switch (BTree.get(dataAssetStorageMap, Text.compare, userID)) {
                            case null { #err("User not found") };
                            case (?userAssets) {
                                switch (BTree.get(userAssets, Text.compare, timestamp)) {
                                    case null { #err("Data asset not found") };
                                    case (?asset) { #ok(asset) };
                                };
                            };
                        };
                    };
                    case (_) {
                        #err("Invalid asset ID");
                    };
                };
            };
            case (#ok(false)) {
                #err("Access denied: Unknown error");
            };
            case (#err(msg)) {
                #err(msg);
            };
        };
    };

    public shared query ({ caller }) func getUserDataAssets() : async Result.Result<[(Text, Types.DataAsset)], Text> {

        let userID = switch (BTree.get(callerPrincipalUserIDMap, Principal.compare, caller)) {
            case null { return #err("User not found") };
            case (?userID) { userID };
        };

        switch (BTree.get(dataAssetStorageMap, Text.compare, userID)) {
            case null { #err("User not found") };
            case (?userAssets) {
                let assets = Buffer.Buffer<(Text, Types.DataAsset)>(0);
                for ((timestamp, asset) in BTree.entries(userAssets)) {
                    assets.add((timestamp, asset));
                };
                #ok(Buffer.toArray(assets));
            };
        };
    };

    public shared query ({ caller }) func getUserDataAssetsByService(userID : Text) : async Result.Result<[(Text, Types.DataAsset)], Text> {
        if (not isPermitted(caller)) {
            return #err("You are not permitted to perform this operation");
        };

        switch (BTree.get(dataAssetStorageMap, Text.compare, userID)) {
            case null { #err("User not found") };
            case (?userAssets) {
                let assets = Buffer.Buffer<(Text, Types.DataAsset)>(0);
                for ((timestamp, asset) in BTree.entries(userAssets)) {
                    assets.add((timestamp, asset));
                };
                #ok(Buffer.toArray(assets));
            };
        };

    };

    public shared ({ caller }) func updateDataAsset(timestamp : Text, metadata : Types.Metadata) : async Result.Result<Text, Text> {

        let userID = getUserID(caller);

        switch (BTree.get(dataAssetStorageMap, Text.compare, userID)) {
            case null { #err("User have no assets") };
            case (?userAssets) {
                switch (BTree.get(userAssets, Text.compare, timestamp)) {
                    case null { #err("Data asset not found") };
                    case (?asset) {
                        let newupdatedAsset = {
                            asset with
                            metadata = metadata;
                        };
                        ignore BTree.insert(userAssets, Text.compare, timestamp, newupdatedAsset);
                        #ok("Asset updated successfully");
                    };
                };

            };
        };

    };

    public shared ({ caller }) func deleteDataAsset(userID : Text, timestamp : Text) : async Result.Result<(), Text> {
        if (not isPermitted(caller)) {
            return #err("You are not permitted to perform this operation");
        };

        switch (BTree.get(dataAssetStorageMap, Text.compare, userID)) {
            case null {
                #err("User not found");
            };
            case (?userAssets) {
                // Get the asset before deleting it to access its assetID
                switch (BTree.get(userAssets, Text.compare, timestamp)) {
                    case null { #err("Data asset not found") };
                    case (?asset) {
                        let assetID = asset.assetID;

                        // Remove from dataAccessTP
                        switch (BTree.get(data_AssetID_AccessPrincipal_Map, Text.compare, assetID)) {
                            case (?principalTree) {
                                // Get all principals with access before deleting
                                let principals = BTree.toKeyArray(principalTree);

                                // Remove access for each principal
                                for (principal in principals.vals()) {
                                    switch (BTree.get(data_AccessPrincipal_AssetID_Map, Principal.compare, principal)) {
                                        case (?assetTree) {
                                            ignore BTree.delete(assetTree, Text.compare, assetID);
                                        };
                                        case null {};
                                    };
                                };

                                // Delete the entire asset entry from dataAccessTP
                                ignore BTree.delete(data_AssetID_AccessPrincipal_Map, Text.compare, assetID);
                            };
                            case null {};
                        };

                        // Delete the asset from storage
                        ignore BTree.delete(userAssets, Text.compare, timestamp);
                        #ok(());
                    };
                };
            };
        };
    };

    public shared ({ caller }) func grantAccess(assetID : Text, userPrincipal : Principal, timestamp : Time.Time) : async Result.Result<(), Text> {
        if (not isPermitted(caller)) {
            return #err("You are not permitted to perform this operation");
        };

        // Update dataAccessTP
        switch (BTree.get(data_AssetID_AccessPrincipal_Map, Text.compare, assetID)) {
            case null {
                let newTree = BTree.init<Principal, ?Time.Time>(null);
                ignore BTree.insert(newTree, Principal.compare, userPrincipal, ?timestamp);
                ignore BTree.insert(data_AssetID_AccessPrincipal_Map, Text.compare, assetID, newTree);
            };
            case (?principalTree) {
                ignore BTree.insert(principalTree, Principal.compare, userPrincipal, ?timestamp);
            };
        };

        // Update dataAccessPT
        switch (BTree.get(data_AccessPrincipal_AssetID_Map, Principal.compare, userPrincipal)) {
            case null {
                let newTree = BTree.init<Text, ?Time.Time>(null);
                ignore BTree.insert(newTree, Text.compare, assetID, ?timestamp);
                ignore BTree.insert(data_AccessPrincipal_AssetID_Map, Principal.compare, userPrincipal, newTree);
            };
            case (?assetTree) {
                ignore BTree.insert(assetTree, Text.compare, assetID, ?timestamp);
            };
        };

        #ok(());
    };

    public shared ({ caller }) func revokeAccess(assetID : Text, userPrincipal : Principal) : async Result.Result<(), Text> {
        if (not isPermitted(caller)) {
            return #err("You are not permitted to perform this operation");
        };

        // Update dataAccessTP
        switch (BTree.get(data_AssetID_AccessPrincipal_Map, Text.compare, assetID)) {
            case null { /* Do nothing */ };
            case (?principalTree) {
                ignore BTree.delete(principalTree, Principal.compare, userPrincipal);
            };
        };

        // Update dataAccessPT
        switch (BTree.get(data_AccessPrincipal_AssetID_Map, Principal.compare, userPrincipal)) {
            case null { /* Do nothing */ };
            case (?assetTree) {
                ignore BTree.delete(assetTree, Text.compare, assetID);
            };
        };

        #ok(());
    };

    // Helper function to check if a user has access to a specific asset
    private func hasAccess(accessRequestingPrincipal : Principal, assetID : Text) : Result.Result<Bool, Text> {
        switch (BTree.get(data_AssetID_AccessPrincipal_Map, Text.compare, assetID)) {
            case (?principalTree) {
                switch (BTree.get(principalTree, Principal.compare, accessRequestingPrincipal)) {
                    case (?timestamp) {
                        let currentTime = Time.now();
                        switch (timestamp) {
                            case (?t) {
                                if (currentTime >= t) {
                                    #err("Access denied: Access time has expired");
                                } else {
                                    #ok(true);
                                };
                            };
                            case null {
                                // Permanent access granted
                                #ok(true);
                            };
                        };
                    };
                    case null {
                        #err("Access denied: Principal not found in access list for this asset");
                    };
                };
            };
            case null {
                #err("Access denied: Asset ID not found in access mapping");
            };
        };
    };

    public func getSymmetricKeyVerificationKey() : async Text {

        let { public_key } = await vetkd_system_api.vetkd_public_key({
            canister_id = null;
            derivation_path = Array.make(Text.encodeUtf8("symmetric_key"));
            key_id = { curve = #bls12_381; name = "test_key_1" };
        });
        Hex.encode(Blob.toArray(public_key));

    };

    public shared ({ caller }) func encrypted_symmetric_key_for_asset(assetID : Text, encryption_public_key : Blob) : async Result.Result<Text, Text> {
        switch (hasAccess(caller, assetID)) {
            case (#err(msg)) { #err(msg) };
            case (#ok(false)) { #err("Access denied: Unknown error") };
            case (#ok(true)) {
                let buf = Buffer.Buffer<Nat8>(32);
                buf.append(Buffer.fromArray(Blob.toArray(Text.encodeUtf8(assetID))));
                let derivation_id = Blob.fromArray(Buffer.toArray(buf));

                let { encrypted_key } = await vetkd_system_api.vetkd_encrypted_key({
                    derivation_id;
                    public_key_derivation_path = Array.make(Text.encodeUtf8("symmetric_key"));
                    key_id = {
                        curve = #bls12_381;
                        name = "test_key_1";
                    };
                    encryption_public_key;
                });

                #ok(Hex.encode(Blob.toArray(encrypted_key)));
            };
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
