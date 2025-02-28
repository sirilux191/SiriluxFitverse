import Array "mo:base/Array";
import Debug "mo:base/Debug";
import Float "mo:base/Float";
import Int "mo:base/Int";
import Nat "mo:base/Nat";
import Nat32 "mo:base/Nat32";
import Principal "mo:base/Principal";
import Result "mo:base/Result";
import Text "mo:base/Text";
import Time "mo:base/Time";
import Timer "mo:base/Timer";
import ICRC2 "mo:icrc2-types";
import BTree "mo:stableheapbtreemap/BTree";

import Types "../Types";
import CanisterIDs "../Types/CanisterIDs";
import CanisterTypes "../Types/CanisterTypes";

actor class SubscriptionManager() = this {
    type Balance = Types.Balance;

    private let identityManager = CanisterTypes.identityManager;

    private let dataAssetService : CanisterTypes.DataService = actor (CanisterIDs.dataAssetCanisterID);
    private let icrcLedger : ICRC2.Service = actor (CanisterIDs.icrc_ledger_canister_id);
    private stable var subscriberMap : BTree.BTree<Principal, Types.Balance> = BTree.init<Principal, Types.Balance>(?128); // Subscriber Map (Principal, Balance (remaining tokens, stored dataMB, last Update Time))

    private stable var principalTimerMap : BTree.BTree<Principal, Nat> = BTree.init<Principal, Nat>(?128); // Principal Timer Map (Principal, Timer)

    private let allDataServiceDataStorageShards : BTree.BTree<Principal, ()> = BTree.init<Principal, ()>(?128);

    private let TOKEN_PER_DATA_MB_PER_SECOND : Nat = 1; // 1 token per 1MB / Second
    // Token storage and expiration time (5 minutes in nanoseconds)
    private let TOKEN_EXPIRATION = 300_000_000_000;
    private let AI_TOKEN_GENERATION_COST = 1; // 1 tokens
    private let PREMIUM_STATUS_COST = 1000; // 1000 tokens
    private stable var tokenMap : BTree.BTree<Text, (Principal, Int)> = BTree.init<Text, (Principal, Int)>(null);

    private stable var permittedPrincipals : [Principal] = [Principal.fromText(CanisterIDs.dataAssetCanisterID)]; // Add permitted principals here

    public shared ({ caller }) func buyPremiumStatus() : async Result.Result<Text, Text> {
        let balance = switch (BTree.get(subscriberMap, Principal.compare, caller)) {
            case (null) {
                {
                    tokens = 0;
                    dataMB = 0;
                    lastUpdateTime = Time.now();
                    isPremium = false;
                };
            };
            case (?balance) {
                balance;
            };
        };

        if (balance.isPremium) {
            return #err("User already has premium status");
        };

        let result = await icrcLedger.icrc2_transfer_from({
            from = { owner = caller; subaccount = null };
            spender_subaccount = null;
            to = { owner = Principal.fromActor(this); subaccount = null };
            amount = PREMIUM_STATUS_COST * 100_000_000;
            fee = null;
            memo = ?Text.encodeUtf8("Buy Premium : " # debug_show PREMIUM_STATUS_COST);
            created_at_time = null;
        });

        switch (result) {
            case (#Ok(_value)) {

            };
            case (#Err(error)) {
                return #err(debug_show error);
            };
        };

        let updatedBalance : Balance = {
            tokens = balance.tokens - PREMIUM_STATUS_COST;
            dataMB = balance.dataMB;
            lastUpdateTime = Time.now();
            isPremium = true;
        };
        ignore BTree.insert(subscriberMap, Principal.compare, caller, updatedBalance);
        #ok("Successfully bought premium status");

    };
    // Generate a simple auth token for cloud function access
    public shared ({ caller }) func generateCloudFunctionToken() : async Result.Result<Text, Text> {
        // Verify the caller has an identity
        switch (BTree.get(subscriberMap, Principal.compare, caller)) {
            case (null) {
                return #err("User not registered");
            };
            case (?balance) {
                if (balance.isPremium) {
                    // Generate a token (hash of principal + timestamp)
                    let timestamp = Time.now();
                    let tokenText = Principal.toText(caller) # Int.toText(timestamp);
                    let token = Text.concat("SHC-", Nat32.toText(Text.hash(tokenText)));

                    // Store the token with expiration
                    ignore BTree.insert(tokenMap, Text.compare, token, (caller, timestamp + TOKEN_EXPIRATION));

                    return #ok(token);
                };
                let result = await icrcLedger.icrc2_transfer_from({
                    from = { owner = caller; subaccount = null };
                    spender_subaccount = null;
                    to = {
                        owner = Principal.fromActor(this);
                        subaccount = null;
                    };
                    amount = AI_TOKEN_GENERATION_COST * 10_000_000; // 0.1 token
                    fee = null;
                    memo = ?Text.encodeUtf8("Generate AI Token: " # debug_show AI_TOKEN_GENERATION_COST);
                    created_at_time = null;
                });

                switch (result) {
                    case (#Ok(_value)) {

                    };
                    case (#Err(error)) {
                        return #err(debug_show error);
                    };
                };

                // Generate a token (hash of principal + timestamp)
                let timestamp = Time.now();
                let tokenText = Principal.toText(caller) # Int.toText(timestamp);
                let token = Text.concat("SHC-", Nat32.toText(Text.hash(tokenText)));

                // Store the token with expiration
                ignore BTree.insert(tokenMap, Text.compare, token, (caller, timestamp + TOKEN_EXPIRATION));

                return #ok(token);

            };
        };
    };

    // Verify a token (used by the cloud function)
    public query func verifyCloudFunctionToken(token : Text, principalText : Text) : async Result.Result<Bool, Text> {
        switch (BTree.get(tokenMap, Text.compare, token)) {
            case (null) {
                return #err("Invalid token");
            };
            case (?(tokenPrincipal, expirationTime)) {
                let currentTime = Time.now();

                if (currentTime > expirationTime) {
                    // Token expired, remove it
                    ignore BTree.delete(tokenMap, Text.compare, token);
                    return #err("Token expired");
                };

                // Verify the principal matches
                if (Principal.toText(tokenPrincipal) != principalText) {
                    return #err("Token mismatch");
                };

                return #ok(true);
            };
        };
    };

    public shared ({ caller }) func updateDataStorageUsedMap(principal : Principal, usedSpace : Int) : async Result.Result<Types.TimeRemaining, Text> {
        let shardsPrincipal = BTree.get(allDataServiceDataStorageShards, Principal.compare, caller);
        switch (shardsPrincipal) {
            case (null) {
                return #err("Caller is not a data storage shard");
            };
            case (?_) {

                let currentTime = Time.now();

                // Get or initialize subscriber balance
                let currentBalance = switch (BTree.get(subscriberMap, Principal.compare, principal)) {
                    case (?balance) { balance };
                    case null {
                        {
                            tokens = 0;
                            dataMB = 0;
                            lastUpdateTime = currentTime;
                            isPremium = false;
                        };
                    };
                };

                // Calculate elapsed time and token consumption
                let elapsedNano = currentTime - currentBalance.lastUpdateTime;
                let elapsedSeconds = Int.div(elapsedNano, 1_000_000_000);
                var tokensConsumed : Int = 0;
                if (currentBalance.dataMB <= 100) {
                    // No tokens consumed for first 100MB
                } else {
                    tokensConsumed := (TOKEN_PER_DATA_MB_PER_SECOND) * (Int.abs(elapsedSeconds)) * currentBalance.dataMB;
                };

                // Calculate new data size in MB, minimum 1MB if there's any data
                var newDataMB = usedSpace / 1_000_000; // Convert bytes to MB
                if (usedSpace > 0 and newDataMB == 0) {
                    // If file exists but is less than 1MB, count it as 1MB
                    newDataMB := 1;
                };

                // Update balance
                let updatedBalance : Types.Balance = {
                    tokens = currentBalance.tokens - Int.abs(tokensConsumed);
                    dataMB = Int.abs(newDataMB + currentBalance.dataMB);
                    lastUpdateTime = currentTime;
                    isPremium = currentBalance.isPremium;
                };
                Debug.print("Updated Balance: " # debug_show updatedBalance);

                let remainingSeconds = Float.fromInt((updatedBalance.tokens) / ((TOKEN_PER_DATA_MB_PER_SECOND) * (updatedBalance.dataMB)));

                ignore BTree.insert(subscriberMap, Principal.compare, principal, updatedBalance);

                if (updatedBalance.dataMB <= 100) {
                    switch (BTree.get(principalTimerMap, Principal.compare, principal)) {
                        case (?value) {
                            Timer.cancelTimer(value);
                        };
                        case (null) {
                            // No timer to cancel
                        };
                    };
                } else if (updatedBalance.isPremium and (updatedBalance.dataMB < 1000)) {
                    switch (BTree.get(principalTimerMap, Principal.compare, principal)) {
                        case (?value) {
                            Timer.cancelTimer(value);
                        };
                        case (null) {
                            // No timer to cancel
                        };
                    };
                } else if (remainingSeconds <= (24.0 * 60.0 * 60.0 * 1)) {
                    //Less than 1 Days
                    return #err("Remaining time after updating storage is less than 1 Days Add Tokens or Update Storage");
                } else {
                    let triggerAfter : Nat = Int.abs(Float.toInt(remainingSeconds));
                    let id = Timer.setTimer<system>(
                        #seconds triggerAfter,
                        func() : async () {
                            ignore await dataAssetService.deleteAllDataForPrincipal(principal);
                        },
                    );

                    ignore BTree.insert(principalTimerMap, Principal.compare, principal, id);
                };

                return #ok({
                    seconds = remainingSeconds;
                    minutes = remainingSeconds / 60.0;
                    hours = remainingSeconds / (60.0 * 60.0);
                    days = remainingSeconds / (24.0 * 60.0 * 60.0);
                });

            };
        };

    };

    public shared ({ caller }) func checkDataStorageUsedMap(principal : Principal, usedSpace : Int) : async Result.Result<Types.TimeRemaining, Text> {
        let shardsPrincipal = BTree.get(allDataServiceDataStorageShards, Principal.compare, caller);
        switch (shardsPrincipal) {
            case (null) {
                return #err("Caller is not a data storage shard");
            };
            case (?_) {
                let currentTime = Time.now();

                // Get or initialize subscriber balance
                let currentBalance = switch (BTree.get(subscriberMap, Principal.compare, principal)) {
                    case (?balance) { balance };
                    case null {
                        {
                            tokens = 0;
                            dataMB = 0;
                            lastUpdateTime = currentTime;
                            isPremium = false;
                        };
                    };
                };

                // Calculate elapsed time and token consumption
                let elapsedNano = currentTime - currentBalance.lastUpdateTime;
                let elapsedSeconds = Int.div(elapsedNano, 1_000_000_000);
                var tokensConsumed : Int = 0;
                if (currentBalance.dataMB <= 100) {
                    // No tokens consumed for first 100MB
                } else {
                    tokensConsumed := (TOKEN_PER_DATA_MB_PER_SECOND) * (Int.abs(elapsedSeconds)) * currentBalance.dataMB;
                };

                // Calculate new data size in MB, minimum 1MB
                var newDataMB = usedSpace / 1_000_000; // Convert bytes to MB
                if (usedSpace > 0 and newDataMB == 0) {
                    // If file exists but is less than 1MB, count it as 1MB
                    newDataMB := 1;
                };

                // Calculate hypothetical updated balance
                let hypotheticalBalance : Balance = {
                    tokens = currentBalance.tokens - Int.abs(tokensConsumed);
                    dataMB = Int.abs(newDataMB + currentBalance.dataMB);
                    lastUpdateTime = currentTime;
                    isPremium = currentBalance.isPremium;
                };

                var remainingSeconds : Float = 0.0;
                if (hypotheticalBalance.dataMB > 0 and hypotheticalBalance.tokens > 0) {
                    remainingSeconds := Float.fromInt((hypotheticalBalance.tokens)) / (Float.fromInt(TOKEN_PER_DATA_MB_PER_SECOND) * Float.fromInt(hypotheticalBalance.dataMB));
                };

                if (currentBalance.dataMB <= 100) {
                    return #ok({
                        seconds = remainingSeconds;
                        minutes = remainingSeconds / 60.0;
                        hours = remainingSeconds / (60.0 * 60.0);
                        days = remainingSeconds / (24.0 * 60.0 * 60.0);
                    });
                } else if (currentBalance.isPremium and (currentBalance.dataMB < 1000)) {
                    return #ok({
                        seconds = remainingSeconds;
                        minutes = remainingSeconds / 60.0;
                        hours = remainingSeconds / (60.0 * 60.0);
                        days = remainingSeconds / (24.0 * 60.0 * 60.0);
                    });
                } else if (remainingSeconds <= (24.0 * 60.0 * 60.0 * 1)) {
                    return #err("Remaining time after updating storage would be less than 1 day. Add tokens or update storage.");
                };

                return #ok({
                    seconds = remainingSeconds;
                    minutes = remainingSeconds / 60.0;
                    hours = remainingSeconds / (60.0 * 60.0);
                    days = remainingSeconds / (24.0 * 60.0 * 60.0);
                });
            };

        };
    };

    public shared query ({ caller }) func getTotalDataBalance(principalText : ?Text) : async Result.Result<Types.Balance, Text> {
        let principal = switch (principalText) {
            case (?text) { Principal.fromText(text) };
            case null { caller };
        };

        switch (BTree.get(subscriberMap, Principal.compare, principal)) {
            case (?balance) { #ok(balance) };
            case null { #err("Not a subscriber") };
        };
    };

    public shared query ({ caller }) func getRemainingStorageTime(principalText : ?Text) : async Result.Result<Types.TimeRemaining, Text> {
        let principal = switch (principalText) {
            case (?text) { Principal.fromText(text) };
            case null { caller };
        };

        switch (BTree.get(subscriberMap, Principal.compare, principal)) {
            case (?balance) {
                if (balance.tokens <= 0 or balance.dataMB <= 0) {
                    return #ok({
                        seconds = 0.0;
                        minutes = 0.0;
                        hours = 0.0;
                        days = 0.0;
                    });
                };

                let remainingSeconds = Float.fromInt(balance.tokens) / ((Float.fromInt(TOKEN_PER_DATA_MB_PER_SECOND)) * Float.fromInt(balance.dataMB));

                #ok({
                    seconds = remainingSeconds;
                    minutes = remainingSeconds / 60.0;
                    hours = remainingSeconds / (60.0 * 60.0);
                    days = remainingSeconds / (24.0 * 60.0 * 60.0);
                });
            };
            case null {
                #err("No balance found for principal");
            };
        };
    };

    public shared ({ caller }) func addTokensToBalance(amount : Nat) : async Result.Result<Text, Text> {

        let result = await icrcLedger.icrc2_transfer_from({
            from = { owner = caller; subaccount = null };
            spender_subaccount = null;
            to = { owner = Principal.fromActor(this); subaccount = null };
            amount = amount * 100_000_000;
            fee = null;
            memo = ?Text.encodeUtf8("Add Tokens Subscriber: " # debug_show amount);
            created_at_time = null;
        });

        switch (result) {
            case (#Ok(_value)) {

            };
            case (#Err(error)) {
                return #err(debug_show error);
            };
        };

        let tokensToadd = Int.abs(Float.toInt((Float.fromInt(amount) * 24 * 60 * 60 * 30) / 100));

        switch (BTree.get(subscriberMap, Principal.compare, caller)) {
            case (?balance) {
                let updatedBalance : Balance = {
                    tokens = balance.tokens + tokensToadd;
                    dataMB = balance.dataMB;
                    lastUpdateTime = balance.lastUpdateTime;
                    isPremium = balance.isPremium;
                };
                ignore BTree.insert(subscriberMap, Principal.compare, caller, updatedBalance);
                #ok("Successfully added tokens to balance");
            };
            case null {
                let newBalance : Balance = {
                    tokens = (tokensToadd);
                    dataMB = 0; // Initialize with 100MB
                    lastUpdateTime = Time.now();
                    isPremium = false;
                };
                ignore BTree.insert(subscriberMap, Principal.compare, caller, newBalance);
                #ok("Successfully added tokens to balance");
            };
        };
    };

    public shared ({ caller }) func addAllDataServiceShards(principal : Principal) : async Result.Result<Text, Text> {
        if (not isPermitted(caller)) {
            return #err("You are not permitted to perform this operation");
        };
        ignore BTree.insert(allDataServiceDataStorageShards, Principal.compare, principal, ());
        #ok("Successfully added data storage shard");
    };

    public shared ({ caller }) func removeAllDataServiceShards(principal : Principal) : async Result.Result<Text, Text> {
        if (not isPermitted(caller)) {
            return #err("You are not permitted to perform this operation");
        };
        ignore BTree.delete(allDataServiceDataStorageShards, Principal.compare, principal);
        #ok("Successfully removed data storage shard");
    };

    private func isAdmin(caller : Principal) : async Bool {
        if (Principal.fromText(await identityManager.returnAdmin()) == (caller)) {
            true;
        } else {
            false;
        };
    };

    private func isPermitted(caller : Principal) : Bool {
        Array.find<Principal>(permittedPrincipals, func(p) { p == caller }) != null;
    };

    public shared ({ caller }) func addPermittedPrincipal(principal : Principal) : async Result.Result<(), Text> {
        if (not (await isAdmin(caller))) {
            return #err("You are not permitted to perform this operation");
        };
        permittedPrincipals := Array.append(permittedPrincipals, [principal]);
        #ok(());
    };

    public shared ({ caller }) func removePermittedPrincipal(principal : Principal) : async Result.Result<(), Text> {
        if (not (await isAdmin(caller))) {
            return #err("You are not permitted to perform this operation");
        };
        permittedPrincipals := Array.filter(permittedPrincipals, func(p : Principal) : Bool { p != principal });
        #ok(());
    };

    public shared query ({ caller }) func isPremium(principalText : ?Text) : async Bool {
        let principal = switch (principalText) {
            case (?text) { Principal.fromText(text) };
            case null { caller };
        };
        switch (BTree.get(subscriberMap, Principal.compare, principal)) {
            case (?balance) { balance.isPremium };
            case null { false };
        };
    };
};
