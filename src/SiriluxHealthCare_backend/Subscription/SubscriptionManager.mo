import Array "mo:base/Array";
import Float "mo:base/Float";
import Int "mo:base/Int";
import Nat "mo:base/Nat";
import Nat32 "mo:base/Nat32";
import Option "mo:base/Option";
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
    type PremiumType = Types.PremiumType;

    // Define a new return type that includes premium expiration time
    type BalanceWithExpiration = {
        balance : Types.Balance;
        premiumExpirationTime : ?Int;
    };

    private let identityManager = CanisterTypes.identityManager;
    private let dataAssetService : CanisterTypes.DataService = actor (CanisterIDs.dataAssetCanisterID);
    private let icrcLedger : ICRC2.Service = actor (CanisterIDs.icrc_ledger_canister_id);

    private let ONE_DAY_NANOS : Nat = 86_400_000_000_000; // nanoseconds in a day
    private let TOKEN_PER_DATA_MB_PER_SECOND : Nat = 1; // 1 token per 1MB / Second
    private let FREE_DATA_MB : Nat = 100; // 100MB
    private let FREE_DATA_GB_PREMIUM : Nat = 5; // 5GB
    private let TOKEN_EXPIRATION = 300_000_000_000; // Token storage and expiration time (5 minutes in nanoseconds)
    private let AI_TOKEN_GENERATION_COST = 1;
    private let FREE_AI_MAX_TOKEN_REQUEST_PER_DAY = 5;
    private let PREMIUM_STATUS_COST_MONTHLY = 1000; // 1000 tokens
    private let PREMIUM_STATUS_EXPIRATION = 30 * 24 * 60 * 60; // 30 days in seconds
    private let BYTES_PER_MB : Nat = 1_000_000;
    private let BYTES_PER_GB : Nat = 1_000_000_000;
    private let PREMIUM_TYPE_YEARLY = #Yearly;
    private let PREMIUM_STATUS_YEARLY_DISCOUNT = 20; // 20% discount
    private let PREMIUM_STATUS_YEARLY_DURATION = 365 * 24 * 60 * 60; // 365 days in seconds

    private stable var subscriberMap : BTree.BTree<Principal, Types.Balance> = BTree.init<Principal, Types.Balance>(?128); // Subscriber Map (Principal, Balance (remaining tokens, stored dataMB, last Update Time, premium status))
    private stable var premiumExpirationMap : BTree.BTree<Principal, Int> = BTree.init<Principal, Int>(?128);

    private stable var tokenRequestMap : BTree.BTree<Principal, Nat> = BTree.init<Principal, Nat>(null); // Token Request Map (Principal, Nat) for storing the number of AI tokens requested by the user in the day
    private stable var tokenMap : BTree.BTree<Text, (Principal, Int)> = BTree.init<Text, (Principal, Int)>(null); // Token Map (Text, (Principal, Int)) for storing the token and the principal and the expiration time

    private stable var allDataServiceShards : BTree.BTree<Principal, ()> = BTree.init<Principal, ()>(null);
    private stable var principalTimerMap : BTree.BTree<Principal, Nat> = BTree.init<Principal, Nat>(?128); // Principal Timer Map (Principal, Timer) for deleting data after expiration

    private stable var permittedPrincipals : [Principal] = [Principal.fromText(CanisterIDs.dataAssetCanisterID), Principal.fromActor(this)]; // Add permitted principals here

    public shared ({ caller }) func buyPremiumStatus(principalToPurchase : ?Principal, premiumType : PremiumType) : async Result.Result<Text, Text> {

        // Determine if this is a self-purchase or an admin purchase for someone else
        let targetPrincipal = switch (principalToPurchase) {
            case (null) {
                // Self-purchase case
                caller;
            };
            case (?principal) {
                // Admin purchase case - verify caller is authorized
                if (caller != Principal.fromText(CanisterIDs.AIAgentAdmin)) {
                    return #err("Caller is not authorized to purchase premium for others" # debug_show Principal.toText(caller));
                };
                principal;
            };
        };

        let balance = switch (BTree.get(subscriberMap, Principal.compare, targetPrincipal)) {
            case (null) {
                {
                    tokens = 0;
                    dataBytes = 0;
                    lastUpdateTime = Time.now();
                    isPremium = false;
                };
            };
            case (?balance) {
                balance;
            };
        };

        // Check if this is a renewal
        let isRenewal = balance.isPremium;

        // Calculate cost based on premium type
        let premiumCost = if (premiumType == PREMIUM_TYPE_YEARLY) {
            // Apply 20% discount for yearly subscription
            // Cost for 12 months with 20% discount = 12 * monthly_cost * 0.8
            let yearlyPrice = (12 * PREMIUM_STATUS_COST_MONTHLY * (Int.abs(100 - PREMIUM_STATUS_YEARLY_DISCOUNT))) / 100;
            yearlyPrice;
        } else {
            PREMIUM_STATUS_COST_MONTHLY;
        };

        // For self-purchase, process the payment
        if (Option.isNull(principalToPurchase)) {
            let result = await icrcLedger.icrc2_transfer_from({
                from = { owner = caller; subaccount = null };
                spender_subaccount = null;
                to = { owner = Principal.fromActor(this); subaccount = null };
                amount = premiumCost * 100_000_000;
                fee = null;
                memo = ?Text.encodeUtf8(if (isRenewal) "Renew Premium Status" else "Buy Premium Status");
                created_at_time = null;
            });

            switch (result) {
                case (#Ok(_value)) {};
                case (#Err(error)) {
                    return #err(debug_show error);
                };
            };
        };

        let updatedBalance : Balance = {
            tokens = balance.tokens;
            dataBytes = balance.dataBytes;
            lastUpdateTime = balance.lastUpdateTime;
            isPremium = true;
        };

        ignore BTree.insert(subscriberMap, Principal.compare, targetPrincipal, updatedBalance);

        // Calculate total premium duration based on premium type
        var premiumDuration = if (premiumType == PREMIUM_TYPE_YEARLY) {
            PREMIUM_STATUS_YEARLY_DURATION;
        } else {
            PREMIUM_STATUS_EXPIRATION;
        };

        // If renewal, add remaining time from existing premium subscription
        if (isRenewal) {
            switch (BTree.get(premiumExpirationMap, Principal.compare, targetPrincipal)) {
                case (?expirationTime) {
                    let currentTime = Time.now() / 1_000_000_000; // Convert to seconds
                    if (expirationTime > currentTime) {
                        // Add remaining time to new premium duration
                        premiumDuration += (Int.abs(expirationTime - currentTime));
                    };
                };
                case (null) {
                    // No expiration time stored, use default duration
                };
            };

            // Cancel existing timer
            switch (BTree.get(principalTimerMap, Principal.compare, targetPrincipal)) {
                case (?timerId) { Timer.cancelTimer(timerId) };
                case (null) {};
            };

            // Update data storage immediately to reset timers based on renewed premium status
            // This ensures proper timer calculation based on current usage
            ignore await updateDataStorageUsedMap(targetPrincipal, 0);
        };

        // Calculate and store new expiration time
        let newExpirationTime = Time.now() / 1_000_000_000 + premiumDuration;
        ignore BTree.insert(premiumExpirationMap, Principal.compare, targetPrincipal, newExpirationTime);

        // Set timer to update storage metrics when premium expires
        let id = Timer.setTimer<system>(
            #seconds premiumDuration,
            func() : async () {
                // First, update the premium status to false
                switch (BTree.get(subscriberMap, Principal.compare, targetPrincipal)) {
                    case (?userBalance) {
                        let updatedBalance : Balance = {
                            tokens = userBalance.tokens;
                            dataBytes = userBalance.dataBytes;
                            lastUpdateTime = userBalance.lastUpdateTime;
                            isPremium = false;
                        };
                        ignore BTree.insert(subscriberMap, Principal.compare, targetPrincipal, updatedBalance);
                    };
                    case null {
                        // User doesn't exist in subscriber map anymore
                    };
                };

                // Then update data storage to recalculate timers based on non-premium status
                ignore await updateDataStorageUsedMap(targetPrincipal, 0);
            },
        );
        ignore BTree.insert(principalTimerMap, Principal.compare, targetPrincipal, id);

        let premiumTypeText = if (premiumType == PREMIUM_TYPE_YEARLY) {
            "yearly";
        } else {
            "monthly";
        };

        #ok(
            if (isRenewal) {
                "Successfully renewed " # premiumTypeText # " premium status";
            } else {
                "Successfully bought " # premiumTypeText # " premium status";
            }
        );
    };

    // Generate a simple auth token for AI cloud function access
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

                } else {

                    let tokenRequestRemainingResult = switch (BTree.get(tokenRequestMap, Principal.compare, caller)) {
                        case (null) {
                            ignore BTree.insert(tokenRequestMap, Principal.compare, caller, 1);
                            true;
                        };
                        case (?value) {
                            if (value < FREE_AI_MAX_TOKEN_REQUEST_PER_DAY) {
                                ignore BTree.insert(tokenRequestMap, Principal.compare, caller, value + 1);
                                true;
                            } else {
                                false;
                            };
                        };
                    };

                    if (tokenRequestRemainingResult) {
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
                        memo = ?Text.encodeUtf8("Generate AI Token");
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
    };

    // Verify a token (used by the cloud function)
    public shared ({ caller }) func verifyCloudFunctionToken(token : Text, principalText : Text) : async Result.Result<Bool, Text> {

        if (caller != Principal.fromText(CanisterIDs.AIAgentAdmin)) {
            return #err("Caller is not authorized");
        };

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
        let shardsPrincipal = BTree.get(allDataServiceShards, Principal.compare, caller);
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
                            dataBytes = 0;
                            lastUpdateTime = currentTime;
                            isPremium = false;
                        };
                    };
                };

                let elapsedNano = currentTime - currentBalance.lastUpdateTime;
                let elapsedSeconds = (elapsedNano / 1_000_000_000);

                var tokensConsumed : Nat = 0;

                if (currentBalance.isPremium) {

                    // Tokens consumed for remaining data
                    let usedBytesTillNow : Int = (currentBalance.dataBytes) - (FREE_DATA_GB_PREMIUM * BYTES_PER_GB);
                    if (usedBytesTillNow > 0) {
                        let currentBalanceMBUsedTillNow = Int.abs(usedBytesTillNow) / (BYTES_PER_MB);
                        tokensConsumed := (TOKEN_PER_DATA_MB_PER_SECOND) * (Int.abs(elapsedSeconds)) * (currentBalanceMBUsedTillNow);
                    };

                } else {

                    // Tokens consumed for remaining data
                    let usedBytesTillNow : Int = (currentBalance.dataBytes) - (FREE_DATA_MB * BYTES_PER_MB);
                    if (usedBytesTillNow > 0) {
                        let currentBalanceMBUsedTillNow = Int.abs(usedBytesTillNow) / (BYTES_PER_MB);
                        tokensConsumed := (TOKEN_PER_DATA_MB_PER_SECOND) * (Int.abs(elapsedSeconds)) * (currentBalanceMBUsedTillNow);
                    };

                };

                var changeDataBytes = (usedSpace);

                var newDataBytes = (currentBalance.dataBytes) + (changeDataBytes);
                if (newDataBytes < 0) {
                    newDataBytes := 0;
                };

                // Update balance
                let updatedBalance : Types.Balance = {
                    tokens = currentBalance.tokens - tokensConsumed;
                    dataBytes = Int.abs(newDataBytes);
                    lastUpdateTime = currentTime;
                    isPremium = currentBalance.isPremium;
                };

                var remainingSeconds : Float = 0.0;

                // Calculate chargeable bytes (above free tier)
                var chargeableBytes : Int = 0;
                if (updatedBalance.isPremium) {
                    chargeableBytes := Int.max(0, updatedBalance.dataBytes - (FREE_DATA_GB_PREMIUM * BYTES_PER_GB));
                } else {
                    chargeableBytes := Int.max(0, updatedBalance.dataBytes - (FREE_DATA_MB * BYTES_PER_MB));
                };

                // If using less than free tier, time is effectively infinite
                if (chargeableBytes == 0) {
                    remainingSeconds := Float.fromInt(9999999999); // Very large number to indicate "infinite"
                } else {
                    let chargeableMB = chargeableBytes / BYTES_PER_MB;
                    // Calculate how long tokens will last with current usage
                    remainingSeconds := Float.fromInt(updatedBalance.tokens / (TOKEN_PER_DATA_MB_PER_SECOND * chargeableMB));
                };

                ignore BTree.insert(subscriberMap, Principal.compare, principal, updatedBalance);

                if (updatedBalance.dataBytes <= (FREE_DATA_MB * BYTES_PER_MB)) {
                    switch (BTree.get(principalTimerMap, Principal.compare, principal)) {
                        case (?value) {
                            Timer.cancelTimer(value);
                        };
                        case (null) {
                            // No timer to cancel
                        };
                    };
                } else if (updatedBalance.isPremium and (updatedBalance.dataBytes < (FREE_DATA_GB_PREMIUM * BYTES_PER_GB))) {
                    switch (BTree.get(principalTimerMap, Principal.compare, principal)) {
                        case (?value) {
                            Timer.cancelTimer(value);
                        };
                        case (null) {
                            // No timer to cancel
                        };
                    };
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

    public shared query ({ caller }) func checkDataStorageUsedMap(principal : Principal, usedSpace : Int) : async Result.Result<Types.TimeRemaining, Text> {
        let shardsPrincipal = BTree.get(allDataServiceShards, Principal.compare, caller);
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
                            dataBytes = 0;
                            lastUpdateTime = currentTime;
                            isPremium = false;
                        };
                    };
                };

                let elapsedNano = currentTime - currentBalance.lastUpdateTime;
                let elapsedSeconds = (elapsedNano / 1_000_000_000);

                var tokensConsumed : Nat = 0;

                if (currentBalance.isPremium) {

                    // Tokens consumed for remaining data
                    let usedBytesTillNow : Int = (currentBalance.dataBytes) - (FREE_DATA_GB_PREMIUM * BYTES_PER_GB);
                    if (usedBytesTillNow > 0) {
                        let currentBalanceMBUsedTillNow = Int.abs(usedBytesTillNow) / (BYTES_PER_MB);
                        tokensConsumed := (TOKEN_PER_DATA_MB_PER_SECOND) * (Int.abs(elapsedSeconds)) * (currentBalanceMBUsedTillNow);
                    };

                } else {

                    // Tokens consumed for remaining data
                    let usedBytesTillNow : Int = (currentBalance.dataBytes) - (FREE_DATA_MB * BYTES_PER_MB);
                    if (usedBytesTillNow > 0) {
                        let currentBalanceMBUsedTillNow = Int.abs(usedBytesTillNow) / (BYTES_PER_MB);
                        tokensConsumed := (TOKEN_PER_DATA_MB_PER_SECOND) * (Int.abs(elapsedSeconds)) * (currentBalanceMBUsedTillNow);
                    };

                };

                var changeDataBytes = (usedSpace);

                var newDataBytes = (currentBalance.dataBytes) + (changeDataBytes);
                if (newDataBytes < 0) {
                    newDataBytes := 0;
                };

                // Update balance
                let hypotheticalUpdatedBalance : Types.Balance = {
                    tokens = currentBalance.tokens - tokensConsumed;
                    dataBytes = Int.abs(newDataBytes);
                    lastUpdateTime = currentTime;
                    isPremium = currentBalance.isPremium;
                };

                var remainingSeconds : Float = 0.0;

                // Calculate chargeable bytes (above free tier)
                var chargeableBytes : Int = 0;
                if (hypotheticalUpdatedBalance.isPremium) {
                    chargeableBytes := Int.max(0, hypotheticalUpdatedBalance.dataBytes - (FREE_DATA_GB_PREMIUM * BYTES_PER_GB));
                } else {
                    chargeableBytes := Int.max(0, hypotheticalUpdatedBalance.dataBytes - (FREE_DATA_MB * BYTES_PER_MB));
                };

                // If using less than free tier, time is effectively infinite
                if (chargeableBytes == 0) {
                    remainingSeconds := Float.fromInt(9999999999); // Very large number to indicate "infinite"
                } else {
                    let chargeableMB = chargeableBytes / BYTES_PER_MB;
                    // Calculate how long tokens will last with current usage
                    remainingSeconds := Float.fromInt(hypotheticalUpdatedBalance.tokens / (TOKEN_PER_DATA_MB_PER_SECOND * chargeableMB));
                };

                if (hypotheticalUpdatedBalance.dataBytes <= (FREE_DATA_MB * BYTES_PER_MB)) {
                    return #ok({
                        seconds = remainingSeconds;
                        minutes = remainingSeconds / 60.0;
                        hours = remainingSeconds / (60.0 * 60.0);
                        days = remainingSeconds / (24.0 * 60.0 * 60.0);
                    });
                } else if (hypotheticalUpdatedBalance.isPremium and (hypotheticalUpdatedBalance.dataBytes <= (FREE_DATA_GB_PREMIUM * BYTES_PER_GB))) {
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

    public shared query ({ caller }) func getTotalDataBalance(principalText : ?Text) : async Result.Result<BalanceWithExpiration, Text> {
        let principal = switch (principalText) {
            case (?text) { Principal.fromText(text) };
            case null { caller };
        };

        switch (BTree.get(subscriberMap, Principal.compare, principal)) {
            case (?balance) {
                let expirationTime = BTree.get(premiumExpirationMap, Principal.compare, principal);
                #ok({
                    balance = balance;
                    premiumExpirationTime = expirationTime;
                });
            };
            case null { #err("Not a subscriber") };
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

        let tokensToadd = Int.abs(((amount) * 24 * 60 * 60 * 30) / 100) * 1000; // 30 days for 100 tokens

        switch (BTree.get(subscriberMap, Principal.compare, caller)) {
            case (?balance) {
                let updatedBalance : Balance = {
                    tokens = balance.tokens + tokensToadd;
                    dataBytes = balance.dataBytes;
                    lastUpdateTime = balance.lastUpdateTime;
                    isPremium = balance.isPremium;
                };
                ignore BTree.insert(subscriberMap, Principal.compare, caller, updatedBalance);
                #ok("Successfully added tokens to balance");
            };
            case null {
                let newBalance : Balance = {
                    tokens = (tokensToadd);
                    dataBytes = 0;
                    lastUpdateTime = Time.now();
                    isPremium = false;
                };
                ignore BTree.insert(subscriberMap, Principal.compare, caller, newBalance);
                #ok("Successfully added tokens to balance");
            };
        };
    };

    public shared ({ caller }) func addActorPrincipalToDataServiceShards() : async Result.Result<Text, Text> {
        if (not (await isAdmin(caller))) {
            return #err("You are not permitted to perform this operation");
        };
        ignore BTree.insert(allDataServiceShards, Principal.compare, Principal.fromActor(this), ());
        #ok("Successfully added actor principal to data storage shards");
    };

    public shared ({ caller }) func addAllDataServiceShards(principal : Principal) : async Result.Result<Text, Text> {
        if (not isPermitted(caller)) {
            return #err("You are not permitted to perform this operation");
        };
        ignore BTree.insert(allDataServiceShards, Principal.compare, principal, ());
        #ok("Successfully added data storage shard");
    };

    public shared ({ caller }) func removeAllDataServiceShards(principal : Principal) : async Result.Result<Text, Text> {
        if (not isPermitted(caller)) {
            return #err("You are not permitted to perform this operation");
        };
        ignore BTree.delete(allDataServiceShards, Principal.compare, principal);
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

    public shared query ({ caller }) func getRemainingTokenRequest(principalText : ?Text) : async Result.Result<Nat, Text> {
        let principal = switch (principalText) {
            case (?text) { Principal.fromText(text) };
            case null { caller };
        };
        switch (BTree.get(tokenRequestMap, Principal.compare, principal)) {
            case (?value) { #ok(value) };
            case null { #ok(0) };
        };
    };

    //private func runDailyTask() : async () {
    private func runDailyTask() : async () {
        BTree.clear(tokenRequestMap);
    };

    // Calculate time until next midnight UTC
    func timeUntilNextMidnight() : Nat {
        let currentTime = Int.abs(Time.now());
        ONE_DAY_NANOS - (currentTime % ONE_DAY_NANOS);
    };

    // Set up the recurring timer
    Timer.setTimer<system>(
        #nanoseconds(timeUntilNextMidnight()),
        func() : async () {
            ignore Timer.recurringTimer<system>(#nanoseconds(ONE_DAY_NANOS), runDailyTask);
            await runDailyTask();
        },
    );
};
