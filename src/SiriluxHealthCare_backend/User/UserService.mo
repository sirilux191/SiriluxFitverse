import Array "mo:base/Array";
import Blob "mo:base/Blob";
import Buffer "mo:base/Buffer";
import Error "mo:base/Error";
import Cycles "mo:base/ExperimentalCycles";
import Nat "mo:base/Nat";
import Nat8 "mo:base/Nat8";
import Principal "mo:base/Principal";
import Result "mo:base/Result";
import Text "mo:base/Text";
import BTree "mo:stableheapbtreemap/BTree";
import Source "mo:uuid/async/SourceV4";
import UUID "mo:uuid/UUID";

import Types "../Types";
import CanisterTypes "../Types/CanisterTypes";
import Hex "../utility/Hex";
import Interface "../utility/ic-management-interface";
import UserShard "UserShard";

actor class UserService() {

    type HealthIDUser = Types.HealthIDUser;

    let identityManager = CanisterTypes.identityManager;
    let vetkd_system_api = CanisterTypes.vetkd_system_api;

    private stable var totalUserCount : Nat = 0;
    private stable var shardCount : Nat = 0;
    private let USERS_PER_SHARD : Nat = 200_000;
    private let STARTING_USER_ID : Nat = 10_000_000_000_000; // Starting User ID
    private stable let shards : BTree.BTree<Text, Principal> = BTree.init<Text, Principal>(null); //Shard Number to Shard Canister ID
    private stable var userShardMap : BTree.BTree<Principal, Text> = BTree.init<Principal, Text>(null); // Principal to User ID
    private stable var reverseUserShardMap : BTree.BTree<Text, Principal> = BTree.init<Text, Principal>(null); // User ID to Principal

    private stable var userShardWasmModule : [Nat8] = []; // Wasm Module for Shard Canister

    private let IC = "aaaaa-aa";
    private let ic : Interface.Self = actor (IC);

    private stable var creatingShard : Bool = false;
    // Function to create a new user
    public shared ({ caller }) func createUser(userData : Types.HealthIDUserData) : async Result.Result<Text, Text> {
        let userIDResult = generateUserID(); // Generate User ID
        let uuidResult = await generateUUID(); // Generate UUID

        switch (userIDResult, uuidResult) {
            case (#ok(userID), #ok(uuid)) {
                let tempID : HealthIDUser = {
                    // Temporary User ID Data Structure
                    IDNum = userID;
                    UUID = uuid;
                    MetaData = {
                        // User Metadata
                        DemographicInformation = userData.DemographicInformation;
                        BasicHealthParameters = userData.BasicHealthParameters;
                        BiometricData = userData.BiometricData;
                        FamilyInformation = userData.FamilyInformation;
                    };
                };
                let registerResult = registerUser(caller, userID);
                switch (registerResult) {
                    case (#ok(())) {
                        let identityResult = await identityManager.registerIdentity(caller, userID, "User");
                        switch (identityResult) {
                            case (#ok(())) {
                                // Insert user data into the shard
                                let shardResult = await getShard(userID);
                                switch (shardResult) {
                                    case (#ok(shard)) {
                                        let insertResult = await shard.insertUser(userID, tempID);
                                        switch (insertResult) {
                                            case (#ok(())) {
                                                #ok(userID);
                                            };
                                            case (#err(e)) {
                                                #err("Failed to insert user data: " # e);
                                            };
                                        };
                                    };
                                    case (#err(e)) {
                                        #err("Failed to get shard: " # e);
                                    };
                                };
                            };
                            case (#err(e)) {
                                #err("Failed to register identity: " # e);
                            };
                        };
                    };
                    case (#err(e)) { #err("Failed to register user: " # e) };
                };
            };
            case (#err(e), _) { #err("Failed to generate user ID: " # e) };
            case (_, #err(e)) { #err("Failed to generate UUID: " # e) };
        };
    };

    // Function to read user data
    public shared ({ caller }) func readUser() : async Result.Result<HealthIDUser, Text> {
        let userIDResult = await getUserID(caller); // Get User ID via UserShardManager
        switch (userIDResult) {
            case (#ok(id)) {
                let shardResult = await getShard(id); // Get Shard via UserShardManager
                switch (shardResult) {
                    case (#ok(shard)) {
                        let userResult = await shard.getUser(id); // Get User via Shard
                        switch (userResult) {
                            case (#ok(user)) {
                                #ok(user); // Return User
                            };
                            case (#err(e)) {
                                #err("Failed to get user: " # e);
                            };
                        };
                    };
                    case (#err(e)) {
                        #err("Failed to get shard: " # e);
                    };
                };
            };
            case (#err(e)) {
                #err("You are not registered as a Health User: " # e);
            };
        };
    };

    // Function to update user data
    public shared ({ caller }) func updateUser(updateData : Types.HealthIDUserData) : async Result.Result<(), Text> {
        let userIDResult = await getUserID(caller);
        switch (userIDResult) {
            case (#ok(id)) {
                let shardResult = await getShard(id);
                switch (shardResult) {
                    case (#ok(shard)) {
                        let userResult = await shard.getUser(id);
                        switch (userResult) {
                            case (#ok(value)) {
                                let updatedID : HealthIDUser = {
                                    IDNum = value.IDNum;
                                    UUID = value.UUID;
                                    MetaData = {
                                        DemographicInformation = updateData.DemographicInformation;
                                        BasicHealthParameters = updateData.BasicHealthParameters;
                                        BiometricData = updateData.BiometricData;
                                        FamilyInformation = updateData.FamilyInformation;
                                    };
                                };

                                ignore await shard.updateUser(id, updatedID);
                                #ok(());
                            };
                            case (#err(err)) {
                                #err(err);
                            };
                        };
                    };
                    case (#err(err)) {
                        #err(err);
                    };
                };
            };
            case (#err(_)) {
                #err("You're not registered as a Health User");
            };
        };
    };

    // Function to delete a user
    public shared ({ caller }) func deleteUser() : async Result.Result<Text, Text> {
        let userIDResult = await getUserID(caller);
        switch (userIDResult) {
            case (#ok(id)) {
                let shardResult = await getShard(id);
                switch (shardResult) {
                    case (#ok(shard)) {
                        let deleteResult = await shard.deleteUser(id);
                        switch (deleteResult) {
                            case (#ok(_)) {
                                let removeIdentityResult = await identityManager.removeIdentity(id);
                                switch (removeIdentityResult) {
                                    case (#ok(())) {
                                        let removeUserResult = await removeUser(caller);
                                        switch (removeUserResult) {
                                            case (#ok(())) {
                                                #ok("User deleted successfully");
                                            };
                                            case (#err(e)) {
                                                #err(e);
                                            };
                                        };
                                    };
                                    case (#err(e)) {
                                        #err(e);
                                    };
                                };
                            };
                            case (#err(e)) {
                                #err(e);
                            };
                        };
                    };
                    case (#err(e)) {
                        #err(e);
                    };
                };
            };
            case (#err(_)) {
                #err("You're not registered as a Health User");
            };
        };
    };

    // Function to get the caller's principal ID
    public shared query ({ caller }) func whoami() : async Text {
        Principal.toText(caller);
    };

    // Function to check if the caller is registered
    public shared ({ caller }) func isRegistered() : async Result.Result<Text, Text> {
        if (Principal.isAnonymous(caller)) {
            return #err("Anonymous persons can't register, please login with wallet or internet identity");
        };

        let userIDResult = await getUserID(caller);
        switch (userIDResult) {
            case (#ok(_)) {
                #ok("User");
            };
            case (#err(_)) {
                #err("Not Registered");
            };
        };
    };

    // Function to get the user ID of the caller
    public shared ({ caller }) func getID() : async Result.Result<Text, Text> {
        await getUserID(caller);
    };

    public func getUserIDPrincipal(userID : Text) : async Result.Result<Principal, Text> {

        let result = await getPrincipalByUserID(userID);
        switch (result) {
            case (#ok(principal)) {
                #ok(principal);
            };
            case (#err(err)) {
                #err((err));
            };
        };

    };

    // Function to get the total number of users
    public func getNumberOfUsers() : async Nat {
        totalUserCount;
    };

    //VetKey Section

    public func symmetric_key_verification_key() : async Text {
        let { public_key } = await vetkd_system_api.vetkd_public_key({
            canister_id = null;
            derivation_path = Array.make(Text.encodeUtf8("symmetric_key"));
            key_id = { curve = #bls12_381; name = "test_key_1" };
        });
        Hex.encode(Blob.toArray(public_key));
    };

    public shared ({ caller }) func encrypted_symmetric_key_for_user(encryption_public_key : Blob) : async Result.Result<Text, Text> {
        if (Principal.isAnonymous(caller)) {
            return #err("Please log in with a wallet or internet identity.");
        };

        let buf = Buffer.Buffer<Nat8>(32);
        buf.append(Buffer.fromArray(Blob.toArray(Text.encodeUtf8(Principal.toText(caller)))));
        let derivation_id = Blob.fromArray(Buffer.toArray(buf));

        let { encrypted_key } = await vetkd_system_api.vetkd_encrypted_key({
            derivation_id;
            public_key_derivation_path = Array.make(Text.encodeUtf8("symmetric_key"));
            key_id = { curve = #bls12_381; name = "test_key_1" };
            encryption_public_key;
        });

        #ok(Hex.encode(Blob.toArray(encrypted_key)));
    };

    //Shard Manager Section
    // Function to generate a new user ID
    private func generateUserID() : Result.Result<Text, Text> {

        #ok(Nat.toText(STARTING_USER_ID + totalUserCount));
    };

    // Function to generate a UUID
    private func generateUUID() : async Result.Result<Text, Text> {

        let g = Source.Source();
        #ok(UUID.toText(await g.new()));
    };

    // Function to get the shard ID for a user
    private func getShardID(userID : Text) : Text {
        switch (Nat.fromText(userID)) {
            case (?value) {
                if (value >= STARTING_USER_ID) {

                    let shardIndex : Nat = (value - STARTING_USER_ID) / USERS_PER_SHARD;
                    return Nat.toText(shardIndex);
                };
                return ("not a valid User ID");
            };
            case (null) { return ("not a valid User ID") };
        };

    };

    // Function to get the shard for a user
    private func getShard(userID : Text) : async Result.Result<UserShard.UserShard, Text> {

        if (shardCount == 0 or totalUserCount >= shardCount * USERS_PER_SHARD) {
            if (creatingShard) {
                return #err("Shard creation is in progress");
            };
            creatingShard := true;
            // Create a new shard
            let newShardResult = await createShard();
            switch (newShardResult) {
                case (#ok(newShardPrincipal)) {
                    let newShardID = "shard-" # Nat.toText(shardCount);
                    ignore BTree.insert(shards, Text.compare, newShardID, newShardPrincipal);
                    shardCount += 1;
                    creatingShard := false;
                    return #ok(actor (Principal.toText(newShardPrincipal)) : UserShard.UserShard);
                };
                case (#err(e)) {
                    return #err(e);
                };
            };
        };

        let shardID = getShardID(userID);
        switch (BTree.get(shards, Text.compare, "shard-" #shardID)) {
            case (?principal) {
                #ok(actor (Principal.toText(principal)) : UserShard.UserShard);
            };
            case null {
                #err("Shard not found for user ID: " # userID);
            };
        };
    };

    // Function to register a user
    private func registerUser(userPrincipal : Principal, userID : Text) : Result.Result<(), Text> {

        switch (BTree.get(userShardMap, Principal.compare, userPrincipal)) {
            case (?_) {
                #err("User already registered");
            };
            case null {
                ignore BTree.insert(userShardMap, Principal.compare, userPrincipal, userID); // Insert Principal to UserID Key Value Pair
                ignore BTree.insert(reverseUserShardMap, Text.compare, userID, userPrincipal); // Insert UserID to Principal Key Value Pair
                totalUserCount += 1;
                #ok(());
            };
        };
    };

    // Function to get the user ID for a given principal
    public func getUserID(caller : Principal) : async Result.Result<Text, Text> {
        switch (BTree.get(userShardMap, Principal.compare, caller)) {
            // Get UserID from Principal
            case (?userID) {
                #ok(userID);
            };
            case null {
                #err("User ID not found for the given principal");
            };
        };
    };
    // New function to get Principal by user ID
    public func getPrincipalByUserID(userID : Text) : async Result.Result<Principal, Text> {
        switch (BTree.get(reverseUserShardMap, Text.compare, userID)) {
            // Get Principal from UserID
            case (?principal) {
                #ok(principal);
            };
            case null {
                #err("No principal found for user ID: " # userID);
            };
        };
    };
    // Function to remove a user
    private func removeUser(userToRemove : Principal) : async Result.Result<(), Text> {

        switch (BTree.get(userShardMap, Principal.compare, userToRemove)) {
            case (?userID) {
                ignore BTree.delete(userShardMap, Principal.compare, userToRemove); //Remove Principal to UserID
                ignore BTree.delete(reverseUserShardMap, Text.compare, userID); //Remove UserID to Principal
                #ok(());
            };
            case null {
                #err("User not found");
            };
        };
    };

    // Function to get the users in a specific shard
    public func getUsersInShard(shardID : Text) : async [Text] {

        switch (BTree.get(shards, Text.compare, shardID)) {
            case (?principal) {
                // Assuming each shard has a method to get all user principals
                let shard = actor (Principal.toText(principal)) : UserShard.UserShard;
                await shard.getAllUserIDs();
            };
            case null {
                [];
            };
        };
    };

    // Private function to create a new shard
    private func createShard() : async Result.Result<Principal, Text> {

        if (Array.size(userShardWasmModule) == 0) {
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

    // Private function to install code on a shard
    private func installCodeOnShard(canisterPrincipal : Principal) : async Result.Result<(), Text> {
        let arg = [];

        try {
            await ic.install_code({
                arg = arg;
                wasm_module = userShardWasmModule; // Use the UserShard module directly
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
        try {
            await ic.install_code({
                arg = [];
                wasm_module = userShardWasmModule;
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

        userShardWasmModule := wasmModule;
        #ok(());
    };

    public shared ({ caller }) func updateExistingShards() : async Result.Result<(), Text> {

        if (not (await isAdmin(caller))) {
            return #err("You are not Admin, only admin can perform this action");
        };

        if (Array.size(userShardWasmModule) == 0) {
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

    // Query function to get the total user count
    public query func getTotalUserCount() : async Nat {
        totalUserCount;
    };

    // Query function to get the shard count
    public query func getShardCount() : async Nat {
        shardCount;
    };

    public shared func isAdmin(caller : Principal) : async Bool {
        if (Principal.fromText(await identityManager.returnAdmin()) == (caller)) {
            true;
        } else {
            false;
        };
    };

    // Function to add a permitted principal to all shards
    public shared ({ caller }) func addPermittedPrincipalToAllShards(principalToAdd : Text) : async Result.Result<Text, Text> {
        if (not (await isAdmin(caller))) {
            return #err("You are not Admin, only admin can perform this action");
        };

        let resultsBuffer = Buffer.fromArray<Result.Result<Text, Text>>([]); // Initialize a buffer for results
        for ((shardID, shardPrincipal) in BTree.entries(shards)) {
            let shard = actor (Principal.toText(shardPrincipal)) : UserShard.UserShard;
            let result = await shard.addPermittedPrincipal(principalToAdd);
            resultsBuffer.add(result); // Add result to the buffer
        };

        // Optionally, you can process the results in the buffer here if needed
        return #ok("Added Principal to all shards successfully");
    };

    // Function to remove a permitted principal from all shards
    public shared ({ caller }) func removePermittedPrincipalFromAllShards(principalToRemove : Text) : async Result.Result<Text, Text> {
        if (not (await isAdmin(caller))) {
            return #err("You are not Admin, only admin can perform this action");
        };

        let resultsBuffer = Buffer.fromArray<Result.Result<Text, Text>>([]); // Initialize a buffer for results
        for ((shardID, shardPrincipal) in BTree.entries(shards)) {
            let shard = actor (Principal.toText(shardPrincipal)) : UserShard.UserShard;
            let result = await shard.removePermittedPrincipal(principalToRemove);
            resultsBuffer.add(result); // Add result to the buffer
        };

        // Optionally, you can process the results in the buffer here if needed
        return #ok("Removed Principal from all shards successfully");
    };
    //Shard Manager Section

};
