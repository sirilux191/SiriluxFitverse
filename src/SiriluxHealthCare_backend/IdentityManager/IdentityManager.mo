import Principal "mo:base/Principal";
import Result "mo:base/Result";
import Text "mo:base/Text";
import BTree "mo:stableheapbtreemap/BTree";

import CanisterIDs "../Types/CanisterIDs";

actor class IdentityManager() {

    private stable var admin : Text = ("");
    private stable var isAdminRegistered = false;

    private stable var identityMap : BTree.BTree<Principal, (Text, Text)> = BTree.init<Principal, (Text, Text)>(null);
    private stable var reverseIdentityMap : BTree.BTree<Text, Principal> = BTree.init<Text, Principal>(null);

    private stable var permittedPrincipals : [Principal] = [
        Principal.fromText(CanisterIDs.userServiceCanisterID),
        Principal.fromText(CanisterIDs.professionalServiceCanisterID),
        Principal.fromText(CanisterIDs.facilityServiceCanisterID),
        Principal.fromText(CanisterIDs.dataAssetCanisterID),
        Principal.fromText(CanisterIDs.sharedActivityCanisterID),
        Principal.fromText(CanisterIDs.gamificationSystemCanisterID),
    ];

    ///Permitted Principal Bind to @instituteName, For Example :- BTree Principal <-> @FortisHospital

    public shared ({ caller }) func registerIdentity(principal : Principal, id : Text, userType : Text) : async Result.Result<(), Text> {
        if (not isPermitted(caller)) {
            return #err("Unauthorized");
        };
        switch (BTree.has(reverseIdentityMap, Text.compare, id)) {
            case (true) {
                return #err(
                    "This ID is Already Registered Please Choose Different One"
                );
            };
            case (false) {};
        };
        ignore BTree.insert(identityMap, Principal.compare, principal, (id, userType));
        ignore BTree.insert(reverseIdentityMap, Text.compare, id, principal);
        #ok(());
    };

    public query func getIdentity(principal : Principal) : async Result.Result<(Text, Text), Text> {
        switch (BTree.get(identityMap, Principal.compare, principal)) {
            case (?identity) { #ok(identity) };
            case null { #err("Identity not found") };
        };
    };

    public shared query ({ caller }) func checkRegistration() : async Result.Result<Text, Text> {
        switch (BTree.get(identityMap, Principal.compare, caller)) {
            case (?identity) { #ok(identity.1) };
            case null { #err("Identity not found") };
        };
    };

    public shared query func checkRegistrationByPrincipal(id : Principal) : async Result.Result<Text, Text> {
        switch (BTree.get(identityMap, Principal.compare, id)) {
            case (?identity) { #ok(identity.1) };
            case null { #err("Identity not found") };
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

    public shared ({ caller }) func removeIdentity(id : Text) : async Result.Result<(), Text> {
        if (not isPermitted(caller)) {
            return #err("Unauthorized");
        };
        switch (BTree.get(reverseIdentityMap, Text.compare, id)) {
            case (?principal) {
                ignore BTree.delete(identityMap, Principal.compare, principal);
                ignore BTree.delete(reverseIdentityMap, Text.compare, id);
                #ok(());
            };
            case null {
                #err("Identity not found");
            };
        };
    };

    public shared ({ caller }) func registerAdmin() : async Result.Result<Text, Text> {

        if (isAdminRegistered) {
            return #err("Admin is already Registered");
        };

        admin := Principal.toText(caller);
        isAdminRegistered := true;
        return #ok("Admin Registered Successfully");
    };

    public shared query ({ caller }) func getIdentityBySelf() : async Result.Result<(Text, Text), Text> {
        switch (BTree.get(identityMap, Principal.compare, caller)) {
            case (?identity) { #ok(identity) };
            case null { #err("Identity not found") };
        };
    };

    public shared query ({ caller }) func whoami() : async Principal {
        return caller;
    };

    private func isPermitted(principal : Principal) : Bool {
        for (permittedPrincipal in permittedPrincipals.vals()) {
            if (permittedPrincipal == principal) {
                return true;
            };
        };
        return false;
    };
    //Should Not Be Query Function Due To Security Concerns
    public func returnAdmin() : async Text {
        return admin;
    };
};
