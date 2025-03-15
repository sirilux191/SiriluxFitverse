import Array "mo:base/Array";
import Blob "mo:base/Blob";
import Debug "mo:base/Debug";
import Float "mo:base/Float";
import Int "mo:base/Int";
import Nat "mo:base/Nat";
import Nat32 "mo:base/Nat32";
import Principal "mo:base/Principal";
import Result "mo:base/Result";
import Text "mo:base/Text";
import Time "mo:base/Time";
import ICRC2 "mo:icrc2-types";
import ICRC7 "mo:icrc7-mo";
import BTree "mo:stableheapbtreemap/BTree";
import Source "mo:uuid/async/SourceV4";
import UUID "mo:uuid/UUID";

import GamificationTypes "../Gamification/GamificationTypes";
import WellnessAvatarNFT "../Gamification/WellnessAvatarNFT";
import CanisterIDs "../Types/CanisterIDs";

actor class AIAgentSystem() = this {

    type Visit = GamificationTypes.Visit;
    type VisitMode = GamificationTypes.VisitMode;
    type Account = ICRC7.Account;
    type NFT = {
        owner : ?Account;
        token_id : Nat;
        metadata : [(Text, Value)];
    };
    private type SetNFTError = {
        #NonExistingTokenId;
        #TokenExists;
        #GenericError : { error_code : Nat; message : Text };
        #TooOld;
        #CreatedInFuture : { ledger_time : Nat64 };
    };
    private type SetNFTRequest = [{
        token_id : Nat;
        owner : ?Account;
        metadata : [(Text, Value)];
        memo : ?Blob;
        created_at_time : ?Nat64;
        override : Bool;
    }];
    private type SetNFTResult = {
        #Ok : ?Nat;
        #Err : SetNFTError;
        #GenericError : { error_code : Nat; message : Text };
    };
    private type Value = ICRC7.Value;

    // AI Agent representation
    type AIAgent = {
        id : Text;
        assistantId : Text;
        name : Text;
        specialization : [Text];
        description : Text;
        visitCost : Nat;
    };

    // Token storage
    type AuthToken = {
        principal : Principal;
        agentId : Text;
        expirationTime : Int;
    };

    // AI Visit - without slot booking, just direct visits
    type AIVisit = {
        visitId : Nat;
        userId : Text;
        agentId : Text;
        status : GamificationTypes.VisitStatus;
        timestamp : GamificationTypes.VisitTimeStamps;
        payment : GamificationTypes.VisitPrice;
        avatarId : Nat;
    };

    private let ICRC_DECIMALS : Nat = 100_000_000;
    private let TOKEN_EXPIRATION = 300_000_000_000; // 5 minutes in nanoseconds

    private let wellnessAvatarNFT : WellnessAvatarNFT.WellnessAvatarNFT = actor (CanisterIDs.wellnessAvatarNFTCanisterID);
    private let icrcLedger : ICRC2.Service = actor (CanisterIDs.icrc_ledger_canister_id);

    // STABLE VARIABLES
    private stable var aiAgents : BTree.BTree<Text, AIAgent> = BTree.init<Text, AIAgent>(null);
    private stable var aiVisits : BTree.BTree<Nat, AIVisit> = BTree.init<Nat, AIVisit>(null);
    private stable var userAIVisits : BTree.BTree<Text, [Nat]> = BTree.init<Text, [Nat]>(null);
    private stable var agentAIVisits : BTree.BTree<Text, [Nat]> = BTree.init<Text, [Nat]>(null);
    private stable var nextVisitId : Nat = 1;
    private stable var authTokens : BTree.BTree<Text, AuthToken> = BTree.init<Text, AuthToken>(null);

    // Process a visit with an AI Agent
    public shared ({ caller }) func processVisit(
        agentId : Text,
        avatarId : Nat,
        callerId : ?Text,
    ) : async Result.Result<Text, Text> {
        // Check if agent exists
        switch (BTree.get(aiAgents, Text.compare, agentId)) {
            case (null) { return #err("AI Agent not found") };
            case (?agent) {

                let isAdmin = Principal.toText(caller) == CanisterIDs.AIAgentAdmin;

                // Avatar ownership verification for all users (admin and non-admin)
                let ownerResult = await wellnessAvatarNFT.icrc7_owner_of([avatarId]);
                switch (ownerResult[0]) {
                    case (?{ owner }) {
                        switch (callerId) {
                            case (null) {
                                if (not Principal.equal(owner, caller)) {
                                    return #err("Caller is not the owner of the avatar");
                                };
                            };
                            case (?callerId) {
                                if (not Principal.equal(owner, Principal.fromText(callerId))) {
                                    return #err("Caller is not the owner of the avatar");
                                };
                            };
                        };

                        // Process HP depletion for all users
                        let depleteResult = await depleteHPandVisitCountIncrease(avatarId);
                        switch (depleteResult) {
                            case (#err(e)) {
                                return #err(e);
                            };
                            case (#ok(_)) {
                                // Process payment only for non-admin users
                                if (not isAdmin) {
                                    let result = await icrcLedger.icrc2_transfer_from({
                                        from = {
                                            owner = caller;
                                            subaccount = null;
                                        };
                                        spender_subaccount = null;
                                        to = {
                                            owner = Principal.fromActor(this);
                                            subaccount = null;
                                        };
                                        amount = agent.visitCost * ICRC_DECIMALS;
                                        fee = null;
                                        memo = ?Text.encodeUtf8("AI_VISIT_PAYMENT");
                                        created_at_time = null;
                                    });
                                    Debug.print("Payment result: " # debug_show result);
                                    switch (result) {
                                        case (#Err(e)) {
                                            // Refund HP if payment fails
                                            ignore await wellnessAvatarNFT.icrcX_updateHP(
                                                Principal.fromText(CanisterIDs.canisterControllersAdmin),
                                                avatarId,
                                                10,
                                            );
                                            return #err("Payment failed: " # debug_show e);
                                        };
                                        case (#Ok(_)) {};
                                    };
                                };

                                // Process rewards for all users
                                ignore await processRewards(owner, avatarId);
                            };
                        };

                    };
                    case null { return #err("Avatar not found") };
                };

                // Generate token
                let timestamp = Time.now();
                let tokenText = Principal.toText(caller) # Int.toText(timestamp);
                let token = Text.concat("AI-", Nat32.toText(Text.hash(tokenText)));

                // Store token with expiration
                let tokenData : AuthToken = {
                    principal = caller;
                    agentId = agentId;
                    expirationTime = timestamp + TOKEN_EXPIRATION;
                };

                ignore BTree.insert(authTokens, Text.compare, token, tokenData);

                // Record the visit
                let visitId = nextVisitId;
                nextVisitId += 1;

                let userId = Principal.toText(caller);

                let visit : AIVisit = {
                    visitId = visitId;
                    userId = userId;
                    agentId = agentId;
                    status = #Completed;
                    timestamp = {
                        bookingTime = null;
                        cancellationTime = null;
                        completionTime = ?timestamp;
                        rejectionTime = null;
                        slotTime = null;
                    };
                    payment = agent.visitCost;
                    avatarId = avatarId;
                };

                // Store visit in visit log
                ignore BTree.insert(aiVisits, Nat.compare, visitId, visit);

                // Update user's visit history
                switch (BTree.get(userAIVisits, Text.compare, userId)) {
                    case (?userVisits) {
                        let updatedVisits = Array.append(userVisits, [visitId]);
                        ignore BTree.insert(userAIVisits, Text.compare, userId, updatedVisits);
                    };
                    case null {
                        ignore BTree.insert(userAIVisits, Text.compare, userId, [visitId]);
                    };
                };

                // Update agent's visit history
                switch (BTree.get(agentAIVisits, Text.compare, agentId)) {
                    case (?agentVisits) {
                        let updatedVisits = Array.append(agentVisits, [visitId]);
                        ignore BTree.insert(agentAIVisits, Text.compare, agentId, updatedVisits);
                    };
                    case null {
                        ignore BTree.insert(agentAIVisits, Text.compare, agentId, [visitId]);
                    };
                };

                return #ok(token);
            };
        };
    };

    // Verify and delete a token (admin only)
    public shared ({ caller }) func verifyAndDeleteToken(token : Text) : async Result.Result<Bool, Text> {
        if (Principal.toText(caller) != CanisterIDs.AIAgentAdmin) {
            return #err("Only admin can verify and delete tokens");
        };

        switch (BTree.get(authTokens, Text.compare, token)) {
            case (null) {
                return #err("Invalid token");
            };
            case (?tokenData) {
                let currentTime = Time.now();

                if (currentTime > tokenData.expirationTime) {
                    // Token expired, remove it
                    ignore BTree.delete(authTokens, Text.compare, token);
                    return #err("Token expired");
                };

                // Valid token, delete it after verification
                ignore BTree.delete(authTokens, Text.compare, token);
                return #ok(true);
            };
        };
    };

    // Admin function to register AI Agents
    public shared ({ caller }) func registerAIAgent(
        name : Text,
        assistantId : Text,
        specialization : [Text],
        description : Text,
        visitCost : Nat,
    ) : async Result.Result<Text, Text> {

        if (Principal.toText(caller) != CanisterIDs.admin) {
            return #err("Only admin can register AI Agents");
        };

        let g = Source.Source();
        let agentId = (UUID.toText(await g.new()));

        let agent : AIAgent = {
            id = agentId;
            assistantId = assistantId;
            name = name;
            specialization = specialization;
            description = description;
            visitCost = visitCost;
        };

        ignore BTree.insert(aiAgents, Text.compare, agentId, agent);
        return #ok(agentId);
    };

    // Query function to get all AI Agents
    public query func getAllAIAgents() : async [AIAgent] {
        BTree.toValueArray(aiAgents);
    };

    // Helper functions
    private func depleteHPandVisitCountIncrease(tokenId : Nat) : async Result.Result<[ICRC7.UpdateNFTResult], Text> {
        await wellnessAvatarNFT.icrcX_updateHPAndVisits(Principal.fromText(CanisterIDs.canisterControllersAdmin), tokenId);
    };

    private func processRewards(principal : Principal, avatarId : Nat) : async Result.Result<Text, Text> {
        // Get avatar metadata
        let tokenMetadata = await wellnessAvatarNFT.icrc7_token_metadata([avatarId]);
        let userMetadata = tokenMetadata[0];

        // Extract quality for reward calculation
        let (userQuality, _, _, _) = extractMetadata(userMetadata);

        // Calculate reward based on quality
        let rarityMultiplier = getRarityMultiplier(userQuality);
        let baseReward : Nat = 10; // Base reward for AI visits
        let userReward = Float.toInt(Float.fromInt(baseReward) + (Float.fromInt(baseReward) * (rarityMultiplier / 10)));

        // Distribute rewards
        let userTransfer = await icrcLedger.icrc2_transfer_from({
            from = { owner = Principal.fromActor(this); subaccount = null };
            spender_subaccount = null;
            to = { owner = principal; subaccount = null };
            amount = Int.abs(userReward) * ICRC_DECIMALS;
            fee = null;
            memo = ?Text.encodeUtf8("AI_VISIT_REWARD");
            created_at_time = null;
        });

        switch (userTransfer) {
            case (#Ok(_)) {
                return #ok("Visit completed. User received " # Int.toText(userReward) # " tokens");
            };
            case (#Err(msg)) {
                return #err("Failed to distribute rewards: " # debug_show msg);
            };
        };
    };

    // Helper methods from GamificationSystem
    private func extractMetadata(metadata : ?[(Text, Value)]) : (GamificationTypes.Quality, [(Text, Value)], { #Avatar; #Professional; #Facility }, Text) {
        switch (metadata) {
            case (?properties) {
                let attributesProp = Array.find(properties, func(p : (Text, Value)) : Bool { p.0 == "attributes" });

                // Extract quality and attributes
                let (quality, attrs) = switch (attributesProp) {
                    case (?(_, #Map(attrs))) {
                        let qualityProp = Array.find(attrs, func(p : (Text, Value)) : Bool { p.0 == "quality" });
                        let quality = switch (qualityProp) {
                            case (?(_, #Text(val))) {
                                switch (val) {
                                    case "Common" #Common;
                                    case "Uncommon" #Uncommon;
                                    case "Rare" #Rare;
                                    case "Epic" #Epic;
                                    case "Legendary" #Legendary;
                                    case "Mythic" #Mythic;
                                    case _ #Common;
                                };
                            };
                            case _ #Common;
                        };
                        (quality, attrs);
                    };
                    case _ (#Common, []);
                };

                // Extract NFT type and subtype
                let (nftType, subtype) = switch (attributesProp) {
                    case (?(_, #Map(attrs))) {
                        let avatarTypeProp = Array.find(attrs, func(p : (Text, Value)) : Bool { p.0 == "avatarType" });
                        let specializationProp = Array.find(attrs, func(p : (Text, Value)) : Bool { p.0 == "specialization" });
                        let servicesProp = Array.find(attrs, func(p : (Text, Value)) : Bool { p.0 == "services" });

                        switch (avatarTypeProp, specializationProp, servicesProp) {
                            case (?(_, #Text(subtype)), _, _) (#Avatar, subtype);
                            case (_, ?(_, #Text(subtype)), _) (#Professional, subtype);
                            case (_, _, ?(_, #Text(subtype))) (#Facility, subtype);
                            case _ (#Avatar, ""); // Default case
                        };
                    };
                    case _ (#Avatar, "");
                };

                (quality, attrs, nftType, subtype);
            };
            case null (#Common, [], #Avatar, "");
        };
    };

    private func getRarityMultiplier(quality : GamificationTypes.Quality) : Float {
        switch (quality) {
            case (#Common) 1.0;
            case (#Uncommon) 1.2;
            case (#Rare) 1.5;
            case (#Epic) 1.9;
            case (#Legendary) 2.4;
            case (#Mythic) 3.0;
        };
    };

    // Admin function to update AI Agent info
    public shared ({ caller }) func updateAIAgent(
        agentId : Text,
        name : Text,
        assistantId : Text,
        specialization : [Text],
        description : Text,
        visitCost : Nat,
    ) : async Result.Result<Text, Text> {
        if (Principal.toText(caller) != CanisterIDs.admin) {
            return #err("Only admin can update AI Agents");
        };

        switch (BTree.get(aiAgents, Text.compare, agentId)) {
            case (?_agent) {
                let updatedAgent : AIAgent = {
                    id = agentId;
                    assistantId = assistantId;
                    name = name;
                    specialization = specialization;
                    description = description;
                    visitCost = visitCost;
                };

                ignore BTree.insert(aiAgents, Text.compare, agentId, updatedAgent);
                #ok("AI Agent updated successfully");
            };
            case null {
                #err("AI Agent not found");
            };
        };
    };

    // Get visits for a specific AI Agent (admin only)
    public shared query ({ caller }) func getAIAgentVisits(agentId : Text) : async Result.Result<[AIVisit], Text> {
        if (Principal.toText(caller) != CanisterIDs.admin) {
            return #err("Only admin can view AI Agent visits");
        };

        switch (BTree.get(agentAIVisits, Text.compare, agentId)) {
            case (?visitIds) {
                var visitList : [AIVisit] = [];
                for (visitId in visitIds.vals()) {
                    switch (BTree.get(aiVisits, Nat.compare, visitId)) {
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

    // Get user's visit history
    public query func getUserVisits(userId : Text) : async [AIVisit] {
        switch (BTree.get(userAIVisits, Text.compare, userId)) {
            case (?visitIds) {
                var visits : [AIVisit] = [];
                for (id in visitIds.vals()) {
                    switch (BTree.get(aiVisits, Nat.compare, id)) {
                        case (?visit) {
                            visits := Array.append(visits, [visit]);
                        };
                        case null {};
                    };
                };
                visits;
            };
            case null {
                [];
            };
        };
    };

    // Generate a temporary token to identify the caller
    public shared ({ caller }) func temporaryToken() : async Result.Result<Text, Text> {

        // Generate token
        let timestamp = Time.now();
        let tokenText = Principal.toText(caller) # Int.toText(timestamp);
        let token = Text.concat("TEMP-", Nat32.toText(Text.hash(tokenText)));

        // Store token with expiration
        let tokenData : AuthToken = {
            principal = caller;
            agentId = "admin-check";
            expirationTime = timestamp + TOKEN_EXPIRATION;
        };

        ignore BTree.insert(authTokens, Text.compare, token, tokenData);
        return #ok(token);
    };

    // Check a temporary token to identify the caller
    public shared ({ caller }) func checkTemporaryToken(token : Text) : async Result.Result<Text, Text> {
        if (Principal.toText(caller) != CanisterIDs.AIAgentAdmin) {
            return #err("Only admin can check tokens");
        };

        switch (BTree.get(authTokens, Text.compare, token)) {
            case (null) {
                return #err("Invalid token");
            };
            case (?tokenData) {
                let currentTime = Time.now();

                if (currentTime > tokenData.expirationTime) {
                    // Token expired, remove it
                    ignore BTree.delete(authTokens, Text.compare, token);
                    return #err("Token expired");
                };

                // Return the principal ID of the original caller
                return #ok(Principal.toText(tokenData.principal));
            };
        };
    };

    // Get details for a specific AI Agent
    public query func getAgentDetails(agentId : Text) : async Result.Result<AIAgent, Text> {
        switch (BTree.get(aiAgents, Text.compare, agentId)) {
            case (?agent) {
                return #ok(agent);
            };
            case null {
                return #err("AI Agent not found");
            };
        };
    };
};
