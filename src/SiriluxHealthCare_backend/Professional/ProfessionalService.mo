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
import Map "mo:map/Map";
import BTree "mo:stableheapbtreemap/BTree";
import Source "mo:uuid/async/SourceV4";
import UUID "mo:uuid/UUID";

import Types "../Types";
import CanisterTypes "../Types/CanisterTypes";
import Interface "../utility/ic-management-interface";
import ProfessionalShard "ProfessionalShard";

actor ProfessionalService {

    type HealthIDProfessional = Types.HealthIDProfessional;
    let identityManager = CanisterTypes.identityManager;

    private let IC = "aaaaa-aa";
    private let ic : Interface.Self = actor (IC);

    private stable var totalProfessionalCount : Nat = 0;
    private stable var shardCount : Nat = 0;
    private let PROFESSIONALS_PER_SHARD : Nat = 20_480;
    private let STARTING_PROFESSIONAL_ID : Nat = 100_000_000_000;

    private stable var shards : BTree.BTree<Text, Principal> = BTree.init<Text, Principal>(null); // Map of Shard ID to Shard Principal

    private stable var professionalPrincipalIDMap : BTree.BTree<Principal, Text> = BTree.init<Principal, Text>(null); // Map of Professional Principal to Professional ID
    private stable var reverseProfessionalPrincipalIDMap : BTree.BTree<Text, Principal> = BTree.init<Text, Principal>(null); // Map of Professional ID to Professional Principal
    private stable var professionalShardWasmModule : [Nat8] = []; // Wasm Module for Shards

    private stable var pendingRequests : Map.Map<Principal, HealthIDProfessional> = Map.new<Principal, HealthIDProfessional>(); // Map of Pending Requests of Professionals Registered

    public shared ({ caller }) func createProfessionalRequest(demoInfo : Blob, occupationInfo : Blob, certificationInfo : Blob) : async Result.Result<Text, Text> {
        let tempProfessional : HealthIDProfessional = {
            IDNum = ""; // Will be assigned upon approval
            UUID = "";
            MetaData = {
                DemographicInformation = demoInfo;
                OccupationInformation = occupationInfo;
                CertificationInformation = certificationInfo;
            };
        };
        Map.set<Principal, Types.HealthIDProfessional>(pendingRequests, Map.phash, caller, tempProfessional);
        #ok("Your request for registration has been sucessful");
    };

    public shared ({ caller }) func getPendingProfessionalRequests() : async Result.Result<[(Principal, HealthIDProfessional)], Text> {
        if (not (await isAdmin(caller))) {
            return #err("Unauthorized: only admins can view pending requests");
        };
        #ok(Map.toArray(pendingRequests));
    };

    public shared ({ caller }) func getProfessionalStatus() : async Result.Result<Text, Text> {
        switch (Map.get(pendingRequests, Map.phash, caller)) {
            case (?_) { return #ok("Pending") };
            case (null) {
                let idResult = await getProfessionalID(?caller);
                switch (idResult) {
                    case (#ok(_)) {
                        #ok("Approved");
                    };
                    case (#err(_)) {
                        #ok("Not Registered");
                    };
                };
            };
        };
    };

    public shared ({ caller }) func approveProfessionalRequest(requestPrincipal : Principal) : async Result.Result<Text, Text> {
        if (not (await isAdmin(caller))) {
            return #err("Unauthorized: only admins can approve requests");
        };

        switch (Map.get(pendingRequests, Map.phash, requestPrincipal)) {
            case (null) { return #err("Invalid request principal") };
            case (?professional) {
                let idResult = await generateProfessionalID();
                let uuidResult = await generateUUID();
                switch (idResult) {
                    case (#ok(id)) {
                        let approvedProfessional : HealthIDProfessional = {
                            IDNum = id # "@siriluxprof";
                            UUID = uuidResult;
                            MetaData = professional.MetaData;
                        };
                        let registerResult = await registerProfessional(id, approvedProfessional, requestPrincipal);
                        switch (registerResult) {
                            case (#ok(_)) {
                                Map.delete(pendingRequests, Map.phash, requestPrincipal);
                                let identityResult = await identityManager.registerIdentity(requestPrincipal, id, "Professional");
                                switch (identityResult) {
                                    case (#ok(_)) {
                                        #ok("Professional has been successfully approved");
                                    };
                                    case (#err(_e)) {
                                        let removeProfessionalResult = await removeProfessional(requestPrincipal);
                                        switch (removeProfessionalResult) {
                                            case (#ok(_)) {
                                                #err("Failed to register identity and professional");
                                            };
                                            case (#err(_e)) {
                                                #err("Failed to register professional");
                                            };
                                        };
                                    };
                                };
                            };
                            case (#err(err)) {
                                #err("Failed to register professional: " # err);
                            };
                        };
                    };
                    case (#err(err)) {
                        #err("Failed to generate ID: " # err);
                    };
                };
            };
        };
    };

    public shared ({ caller }) func rejectProfessionalRequest(requestPrincipal : Principal) : async Result.Result<Text, Text> {
        if (not (await isAdmin(caller))) {
            return #err("Unauthorized: only admins can reject requests");
        };

        switch (Map.get(pendingRequests, Map.phash, requestPrincipal)) {
            case (null) { return #err("Invalid request principal") };
            case (_) {
                Map.delete(pendingRequests, Map.phash, requestPrincipal);
                #ok("Sucessfully rejected the professional request");
            };
        };
    };
    public shared ({ caller }) func updateProfessionalInfo(demoInfo : Blob, occupationInfo : Blob, certificationInfo : Blob) : async Result.Result<Text, Text> {
        let userIDResult = await getProfessionalID(?caller);
        switch (userIDResult) {
            case (#ok(id)) {
                let shardResult = await getShard(id);
                switch (shardResult) {
                    case (#ok(shard)) {
                        let professionalResult = await shard.getProfessional(id);
                        switch (professionalResult) {
                            case (#ok(value)) {
                                let updatedProfessional : HealthIDProfessional = {
                                    IDNum = value.IDNum;
                                    UUID = value.UUID;
                                    MetaData = {
                                        DemographicInformation = demoInfo;
                                        OccupationInformation = occupationInfo;
                                        CertificationInformation = certificationInfo;
                                    };
                                };
                                await shard.updateProfessional(id, updatedProfessional);

                            };
                            case (#err(err)) {
                                #err(err);
                            };
                        };
                    };
                    case (#err(e)) {
                        #err(e);
                    };
                };
            };
            case (#err(_)) {
                #err("You're not registered as a Health Professional");
            };
        };
    };

    public shared ({ caller }) func deleteProfessional() : async Result.Result<Text, Text> {
        let professionalIDResult = await getProfessionalID(?caller);
        switch (professionalIDResult) {
            case (#ok(id)) {
                let shardResult = await getShard(id);
                switch (shardResult) {
                    case (#ok(shard)) {
                        let deleteResult = await shard.deleteProfessional(id);
                        switch (deleteResult) {
                            case (#ok(_)) {
                                let removeIdentityResult = await identityManager.removeIdentity(id);
                                switch (removeIdentityResult) {
                                    case (#ok(_)) {
                                        let removeProfessionalResult = await removeProfessional(caller);
                                        switch (removeProfessionalResult) {
                                            case (#ok(_)) {
                                                #ok("Professional deleted successfully");
                                            };
                                            case (#err(e)) { #err(e) };
                                        };
                                    };
                                    case (#err(e)) { #err(e) };
                                };
                            };
                            case (#err(e)) { #err(e) };
                        };
                    };
                    case (#err(e)) { #err(e) };
                };
            };
            case (#err(_)) {
                #err("You're not registered as a Health Professional");
            };
        };
    };

    private func registerProfessional(id : Text, professional : HealthIDProfessional, requestPrincipal : Principal) : async Result.Result<(), Text> {

        let shardResult = await getShard(id);
        switch (shardResult) {
            case (#ok(shard)) {
                let result = await shard.insertProfessional(id, professional);
                switch (result) {
                    case (#ok(_)) {
                        await registerProfessionalInternal(requestPrincipal, id);

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

    public shared ({ caller }) func getProfessionalInfo() : async Result.Result<HealthIDProfessional, Text> {
        let idResult = await getProfessionalID(?caller);
        switch (idResult) {
            case (#ok(id)) {
                let shardResult = await getShard(id);
                switch (shardResult) {
                    case (#ok(shard)) {
                        let professionalResult = await shard.getProfessional(id);
                        switch (professionalResult) {
                            case (#ok(professional)) {
                                #ok(professional);
                            };
                            case (#err(e)) {
                                #err("Failed to get professional: " # e);
                            };
                        };
                    };
                    case (#err(e)) {
                        #err("Failed to get shard: " # e);
                    };
                };
            };
            case (#err(_)) {
                #err("You're not registered as a Health Professional");
            };
        };
    };

    public shared ({ caller }) func getProfessionalByID(id : Text) : async Result.Result<HealthIDProfessional, Text> {
        if (not (await isAdmin(caller))) {
            return #err("Unauthorized: only admins can view professionals by ID");
        };
        let shardResult = await getShard(id);

        switch (shardResult) {
            case (#ok(shard)) {
                await shard.getProfessional(id);
            };
            case (#err(e)) {
                #err("Failed to get shard: " # e);
            };
        };
    };

    //Shard Management Section

    public func generateProfessionalID() : async Result.Result<Text, Text> {
        #ok(Nat.toText(STARTING_PROFESSIONAL_ID + totalProfessionalCount));
    };

    public func generateUUID() : async Text {
        let g = Source.Source();
        (UUID.toText(await g.new()));
    };

    public query ({ caller }) func getProfessionalID(callerPrincipal : ?Principal) : async Result.Result<Text, Text> {
        switch (callerPrincipal) {
            case (?callerPrincipal) {
                switch (BTree.get(professionalPrincipalIDMap, Principal.compare, callerPrincipal)) {
                    case (?professionalID) {
                        #ok(professionalID);
                    };
                    case null {
                        #err("Professional ID not found for the given principal");
                    };
                };
            };
            case null {
                switch (BTree.get(professionalPrincipalIDMap, Principal.compare, caller)) {
                    case (?professionalID) {
                        #ok(professionalID);
                    };
                    case null {
                        #err("Professional ID not found for the given principal");
                    };
                };
            };
        };
    };

    public func getProfessionalPrincipalByID(professionalID : Text) : async Result.Result<Principal, Text> {
        switch (BTree.get(reverseProfessionalPrincipalIDMap, Text.compare, professionalID)) {
            case (?principal) {
                #ok(principal);
            };
            case null {
                #err("Professional not found");
            };
        };
    };

    private func registerProfessionalInternal(requestPrincipal : Principal, professionalID : Text) : async Result.Result<(), Text> {
        switch (BTree.get(professionalPrincipalIDMap, Principal.compare, requestPrincipal)) {
            case (?_) {
                #err("Professional already registered");
            };
            case null {
                ignore BTree.insert(professionalPrincipalIDMap, Principal.compare, requestPrincipal, professionalID);
                ignore BTree.insert(reverseProfessionalPrincipalIDMap, Text.compare, professionalID, requestPrincipal);
                totalProfessionalCount += 1;
                #ok(());
            };
        };
    };

    private func removeProfessional(caller : Principal) : async Result.Result<(), Text> {
        switch (BTree.get(professionalPrincipalIDMap, Principal.compare, caller)) {
            case (?professionalID) {
                ignore BTree.delete(professionalPrincipalIDMap, Principal.compare, caller);
                ignore BTree.delete(reverseProfessionalPrincipalIDMap, Text.compare, professionalID);
                totalProfessionalCount -= 1;
                #ok(());
            };
            case null {
                #err("Professional not found");
            };
        };
    };

    private func getShardID(professionalID : Text) : Result.Result<Text, Text> {
        switch (Nat.fromText(professionalID)) {
            case (?value) {
                if (value >= STARTING_PROFESSIONAL_ID) {

                    let shardIndex = (Nat.max(0, value - STARTING_PROFESSIONAL_ID)) / PROFESSIONALS_PER_SHARD;
                    return #ok("professional-shard-" # Nat.toText(shardIndex));
                };
                return #err("not a valid Professional ID");
            };
            case (null) { return #err("not a valid Professional ID") };
        };
    };

    public func getShard(professionalID : Text) : async Result.Result<ProfessionalShard.ProfessionalShard, Text> {

        let shardIDResult = getShardID(professionalID);
        var shardID = "";
        switch (shardIDResult) {
            case (#ok(shardIDResult)) {
                shardID := shardIDResult;
            };
            case (#err(e)) {
                return #err(e);
            };
        };
        switch (BTree.get(shards, Text.compare, shardID)) {
            case (?principal) {
                #ok(actor (Principal.toText(principal)) : ProfessionalShard.ProfessionalShard);
            };
            case null {
                let newShardResult = await createShard();
                switch (newShardResult) {
                    case (#ok(newShardPrincipal)) {
                        let newShardID = "professional-shard-" # Nat.toText(shardCount);
                        ignore BTree.insert(shards, Text.compare, newShardID, newShardPrincipal);
                        shardCount += 1;
                        return #ok(actor (Principal.toText(newShardPrincipal)) : ProfessionalShard.ProfessionalShard);
                    };
                    case (#err(e)) {
                        return #err(e);
                    };
                };
            };
        };
    };

    private func createShard() : async Result.Result<Principal, Text> {
        if (Array.size(professionalShardWasmModule) == 0) {
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

    private func installCodeOnShard(canisterPrincipal : Principal) : async Result.Result<(), Text> {
        let arg = [];

        try {
            await ic.install_code({
                arg = arg;
                wasm_module = professionalShardWasmModule;
                mode = #install;
                canister_id = canisterPrincipal;
            });

            await ic.start_canister({ canister_id = canisterPrincipal });
            #ok(());
        } catch (e) {
            #err("Failed to install or start code on shard: " # Error.message(e));
        };
    };

    public shared ({ caller }) func updateProfessionalShardWasmModule(wasmModule : [Nat8]) : async Result.Result<Text, Text> {
        if (not (await isAdmin(caller))) {
            return #err("Unauthorized: only admins can update the ProfessionalShardWASM module");
        };

        if (Array.size(wasmModule) < 8) {
            return #err("Invalid WASM module: too small");
        };

        professionalShardWasmModule := wasmModule;
        #ok("Professional Shard WASM module updated successfully");
    };

    private func upgradeCodeOnShard(canisterPrincipal : Principal) : async Result.Result<(), Text> {
        try {
            await ic.install_code({
                arg = [];
                wasm_module = professionalShardWasmModule;
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

        if (Array.size(professionalShardWasmModule) == 0) {
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

    // Helper function to check if a principal is an admin
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
            let shard = actor (Principal.toText(shardPrincipal)) : ProfessionalShard.ProfessionalShard;
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
            let shard = actor (Principal.toText(shardPrincipal)) : ProfessionalShard.ProfessionalShard;
            let result = await shard.removePermittedPrincipal(principalToRemove);
            resultsBuffer.add(result); // Add result to the buffer
        };

        // Optionally, you can process the results in the buffer here if needed
        return #ok("Removed Principal from all shards successfully");
    };

};
