import Array "mo:base/Array";
import Blob "mo:base/Blob";
import Bool "mo:base/Bool";
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
import FacilityShard "FacilityShard";

actor FacilityService {

    type HealthIDFacility = Types.HealthIDFacility;
    let identityManager = CanisterTypes.identityManager;

    private let IC = "aaaaa-aa";
    private let ic : Interface.Self = actor (IC);

    private stable var totalFacilityCount : Nat = 0;
    private stable var shardCount : Nat = 0;
    private let FACILITIES_PER_SHARD : Nat = 20_480;
    private let STARTING_FACILITY_ID : Nat = 1_000_000_000;

    private stable let shards : BTree.BTree<Text, Principal> = BTree.init<Text, Principal>(null);

    private stable var facilityPrincipalIDMap : BTree.BTree<Principal, Text> = BTree.init<Principal, Text>(null);
    private stable var reverseFacilityPrincipalIDMap : BTree.BTree<Text, Principal> = BTree.init<Text, Principal>(null);
    private stable var facilityShardWasmModule : [Nat8] = [];

    private stable var pendingRequests : Map.Map<Principal, HealthIDFacility> = Map.new<Principal, HealthIDFacility>(); // Map of pending requests

    private stable var creatingShard : Bool = false;

    public shared ({ caller }) func createFacilityRequest(licenseInfo : Blob, demographicInfo : Blob, servicesOfferedInfo : Blob) : async Result.Result<Text, Text> {
        let tempFacility : HealthIDFacility = {
            IDNum = ""; // Will be assigned upon approval
            UUID = Principal.toText(caller);
            MetaData = {

                LicenseInformation = licenseInfo;
                DemographicInformation = demographicInfo;
                ServicesOfferedInformation = servicesOfferedInfo;
            };
        };
        Map.set<Principal, Types.HealthIDFacility>(pendingRequests, Map.phash, caller, tempFacility);
        #ok("Your request for facility registration has been successful");
    };

    public shared ({ caller }) func getPendingFacilityRequests() : async Result.Result<[(Principal, HealthIDFacility)], Text> {
        if (not (await isAdmin(caller))) {
            return #err("Unauthorized: only admins can view pending requests");
        };
        #ok(Map.toArray(pendingRequests));
    };

    public shared ({ caller }) func getFacilityStatus() : async Result.Result<Text, Text> {
        switch (Map.get(pendingRequests, Map.phash, caller)) {
            case (?_) { return #ok("Pending") };
            case (null) {
                let idResult = await getFacilityID(caller);
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

    public shared ({ caller }) func approveFacilityRequest(requestPrincipal : Principal) : async Result.Result<Text, Text> {
        if (not (await isAdmin(caller))) {
            return #err("Unauthorized: only admins can approve requests");
        };

        switch (Map.get(pendingRequests, Map.phash, requestPrincipal)) {
            case (null) { return #err("Invalid request principal") };
            case (?facility) {
                let idResult = await generateFacilityID();
                let uuidResult = await generateUUID();

                let approvedFacility : HealthIDFacility = {
                    IDNum = idResult # "@siriluxservice";
                    UUID = uuidResult;
                    MetaData = facility.MetaData;
                };
                let registerResult = await registerFacility(idResult, approvedFacility, requestPrincipal);
                switch (registerResult) {
                    case (#ok(_)) {
                        Map.delete(pendingRequests, Map.phash, requestPrincipal);
                        let identityResult = await identityManager.registerIdentity(requestPrincipal, idResult, "Facility");
                        switch (identityResult) {
                            case (#ok(_)) {
                                #ok("Facility has been successfully approved");
                            };
                            case (#err(e)) {
                                #err("Failed to register identity: " # e);
                            };
                        };
                    };
                    case (#err(err)) {
                        #err("Failed to register facility: " # err);
                    };
                };

            };
        };
    };

    public shared ({ caller }) func rejectFacilityRequest(requestPrincipal : Principal) : async Result.Result<Text, Text> {
        if (not (await isAdmin(caller))) {
            return #err("Unauthorized: only admins can reject requests");
        };

        switch (Map.get(pendingRequests, Map.phash, requestPrincipal)) {
            case (null) { return #err("Invalid request principal") };
            case (_) {
                Map.delete(pendingRequests, Map.phash, requestPrincipal);
                #ok("Successfully rejected the facility request");
            };
        };
    };

    public shared ({ caller }) func updateFacility(facilityInfo : Blob, licenseInfo : Blob) : async Result.Result<Text, Text> {
        let idResult = await getFacilityID(caller);
        switch (idResult) {
            case (#ok(id)) {
                let shardResult = await getShard(id);
                switch (shardResult) {
                    case (#ok(shard)) {
                        let facilityResult = await shard.getFacility(id);
                        switch (facilityResult) {
                            case (#ok(facility)) {
                                let updatedFacility : HealthIDFacility = {
                                    IDNum = facility.IDNum;
                                    UUID = facility.UUID;
                                    MetaData = {
                                        FacilityInformation = facilityInfo;
                                        LicenseInformation = licenseInfo;
                                        DemographicInformation = facility.MetaData.DemographicInformation;
                                        ServicesOfferedInformation = facility.MetaData.ServicesOfferedInformation;
                                    };
                                };
                                let updateResult = await shard.updateFacility(id, updatedFacility);
                                switch (updateResult) {
                                    case (#ok(_)) {
                                        #ok("Facility updated successfully");
                                    };
                                    case (#err(err)) {
                                        #err("Failed to update facility: " # err);
                                    };
                                };
                            };
                            case (#err(err)) {
                                #err("Failed to get facility: " # err);
                            };
                        };
                    };
                    case (#err(err)) { #err("Failed to get shard: " # err) };
                };
            };
            case (#err(_)) {
                #err("Facility not found for the given principal");
            };
        };
    };

    public shared ({ caller }) func deleteFacility() : async Result.Result<(), Text> {
        let idResult = await getFacilityID(caller);
        switch (idResult) {
            case (#ok(id)) {
                let shardResult = await getShard(id);
                switch (shardResult) {
                    case (#ok(shard)) {
                        let deleteResult = await shard.deleteFacility(id);
                        switch (deleteResult) {
                            case (#ok(_)) {
                                let identityResult = await identityManager.removeIdentity(id);
                                switch (identityResult) {
                                    case (#ok(_)) {
                                        ignore await removeFacility(caller);
                                        #ok(());
                                    };
                                    case (#err(e)) {
                                        #err("Failed to delete identity: " # e);
                                    };
                                };
                            };
                            case (#err(err)) {
                                #err("Failed to delete facility: " # err);
                            };
                        };
                    };
                    case (#err(err)) { #err("Failed to get shard: " # err) };
                };
            };
            case (#err(_)) {
                #err("Facility not found for the given principal");
            };
        };
    };

    private func registerFacility(id : Text, facility : HealthIDFacility, requestPrincipal : Principal) : async Result.Result<(), Text> {
        let shardResult = await getShard(id);
        switch (shardResult) {
            case (#ok(shard)) {
                let result = await shard.insertFacility(id, facility);
                switch (result) {
                    case (#ok(_)) {
                        await registerFacilityInternal(id, requestPrincipal);
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

    public shared ({ caller }) func getFacilityInfo() : async Result.Result<HealthIDFacility, Text> {
        let idResult = await getFacilityID(caller);
        switch (idResult) {
            case (#ok(id)) {
                let shardResult = await getShard(id);
                switch (shardResult) {
                    case (#ok(shard)) {
                        await shard.getFacility(id);
                    };
                    case (#err(err)) { #err("Failed to get shard: " # err) };
                };
            };
            case (#err(_)) {
                #err("Facility not found for the given principal");
            };
        };
    };

    public shared ({ caller }) func getFacilityByID(id : Text) : async Result.Result<HealthIDFacility, Text> {
        if (not (await isAdmin(caller))) {
            return #err("Unauthorized: only admins can view facilities by ID");
        };
        let shardResult = await getShard(id);
        switch (shardResult) {
            case (#ok(shard)) {
                await shard.getFacility(id);
            };
            case (#err(err)) { #err("Failed to get shard: " # err) };
        };
    };

    //Shard Management

    private func generateFacilityID() : async Text {
        (Nat.toText(STARTING_FACILITY_ID + totalFacilityCount));
    };

    private func generateUUID() : async Text {
        let g = Source.Source();
        UUID.toText(await g.new());
    };

    // Function to get the caller's principal ID
    public shared query ({ caller }) func whoami() : async Text {
        Principal.toText(caller);
    };

    public query func getTotalFacilityCountSignedUp() : async Nat {
        totalFacilityCount;
    };

    public shared ({ caller }) func getFacilityIDSelf() : async Result.Result<Text, Text> {
        await getFacilityID(caller);
    };

    public func getFacilityID(caller : Principal) : async Result.Result<Text, Text> {
        switch (BTree.get(facilityPrincipalIDMap, Principal.compare, caller)) {
            case (?facilityID) {
                #ok(facilityID);
            };
            case null {
                #err("Facility ID not found for the given principal");
            };
        };
    };

    public func getFacilityPrincipalByID(facilityID : Text) : async Result.Result<Principal, Text> {
        switch (BTree.get(reverseFacilityPrincipalIDMap, Text.compare, facilityID)) {
            case (?principal) {
                #ok(principal);
            };
            case null {
                #err("Facility not found");
            };
        };
    };

    private func getShardID(facilityID : Text) : Text {
        switch (Nat.fromText(facilityID)) {
            case (?value) {
                if (value >= STARTING_FACILITY_ID) {
                    let shardIndex = (Nat.max(0, value - STARTING_FACILITY_ID) / FACILITIES_PER_SHARD);
                    return Nat.toText(shardIndex);
                };
                return ("not a valid Facility ID");
            };
            case (null) { return ("not a valid Facility ID") };
        };
    };

    private func getShard(facilityID : Text) : async Result.Result<FacilityShard.FacilityShard, Text> {
        if (shardCount == 0 or totalFacilityCount >= shardCount * FACILITIES_PER_SHARD) {
            if (creatingShard) {
                return #err("Shard creation is in progress");
            };
            creatingShard := true;
            let newShardResult = await createShard();
            switch (newShardResult) {
                case (#ok(newShardPrincipal)) {
                    let newShardID = getShardID(facilityID);
                    ignore BTree.insert(shards, Text.compare, newShardID, newShardPrincipal);
                    shardCount += 1;
                    creatingShard := false;
                    return #ok(actor (Principal.toText(newShardPrincipal)) : FacilityShard.FacilityShard);
                };
                case (#err(e)) {
                    return #err(e);
                };
            };
        };

        let shardID = getShardID(facilityID);
        switch (BTree.get(shards, Text.compare, shardID)) {
            case (?principal) {
                #ok(actor (Principal.toText(principal)) : FacilityShard.FacilityShard);
            };
            case null {
                #err("Shard not found for facility ID: " # facilityID);
            };
        };
    };

    private func createShard() : async Result.Result<Principal, Text> {
        if (Array.size(facilityShardWasmModule) == 0) {
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
                wasm_module = facilityShardWasmModule;
                mode = #install;
                canister_id = canisterPrincipal;
            });

            await ic.start_canister({ canister_id = canisterPrincipal });
            #ok(());
        } catch (e) {
            #err("Failed to install or start code on shard: " # Error.message(e));
        };
    };

    public shared ({ caller }) func updateFacilityShardWasmModule(wasmModule : [Nat8]) : async Result.Result<(), Text> {
        if (not (await isAdmin(caller))) {
            return #err("You are not Admin, only admin can perform this action");
        };
        if (Array.size(wasmModule) < 8) {
            return #err("Invalid WASM module: too small");
        };

        facilityShardWasmModule := wasmModule;
        #ok(());
    };

    private func upgradeCodeOnShard(canisterPrincipal : Principal) : async Result.Result<(), Text> {
        try {
            await ic.install_code({
                arg = [];
                wasm_module = facilityShardWasmModule;
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

        if (Array.size(facilityShardWasmModule) == 0) {
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

    private func registerFacilityInternal(facilityID : Text, requestPrincipal : Principal) : async Result.Result<(), Text> {
        switch (BTree.get(facilityPrincipalIDMap, Principal.compare, requestPrincipal)) {
            case (?_) {
                #err("Facility already registered");
            };
            case null {
                ignore BTree.insert(facilityPrincipalIDMap, Principal.compare, requestPrincipal, facilityID);
                ignore BTree.insert(reverseFacilityPrincipalIDMap, Text.compare, facilityID, requestPrincipal);
                totalFacilityCount += 1;
                #ok(());
            };
        };
    };

    private func removeFacility(caller : Principal) : async Result.Result<(), Text> {
        switch (BTree.get(facilityPrincipalIDMap, Principal.compare, caller)) {
            case (?facilityID) {
                ignore BTree.delete(facilityPrincipalIDMap, Principal.compare, caller);
                ignore BTree.delete(reverseFacilityPrincipalIDMap, Text.compare, facilityID);
                totalFacilityCount -= 1;
                #ok(());
            };
            case null {
                #err("Facility not found");
            };
        };
    };

    private func isAdmin(caller : Principal) : async Bool {
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
            let shard = actor (Principal.toText(shardPrincipal)) : FacilityShard.FacilityShard;
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
            let shard = actor (Principal.toText(shardPrincipal)) : FacilityShard.FacilityShard;
            let result = await shard.removePermittedPrincipal(principalToRemove);
            resultsBuffer.add(result); // Add result to the buffer
        };

        // Optionally, you can process the results in the buffer here if needed
        return #ok("Removed Principal from all shards successfully");
    };
};
