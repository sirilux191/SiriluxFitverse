import Array "mo:base/Array";
import Buffer "mo:base/Buffer";
import Nat "mo:base/Nat";
import Principal "mo:base/Principal";
import Result "mo:base/Result";
import Text "mo:base/Text";
import BTree "mo:stableheapbtreemap/BTree";

import Types "../Types";
import CanisterIDs "../Types/CanisterIDs";
actor class FacilityShard() {
    private var facilityMap : BTree.BTree<Text, Types.HealthIDFacility> = BTree.init<Text, Types.HealthIDFacility>(null);
    private stable var permittedPrincipal : [Principal] = [Principal.fromText(CanisterIDs.facilityServiceCanisterID)];

    public shared ({ caller }) func insertFacility(facilityID : Text, facility : Types.HealthIDFacility) : async Result.Result<(), Text> {
        if (not isPermitted(caller)) {
            return #err("You are not permitted to call this function");
        };

        if (BTree.has(facilityMap, Text.compare, facilityID)) {
            #err("Facility with ID " # facilityID # " already exists");
        } else {
            let insertResult = BTree.insert(facilityMap, Text.compare, facilityID, facility);
            switch (insertResult) {
                case null {
                    if (BTree.has(facilityMap, Text.compare, facilityID)) {
                        #ok(());
                    } else {
                        #err("Failed to insert facility with ID " # facilityID);
                    };
                };
                case (?_) {
                    #err("Unexpected result: Facility already existed");
                };
            };
        };
    };

    public shared query ({ caller }) func getFacility(facilityID : Text) : async Result.Result<Types.HealthIDFacility, Text> {
        if (not isPermitted(caller)) {
            return #err("You are not permitted to call this function");
        };
        switch (BTree.get(facilityMap, Text.compare, facilityID)) {
            case (?value) { #ok(value) };
            case null { #err("Facility not found") };
        };
    };

    public shared ({ caller }) func updateFacility(facilityID : Text, facility : Types.HealthIDFacility) : async Result.Result<(), Text> {
        if (not isPermitted(caller)) {
            return #err("You are not permitted to call this function");
        };
        switch (BTree.get(facilityMap, Text.compare, facilityID)) {
            case (?_) {
                switch (BTree.insert(facilityMap, Text.compare, facilityID, facility)) {
                    case (?_) { #ok(()) };
                    case null { #err("Failed to update facility") };
                };
            };
            case null {
                #err("Facility not found");
            };
        };
    };

    public shared ({ caller }) func deleteFacility(facilityID : Text) : async Result.Result<(), Text> {
        if (not isPermitted(caller)) {
            return #err("You are not permitted to call this function");
        };
        switch (BTree.delete(facilityMap, Text.compare, facilityID)) {
            case (?_) { #ok(()) };
            case null { #err("Facility not found") };
        };
    };

    public query func getFacilityCount() : async Nat {
        BTree.size(facilityMap);
    };

    private func isPermitted(principal : Principal) : Bool {
        for (permittedPrincipal in permittedPrincipal.vals()) {
            if (principal == permittedPrincipal) {
                return true;
            };
        };
        return false;
    };

    public shared ({ caller }) func addPermittedPrincipal(principalToAdd : Text) : async Result.Result<Text, Text> {

        if (not isPermitted(caller)) {
            return #err("You are not permitted to call this function");
        };
        permittedPrincipal := Array.append(permittedPrincipal, [Principal.fromText(principalToAdd)]);
        return #ok("Added Principal as Permitted Permitted Principal Successfully");
    };

    public shared ({ caller }) func removePermittedPrincipal(principalToRemove : Text) : async Result.Result<Text, Text> {
        if (not isPermitted(caller)) {
            return #err("You are not permitted to call this function");
        };

        let principalToRemoveObj = Principal.fromText(principalToRemove);
        let permittedPrincipalBuffer = Buffer.fromArray<Principal>(
            Array.filter(
                permittedPrincipal,
                func(p : Principal) : Bool {
                    not Principal.equal(p, principalToRemoveObj);
                },
            )
        );

        if (permittedPrincipalBuffer.size() == permittedPrincipal.size()) {
            return #err("Principal ID is not present to remove");
        };

        permittedPrincipal := Buffer.toArray(permittedPrincipalBuffer);
        return #ok("Removed Principal from Permitted Principal Successfully");
    };
};
