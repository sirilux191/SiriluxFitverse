// VisitManager.mo
import Array "mo:base/Array";
import Int "mo:base/Int";
import Nat "mo:base/Nat";
import Order "mo:base/Order";
import Principal "mo:base/Principal";
import Result "mo:base/Result";
import Text "mo:base/Text";
import Time "mo:base/Time";
import env "mo:env";
import BTree "mo:stableheapbtreemap/BTree";

import IdentityManager "../IdentityManager/IdentityManager";

actor class VisitManager() {

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
        timestamp : Time.Time; // Time of booking
        avatarId : Nat;
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

    private stable var bookedSlots : BTree.BTree<Text, BTree.BTree<Time.Time, AvailabilitySlot>> = BTree.init<Text, BTree.BTree<Time.Time, AvailabilitySlot>>(null);
    // For each avatar, track how many visits completed
    private stable var avatarVisitCount : BTree.BTree<Nat, Nat> = BTree.init<Nat, Nat>(null);

    // Next unique ID for new visits
    private stable var nextVisitId : Nat = 1;

    // Reference to IdentityManager
    private let identityManager : IdentityManager.IdentityManager = actor (env.identityManagerCanisterID);

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
        var professionals_list : [ProfessionalInfo] = [];
        for ((_, info) in BTree.entries(professionals)) {
            professionals_list := Array.append(professionals_list, [info]);
        };
        professionals_list;
    };

    public query func getAllFacilities() : async [FacilityInfo] {
        var facilities_list : [FacilityInfo] = [];
        for ((_, info) in BTree.entries(facilities)) {
            facilities_list := Array.append(facilities_list, [info]);
        };
        facilities_list;
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
};
