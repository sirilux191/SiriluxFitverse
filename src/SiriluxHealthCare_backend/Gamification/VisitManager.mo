// VisitManager.mo
import Array "mo:base/Array";
import Int "mo:base/Int";
import Nat "mo:base/Nat";
import Principal "mo:base/Principal";
import Result "mo:base/Result";
import Text "mo:base/Text";
import Time "mo:base/Time";
import env "mo:env";
import BTree "mo:stableheapbtreemap/BTree";

import IdentityManager "../IdentityManager/IdentityManager";
import CanisterIDs "../Types/CanisterIDs";

actor class VisitManager() {

    public type VisitTimeStamps = {
        slotTime : ?Time.Time;
        bookingTime : ?Time.Time;
        completionTime : ?Time.Time;
        cancellationTime : ?Time.Time;
        rejectionTime : ?Time.Time;
    };

    public type VisitMode = {
        #Online;
        #Offline;
    };

    // Status of a visit
    public type VisitStatus = {
        #Pending; // booking initiated
        #Approved; // optional extra stage
        #Completed;
        #Cancelled;
        #Rejected;
    };

    // Represents an individual booking/visit
    public type Visit = {
        visitId : Nat;
        userId : Text; // the user who is booking
        professionalId : ?Text; // if visiting a professional
        facilityId : ?Text; // if visiting a facility
        visitMode : VisitMode;
        status : VisitStatus;
        timestamp : VisitTimeStamps;
        avatarId : Nat;
        meetingLink : ?Text; // Added field for online meetings
    };

    // Basic info for a professional (without slots)
    public type ProfessionalInfo = {
        id : Text;
        name : Text;
        specialization : Text;
        description : Text;
    };

    // Basic info for a facility (without slots)
    public type FacilityInfo = {
        id : Text;
        name : Text;
        facilityType : Text;
        description : Text;
    };

    // A single time block with capacity
    public type AvailabilitySlot = {
        entityId : Text; // professional or facility ID
        start : Time.Time;
        capacity : Nat;
    };

    public type BookedSlot = {
        entityId : Text; // professional or facility ID
        start : Time.Time;
        visitId : Nat;
        capacity : Nat;
    };

    // ------------------------------------------------------------------------
    // STABLE VARIABLES
    // ------------------------------------------------------------------------

    // The map of all visits
    private stable var visits : BTree.BTree<Nat, Visit> = BTree.init<Nat, Visit>(null);

    // userId -> [visitIds]
    private stable var userVisits : BTree.BTree<Text, [Nat]> = BTree.init<Text, [Nat]>(null);

    // professionalId -> [visitIds]
    private stable var professionalVisits : BTree.BTree<Text, [Nat]> = BTree.init<Text, [Nat]>(null);

    // facilityId -> [visitIds]
    private stable var facilityVisits : BTree.BTree<Text, [Nat]> = BTree.init<Text, [Nat]>(null);

    // Basic info registries (without slots)
    private stable var professionals : BTree.BTree<Text, ProfessionalInfo> = BTree.init<Text, ProfessionalInfo>(null);

    private stable var facilities : BTree.BTree<Text, FacilityInfo> = BTree.init<Text, FacilityInfo>(null);

    // Availability slots storage
    // entityId -> BTree(startTime -> AvailabilitySlot)
    private stable var availabilitySlots : BTree.BTree<Text, BTree.BTree<Time.Time, AvailabilitySlot>> = BTree.init<Text, BTree.BTree<Time.Time, AvailabilitySlot>>(null);

    private stable var bookedSlots : BTree.BTree<Text, BTree.BTree<Time.Time, BookedSlot>> = BTree.init<Text, BTree.BTree<Time.Time, BookedSlot>>(null);
    // For each avatar, track how many visits completed

    // Next unique ID for new visits
    private stable var nextVisitId : Nat = 1;

    // Reference to IdentityManager
    private let identityManager : IdentityManager.IdentityManager = actor (env.identityManagerCanisterID);

    // Store permitted principals that can call certain functions
    private stable var permittedPrincipals : [Principal] = [Principal.fromText(CanisterIDs.gamificationSystemCanisterID)];

    private func isPermittedCaller(caller : Principal) : Bool {
        Array.find<Principal>(permittedPrincipals, func(p) { Principal.equal(p, caller) }) != null;
    };

    public shared ({ caller }) func updateProfessionalInfo(professionalInfo : ProfessionalInfo) : async Result.Result<Text, Text> {
        // Check caller's identity
        let identityResult = await identityManager.getIdentity(caller);

        switch (identityResult) {
            case (#err(msg)) {
                return #err("Identity verification failed: " # msg);
            };
            case (#ok(identity)) {
                // Check if the caller is the professional they're trying to update
                if (identity.0 != professionalInfo.id) {
                    return #err("You can only update your own professional information");
                };
                // Verify the caller is registered as a professional
                if (identity.1 != "Professional") {
                    return #err("Only professionals can update professional information");
                };

                // Update the professional info
                ignore BTree.insert(professionals, Text.compare, professionalInfo.id, professionalInfo);
                #ok("Professional information updated successfully" # professionalInfo.id);
            };
        };
    };

    public shared ({ caller }) func updateFacilityInfo(facilityInfo : FacilityInfo) : async Result.Result<Text, Text> {
        // Check caller's identity
        let identityResult = await identityManager.getIdentity(caller);

        switch (identityResult) {
            case (#err(msg)) {
                return #err("Identity verification failed: " # msg);
            };
            case (#ok(identity)) {
                // Check if the caller is authorized to update this facility
                if (identity.0 != facilityInfo.id) {
                    return #err("You can only update your own facility information");
                };
                if (identity.1 != "Facility") {
                    return #err("Only facilities can update facility information");
                };
                // Update the facility info
                ignore BTree.insert(facilities, Text.compare, facilityInfo.id, facilityInfo);
                #ok("Facility information updated successfully" # facilityInfo.id);
            };
        };
    };

    // Add these helper functions first
    private func isHalfHourAligned(timestamp : Time.Time) : Bool {
        let millisInHalfHour : Nat = 30 * 60 * 1000_000_000; // 30 minutes in nanoseconds
        return timestamp % millisInHalfHour == 0;
    };

    private func isSlotBooked(entityId : Text, startTime : Time.Time) : Bool {
        switch (BTree.get(bookedSlots, Text.compare, entityId)) {
            case (?entityBookedSlots) {
                switch (BTree.get(entityBookedSlots, Int.compare, startTime)) {
                    case (?_) { true };
                    case null { false };
                };
            };
            case null { false };
        };
    };

    // Optional: Add a function to get available slots for an entity
    public query func getAvailableSlots(entityId : Text) : async [AvailabilitySlot] {
        let currentTime = Time.now(); // Get the current time
        switch (BTree.get(availabilitySlots, Text.compare, entityId)) {
            case (?entitySlots) {
                var slots : [AvailabilitySlot] = [];
                for ((slotStart, slot) in BTree.entries(entitySlots)) {
                    // Only include slots that are not booked and start in the future
                    if (not isSlotBooked(entityId, slotStart) and slotStart >= currentTime) {
                        slots := Array.append(slots, [slot]);
                    };
                };
                slots;
            };
            case null { [] };
        };
    };

    public shared ({ caller }) func removeMultipleAvailabilitySlots(entityId : Text, startTimes : [Time.Time]) : async Result.Result<Text, Text> {
        // Check caller's identity
        let identityResult = await identityManager.getIdentity(caller);

        switch (identityResult) {
            case (#err(msg)) {
                return #err("Identity verification failed: " # msg);
            };
            case (#ok(identity)) {
                if (identity.0 != entityId) {
                    return #err("You can only remove slots for your own entity");
                };

                // Get entity slots once
                switch (BTree.get(availabilitySlots, Text.compare, entityId)) {
                    case (null) {
                        return #err("No slots found for entity " # entityId);
                    };
                    //reference to tree of entity is entitySlots
                    case (?entitySlots) {
                        var errors : [Text] = [];

                        // Process all start times using the same entitySlots
                        for (startTime in startTimes.vals()) {
                            switch (BTree.get(entitySlots, Int.compare, startTime)) {
                                case (?slot) {
                                    ignore BTree.delete(entitySlots, Int.compare, startTime);
                                };
                                case null {
                                    errors := Array.append<Text>(errors, ["Slot " # Int.toText(startTime) # " not found"]);
                                };
                            };
                        };

                        if (Array.size(errors) == 0) {
                            #ok("All specified availability slots removed successfully");
                        } else {
                            #err(Array.foldLeft<Text, Text>(errors, "", Text.concat));
                        };
                    };
                };
            };
        };
    };

    public shared ({ caller }) func addMultipleAvailabilitySlots(slots : [AvailabilitySlot]) : async Result.Result<Text, Text> {
        // Check caller's identity
        let identityResult = await identityManager.getIdentity(caller);

        switch (identityResult) {
            case (#err(msg)) {
                return #err("Identity verification failed: " # msg);
            };
            case (#ok(identity)) {
                var errors : [Text] = [];
                label l for (slot in slots.vals()) {
                    // Verify the caller owns this slot
                    if (identity.0 != slot.entityId) {
                        errors := Array.append<Text>(errors, ["You can only add slots for your own entity"]);
                        continue l;
                    };

                    // Verify caller is either a professional or facility
                    if (identity.1 != "Professional" and identity.1 != "Facility") {
                        errors := Array.append<Text>(errors, ["Only professionals or facilities can add availability slots"]);
                        continue l;
                    };

                    // Check if the time is aligned to half-hour intervals
                    if (not isHalfHourAligned(slot.start)) {
                        errors := Array.append<Text>(errors, ["Slot " # Int.toText(slot.start) # " must start at half-hour intervals"]);
                        continue l;
                    };

                    // Check if the slot is already booked
                    if (isSlotBooked(slot.entityId, slot.start)) {
                        errors := Array.append<Text>(errors, ["Slot " # Int.toText(slot.start) # " is already booked"]);
                        continue l;
                    };

                    // Check if the slot start time is in the past
                    let currentTime = Time.now(); // Get the current time
                    if (slot.start < currentTime) {
                        errors := Array.append<Text>(errors, ["Slot " # Int.toText(slot.start) # " cannot start in the past"]);
                        continue l;
                    };

                    // Get or create the entity's slot tree
                    //reference tree of entity
                    var entitySlots = switch (BTree.get(availabilitySlots, Text.compare, slot.entityId)) {
                        case (?existing) { existing };
                        case null {
                            let newTree = BTree.init<Time.Time, AvailabilitySlot>(null);
                            ignore BTree.insert(availabilitySlots, Text.compare, slot.entityId, newTree);
                            newTree;
                        };
                    };

                    // Add the slot to the entity's availability
                    //due to reference adding to this automatically changes in the main tree
                    ignore BTree.insert(entitySlots, Int.compare, slot.start, slot);
                };

                if (Array.size(errors) == 0) {
                    return #ok("All availability slots added successfully");
                } else {
                    return #err(
                        Array.foldLeft<Text, Text>(errors, "", Text.concat)
                    );
                };
            };
        };
    };

    public shared ({ caller }) func getProfessionalInfoSelf() : async Result.Result<ProfessionalInfo, Text> {
        // Check caller's identity
        let identityResult = await identityManager.getIdentity(caller);

        switch (identityResult) {
            case (#err(msg)) {
                return #err("Identity verification failed: " # msg);
            };
            case (#ok(identity)) {
                let id = identity.0;
                let role = identity.1;

                if (role != "Professional") {
                    return #err("Only professionals can access professional information");
                };

                switch (BTree.get(professionals, Text.compare, id)) {
                    case (?info) { #ok(info) };
                    case null { #err("Professional information not found") };
                };
            };
        };
    };

    public shared ({ caller }) func getFacilityInfoSelf() : async Result.Result<FacilityInfo, Text> {
        // Check caller's identity
        let identityResult = await identityManager.getIdentity(caller);

        switch (identityResult) {
            case (#err(msg)) {
                return #err("Identity verification failed: " # msg);
            };
            case (#ok(identity)) {
                let id = identity.0;
                let role = identity.1;

                if (role != "Facility") {
                    return #err("Only facilities can access facility information");
                };

                switch (BTree.get(facilities, Text.compare, id)) {
                    case (?info) { #ok(info) };
                    case null { #err("Facility information not found") };
                };
            };
        };
    };

    public shared ({ caller }) func getAvailableSlotsSelf() : async Result.Result<[AvailabilitySlot], Text> {
        // Check caller's identity
        let identityResult = await identityManager.getIdentity(caller);

        switch (identityResult) {
            case (#err(msg)) {
                return #err("Identity verification failed: " # msg);
            };
            case (#ok(identity)) {
                let id = identity.0;
                let role = identity.1;

                if (role != "Professional" and role != "Facility") {
                    return #err("Only professionals or facilities can view their availability slots");
                };

                let currentTime = Time.now();
                switch (BTree.get(availabilitySlots, Text.compare, id)) {
                    case (?entitySlots) {
                        var slots : [AvailabilitySlot] = [];
                        for ((slotStart, slot) in BTree.entries(entitySlots)) {
                            if (not isSlotBooked(id, slotStart) and slotStart >= currentTime) {
                                slots := Array.append(slots, [slot]);
                            };
                        };
                        #ok(slots);
                    };
                    case null { #ok([]) };
                };
            };
        };
    };

    public query func getAllProfessionals() : async [ProfessionalInfo] {
        BTree.toValueArray(professionals);

    };

    public query func getAllFacilities() : async [FacilityInfo] {
        BTree.toValueArray(facilities);

    };

    // Optional: Add filtered queries
    public query func getProfessionalsBySpecialization(specialization : Text) : async [ProfessionalInfo] {
        var filtered_list : [ProfessionalInfo] = [];
        for ((_, info) in BTree.entries(professionals)) {
            if (Text.equal(info.specialization, specialization)) {
                filtered_list := Array.append(filtered_list, [info]);
            };
        };
        filtered_list;
    };

    public query func getFacilitiesByType(facilityType : Text) : async [FacilityInfo] {
        var filtered_list : [FacilityInfo] = [];
        for ((_, info) in BTree.entries(facilities)) {
            if (Text.equal(info.facilityType, facilityType)) {
                filtered_list := Array.append(filtered_list, [info]);
            };
        };
        filtered_list;
    };

    // Add these helper functions
    private func isProfessionalID(id : Text) : Bool {
        let idLength = Text.size(id);
        idLength == 12;
    };

    private func isFacilityID(id : Text) : Bool {
        let idLength = Text.size(id);
        idLength == 10;
    };

    // Update the bookSlotAndCreateVisit function
    public shared ({ caller }) func bookSlotAndCreateVisit(
        userPrincipal : Principal,
        idToVisit : Text,
        slotTime : Time.Time,
        visitMode : VisitMode,
        avatarId : Nat,
    ) : async Result.Result<Nat, Text> {
        // Check if caller is permitted (GamificationSystem)
        if (not isPermittedCaller(caller)) {
            return #err("Unauthorized caller");
        };

        // Validate ID format
        if (not (isProfessionalID(idToVisit) or isFacilityID(idToVisit))) {
            return #err("Invalid ID format");
        };

        // Verify user identity
        let userIdentityResult = await identityManager.getIdentity(userPrincipal);
        switch (userIdentityResult) {
            case (#err(msg)) {
                return #err("User identity verification failed: " # msg);
            };
            case (#ok(userIdentity)) {
                let userId = userIdentity.0;

                // Check if slot exists and is available
                switch (BTree.get(availabilitySlots, Text.compare, idToVisit)) {
                    case (?entitySlots) {
                        switch (BTree.get(entitySlots, Int.compare, slotTime)) {
                            case (?availabilitySlot) {
                                if (isSlotBooked(idToVisit, slotTime)) {
                                    return #err("Slot is already booked");
                                };

                                // Generate meeting link for online visits
                                let meetingLink = switch (visitMode) {
                                    case (#Online) {
                                        ?("https://beta.brie.fi/ng/" # Int.toText(Time.now()) # "-" # Nat.toText(nextVisitId));
                                    };
                                    case (#Offline) { null };
                                };

                                // Create the visit with meeting link
                                let visit : Visit = {
                                    visitId = nextVisitId;
                                    userId = userId;
                                    professionalId = if (isProfessionalID(idToVisit)) ?idToVisit else null;
                                    facilityId = if (isFacilityID(idToVisit)) ?idToVisit else null;
                                    visitMode = visitMode;
                                    status = #Pending;
                                    timestamp = {
                                        slotTime = ?slotTime;
                                        bookingTime = ?Time.now();
                                        completionTime = null;
                                        cancellationTime = null;
                                        rejectionTime = null;
                                    };
                                    avatarId = avatarId;
                                    meetingLink = meetingLink; // Add meeting link
                                };

                                // Create a BookedSlot instead of using AvailabilitySlot
                                let bookedSlot : BookedSlot = {
                                    entityId = idToVisit;
                                    start = slotTime;
                                    visitId = nextVisitId;
                                    capacity = availabilitySlot.capacity;
                                };

                                // Book the slot with correct type
                                var entityBookedSlots = switch (BTree.get(bookedSlots, Text.compare, idToVisit)) {
                                    case (?existing) { existing };
                                    case null {
                                        let newTree = BTree.init<Time.Time, BookedSlot>(null);
                                        ignore BTree.insert(bookedSlots, Text.compare, idToVisit, newTree);
                                        newTree;
                                    };
                                };
                                ignore BTree.insert(entityBookedSlots, Int.compare, slotTime, bookedSlot);

                                // Remove the slot from availability
                                ignore BTree.delete(entitySlots, Int.compare, slotTime);

                                // Store the visit
                                ignore BTree.insert(visits, Nat.compare, nextVisitId, visit);

                                // Update user visits
                                updateUserVisits(userId, nextVisitId);

                                // Update professional/facility visits
                                updateEntityVisits(idToVisit, nextVisitId);

                                let currentVisitId = nextVisitId;
                                nextVisitId += 1;
                                #ok(currentVisitId);
                            };
                            case null { #err("Slot not found") };
                        };
                    };
                    case null { #err("No slots found for entity") };
                };
            };
        };
    };

    private func updateUserVisits(userId : Text, visitId : Nat) {
        let currentVisits = switch (BTree.get(userVisits, Text.compare, userId)) {
            case (?visits) { visits };
            case null { [] };
        };
        ignore BTree.insert(userVisits, Text.compare, userId, Array.append(currentVisits, [visitId]));
    };

    private func updateEntityVisits(entityId : Text, visitId : Nat) {
        let visitsMap = if (isProfessionalID(entityId)) {
            professionalVisits;
        } else {
            facilityVisits;
        };

        let currentVisits = switch (BTree.get(visitsMap, Text.compare, entityId)) {
            case (?visits) { visits };
            case null { [] };
        };
        ignore BTree.insert(visitsMap, Text.compare, entityId, Array.append(currentVisits, [visitId]));
    };

    public shared ({ caller }) func getBookedSlotsSelf() : async Result.Result<[BookedSlot], Text> {
        let identityResult = await identityManager.getIdentity(caller);

        switch (identityResult) {
            case (#err(msg)) {
                return #err("Identity verification failed: " # msg);
            };
            case (#ok(identity)) {
                let id = identity.0;
                let role = identity.1;

                if (role != "Professional" and role != "Facility") {
                    return #err("Only professionals or facilities can view their booked slots");
                };

                switch (BTree.get(bookedSlots, Text.compare, id)) {
                    case (?entitySlots) {
                        var slots : [BookedSlot] = [];
                        for ((_, slot) in BTree.entries(entitySlots)) {
                            slots := Array.append(slots, [slot]);
                        };
                        #ok(slots);
                    };
                    case null { #ok([]) };
                };
            };
        };
    };

    public shared ({ caller }) func getUserVisits() : async Result.Result<[Visit], Text> {
        let identityResult = await identityManager.getIdentity(caller);

        switch (identityResult) {
            case (#err(msg)) {
                return #err("Identity verification failed: " # msg);
            };
            case (#ok(identity)) {
                let userId = identity.0;

                switch (BTree.get(userVisits, Text.compare, userId)) {
                    case (?visitIds) {
                        var visitList : [Visit] = [];
                        for (visitId in visitIds.vals()) {
                            switch (BTree.get(visits, Nat.compare, visitId)) {
                                case (?visit) {
                                    visitList := Array.append(visitList, [visit]);
                                };
                                case null {};
                            };
                        };
                        #ok(visitList);
                    };
                    case null { #ok([]) };
                };
            };
        };
    };

    public shared ({ caller }) func getEntityVisits() : async Result.Result<[Visit], Text> {
        let identityResult = await identityManager.getIdentity(caller);

        switch (identityResult) {
            case (#err(msg)) {
                return #err("Identity verification failed: " # msg);
            };
            case (#ok(identity)) {
                let entityId = identity.0;
                let role = identity.1;

                if (role != "Professional" and role != "Facility") {
                    return #err("Only professionals or facilities can view their visits");
                };

                let visitsMap = if (role == "Professional") {
                    professionalVisits;
                } else {
                    facilityVisits;
                };

                switch (BTree.get(visitsMap, Text.compare, entityId)) {
                    case (?visitIds) {
                        var visitList : [Visit] = [];
                        for (visitId in visitIds.vals()) {
                            switch (BTree.get(visits, Nat.compare, visitId)) {
                                case (?visit) {
                                    visitList := Array.append(visitList, [visit]);
                                };
                                case null {};
                            };
                        };
                        #ok(visitList);
                    };
                    case null { #ok([]) };
                };
            };
        };
    };

    public shared ({ caller }) func completeVisit(professionalPrincipal : Principal, visitId : Nat) : async Result.Result<Visit, Text> {
        if (not isPermittedCaller(caller)) {
            return #err("Unauthorized caller");
        };
        let identityResult = await identityManager.getIdentity(professionalPrincipal);

        switch (identityResult) {
            case (#err(msg)) {
                return #err("Identity verification failed: " # msg);
            };
            case (#ok(identity)) {
                let entityId = identity.0;

                switch (BTree.get(visits, Nat.compare, visitId)) {
                    case (?visit) {
                        // Check if the caller is the professional/facility assigned to this visit
                        let isAuthorized = switch (visit.professionalId, visit.facilityId) {
                            case (?profId, _) { profId == entityId };
                            case (_, ?facId) { facId == entityId };
                            case (null, null) { false };
                        };

                        if (not isAuthorized) {
                            return #err("Not authorized to complete this visit");
                        };

                        // switch (visit.timestamp.slotTime) {
                        //     case (?slotTime) {
                        //         if (Time.now() < slotTime) {
                        //             return #err("Visit is not yet due");
                        //         };
                        //     };
                        //     case null {
                        //         return #err("Visit has no slot time");
                        //     };
                        // };

                        // Check if visit is in a valid state to complete
                        switch (visit.status) {
                            case (#Pending or #Approved) {
                                let updatedVisit = {
                                    visit with
                                    status = #Completed;
                                    timestamp = {
                                        visit.timestamp with
                                        completionTime = ?Time.now();
                                    };
                                };

                                // Remove from bookedSlots
                                switch (visit.timestamp.slotTime) {
                                    case (?slotTime) {
                                        switch (BTree.get(bookedSlots, Text.compare, entityId)) {
                                            case (?entitySlots) {
                                                ignore BTree.delete(entitySlots, Int.compare, slotTime);
                                            };
                                            case null {};
                                        };
                                    };
                                    case null {};
                                };

                                ignore BTree.insert(visits, Nat.compare, visitId, updatedVisit);
                                #ok(updatedVisit);
                            };
                            case (#Completed) {
                                #err("Visit is already completed");
                            };
                            case (#Cancelled) {
                                #err("Cannot complete a cancelled visit");
                            };
                            case (#Rejected) {
                                #err("Cannot complete a rejected visit");
                            };
                        };
                    };
                    case null { #err("Visit not found") };
                };
            };
        };
    };

    public shared ({ caller }) func rejectVisit(professionalPrincipal : Principal, visitId : Nat) : async Result.Result<Text, Text> {
        if (not isPermittedCaller(caller)) {
            return #err("Unauthorized caller");
        };
        let identityResult = await identityManager.getIdentity(professionalPrincipal);

        switch (identityResult) {
            case (#err(msg)) {
                return #err("Identity verification failed: " # msg);
            };
            case (#ok(identity)) {
                let entityId = identity.0;

                switch (BTree.get(visits, Nat.compare, visitId)) {
                    case (?visit) {
                        // Check if the caller is the professional/facility assigned to this visit
                        let isAuthorized = switch (visit.professionalId, visit.facilityId) {
                            case (?profId, _) { profId == entityId };
                            case (_, ?facId) { facId == entityId };
                            case (null, null) { false };
                        };

                        if (not isAuthorized) {
                            return #err("Not authorized to reject this visit");
                        };

                        // switch (visit.timestamp.slotTime) {
                        //     case (?slotTime) {
                        //         if (Time.now() < slotTime) {
                        //             return #err("Visit is not yet due");
                        //         };
                        //     };
                        //     case null {
                        //         return #err("Visit has no slot time");
                        //     };
                        // };

                        // Check if visit is in a valid state to reject
                        switch (visit.status) {
                            case (#Pending) {
                                let updatedVisit = {
                                    visit with
                                    status = #Rejected;
                                    timestamp = {
                                        visit.timestamp with
                                        rejectionTime = ?Time.now();
                                    };
                                };

                                // Remove from bookedSlots and restore availability
                                switch (visit.timestamp.slotTime) {
                                    case (?slotTime) {
                                        switch (BTree.get(bookedSlots, Text.compare, entityId)) {
                                            case (?entitySlots) {
                                                switch (BTree.get(entitySlots, Int.compare, slotTime)) {
                                                    case (?bookedSlot) {
                                                        // Remove from bookedSlots
                                                        ignore BTree.delete(entitySlots, Int.compare, slotTime);

                                                        // Restore to availabilitySlots
                                                        let availabilitySlot : AvailabilitySlot = {
                                                            entityId = bookedSlot.entityId;
                                                            start = bookedSlot.start;
                                                            capacity = bookedSlot.capacity;
                                                        };

                                                        var entityAvailSlots = switch (BTree.get(availabilitySlots, Text.compare, entityId)) {
                                                            case (?existing) {
                                                                existing;
                                                            };
                                                            case null {
                                                                let newTree = BTree.init<Time.Time, AvailabilitySlot>(null);
                                                                ignore BTree.insert(availabilitySlots, Text.compare, entityId, newTree);
                                                                newTree;
                                                            };
                                                        };
                                                        ignore BTree.insert(entityAvailSlots, Int.compare, slotTime, availabilitySlot);
                                                    };
                                                    case null {};
                                                };
                                            };
                                            case null {};
                                        };
                                    };
                                    case null {};
                                };

                                ignore BTree.insert(visits, Nat.compare, visitId, updatedVisit);
                                #ok("Visit rejected successfully");
                            };
                            case (#Completed) {
                                #err("Cannot reject a completed visit");
                            };
                            case (#Cancelled) {
                                #err("Cannot reject a cancelled visit");
                            };
                            case (#Rejected) {
                                #err("Visit is already rejected");
                            };
                            case (#Approved) {
                                #err("Cannot reject an approved visit");
                            };
                        };
                    };
                    case null { #err("Visit not found") };
                };
            };
        };
    };
};
