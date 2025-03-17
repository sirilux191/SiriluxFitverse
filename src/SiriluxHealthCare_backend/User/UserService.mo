import Array "mo:base/Array";
import Blob "mo:base/Blob";
import Buffer "mo:base/Buffer";
import Error "mo:base/Error";
import Cycles "mo:base/ExperimentalCycles";
import Int "mo:base/Int";
import Nat "mo:base/Nat";
import Nat8 "mo:base/Nat8";
import Principal "mo:base/Principal";
import Result "mo:base/Result";
import Text "mo:base/Text";
import Time "mo:base/Time";
import BTree "mo:stableheapbtreemap/BTree";
import Source "mo:uuid/async/SourceV4";
import UUID "mo:uuid/UUID";

import Types "../Types";
import CanisterIDs "../Types/CanisterIDs";
import CanisterTypes "../Types/CanisterTypes";
import Hex "../utility/Hex";
import Interface "../utility/ic-management-interface";
import UserShard "UserShard";

actor class UserService() = this {

    type HealthIDUser = Types.HealthIDUser;

    let identityManager = CanisterTypes.identityManager;
    let vetkd_system_api = CanisterTypes.vetkd_system_api;

    private stable var totalUserCount : Nat = 0;
    private stable var shardCount : Nat = 0;
    private stable let USERS_PER_SHARD : Nat = 2_000;
    private stable let STARTING_USER_ID : Nat = 10_000_000_000_000; // Starting User ID

    private stable var shards : BTree.BTree<Text, Principal> = BTree.init<Text, Principal>(null); //Shard Number <--> Shard Canister ID

    private stable var userPrincipalIDMap : BTree.BTree<Principal, Text> = BTree.init<Principal, Text>(null); // Principal <--> User ID
    private stable var reverseUserPrincipalIDMap : BTree.BTree<Text, Principal> = BTree.init<Text, Principal>(null); // User ID <--> Principal

    private stable var userIdentitySharedMap : BTree.BTree<Principal, BTree.BTree<Principal, Types.IdenitySharedInfo>> = BTree.init<Principal, BTree.BTree<Principal, Types.IdenitySharedInfo>>(null); // Principal to User ID

    private stable var userShardWasmModule : [Nat8] = []; // WASM Module for Shard Canister

    private let IC = "aaaaa-aa";
    private let ic : Interface.Self = actor (IC);

    // Registration code storage - we'll only store unused codes
    private stable var registrationCodes : BTree.BTree<Text, Bool> = BTree.init<Text, Bool>(null); // Code -> placeholder (always true)

    // Function to create a new user
    public shared ({ caller }) func createUser(userData : Types.HealthIDUserData, registrationCode : Text) : async Result.Result<Text, Text> {
        // First verify the registration code
        if (not verifyRegistrationCode(registrationCode)) {
            return #err("Invalid registration code");
        };

        let userIDResult = generateUserID(); // Generate User ID
        let uuidResult = await generateUUID(); // Generate UUID

        switch (userIDResult, uuidResult) {
            case (#ok(userID), #ok(uuid)) {

                let tempID : HealthIDUser = {

                    IDNum = userID # "@sirilux";
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
                            case (#ok(_)) {
                                // Insert user data into the shard
                                let shardResult = await getShard(userID);
                                switch (shardResult) {
                                    case (#ok(shard)) {
                                        switch (await shard.insertUser(userID, tempID)) {
                                            case (#ok(insertedUserID)) {
                                                // Delete the registration code after successful registration
                                                deleteRegistrationCode(registrationCode);
                                                #ok("User Created Successfully with ID: " # insertedUserID);
                                            };
                                            case (#err(e)) {
                                                //To Do Remove for Identity Manager
                                                switch (await removeUser(caller)) {
                                                    case (#ok(_)) {
                                                        #err("Failed to register identity and user: " # e);
                                                    };
                                                    case (#err(e)) {
                                                        //Add Timer to remove user
                                                        #err("Failed to register identity and user: " # e);
                                                    };
                                                };
                                            };
                                        };
                                    };
                                    case (#err(e)) {
                                        //To Do Remove from Identity Manager
                                        switch (await removeUser(caller)) {
                                            case (#ok(_)) {
                                                #err("Failed to register identity and user: " # e);
                                            };
                                            case (#err(e)) {
                                                //Add Timer to remove user
                                                #err("Failed to register identity and user: " # e);
                                            };
                                        };
                                    };
                                };
                            };

                            case (#err(e)) {
                                switch (await removeUser(caller)) {
                                    case (#ok(_)) {
                                        #err("Failed to register identity and user: " # e);
                                    };
                                    case (#err(e)) {
                                        //Add Timer to remove user
                                        #err("Failed to register identity and user: " # e);
                                    };
                                };
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
        let userIDResult = await getUserID(?caller);
        switch (userIDResult) {
            case (#ok(id)) {
                let shardResult = await getShard(id);
                switch (shardResult) {
                    case (#ok(shard)) {
                        await shard.getUser(id);
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
    public shared ({ caller }) func updateUser(updateData : Types.HealthIDUserData) : async Result.Result<Text, Text> {
        let userIDResult = await getUserID(?caller);
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

                                await shard.updateUser(id, updatedID);

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
            case (#err(err)) {
                #err(err);
            };
        };
    };

    // Function to delete a user
    public shared ({ caller }) func deleteUser() : async Result.Result<Text, Text> {
        let userIDResult = await getUserID(?caller);
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
                                    case (#ok(_)) {
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
            case (#err(e)) {
                #err(e);
            };
        };
    };

    //USER IDENTITY SHARING SECTION

    // Updated share function using getIdentityByID
    public shared ({ caller }) func shareIdentityAccess(targetUserID : Text, durationSeconds : Nat) : async Result.Result<Text, Text> {
        let ownerIDResult = getUserID(?caller);
        let targetPrincipalAndIdentityResult = identityManager.getPrincipalAndIdentityTypeByID(targetUserID);
        switch (await ownerIDResult, await targetPrincipalAndIdentityResult) {
            case (#ok(ownerID), #ok(targetPrincipalAndIdentity)) {
                let (targetPrincipal, userType) = targetPrincipalAndIdentity;
                let now = Time.now();
                let sharedInfo : Types.IdenitySharedInfo = {
                    timeShared = now;
                    accessTill = now + durationSeconds;
                    userSharedToType = userType;
                    userSharedToID = targetUserID;
                };

                switch (BTree.get(userIdentitySharedMap, Principal.compare, caller)) {
                    case (?sharedMap) {
                        // Insert the shared info into the existing map (map is reference type)
                        ignore BTree.insert(sharedMap, Principal.compare, targetPrincipal, sharedInfo);
                    };
                    case null {
                        // If the map is not found, create a new map
                        let newSharedMap = BTree.init<Principal, Types.IdenitySharedInfo>(null);
                        ignore BTree.insert(newSharedMap, Principal.compare, targetPrincipal, sharedInfo);
                        ignore BTree.insert(userIdentitySharedMap, Principal.compare, caller, newSharedMap);
                    };
                };
                #ok("Successfully Shared access to the User with ID " # targetUserID # " of your id " # ownerID);
            };
            case (#err(e), _) { #err("Owner ID error: " # e) };
            case (_, #err(e)) { #err("Invalid target user: " # e) };
        };
    };

    // Updated get shared data using identity verification
    public shared ({ caller }) func getSharedUserData(targetUserID : Text) : async Result.Result<Types.HealthIDUser, Text> {
        let targetPrincipalAndIdentityResult = await identityManager.getPrincipalAndIdentityTypeByID(targetUserID);
        switch (targetPrincipalAndIdentityResult) {
            case (#ok(targetPrincipalAndIdentity)) {
                let (targetPrincipal, userType) = targetPrincipalAndIdentity;
                switch (BTree.get(userIdentitySharedMap, Principal.compare, targetPrincipal)) {
                    case (?sharedMap) {
                        switch (BTree.get(sharedMap, Principal.compare, caller)) {
                            case (?sharedInfo) {
                                if (Time.now() > sharedInfo.accessTill) {
                                    return #err("Access expired for " # targetUserID # " of type " # userType # " at " # Int.toText(sharedInfo.accessTill));
                                };
                                let shardResult = await getShard(targetUserID);
                                switch (shardResult) {
                                    case (#ok(shard)) {
                                        await shard.getUser(targetUserID);
                                    };
                                    case (#err(e)) { #err(e) };
                                };
                            };
                            case null {
                                #err("Access denied: No permissions for user " # targetUserID);
                            };
                        };
                    };
                    case null {
                        #err("No sharing exists for " # targetUserID);
                    };
                };
            };
            case (#err(e)) { #err("Invalid target user: " # e) };

        };
    };

    // Function to revoke shared identity access
    public shared ({ caller }) func revokeIdentityAccess(targetUserID : Text) : async Result.Result<Text, Text> {
        let targetPrincipalAndIdentityResult = await identityManager.getPrincipalAndIdentityTypeByID(targetUserID);

        switch (targetPrincipalAndIdentityResult) {
            case (#ok(targetPrincipalAndIdentity)) {
                let (targetPrincipal, _userType) = targetPrincipalAndIdentity;
                switch (BTree.get(userIdentitySharedMap, Principal.compare, caller)) {
                    case (?sharedMap) {
                        switch (BTree.delete(sharedMap, Principal.compare, targetPrincipal)) {
                            case (?existingInfo) {
                                let updatedInfo : Types.IdenitySharedInfo = {
                                    timeShared = existingInfo.timeShared;
                                    accessTill = Time.now();
                                    userSharedToType = existingInfo.userSharedToType;
                                    userSharedToID = existingInfo.userSharedToID;
                                };

                                ignore BTree.insert(sharedMap, Principal.compare, targetPrincipal, updatedInfo);
                                #ok("Successfully Revoked access to the User with ID" # targetUserID);
                            };
                            case null {
                                #err("No existing access found for " # targetUserID);
                            };
                        };
                    };
                    case null {
                        #err("No shared accesses found for your account");
                    };
                };
            };
            case (#err(e)) { #err("Invalid target user: " # e) };
        };
    };

    //VETKD SECTION

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
            key_id = {
                curve = #bls12_381;
                name = "test_key_1";
            };
            encryption_public_key;
        });

        #ok(Hex.encode(Blob.toArray(encrypted_key)));
    };

    // Updated encryption with combined identity check
    public shared ({ caller }) func encrypt_symmetric_key_for_shared_identity(targetUserID : Text, encryption_public_key : Blob) : async Result.Result<Text, Text> {

        let targetPrincipalAndIdentityResult = await identityManager.getPrincipalAndIdentityTypeByID(targetUserID);

        switch (targetPrincipalAndIdentityResult) {

            case (#ok(targetPrincipalAndIdentity)) {

                let (targetPrincipal, userType) = targetPrincipalAndIdentity;

                switch (BTree.get(userIdentitySharedMap, Principal.compare, targetPrincipal)) {
                    case (?sharedMap) {
                        switch (BTree.get(sharedMap, Principal.compare, caller)) {
                            case (?sharedInfo) {
                                if (Time.now() > sharedInfo.accessTill) {
                                    return #err("Access expired for " # targetUserID # " of type " # userType # " at " # Int.toText(sharedInfo.accessTill));
                                };
                                let buf = Buffer.Buffer<Nat8>(32);

                                buf.append(Buffer.fromArray(Blob.toArray(Text.encodeUtf8(Principal.toText(targetPrincipal)))));
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
                            case null {
                                #err("Access denied to " # targetUserID);
                            };
                        };
                    };
                    case null {
                        #err("No sharing exists for " # targetUserID);
                    };
                };
            };
            case (#err(e)) { #err("Invalid target user: " # e) };
        };
    };

    //VETKD SECTION

    //SHARD MANAGER SECTION

    // ID MetaFunctions Section
    // Function to generate a new user ID
    private func generateUserID() : Result.Result<Text, Text> {
        #ok(Nat.toText(STARTING_USER_ID + totalUserCount));
    };

    // Function to generate a UUID
    private func generateUUID() : async Result.Result<Text, Text> {
        let g = Source.Source();
        #ok(UUID.toText(await g.new()));
    };

    // Function to get the user ID for a given principal
    public shared query ({ caller }) func getUserID(callerPrincipal : ?Principal) : async Result.Result<Text, Text> {
        switch (callerPrincipal) {
            case (?callerPrincipal) {
                switch (BTree.get(userPrincipalIDMap, Principal.compare, callerPrincipal)) {
                    // Get UserID from Principal
                    case (?userID) {
                        #ok(userID);
                    };
                    case null {
                        #err("User ID not found for the given principal");
                    };
                };
            };
            case null {
                switch (BTree.get(userPrincipalIDMap, Principal.compare, caller)) {
                    // Get UserID from Principal
                    case (?userID) {
                        #ok(userID);
                    };
                    case null {
                        #err("User ID not found for the given principal");
                    };
                };
            };
        };
    };
    // New function to get Principal by user ID
    public query func getPrincipalByUserID(userID : Text) : async Result.Result<Principal, Text> {
        switch (BTree.get(reverseUserPrincipalIDMap, Text.compare, userID)) {
            // Get Principal from UserID
            case (?principal) {
                #ok(principal);
            };
            case null {
                #err("No principal found for user ID: " # userID);
            };
        };
    };

    // ID MetaFunctions Section

    // Function to get the shard ID for a user
    private func getShardID(userID : Text) : Result.Result<Text, Text> {
        switch (Nat.fromText(userID)) {
            case (?value) {
                if (value >= STARTING_USER_ID) {
                    let shardIndex : Nat = (value - STARTING_USER_ID) / USERS_PER_SHARD;
                    return #ok(Nat.toText(shardIndex));
                };
                return #err("not a valid User ID");
            };
            case (null) { return #err("not a valid User ID") };
        };

    };

    // Function to get the shard for a user
    private func getShard(userID : Text) : async Result.Result<UserShard.UserShard, Text> {

        let shardIDResult = getShardID(userID);
        var shardID = "";
        switch (shardIDResult) {
            case (#ok(shardIDResult)) {
                shardID := shardIDResult;
            };
            case (#err(e)) {
                return #err(e);
            };
        };

        switch (BTree.get(shards, Text.compare, "shard-" #shardID)) {
            case (?principal) {
                #ok(actor (Principal.toText(principal)) : UserShard.UserShard);
            };
            case null {
                let newShardResult = await createShard();
                switch (newShardResult) {
                    case (#ok(newShardPrincipal)) {
                        let newShardID = "shard-" # Nat.toText(shardCount);
                        ignore BTree.insert(shards, Text.compare, newShardID, newShardPrincipal);
                        shardCount += 1;
                        return #ok(actor (Principal.toText(newShardPrincipal)) : UserShard.UserShard);
                    };
                    case (#err(e)) {
                        return #err(e);
                    };
                };
            };
        };
    };

    // Private function to create a new shard
    private func createShard() : async Result.Result<Principal, Text> {

        if (Array.size(userShardWasmModule) == 0) {
            return #err("Wasm module not set. Please update the Wasm module first.");
        };
        let settings : Types.canister_settings = {
            controllers = ?[Principal.fromText(CanisterIDs.canisterControllersAdmin), Principal.fromActor(this)];
            compute_allocation = null;
            memory_allocation = null;
            freezing_threshold = null;
        };
        try {
            let cycles = 15 * 10 ** 11;
            Cycles.add<system>(cycles);
            let newCanister = await ic.create_canister({ settings = ?settings });
            let canisterPrincipal = newCanister.canister_id;

            let installResult = await installCodeOnShard(canisterPrincipal);
            switch (installResult) {
                case (#ok(())) {
                    #ok(canisterPrincipal);
                };
                case (#err(e)) {
                    return #err(e);
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

    // Function to update the WASM module
    public shared ({ caller }) func updateUserShardWasmModule(wasmModule : [Nat8]) : async Result.Result<Text, Text> {
        if (not (await isAdmin(caller))) {
            return #err("You are not Admin, only admin can perform this action");
        };
        if (Array.size(wasmModule) < 8) {
            return #err("Invalid WASM module: too small");
        };
        userShardWasmModule := wasmModule;
        #ok("WASM Module for User Shard Updated Successfully");
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

    // Function to register a user
    private func registerUser(userPrincipal : Principal, userID : Text) : Result.Result<(), Text> {

        switch (BTree.get(userPrincipalIDMap, Principal.compare, userPrincipal)) {
            case (?_) {
                #err("User already registered");
            };
            case null {
                ignore BTree.insert(userPrincipalIDMap, Principal.compare, userPrincipal, userID); // Insert Principal to UserID Key Value Pair
                ignore BTree.insert(reverseUserPrincipalIDMap, Text.compare, userID, userPrincipal); // Insert UserID to Principal Key Value Pair
                totalUserCount += 1;
                #ok(());
            };
        };
    };

    // Function to remove a user
    private func removeUser(userToRemove : Principal) : async Result.Result<(), Text> {

        switch (BTree.get(userPrincipalIDMap, Principal.compare, userToRemove)) {
            case (?userID) {
                ignore BTree.delete(userPrincipalIDMap, Principal.compare, userToRemove); //Remove Principal to UserID
                ignore BTree.delete(reverseUserPrincipalIDMap, Text.compare, userID); //Remove UserID to Principal
                #ok(());
            };
            case null {
                #err("User not found");
            };
        };
    };

    public func isAdmin(caller : Principal) : async Bool {
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

    // Function to generate a random registration code
    private func generateRandomCode() : async Text {

        let g = Source.Source();
        let uuid = await g.new();

        // Use UUID to derive random indices for characters
        let uuidText = UUID.toText(uuid);

        return uuidText;
    };

    // Admin function to generate batches of 100 registration codes
    public shared ({ caller }) func generateRegistrationCodes() : async Result.Result<[Text], Text> {
        if (not (await isAdmin(caller))) {
            return #err("Only admin can generate registration codes");
        };

        let codesBatch = Buffer.Buffer<Text>(100);
        var i = 0;

        while (i < 100) {
            let code = await generateRandomCode();
            // Make sure code is unique
            if (BTree.get(registrationCodes, Text.compare, code) == null) {
                ignore BTree.insert(registrationCodes, Text.compare, code, true); // true is just a placeholder
                codesBatch.add(code);
                i += 1;
            };
        };

        #ok(Buffer.toArray(codesBatch));
    };

    // Admin function to retrieve all available registration codes
    public shared ({ caller }) func getAvailableRegistrationCodes() : async Result.Result<[Text], Text> {
        if (not (await isAdmin(caller))) {
            return #err("Only admin can view registration codes");
        };

        let codes = Buffer.Buffer<Text>(100);
        for ((code, _) in BTree.entries(registrationCodes)) {
            codes.add(code);
        };

        #ok(Buffer.toArray(codes));
    };

    // Admin function to get the count of available registration codes
    public shared ({ caller }) func getRegistrationCodeCount() : async Result.Result<Nat, Text> {
        if (not (await isAdmin(caller))) {
            return #err("Only admin can access this information");
        };

        var count = 0;
        count := BTree.size(registrationCodes);

        #ok(count);
    };

    // Verify if registration code exists and is valid
    private func verifyRegistrationCode(code : Text) : Bool {
        BTree.get(registrationCodes, Text.compare, code) != null;
    };

    // Delete a registration code after use
    private func deleteRegistrationCode(code : Text) : () {
        ignore BTree.delete(registrationCodes, Text.compare, code);
    };

    // Function to get all shard IDs with their corresponding principals
    public shared ({ caller }) func getAllShardIdsWithPrincipal() : async Result.Result<[(Text, Principal)], Text> {
        if (not (await isAdmin(caller))) {
            return #err("Only admin can access this information");
        };
        let shardIds = Buffer.Buffer<(Text, Principal)>(0);
        for ((shardId, principal) in BTree.entries(shards)) {
            shardIds.add((shardId, principal));
        };
        #ok(Buffer.toArray(shardIds));
    };

};
