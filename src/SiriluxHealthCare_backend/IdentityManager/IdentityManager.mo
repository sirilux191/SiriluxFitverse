import Array "mo:base/Array";
import Char "mo:base/Char";
import Nat "mo:base/Nat";
import Principal "mo:base/Principal";
import Result "mo:base/Result";
import Text "mo:base/Text";
import ICRC2 "mo:icrc2-types";
import BTree "mo:stableheapbtreemap/BTree";

import CanisterIDs "../Types/CanisterIDs";

actor class IdentityManager() = this {

    private stable let icrcLedger : ICRC2.Service = actor (CanisterIDs.icrc_ledger_canister_id);
    private stable var admin : Text = (CanisterIDs.admin);

    private stable let COST_PER_PRINCIPAL_REGISTRATION_PERMIT : Nat = 100_000;
    private stable let ICRC_DECIMALS : Nat = 100_000_000; // 8 decimals

    private stable let MIN_INSTITUTE_NAME_LENGTH : Nat = 3;
    private stable let MAX_INSTITUTE_NAME_LENGTH : Nat = 15;
    private stable let MIN_ID_LENGTH : Nat = 5;
    private stable let MAX_ID_LENGTH : Nat = 30;
    private stable let MIN_USER_TYPE_LENGTH : Nat = 3;
    private stable let MAX_USER_TYPE_LENGTH : Nat = 15;

    private stable var identityMap : BTree.BTree<Principal, (Text, Text)> = BTree.init<Principal, (Text, Text)>(null);
    private stable var reverseIdentityMap : BTree.BTree<Text, Principal> = BTree.init<Text, Principal>(null);

    private stable var principalToInstituteName : BTree.BTree<Principal, Text> = BTree.init<Principal, Text>(null);
    ///Permitted Principal Bind to @instituteName, For Example :- BTree Principal <-> @FortisHospital

    public shared ({ caller }) func registerInstituteName_PermitPrincipal(principalToPermit : Principal, instituteNameToPermit : Text) : async Result.Result<Text, Text> {

        let instituteName = Text.toLowercase(instituteNameToPermit);

        if (not noSpecialCharacters(instituteName)) {
            return #err("Institute Name Cannot Contain Special Characters");
        };

        if (instituteName.size() > MAX_INSTITUTE_NAME_LENGTH or instituteName.size() < MIN_INSTITUTE_NAME_LENGTH) {
            return #err("Institute Name Must Be Between " # debug_show MIN_INSTITUTE_NAME_LENGTH # " And " # debug_show MAX_INSTITUTE_NAME_LENGTH # " Characters");
        };

        if (BTree.has(principalToInstituteName, Principal.compare, principalToPermit)) {
            return #err("Institute Name Already Registered for this Principal");
        };

        let instituteNameArray = BTree.toValueArray(principalToInstituteName);
        let instituteNameFound = Array.find(instituteNameArray, func(instituteNameinArray : Text) : Bool { instituteName == instituteNameinArray });
        if (instituteNameFound != null) {
            return #err("Institute Name Already Registered");
        };

        let result = await icrcLedger.icrc2_transfer_from({
            from = { owner = caller; subaccount = null };
            spender_subaccount = null;
            to = { owner = Principal.fromActor(this); subaccount = null };
            amount = COST_PER_PRINCIPAL_REGISTRATION_PERMIT * ICRC_DECIMALS;
            fee = null;
            memo = ?Text.encodeUtf8("Register : " # instituteName);
            created_at_time = null;
        });

        switch (result) {
            case (#Ok(_)) {
                ignore BTree.insert(principalToInstituteName, Principal.compare, principalToPermit, instituteName);
                #ok("Institute Permit Registered Successfully with Institute Name: " # instituteName);
            };
            case (#Err(e)) {
                #err("Error transferring funds: " # debug_show e);
            };
        };
    };

    public shared ({ caller }) func registerIdentity(principal : Principal, id : Text, userType : Text) : async Result.Result<Text, Text> {

        let instituteName = switch (BTree.get(principalToInstituteName, Principal.compare, caller)) {
            case (?instituteName) { instituteName };
            case null { return #err("Institute Not Found") };
        };

        if (id.size() < MIN_ID_LENGTH or id.size() > MAX_ID_LENGTH) {
            return #err("ID length must be between " # debug_show MIN_ID_LENGTH # " and " # debug_show MAX_ID_LENGTH # " characters");
        };

        if (userType.size() < MIN_USER_TYPE_LENGTH or userType.size() > MAX_USER_TYPE_LENGTH) {
            return #err("User type length must be between " # debug_show MIN_USER_TYPE_LENGTH # " and " # debug_show MAX_USER_TYPE_LENGTH # " characters");
        };

        if (not noSpecialCharacters(id)) {
            return #err("ID cannot contain special characters");
        };

        if (not noSpecialCharacters(userType)) {
            return #err("User type cannot contain special characters");
        };

        let idToRegister = id # "@" # instituteName;

        // Check if principal already has an identity
        switch (BTree.get(identityMap, Principal.compare, principal)) {
            case (?identity) {
                return #err("Principal already has an identity registered" # identity.0);
            };
            case null {};
        };

        switch (BTree.has(reverseIdentityMap, Text.compare, idToRegister)) {
            case (true) {

                return #err(
                    "This ID is Already Registered Please Choose Different One"
                );
            };
            case (false) {
                ignore BTree.insert(identityMap, Principal.compare, principal, (idToRegister, userType));
                ignore BTree.insert(reverseIdentityMap, Text.compare, idToRegister, principal);
                #ok("Identity Registered Successfully");
            };
        };
    };

    public query ({ caller }) func getIdentity(principal : ?Principal) : async Result.Result<(Text, Text), Text> {
        switch (principal) {
            case (?principal) {
                switch (BTree.get(identityMap, Principal.compare, principal)) {
                    case (?identity) { #ok(identity) };
                    case null { #err("Identity not found") };
                };
            };
            case null {
                switch (BTree.get(identityMap, Principal.compare, caller)) {
                    case (?identity) { #ok(identity) };
                    case null { #err("Identity not found") };
                };
            };
        };
    };

    public query func getPrincipalAndIdentityTypeByID(id : Text) : async Result.Result<(Principal, Text), Text> {
        switch (BTree.get(reverseIdentityMap, Text.compare, id)) {
            case (?principal) {
                switch (BTree.get(identityMap, Principal.compare, principal)) {
                    case (?identity) { #ok((principal, identity.1)) };
                    case null { #err("Identity not found") };
                };
            };
            case null { #err("Identity not found") };
        };
    };

    public query func getPrincipalByID(id : Text) : async Result.Result<Principal, Text> {
        switch (BTree.get(reverseIdentityMap, Text.compare, id)) {
            case (?principal) { #ok(principal) };
            case null { #err("Principal not found for given ID") };
        };
    };

    public shared ({ caller }) func removeIdentity(id : Text) : async Result.Result<Text, Text> {

        let callerInstitute = switch (BTree.get(principalToInstituteName, Principal.compare, caller)) {
            case (?instituteName) { instituteName };
            case null { return #err("Institute Not Found") };
        };

        // // Ensure the ID belongs to the caller's institution
        if (not Text.endsWith(id, #text("@" # callerInstitute))) {
            return #err("Unauthorized: ID does not belong to your institution");
        };

        switch (BTree.get(reverseIdentityMap, Text.compare, id)) {
            case (?principal) {
                ignore BTree.delete(identityMap, Principal.compare, principal);
                ignore BTree.delete(reverseIdentityMap, Text.compare, id);
                #ok("Identity Removed Successfully");
            };
            case null {
                #err("Identity not found");
            };
        };
    };

    public shared ({ caller }) func registerAdmin(newAdmin : Text) : async Result.Result<Text, Text> {
        if (caller != Principal.fromText(admin)) {
            return #err("Unauthorized");
        };

        admin := newAdmin;
        return #ok("Admin Registered Successfully");
    };

    //Should Not Be Query Function Due To Security Concerns
    public func returnAdmin() : async Text {
        return admin;
    };

    public shared query ({ caller }) func whoami() : async Principal {
        return caller;
    };

    private func noSpecialCharacters(text : Text) : Bool {
        for (char in text.chars()) {
            if (not Char.isAlphabetic(char) and not Char.isDigit(char)) {
                return false;
            };
        };
        true;
    };
};
