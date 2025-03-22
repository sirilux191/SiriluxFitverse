// GamificationSystem.mo

import Array "mo:base/Array";
import Blob "mo:base/Blob";
import Float "mo:base/Float";
import Int "mo:base/Int";
import Nat "mo:base/Nat";
import Principal "mo:base/Principal";
import Result "mo:base/Result";
import Text "mo:base/Text";
import Time "mo:base/Time";
import env "mo:env";
import ICRC2 "mo:icrc2-types";
import ICRC7 "mo:icrc7-mo";
import BTree "mo:stableheapbtreemap/BTree";

import IdentityManager "../IdentityManager/IdentityManager";
import CanisterIDs "../Types/CanisterIDs";
import GamificationTypes "./GamificationTypes";
import WellnessAvatarNFT "./WellnessAvatarNFT";

actor class GamificationSystem() = this {

    type Visit = GamificationTypes.Visit;
    type ProfessionalInfo = GamificationTypes.ProfessionalInfo;
    type FacilityInfo = GamificationTypes.FacilityInfo;
    type AvailabilitySlot = GamificationTypes.AvailabilitySlot;
    type BookedSlot = GamificationTypes.BookedSlot;
    type VisitMode = GamificationTypes.VisitMode;

    type Account = ICRC7.Account;
    type NFT = ICRC7.NFT;
    type SetNFTError = {
        #NonExistingTokenId;
        #TokenExists;
        #GenericError : { error_code : Nat; message : Text };
        #TooOld;
        #CreatedInFuture : { ledger_time : Nat64 };
    };

    type SetNFTRequest = ICRC7.SetNFTRequest;
    type SetNFTResult = {
        #Ok : ?Nat;
        #Err : SetNFTError;
        #GenericError : { error_code : Nat; message : Text };
    };
    type Value = ICRC7.Value;

    let MINT_COST : Nat = 500;
    let ICRC_DECIMALS : Nat = 100_000_000;

    // Add commission percentage (5%)
    private let COMMISSION_PERCENTAGE : Nat = 5;
    private let MIN_VISIT_PRICE : Nat = 5; // Minimum price of 5 tokens

    private let wellnessAvatarNFT : WellnessAvatarNFT.WellnessAvatarNFT = actor (CanisterIDs.wellnessAvatarNFTCanisterID);

    private let icrcLedger : ICRC2.Service = actor (CanisterIDs.icrc_ledger_canister_id);

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

    // Minting function with default values
    public shared ({ caller }) func mintWellnessAvatar(
        mintNFTPrincipal : Text,
        memo : ?Blob,
        avatarType : GamificationTypes.AvatarType,
    ) : async [SetNFTResult] {

        let result = await icrcLedger.icrc2_transfer_from({
            from = { owner = caller; subaccount = null };
            spender_subaccount = null;
            to = { owner = Principal.fromActor(this); subaccount = null };
            amount = MINT_COST * ICRC_DECIMALS; // 8 decimals
            fee = null;
            memo = ?Text.encodeUtf8("MINT_AVATAR Cost: " # debug_show MINT_COST);
            created_at_time = null;
        });

        switch (result) {
            case (#Err(e)) return [#Err(#GenericError { error_code = 1; message = "Insufficient funds for minting: " # debug_show e })];
            case _ {};
        };

        let currentTokenId = await wellnessAvatarNFT.icrc7_total_supply();
        let tokenId = currentTokenId + 1;

        let defaultMetadata = GamificationTypes.createAvatarDefaultMetadata(
            tokenId,
            GamificationTypes.defaultAttributes(avatarType),
            GamificationTypes.getAvatarImageURL(avatarType),
        );

        let request : SetNFTRequest = [{
            owner = ?{
                owner = Principal.fromText(mintNFTPrincipal);
                subaccount = null;
            };
            metadata = defaultMetadata;
            memo = memo;
            override = true;
            token_id = tokenId;
            created_at_time = null;
        }];

        return await wellnessAvatarNFT.icrcX_mint(Principal.fromText(CanisterIDs.canisterControllersAdmin), request);
    };

    public shared ({ caller }) func mintProfessionalNFT(
        mintNFTPrincipal : Text,
        memo : ?Blob,
        specialization : GamificationTypes.ProfessionalSpecialization,
    ) : async [SetNFTResult] {

        let result = await icrcLedger.icrc2_transfer_from({
            from = { owner = caller; subaccount = null };
            spender_subaccount = null;
            to = { owner = Principal.fromActor(this); subaccount = null };
            amount = MINT_COST * ICRC_DECIMALS; // 8 decimals
            fee = null;
            memo = ?Text.encodeUtf8("MINT_PROFESSIONAL Cost: " # debug_show MINT_COST);
            created_at_time = null;
        });

        switch (result) {
            case (#Err(e)) return [#Err(#GenericError { error_code = 1; message = "Insufficient funds for minting: " # debug_show e })];
            case _ {};
        };

        let currentTokenId = await wellnessAvatarNFT.icrc7_total_supply();
        let tokenId = currentTokenId + 1;

        let defaultMetadata = GamificationTypes.createProfessionalDefaultMetadata(
            tokenId,
            GamificationTypes.defaultProfessionalAttributes(specialization),
            GamificationTypes.getProfessionalImageURL(specialization),
        );

        let request : SetNFTRequest = [{
            owner = ?{
                owner = Principal.fromText(mintNFTPrincipal);
                subaccount = null;
            };
            metadata = defaultMetadata;
            memo = memo;
            override = true;
            token_id = tokenId;
            created_at_time = null;
        }];

        return await wellnessAvatarNFT.icrcX_mint(Principal.fromText(CanisterIDs.canisterControllersAdmin), request);
    };

    public shared ({ caller }) func mintFacilityNFT(
        mintNFTPrincipal : Text,
        memo : ?Blob,
        services : GamificationTypes.FacilityServices,
    ) : async [SetNFTResult] {

        let result = await icrcLedger.icrc2_transfer_from({
            from = { owner = caller; subaccount = null };
            spender_subaccount = null;
            to = { owner = Principal.fromActor(this); subaccount = null };
            amount = MINT_COST * ICRC_DECIMALS; // 8 decimals
            fee = null;
            memo = ?Text.encodeUtf8("MINT_FACILITY Cost: " # debug_show MINT_COST);
            created_at_time = null;
        });

        switch (result) {
            case (#Err(e)) return [#Err(#GenericError { error_code = 1; message = "Insufficient funds for minting: " # debug_show e })];
            case _ {};
        };

        let currentTokenId = await wellnessAvatarNFT.icrc7_total_supply();
        let tokenId = currentTokenId + 1;

        let defaultMetadata = GamificationTypes.createFacilityDefaultMetadata(
            tokenId,
            GamificationTypes.defaultFacilityAttributes(services),
            GamificationTypes.getFacilityImageURL(services),
        );

        let request : SetNFTRequest = [{
            owner = ?{
                owner = Principal.fromText(mintNFTPrincipal);
                subaccount = null;
            };
            metadata = defaultMetadata;
            memo = memo;
            override = true;
            token_id = tokenId;
            created_at_time = null;
        }];

        return await wellnessAvatarNFT.icrcX_mint(Principal.fromText(CanisterIDs.canisterControllersAdmin), request);
    };

    public shared ({ caller }) func initiateVisit(idToVisit : Text, slotTime : Time.Time, visitMode : GamificationTypes.VisitMode, avatarId : Nat) : async Result.Result<Nat, Text> {
        // Verify avatar ownership
        let ownerResult = await wellnessAvatarNFT.icrc7_owner_of([avatarId]);
        switch (ownerResult[0]) {
            case (?{ owner }) {

                if (not Principal.equal(owner, caller)) {
                    return #err("Caller is not the owner of the avatar");
                };

                let depleteResult = await depleteHPandVisitCountIncrease(avatarId);
                switch (depleteResult) {
                    case (#ok(_)) {
                        // Book slot and create visit
                        let result = await bookSlotAndCreateVisit(
                            caller,
                            idToVisit,
                            slotTime,
                            visitMode,
                            avatarId,
                        );

                        switch (result) {
                            case (#ok(visitId)) {
                                return #ok(visitId);
                            };
                            case (#err(e)) {
                                let refundHPResult = await wellnessAvatarNFT.icrcX_updateHP(Principal.fromText(CanisterIDs.canisterControllersAdmin), avatarId, 10);
                                switch (refundHPResult) {
                                    case (#ok(_)) { return #err(e) };
                                    case (#err(_e)) { return #err(e) };
                                };

                            };
                        };

                    };
                    case (#err(e)) { return #err(e) };
                };

            };
            case null { #err("Avatar not found") };
        };
    };

    private func depleteHPandVisitCountIncrease(tokenId : Nat) : async Result.Result<[ICRC7.UpdateNFTResult], Text> {
        await wellnessAvatarNFT.icrcX_updateHPAndVisits(Principal.fromText(CanisterIDs.canisterControllersAdmin), tokenId);
    };

    public shared ({ caller }) func restoreHP(tokenId : Nat, amount : Nat) : async Result.Result<[ICRC7.UpdateNFTResult], Text> {

        let result = await icrcLedger.icrc2_transfer_from({
            from = { owner = caller; subaccount = null };
            spender_subaccount = null;
            to = { owner = Principal.fromActor(this); subaccount = null };
            amount = amount * 100_000_000;
            fee = null;
            memo = ?Text.encodeUtf8("RESTORE_HP TokenId: " # debug_show tokenId # " Amount: " # debug_show amount);
            created_at_time = null;
        });

        switch (result) {
            case (# Ok(_block_number)) {
                return await wellnessAvatarNFT.icrcX_updateHP(Principal.fromText(CanisterIDs.canisterControllersAdmin), tokenId, amount);
            };
            case (#Err(e)) {
                return #err("Error transferring funds" # debug_show e);
            };
        };

    };

    //Helper functions
    public func getUserAvatars(userPrincipalId : Text) : async [Nat] {
        await wellnessAvatarNFT.icrc7_tokens_of({ owner = Principal.fromText(userPrincipalId); subaccount = null }, null, null);
    };

    public shared ({ caller }) func getUserAvatarsSelf() : async [(Nat, ?[(Text, ICRC7.Value)])] {

        let tokenIds = await wellnessAvatarNFT.icrc7_tokens_of({ owner = caller; subaccount = null }, null, null);
        let metadata = await wellnessAvatarNFT.icrc7_token_metadata(tokenIds);

        (Array.tabulate<(Nat, ?[(Text, ICRC7.Value)])>(tokenIds.size(), func(i) { (tokenIds[i], metadata[i]) }));

    };

    public shared ({ caller }) func transferNFT(tokenId : Nat, newOwner : Text) : async Result.Result<[?ICRC7.TransferResult], Text> {
        await transferNFTInternal(caller, tokenId, newOwner);
    };

    private func transferNFTInternal(caller : Principal, tokenId : Nat, newOwner : Text) : async Result.Result<[?ICRC7.TransferResult], Text> {
        let transferArgs = [{
            from_subaccount = null;
            to = { owner = Principal.fromText(newOwner); subaccount = null };
            token_id = tokenId;
            memo = null;
            created_at_time = null;
        }];
        return await wellnessAvatarNFT.icrc7_transfer(caller, transferArgs);

    };

    public shared query ({ caller }) func whoami() : async Text {
        Principal.toText(caller);
    };

    public shared ({ caller }) func levelUpNFT(tokenId : Nat) : async Result.Result<[ICRC7.UpdateNFTResult], Text> {
        // Get NFT metadata
        let tokenMetadata = await wellnessAvatarNFT.icrc7_token_metadata([tokenId]);

        // Verify ownership
        let ownerResult = await wellnessAvatarNFT.icrc7_owner_of([tokenId]);
        switch (ownerResult[0]) {
            case (?{ owner }) {
                if (not Principal.equal(owner, caller)) {
                    return #err("Caller is not the owner of the NFT");
                };
            };
            case null return #err("NFT not found");
        };

        // Extract current quality and attributes
        let (currentQuality, attributes, _nftType, _subtype) = extractMetadata(tokenMetadata[0]);

        // Check if already at max level
        if (currentQuality == #Mythic) {
            return #err("NFT is already at maximum level");
        };

        // Calculate required tokens
        let cost = GamificationTypes.getUpgradeCost(currentQuality);
        let result = await icrcLedger.icrc2_transfer_from({
            from = { owner = caller; subaccount = null };
            spender_subaccount = null;
            to = { owner = Principal.fromActor(this); subaccount = null };
            amount = cost * 100_000_000; // 8 decimals
            fee = null;
            memo = ?Text.encodeUtf8("LEVEL_UP TokenId: " # debug_show tokenId # " Cost: " # debug_show cost);
            created_at_time = null;
        });

        switch (result) {
            case (#Err(e)) return #err("Error transferring funds" # debug_show e # " " # debug_show cost);
            case _ {};
        };

        // Determine next quality level
        let newQuality = switch (currentQuality) {
            case (#Common) #Uncommon;
            case (#Uncommon) #Rare;
            case (#Rare) #Epic;
            case (#Epic) #Legendary;
            case (#Legendary) #Mythic;
            case (#Mythic) return #err("Already at max level");
        };

        // Get attribute increment percentage
        let increment = GamificationTypes.getAttributeIncrement(newQuality);

        // Get attributes to exclude from updating
        let attributesToExclude = ["avatarType", "specialization", "services", "HP", "visitCount"];

        // Update attributes with calculated increments and quality
        let updatedAttrs = Array.map<(Text, Value), (Text, Value)>(
            attributes,
            func((k, v) : (Text, Value)) : (Text, Value) {
                if (k == "quality") {
                    // Update quality field with new value
                    (
                        k,
                        #Text(
                            switch (newQuality) {
                                case (#Uncommon) "Uncommon";
                                case (#Rare) "Rare";
                                case (#Epic) "Epic";
                                case (#Legendary) "Legendary";
                                case (#Mythic) "Mythic";
                            }
                        ),
                    );
                } else if (k == "level") {
                    switch (v) {
                        case (#Nat(n)) {
                            (k, #Nat(n + 1));
                        };
                        case _ (k, v);
                    };
                } else if (Array.find(attributesToExclude, func(exclude : Text) : Bool { exclude == k }) == null) {
                    switch (v) {
                        case (#Nat(n)) {
                            let newValue = n + Float.toInt(Float.fromInt(n) * increment);
                            (k, #Nat(Int.abs(newValue)));
                        };
                        case _ (k, v);
                    };
                } else {
                    (k, v);
                };
            },
        );

        // Update NFT metadata
        await wellnessAvatarNFT.icrcX_updateMetadata(
            Principal.fromText(CanisterIDs.canisterControllersAdmin),
            tokenId,
            updatedAttrs,
        );
    };

    // Add new function to calculate and distribute visit rewards
    public shared ({ caller }) func processVisitCompletion(
        visitId : Nat,
        entityAvatarId : Nat,
    ) : async Result.Result<Text, Text> {

        let ownerResult = await wellnessAvatarNFT.icrc7_owner_of([entityAvatarId]);
        switch (ownerResult[0]) {
            case (?{ owner }) {
                if (not Principal.equal(owner, caller)) {
                    return #err("Caller is not the owner of the avatar");
                };
            };
            case null return #err("Avatar not found");
        };

        // Complete the visit first
        switch (await wellnessAvatarNFT.icrcX_updateHPAndVisits(Principal.fromText(CanisterIDs.canisterControllersAdmin), entityAvatarId)) {
            case (#ok(_)) {};
            case (#err(msg)) { return #err(msg) };
        };

        let completionResult = await completeVisit(caller, visitId);

        switch (completionResult) {
            case (#err(msg)) { return #err(msg) };
            case (#ok(visit)) {
                // Get both avatars' metadata
                let userAvatarNFTOwner = switch ((await wellnessAvatarNFT.icrc7_owner_of([visit.avatarId]))[0]) {
                    case (?{ owner }) { { owner = owner; subaccount = null } };
                    case null { return #err("Avatar not found") };
                };
                let tokenMetadata = await wellnessAvatarNFT.icrc7_token_metadata([visit.avatarId, entityAvatarId]);
                let userMetadata = tokenMetadata[0];
                let entityMetadata = tokenMetadata[1];
                // Extract attributes and types
                let (userQuality, _userAttrs, userType, userSubtype) = extractMetadata(userMetadata);
                let (entityQuality, _entityAttrs, entityType, entitySubtype) = extractMetadata(entityMetadata);

                // Get base attributes for type matching
                let userPrimaryAttr = getPrimaryAttribute(userType, userSubtype);
                let entityPrimaryAttr = getPrimaryAttribute(entityType, entitySubtype);

                // Calculate type match bonus
                let typeMatchMultiplier = if (userPrimaryAttr == entityPrimaryAttr) {
                    1.5;
                } else { 1.0 };

                // Calculate rarity multipliers
                let userRarityMultiplier = getRarityMultiplier(userQuality);
                let entityRarityMultiplier = getRarityMultiplier(entityQuality);

                // Calculate rewards
                let baseReward : Nat = 11;
                let userReward = Float.toInt(Float.fromInt(baseReward) * typeMatchMultiplier * userRarityMultiplier);
                let entityReward = Float.toInt(Float.fromInt(baseReward) * typeMatchMultiplier * entityRarityMultiplier);

                // Distribute rewards
                let userTransfer = await icrcLedger.icrc2_transfer_from({
                    from = {
                        owner = Principal.fromActor(this);
                        subaccount = null;
                    };
                    spender_subaccount = null;
                    to = userAvatarNFTOwner;
                    amount = Int.abs(userReward) * 100_000_000;
                    fee = null;
                    memo = null;
                    created_at_time = null;
                });

                let entityTransfer = await icrcLedger.icrc2_transfer_from({
                    from = {
                        owner = Principal.fromActor(this);
                        subaccount = null;
                    };
                    spender_subaccount = null;
                    to = {
                        owner = caller;
                        subaccount = null;
                    };
                    amount = Int.abs(entityReward) * 100_000_000;
                    fee = null;
                    memo = null;
                    created_at_time = null;
                });

                switch (userTransfer, entityTransfer) {
                    case (#Ok(_), #Ok(_)) {
                        return #ok("Visit completed. User received " # Int.toText(userReward) # ", Entity received " # Int.toText(entityReward));
                    };
                    case (#Err(msg), _) { return #err(debug_show msg) };
                    case (_, #Err(msg)) { return #err(debug_show msg) };
                };
            };
        };
    };

    // Helper functions
    private func getPrimaryAttribute(nftType : { #Avatar; #Professional; #Facility }, subtype : Text) : Text {
        switch (nftType) {
            case (#Avatar) {
                switch (subtype) {
                    case ("Fitness Champion" or "Metabolic Maestro" or "Stress Buster") "energy";
                    case ("Mindfulness Master" or "Posture Pro" or "Sleep Optimizer") "focus";
                    case ("Nutrition Expert" or "Immune Guardian" or "Aging Gracefully") "vitality";
                    case ("Holistic Healer" or "Recovery Warrior" or "Chronic Care Champion") "resilience";
                    case _ "energy"; // Default case
                };
            };
            case (#Professional) {
                switch (subtype) {
                    case ("Physical Trainer" or "Sports Medicine Expert" or "Fitness Instructor") "energy";
                    case ("Mental Health Expert" or "Meditation Guide" or "Cognitive Behaviorist") "focus";
                    case ("Nutritional Advisor" or "Functional Medicine Expert" or "Preventive Care Specialist") "vitality";
                    case ("Rehabilitation Therapist" or "Chronic Care Specialist" or "Recovery Expert") "resilience";
                    case _ "energy"; // Default case
                };
            };
            case (#Facility) {
                switch (subtype) {
                    case ("Fitness Center" or "Sports Medicine Facility" or "Athletic Training Center") "energy";
                    case ("Mental Health Clinic" or "Meditation Center" or "Cognitive Care Center") "focus";
                    case ("Nutrition Center" or "Wellness Retreat" or "Preventive Health Center") "vitality";
                    case ("Rehabilitation Hospital" or "Recovery Center" or "Chronic Care Clinic") "resilience";
                    case _ "energy"; // Default case
                };
            };
        };
    };

    private func getRarityMultiplier(quality : GamificationTypes.Quality) : Float {
        switch (quality) {
            case (#Common) 1.0;
            case (#Uncommon) 1.2;
            case (#Rare) 1.5;
            case (#Epic) 1.8;
            case (#Legendary) 2.2;
            case (#Mythic) 3.0;
        };
    };

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

    public shared ({ caller }) func updateProfessionalInfo(professionalInfo : ProfessionalInfo) : async Result.Result<Text, Text> {
        // Check caller's identity
        let identityResult = await identityManager.getIdentity(?caller);

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
        let identityResult = await identityManager.getIdentity(?caller);

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
        let identityResult = await identityManager.getIdentity(?caller);

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
        let identityResult = await identityManager.getIdentity(?caller);

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

                    // Validate price - must be at least 5 tokens
                    if (slot.price < MIN_VISIT_PRICE) {
                        errors := Array.append<Text>(errors, ["Price must be at least " # Nat.toText(MIN_VISIT_PRICE) # " tokens"]);
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
                    let currentTime = Time.now();
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
        let identityResult = await identityManager.getIdentity(?caller);

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
        let identityResult = await identityManager.getIdentity(?caller);

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
        let identityResult = await identityManager.getIdentity(?caller);

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

    // Update the bookSlotAndCreateVisit function
    private func bookSlotAndCreateVisit(
        userPrincipal : Principal,
        idToVisit : Text,
        slotTime : Time.Time,
        visitMode : VisitMode,
        avatarId : Nat,
    ) : async Result.Result<Nat, Text> {

        // Validate ID format
        if (not (isProfessionalID(idToVisit) or isFacilityID(idToVisit))) {
            return #err("Invalid ID format");
        };

        // Verify user identity
        let userIdentityResult = await identityManager.getIdentity(?userPrincipal);
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

                                // Process payment if the slot has a price
                                if (availabilitySlot.price > 5) {
                                    // Calculate commission amount (5% of price)
                                    let commissionAmount = (Float.fromInt(availabilitySlot.price) * Float.fromInt(COMMISSION_PERCENTAGE)) / 100;
                                    let providerAmount : Nat = Int.abs(Int.max(0, Float.toInt(Float.fromInt(availabilitySlot.price) - commissionAmount)));

                                    // Transfer payment from user to this canister
                                    let paymentResult = await icrcLedger.icrc2_transfer_from({
                                        from = {
                                            owner = userPrincipal;
                                            subaccount = null;
                                        };
                                        spender_subaccount = null;
                                        to = {
                                            owner = Principal.fromActor(this);
                                            subaccount = null;
                                        };
                                        amount = availabilitySlot.price * ICRC_DECIMALS;
                                        fee = null;
                                        memo = ?Text.encodeUtf8("VISIT_PAYMENT: " # Int.toText(availabilitySlot.price));
                                        created_at_time = null;
                                    });

                                    switch (paymentResult) {
                                        case (#Err(e)) {
                                            return #err("Payment failed: " # debug_show e);
                                        };
                                        case (#Ok(_)) {
                                            // Transfer provider's share (minus commission)
                                            let entityPrincipal = await getEntityPrincipal(idToVisit);
                                            switch (entityPrincipal) {
                                                case (#err(e)) {
                                                    return #err(e);
                                                };
                                                case (#ok(principal)) {
                                                    let transferResult = await icrcLedger.icrc1_transfer({
                                                        to = {
                                                            owner = principal;
                                                            subaccount = null;
                                                        };
                                                        from_subaccount = null;
                                                        amount = providerAmount * ICRC_DECIMALS;
                                                        fee = null;
                                                        memo = ?Text.encodeUtf8("Commission: " # Float.toText(commissionAmount));
                                                        created_at_time = null;
                                                    });

                                                    switch (transferResult) {
                                                        case (#Err(e)) {
                                                            return #err("Provider payment failed: " # debug_show e);
                                                        };
                                                        case (#Ok(_)) {};
                                                    };
                                                };
                                            };
                                        };
                                    };
                                } else {
                                    return #err("Slot has no price");
                                };

                                // Generate meeting link for online visits
                                let meetingLink = switch (visitMode) {
                                    case (#Online) {
                                        ?("https://beta.brie.fi/ng/" # Int.toText(Time.now()) # "-" # Nat.toText(nextVisitId));
                                    };
                                    case (#Offline) { null };
                                };

                                // Create the visit
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
                                    meetingLink = meetingLink;
                                    payment = availabilitySlot.price;
                                };

                                // Create a BookedSlot
                                let bookedSlot : BookedSlot = {
                                    entityId = idToVisit;
                                    start = slotTime;
                                    visitId = nextVisitId;
                                    capacity = availabilitySlot.capacity;
                                };

                                // Book the slot
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
        let identityResult = await identityManager.getIdentity(?caller);

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
        let identityResult = await identityManager.getIdentity(?caller);

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
        let identityResult = await identityManager.getIdentity(?caller);

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

    private func completeVisit(professionalPrincipal : Principal, visitId : Nat) : async Result.Result<Visit, Text> {

        let identityResult = await identityManager.getIdentity(?professionalPrincipal);

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

    private func rejectVisit(professionalPrincipal : Principal, visitId : Nat) : async Result.Result<Text, Text> {

        let identityResult = await identityManager.getIdentity(?professionalPrincipal);

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
                                // Process refund if applicable
                                let refundResult = await refundVisitPayment(professionalPrincipal, visit);
                                switch (refundResult) {
                                    case (#err(msg)) {
                                        return #err("Visit rejection failed: " # msg);
                                    };
                                    case (#ok(_)) {
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
                                                                    price = visit.payment;
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
                                        #ok("Visit rejected successfully and payment refunded");
                                    };
                                };
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

    //  public function to reject visit and restore HP
    public shared ({ caller }) func rejectVisitAndRestoreHP(
        visitId : Nat
    ) : async Result.Result<Text, Text> {

        var avatarId : Nat = 0;
        let restoreAmount : Nat = 10;
        switch (BTree.get(visits, Nat.compare, visitId)) {
            case (?visit) {
                avatarId := visit.avatarId;
            };
            case null {
                return #err("Visit not found");
            };
        };

        let rejectResult = await rejectVisit(caller, visitId);
        switch (rejectResult) {
            case (#ok(msg)) {
                // If rejection successful, restore HP
                let hpResult = await wellnessAvatarNFT.icrcX_updateHP(
                    Principal.fromText(CanisterIDs.canisterControllersAdmin),
                    avatarId,
                    restoreAmount,
                );
                switch (hpResult) {
                    case (#ok(_)) {
                        #ok(msg # ". Successfully restored " # Nat.toText(restoreAmount) # " HP");
                    };
                    case (#err(e)) {
                        #err("Visit rejected but HP restoration failed: " # e);
                    };
                };
            };
            case (#err(e)) {
                #err(e);
            };
        };
    };

    // Update the helper functions for ID validation
    private func isProfessionalID(id : Text) : Bool {
        Text.contains(id, #text "@siriluxprof");
    };

    private func isFacilityID(id : Text) : Bool {
        Text.contains(id, #text "@siriluxservice");
    };

    // Helper function to get entity principal from ID
    private func getEntityPrincipal(entityId : Text) : async Result.Result<Principal, Text> {
        let entityIdentityResult = await identityManager.getPrincipalByID(entityId);

        switch (entityIdentityResult) {
            case (#err(msg)) {
                #err("Entity identity verification failed: " # msg);
            };
            case (#ok(principal)) {
                #ok(principal);
            };
        };
    };

    // Add a function to refund payment if visit is rejected or cancelled
    private func refundVisitPayment(professionalPrincipal : Principal, visit : Visit) : async Result.Result<Text, Text> {
        if (visit.payment > 0) {
            // Get the user's principal
            let userIdentityResult = await identityManager.getPrincipalByID(visit.userId);
            switch (userIdentityResult) {
                case (#err(msg)) {
                    return #err("User identity verification failed: " # msg);
                };
                case (#ok(principal)) {
                    // Check if the canister has enough balance to refund
                    let balanceResult = await icrcLedger.icrc1_balance_of({
                        owner = Principal.fromActor(this);
                        subaccount = null;
                    });

                    if (balanceResult < visit.payment * ICRC_DECIMALS) {
                        return #err("Insufficient balance in canister to process refund");
                    };
                    // Refund the payment
                    let refundResult = await icrcLedger.icrc2_transfer_from({
                        from = {
                            owner = professionalPrincipal;
                            subaccount = null;
                        };
                        spender_subaccount = null;
                        to = {
                            owner = principal;
                            subaccount = null;
                        };
                        amount = visit.payment * ICRC_DECIMALS;
                        fee = null;
                        memo = ?Text.encodeUtf8("VISIT_REFUND: Visit #" # Nat.toText(visit.visitId));
                        created_at_time = null;
                    });

                    switch (refundResult) {
                        case (#Err(e)) {
                            return #err("Refund failed: " # debug_show e);
                        };
                        case (#Ok(_)) {
                            return #ok("Payment refunded successfully");
                        };
                    };
                };

            };
        } else {
            return #ok("No payment to refund");
        };
    };

    public shared ({ caller }) func getVisitById(visitId : Nat) : async Result.Result<Visit, Text> {
        switch (BTree.get(visits, Nat.compare, visitId)) {
            case (?visit) {
                // Check if caller is authorized to view this visit
                let identityResult = await identityManager.getIdentity(?caller);

                switch (identityResult) {
                    case (#err(msg)) {
                        return #err("Identity verification failed: " # msg);
                    };
                    case (#ok(identity)) {
                        let id = identity.0;
                        let _role = identity.1;

                        // Check if caller is the user who booked the visit
                        let isUser = id == visit.userId;

                        // Check if caller is the professional or facility for this visit
                        let isProfessional = switch (visit.professionalId) {
                            case (?profId) { id == profId };
                            case null { false };
                        };

                        let isFacility = switch (visit.facilityId) {
                            case (?facId) { id == facId };
                            case null { false };
                        };

                        if (isUser or isProfessional or isFacility) {
                            return #ok(visit);
                        } else {
                            return #err("Not authorized to view this visit");
                        };
                    };
                };
            };
            case null {
                return #err("Visit not found");
            };
        };
    }

};
