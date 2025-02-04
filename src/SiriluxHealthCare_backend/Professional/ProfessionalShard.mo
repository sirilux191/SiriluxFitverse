import Array "mo:base/Array";
import Buffer "mo:base/Buffer";
import Nat "mo:base/Nat";
import Principal "mo:base/Principal";
import Result "mo:base/Result";
import Text "mo:base/Text";
import BTree "mo:stableheapbtreemap/BTree";

import Types "../Types";
import CanisterIDs "../Types/CanisterIDs";

actor class ProfessionalShard() {

    private var professionalMap : BTree.BTree<Text, Types.HealthIDProfessional> = BTree.init<Text, Types.HealthIDProfessional>(null);
    private stable var permittedPrincipal : [Principal] = [Principal.fromText(CanisterIDs.professionalServiceCanisterID)];

    public shared ({ caller }) func insertProfessional(professionalID : Text, professional : Types.HealthIDProfessional) : async Result.Result<(), Text> {

        if (not isPermitted(caller)) {
            return #err("You are not permitted to call this function");
        };
        if (BTree.has(professionalMap, Text.compare, professionalID)) {
            #err("Professional with ID " # professionalID # " already exists");
        } else {
            let insertResult = BTree.insert(professionalMap, Text.compare, professionalID, professional);
            switch (insertResult) {
                case null {
                    if (BTree.has(professionalMap, Text.compare, professionalID)) {
                        #ok(());
                    } else {
                        #err("Failed to insert professional with ID " # professionalID);
                    };
                };

                case (?_) {
                    #err("Unexpected result: Professional already existed");
                };
            };
        };
    };

    public shared query ({ caller }) func getProfessional(professionalID : Text) : async Result.Result<Types.HealthIDProfessional, Text> {
        if (not isPermitted(caller)) {
            return #err("You are not permitted to call this function");
        };
        switch (BTree.get(professionalMap, Text.compare, professionalID)) {
            case (?value) { #ok(value) };
            case null { #err("Professional not found") };
        };
    };

    public shared ({ caller }) func updateProfessional(professionalID : Text, professional : Types.HealthIDProfessional) : async Result.Result<(), Text> {
        if (not isPermitted(caller)) {
            return #err("You are not permitted to call this function");
        };
        switch (BTree.get(professionalMap, Text.compare, professionalID)) {
            case (?_) {
                switch (BTree.insert(professionalMap, Text.compare, professionalID, professional)) {
                    case (?_) { #ok(()) };
                    case null { #err("Failed to update professional") };
                };
            };
            case null {
                #err("Professional not found");
            };
        };
    };

    public shared ({ caller }) func deleteProfessional(professionalID : Text) : async Result.Result<(), Text> {
        if (not isPermitted(caller)) {
            return #err("You are not permitted to call this function");
        };
        switch (BTree.delete(professionalMap, Text.compare, professionalID)) {
            case (?_) { #ok(()) };
            case null { #err("Professional not found") };
        };
    };

    public query func getProfessionalCount() : async Nat {
        BTree.size(professionalMap);
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
