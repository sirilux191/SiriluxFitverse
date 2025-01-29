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
import ICRC2 "mo:icrc2-types";
import ICRC7 "mo:icrc7-mo";

import IdentityManager "../IdentityManager/IdentityManager";
import Types "../Types";
import CanisterIDs "../Types/CanisterIDs";
import GamificationTypes "./GamificationTypes";
import VisitManager "./VisitManager";
import WellnessAvatarNFT "./WellnessAvatarNFT";

actor class GamificationSystem() = this {
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

    private let wellnessAvatarNFT : WellnessAvatarNFT.WellnessAvatarNFT = actor (CanisterIDs.wellnessAvatarNFTCanisterID);
    private let visitManager : VisitManager.VisitManager = actor (CanisterIDs.visitManagerCanisterID);
    private let icrcLedger : ICRC2.Service = actor (CanisterIDs.icrc_ledger_canister_id);

    private let _identityManager : IdentityManager.IdentityManager = actor (CanisterIDs.identityManagerCanisterID);

    // Minting function with default values
    public shared ({ caller }) func mintWellnessAvatar(mintNFTPrincipal : Text, memo : ?Blob, avatarType : GamificationTypes.AvatarType, imageURL : Text) : async [SetNFTResult] {
        let currentTokenId = await wellnessAvatarNFT.icrc7_total_supply();
        let tokenId = currentTokenId + 1;

        let defaultMetadata = GamificationTypes.createAvatarDefaultMetadata(tokenId, GamificationTypes.defaultAttributes(avatarType), imageURL);

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

        return await wellnessAvatarNFT.icrcX_mint(caller, request);

    };

    public shared ({ caller }) func mintProfessionalNFT(mintNFTPrincipal : Text, memo : ?Blob, specialization : GamificationTypes.ProfessionalSpecialization, imageURL : Text) : async [SetNFTResult] {
        let currentTokenId = await wellnessAvatarNFT.icrc7_total_supply();
        let tokenId = currentTokenId + 1;

        let defaultMetadata = GamificationTypes.createProfessionalDefaultMetadata(tokenId, GamificationTypes.defaultProfessionalAttributes(specialization), imageURL);

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

        return await wellnessAvatarNFT.icrcX_mint(caller, request);

    };

    public shared ({ caller }) func mintFacilityNFT(mintNFTPrincipal : Text, memo : ?Blob, services : GamificationTypes.FacilityServices, imageURL : Text) : async [SetNFTResult] {
        let currentTokenId = await wellnessAvatarNFT.icrc7_total_supply();
        let tokenId = currentTokenId + 1;

        let defaultMetadata = GamificationTypes.createFacilityDefaultMetadata(tokenId, GamificationTypes.defaultFacilityAttributes(services), imageURL);

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

        return await wellnessAvatarNFT.icrcX_mint(caller, request);

    };

    public shared ({ caller }) func initiateVisit(idToVisit : Text, slotTime : Time.Time, visitMode : visitManager.VisitMode, avatarId : Nat) : async Result.Result<Nat, Text> {
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
                        let result = await visitManager.bookSlotAndCreateVisit(
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
                            case (#err(e)) #err(e);
                        };

                    };
                    case (#err(e)) { return #err(e) };
                };

            };
            case null { #err("Avatar not found") };
        };
    };

    private func depleteHPandVisitCountIncrease(tokenId : Nat) : async Result.Result<[ICRC7.UpdateNFTResult], Text> {
        await wellnessAvatarNFT.icrcX_updateHPAndVisits(Principal.fromText(Types.admin), tokenId);
    };

    public shared ({ caller }) func restoreHP(tokenId : Nat, amount : Nat) : async Result.Result<[ICRC7.UpdateNFTResult], Text> {

        let result = await icrcLedger.icrc2_transfer_from({
            from = { owner = caller; subaccount = null };
            spender_subaccount = null;
            to = { owner = Principal.fromActor(this); subaccount = null };
            amount = amount * 100_000_000;
            fee = null;
            memo = null;
            created_at_time = null;
        });

        switch (result) {
            case (# Ok(_block_number)) {
                return await wellnessAvatarNFT.icrcX_updateHP(Principal.fromText(Types.admin), tokenId, amount);
            };
            case (#Err(_e)) { return #err("Error transferring funds") };
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
        // let ownerResult = await wellnessAvatarNFT.icrc7_owner_of([tokenId]);
        // switch (ownerResult[0]) {
        //     case (?{ owner }) {
        //         if (not Principal.equal(owner, caller)) {
        //             return #err("Caller is not the owner of the NFT");
        //         };
        //     };
        //     case null return #err("NFT not found");
        // };

        // Extract current quality and attributes
        let (currentQuality, attributes, _nftType, _subtype) = extractMetadata(tokenMetadata[0]);

        // Check if already at max level
        if (currentQuality == #Mythic) {
            return #err("NFT is already at maximum level");
        };

        // Calculate required tokens
        // let cost = GamificationTypes.getUpgradeCost(currentQuality);
        // let result = await icrcLedger.icrc2_transfer_from({
        //     from = { owner = caller; subaccount = null };
        //     spender_subaccount = null;
        //     to = { owner = Principal.fromActor(this); subaccount = null };
        //     amount = cost * 100_000_000; // 8 decimals
        //     fee = null;
        //     memo = null;
        //     created_at_time = null;
        // });

        // switch (result) {
        //     case (#Err(_)) return #err("Insufficient balance for upgrade");
        //     case _ {};
        // };

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
            Principal.fromText(Types.admin),
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
        switch (await wellnessAvatarNFT.icrcX_updateHPAndVisits(Principal.fromText(Types.admin), entityAvatarId)) {
            case (#ok(_)) {};
            case (#err(msg)) { return #err(msg) };
        };

        let completionResult = await visitManager.completeVisit(caller, visitId);

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

};
