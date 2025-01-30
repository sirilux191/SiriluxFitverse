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
import Hex "../utility/Hex";
import Interface "../utility/ic-management-interface";
import ProfessionalShard "ProfessionalShard";

actor ProfessionalService {

    type HealthIDProfessional = Types.HealthIDProfessional;

    let identityManager = CanisterTypes.identityManager;
    let vetkd_system_api = CanisterTypes.vetkd_system_api;

    private stable var totalProfessionalCount : Nat = 0;
    private stable var shardCount : Nat = 0;
    private let PROFESSIONALS_PER_SHARD : Nat = 20_480;
    private let STARTING_PROFESSIONAL_ID : Nat = 100_000_000_000;
    private stable let shards : BTree.BTree<Text, Principal> = BTree.init<Text, Principal>(null); // Map of Shard ID to Shard Principal
    private stable var professionalShardMap : BTree.BTree<Principal, Text> = BTree.init<Principal, Text>(null); // Map of Professional Principal to Professional ID
    private stable var reverseProfessionalShardMap : BTree.BTree<Text, Principal> = BTree.init<Text, Principal>(null); // Map of Professional ID to Professional Principal
    private stable var professionalShardWasmModule : [Nat8] = []; // Wasm Module for Shards

    private let IC = "aaaaa-aa";
    private let ic : Interface.Self = actor (IC);

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
                            IDNum = id;
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
                                    case (#err(e)) {
                                        #err("Failed to register identity: " # e);
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

    public shared ({ caller }) func deleteProfessional() : async Result.Result<(), Text> {
        let professionalIDResult = await getProfessionalID(caller);
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
                                            case (#ok(_)) { #ok(()) };
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

    public shared ({ caller }) func getProfessionalStatus() : async Result.Result<Text, Text> {
        switch (Map.get(pendingRequests, Map.phash, caller)) {
            case (?_) { return #ok("Pending") };
            case (null) {
                let idResult = await getProfessionalID(caller);
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

    private func registerProfessional(id : Text, professional : HealthIDProfessional, requestPrincipal : Principal) : async Result.Result<(), Text> {

        let shardResult = await getShard(id);
        switch (shardResult) {
            case (#ok(shard)) {
                let result = await shard.insertProfessional(id, professional);
                switch (result) {
                    case (#ok(_)) {
                        ignore await registerProfessionalInternal(requestPrincipal, id);
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

    public shared ({ caller }) func getProfessionalInfo() : async Result.Result<HealthIDProfessional, Text> {
        let idResult = await getProfessionalID(caller);
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

    public shared ({ caller }) func updateProfessionalInfo(demoInfo : Blob, occupationInfo : Blob, certificationInfo : Blob) : async Result.Result<(), Text> {
        let userIDResult = await getProfessionalID(caller);
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
                                ignore await shard.updateProfessional(id, updatedProfessional);
                                #ok(());
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

    public query func countPendingRequests() : async Nat {
        Map.size(pendingRequests);
    };

    // Function to get the caller's principal ID
    public shared query ({ caller }) func whoami() : async Text {
        Principal.toText(caller);
    };

    // Helper function to check if a principal is an admin
    public shared func isAdmin(caller : Principal) : async Bool {
        if (Principal.fromText(await identityManager.returnAdmin()) == (caller)) {
            true;
        } else {
            false;
        };
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

    public shared ({ caller }) func encrypted_symmetric_key_for_professional(encryption_public_key : Blob) : async Result.Result<Text, Text> {
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

    //Shard Management Section

    public func generateProfessionalID() : async Result.Result<Text, Text> {
        #ok(Nat.toText(STARTING_PROFESSIONAL_ID + totalProfessionalCount));
    };

    public func generateUUID() : async Text {
        let g = Source.Source();
        (UUID.toText(await g.new()));
    };

    private func getShardID(professionalID : Text) : Text {
        switch (Nat.fromText(professionalID)) {
            case (?value) {
                if (value >= STARTING_PROFESSIONAL_ID) {

                    let shardIndex = (Nat.max(0, value - STARTING_PROFESSIONAL_ID)) / PROFESSIONALS_PER_SHARD;
                    return "professional-shard-" # Nat.toText(shardIndex);
                };
                return ("not a valid Professional ID");
            };
            case (null) { return ("not a valid Professional ID") };
        };
    };

    public func getShard(professionalID : Text) : async Result.Result<ProfessionalShard.ProfessionalShard, Text> {
        if (shardCount == 0 or totalProfessionalCount >= shardCount * PROFESSIONALS_PER_SHARD) {
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

        let shardID = getShardID(professionalID);
        switch (BTree.get(shards, Text.compare, shardID)) {
            case (?principal) {
                #ok(actor (Principal.toText(principal)) : ProfessionalShard.ProfessionalShard);
            };
            case null {
                #err("Shard not found for professional ID: " # professionalID);
            };
        };
    };

    private func registerProfessionalInternal(caller : Principal, professionalID : Text) : async Result.Result<(), Text> {
        switch (BTree.get(professionalShardMap, Principal.compare, caller)) {
            case (?_) {
                #err("Professional already registered");
            };
            case null {
                ignore BTree.insert(professionalShardMap, Principal.compare, caller, professionalID);
                ignore BTree.insert(reverseProfessionalShardMap, Text.compare, professionalID, caller);
                totalProfessionalCount += 1;
                #ok(());
            };
        };
    };

    public func getProfessionalID(caller : Principal) : async Result.Result<Text, Text> {
        switch (BTree.get(professionalShardMap, Principal.compare, caller)) {
            case (?professionalID) {
                #ok(professionalID);
            };
            case null {
                #err("Professional ID not found for the given principal");
            };
        };
    };

    public func getProfessionalPrincipal(professionalID : Text) : async Result.Result<Principal, Text> {
        switch (BTree.get(reverseProfessionalShardMap, Text.compare, professionalID)) {
            case (?principal) {
                #ok(principal);
            };
            case null {
                #err("Professional not found");
            };
        };
    };
    private func removeProfessional(caller : Principal) : async Result.Result<(), Text> {
        switch (BTree.get(professionalShardMap, Principal.compare, caller)) {
            case (?professionalID) {
                ignore BTree.delete(professionalShardMap, Principal.compare, caller);
                ignore BTree.delete(reverseProfessionalShardMap, Text.compare, professionalID);
                totalProfessionalCount -= 1;
                #ok(());
            };
            case null {
                #err("Professional not found");
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

    public shared ({ caller }) func updateWasmModule(wasmModule : [Nat8]) : async Result.Result<(), Text> {
        if (not (await isAdmin(caller))) {
            return #err("Unauthorized: only admins can update the ProfessionalShardWASM module");
        };

        if (Array.size(wasmModule) < 8) {
            return #err("Invalid WASM module: too small");
        };

        professionalShardWasmModule := wasmModule;
        #ok(());
    };

    public query func getTotalProfessionalCount() : async Nat {
        totalProfessionalCount;
    };

    public query func getShardCount() : async Nat {
        shardCount;
    };

    public query func getProfessionalsPerShard() : async Nat {
        PROFESSIONALS_PER_SHARD;
    };
};
