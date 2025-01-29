import Principal "mo:base/Principal";
import Result "mo:base/Result";
import Text "mo:base/Text";
import BTree "mo:stableheapbtreemap/BTree";

actor class IdentityManager() {

    private stable var admin : Text = ("");
    private stable var isAdminRegistered = false;

    private stable var identityMap : BTree.BTree<Principal, (Text, Text)> = BTree.init<Principal, (Text, Text)>(null);
    private stable var reverseIdentityMap : BTree.BTree<Text, Principal> = BTree.init<Text, Principal>(null);

    public func registerIdentity(principal : Principal, id : Text, userType : Text) : async Result.Result<(), Text> {
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

    public query func getPrincipalByID(id : Text) : async Result.Result<Principal, Text> {
        switch (BTree.get(reverseIdentityMap, Text.compare, id)) {
            case (?principal) { #ok(principal) };
            case null { #err("Principal not found for given ID") };
        };
    };

    public shared func removeIdentity(id : Text) : async Result.Result<(), Text> {
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

    public func returnAdmin() : async Text {
        return admin;
    };
};
