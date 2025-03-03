import Array "mo:base/Array";
import Buffer "mo:base/Buffer";
import CertifiedData "mo:base/CertifiedData";
import D "mo:base/Debug";
import Nat "mo:base/Nat";
import Principal "mo:base/Principal";
import Result "mo:base/Result";
import CandyTypesLib "mo:candy_0_3_0/types";
import CertTree "mo:cert/CertTree";
import ClassPlus "mo:class-plus";
import ICRC3 "mo:icrc3-mo";
import ICRC37 "mo:icrc37-mo";
import ICRC7 "mo:icrc7-mo";
import Vec "mo:vector";

import CanisterIDs "../Types/CanisterIDs";
import ICRC3Default "./initial_state/icrc3";
import ICRC37Default "./initial_state/icrc37";
import ICRC7Default "./initial_state/icrc7";

shared (_init_msg) actor class WellnessAvatarNFT(
    _args : {
        icrc7_args : ?ICRC7.InitArgList;
        icrc37_args : ?ICRC37.InitArgList;
        icrc3_args : ICRC3.InitArgs;
    }
) = this {

    type Account = ICRC7.Account;
    type Environment = ICRC7.Environment;
    type Value = ICRC7.Value;
    type NFT = ICRC7.NFT;
    type NFTShared = ICRC7.NFTShared;
    type NFTMap = ICRC7.NFTMap;
    type OwnerOfResponse = ICRC7.Service.OwnerOfResponse;
    type OwnerOfRequest = ICRC7.Service.OwnerOfRequest;
    type TransferArgs = ICRC7.Service.TransferArg;
    type TransferResult = ICRC7.Service.TransferResult;
    type TransferError = ICRC7.Service.TransferError;
    type BalanceOfRequest = ICRC7.Service.BalanceOfRequest;
    type BalanceOfResponse = ICRC7.Service.BalanceOfResponse;
    type TokenApproval = ICRC37.Service.TokenApproval;
    type CollectionApproval = ICRC37.Service.CollectionApproval;
    type ApprovalInfo = ICRC37.Service.ApprovalInfo;
    type ApproveTokenResult = ICRC37.Service.ApproveTokenResult;
    type ApproveTokenArg = ICRC37.Service.ApproveTokenArg;
    type ApproveCollectionArg = ICRC37.Service.ApproveCollectionArg;
    type IsApprovedArg = ICRC37.Service.IsApprovedArg;

    type ApproveCollectionResult = ICRC37.Service.ApproveCollectionResult;
    type RevokeTokenApprovalArg = ICRC37.Service.RevokeTokenApprovalArg;

    type RevokeCollectionApprovalArg = ICRC37.Service.RevokeCollectionApprovalArg;

    type TransferFromArg = ICRC37.Service.TransferFromArg;
    type TransferFromResult = ICRC37.Service.TransferFromResult;
    type RevokeTokenApprovalResult = ICRC37.Service.RevokeTokenApprovalResult;
    type RevokeCollectionApprovalResult = ICRC37.Service.RevokeCollectionApprovalResult;

    //Add a permitted principals that can call the canister
    private let permittedPrincipals : [Principal] = [Principal.fromText(CanisterIDs.gamificationSystemCanisterID)];
    //

    stable var init_msg = _init_msg; //preserves original initialization;

    stable var original_args = _args;

    stable let cert_store : CertTree.Store = CertTree.newStore();
    let ct = CertTree.Ops(cert_store);

    private func get_certificate_store() : CertTree.Store {
        D.print("returning cert store " # debug_show (cert_store));
        return cert_store;
    };

    private func updated_certification(cert : Blob, lastIndex : Nat) : Bool {

        D.print("updating the certification " # debug_show (CertifiedData.getCertificate(), ct.treeHash()));
        ct.setCertifiedData();
        D.print("did the certification " # debug_show (CertifiedData.getCertificate()));
        return true;
    };

    let initManager = ClassPlus.ClassPlusInitializationManager(init_msg.caller, Principal.fromActor(this), true);

    stable var icrc3_migration_state = ICRC3.init(
        ICRC3.initialState(),
        #v0_1_0(#id),
        switch (_args.icrc3_args) {
            case (null) ICRC3Default.defaultConfig();
            case (?val) ?val : ICRC3.InitArgs;
        },
        init_msg.caller,
    );

    private func get_icrc3_environment() : ICRC3.Environment {
        ?{
            updated_certification = ?updated_certification;
            get_certificate_store = ?get_certificate_store;
        };
    };

    let #v0_1_0(#data(icrc3_state_current)) = icrc3_migration_state;

    private var _icrc3 : ?ICRC3.ICRC3 = null;

    private func get_icrc3_state() : ICRC3.CurrentState {
        return icrc3_state_current;
    };

    D.print("Initargs: " # debug_show (_args));

    func icrc3() : ICRC3.ICRC3 {
        switch (_icrc3) {
            case (null) {
                let initclass : ICRC3.ICRC3 = ICRC3.ICRC3(?icrc3_migration_state, Principal.fromActor(this), get_icrc3_environment());

                D.print("ensure should be done: " # debug_show (initclass.supported_block_types()));
                _icrc3 := ?initclass;

                initclass;
            };
            case (?val) val;
        };
    };

    stable var icrc7_migration_state = ICRC7.initialState();

    private func get_icrc7_environment() : ICRC7.Environment {
        {
            add_ledger_transaction = ?icrc3().add_record;
            can_mint = null;
            can_burn = null;
            can_transfer = null;
            can_update = null;
        };
    };

    let icrc7 = ICRC7.Init<system>({
        manager = initManager;
        initialState = icrc7_migration_state;
        args = switch (do ? { original_args.icrc7_args! }) {
            case (null) ICRC7Default.defaultConfig();
            case (?val) ?val : ?ICRC7.InitArgList;
        };
        pullEnvironment = ?get_icrc7_environment;
        onInitialize = ?(
            func(newClass : ICRC7.ICRC7) : async* () {
                //_icrc7 := ?newClass;
                D.print("Initializing ICRC7");
                ignore newClass.update_ledger_info([
                    #Symbol(do ? { original_args.icrc7_args!.symbol! }),
                    #Name(do ? { original_args.icrc7_args!.name! }),
                    #Description(do ? { original_args.icrc7_args!.description! }),
                    #Logo((do ? { original_args.icrc7_args!.logo! })),
                ]);

                //do any work here necessary for initialization
            }
        );
        onStorageChange = func(new_state : ICRC7.State) {
            icrc7_migration_state := new_state;
        };
    });

    stable var icrc37_migration_state = ICRC37.initialState();

    private func get_icrc37_environment() : ICRC37.Environment {
        {
            icrc7 = icrc7();
            can_transfer_from = null;
            can_approve_token = null;
            can_approve_collection = null;
            can_revoke_token_approval = null;
            can_revoke_collection_approval = null;
        };
    };

    let icrc37 = ICRC37.Init<system>({
        manager = initManager;
        initialState = icrc37_migration_state;
        args = switch (do ? { original_args.icrc37_args! }) {
            case (null) ICRC37Default.defaultConfig();
            case (?val) ?val : ?ICRC37.InitArgList;
        };
        pullEnvironment = ?get_icrc37_environment;
        onInitialize = ?(
            func(newClass : ICRC37.ICRC37) : async* () {
                D.print("Initializing ICRC37");
                //do any work here necessary for initialization
            }
        );
        onStorageChange = func(new_state : ICRC37.State) {
            icrc37_migration_state := new_state;
        };
    });

    public query func icrc7_symbol() : async Text {
        return switch (icrc7().get_ledger_info().symbol) {
            case (?val) val;
            case (null) "";
        };
    };

    public query func icrc7_name() : async Text {
        return switch (icrc7().get_ledger_info().name) {
            case (?val) val;
            case (null) "";
        };
    };

    public query func icrc7_description() : async ?Text {
        return icrc7().get_ledger_info().description;
    };

    public query func icrc7_logo() : async ?Text {
        return icrc7().get_ledger_info().logo;
    };

    public query func icrc7_max_memo_size() : async ?Nat {
        return ?icrc7().get_ledger_info().max_memo_size;
    };

    public query func icrc7_tx_window() : async ?Nat {
        return ?icrc7().get_ledger_info().tx_window;
    };

    public query func icrc7_permitted_drift() : async ?Nat {
        return ?icrc7().get_ledger_info().permitted_drift;
    };

    public query func icrc7_total_supply() : async Nat {
        return icrc7().get_stats().nft_count;
    };

    public query func icrc7_supply_cap() : async ?Nat {
        return icrc7().get_ledger_info().supply_cap;
    };

    public query func icrc37_max_approvals_per_token_or_collection() : async ?Nat {
        return icrc37().max_approvals_per_token_or_collection();
    };

    public query func icrc7_max_query_batch_size() : async ?Nat {
        return icrc7().max_query_batch_size();
    };

    public query func icrc7_max_update_batch_size() : async ?Nat {
        return icrc7().max_update_batch_size();
    };

    public query func icrc7_default_take_value() : async ?Nat {
        return icrc7().default_take_value();
    };

    public query func icrc7_max_take_value() : async ?Nat {
        return icrc7().max_take_value();
    };

    public query func icrc7_atomic_batch_transfers() : async ?Bool {
        return icrc7().atomic_batch_transfers();
    };

    public query func icrc37_max_revoke_approvals() : async ?Nat {
        return ?icrc37().get_ledger_info().max_revoke_approvals;
    };

    public query func icrc7_collection_metadata() : async [(Text, Value)] {

        let ledger_info = icrc7().collection_metadata();
        let ledger_info37 = icrc37().metadata();
        let results = Vec.new<(Text, Value)>();

        Vec.addFromIter(results, ledger_info.vals());
        Vec.addFromIter(results, ledger_info37.vals());

        ///add any addtional metadata here
        //Vec.addFromIter(results, [
        //  ("ICRC-7", #Text("your value"))
        //].vals());

        return Vec.toArray(results);
    };

    public query func icrc7_token_metadata(token_ids : [Nat]) : async [?[(Text, Value)]] {
        return icrc7().token_metadata(token_ids);
    };

    public query func icrc7_owner_of(token_ids : OwnerOfRequest) : async OwnerOfResponse {

        switch (icrc7().get_token_owners(token_ids)) {
            case (#ok(val)) val;
            case (#err(err)) D.trap(err);
        };
    };

    public query func icrc7_balance_of(accounts : BalanceOfRequest) : async BalanceOfResponse {
        return icrc7().balance_of(accounts);
    };

    public query func icrc7_tokens(prev : ?Nat, take : ?Nat) : async [Nat] {
        return icrc7().get_tokens_paginated(prev, take);
    };

    public query func icrc7_tokens_of(account : Account, prev : ?Nat, take : ?Nat) : async [Nat] {
        return icrc7().get_tokens_of_paginated(account, prev, take);
    };

    public query func icrc37_is_approved(args : [IsApprovedArg]) : async [Bool] {
        return icrc37().is_approved(args);
    };

    public query func icrc37_get_token_approvals(token_ids : [Nat], prev : ?TokenApproval, take : ?Nat) : async [TokenApproval] {

        return icrc37().get_token_approvals(token_ids, prev, take);
    };

    public query func icrc37_get_collection_approvals(owner : Account, prev : ?CollectionApproval, take : ?Nat) : async [CollectionApproval] {

        return icrc37().get_collection_approvals(owner, prev, take);
    };

    public query func icrc10_supported_standards() : async ICRC7.SupportedStandards {
        //todo: figure this out
        return [
            {
                name = "ICRC-7";
                url = "https://github.com/dfinity/ICRC/ICRCs/ICRC-7";
            },
            {
                name = "ICRC-10";
                url = "https://github.com/dfinity/ICRC/ICRCs/ICRC-10";
            },
            {
                name = "ICRC-37";
                url = "https://github.com/dfinity/ICRC/ICRCs/ICRC-37";
            },
        ];
    };

    //Update calls

    public shared (msg) func icrc37_approve_tokens(args : [ApproveTokenArg]) : async [?ApproveTokenResult] {

        switch (icrc37().approve_transfers<system>(msg.caller, args)) {
            case (#ok(val)) val;
            case (#err(err)) D.trap(err);
        };
    };

    public shared (msg) func icrc37_approve_collection(approvals : [ApproveCollectionArg]) : async [?ApproveCollectionResult] {
        icrc37().approve_collection<system>(msg.caller, approvals);
    };

    //Modified

    public shared ({ caller }) func icrc7_transfer<system>(sender : Principal, args : [TransferArgs]) : async Result.Result<[?TransferResult], Text> {
        if (not isPermitted(caller)) {
            return #err("Unauthorized");
        };
        #ok(icrc7().transfer<system>(sender, args));
    };

    //

    public shared (msg) func icrc37_transfer_from<system>(args : [TransferFromArg]) : async [?TransferFromResult] {
        icrc37().transfer_from<system>(msg.caller, args);
    };

    public shared (msg) func icrc37_revoke_token_approvals<system>(args : [RevokeTokenApprovalArg]) : async [?RevokeTokenApprovalResult] {
        icrc37().revoke_token_approvals<system>(msg.caller, args);
    };

    public shared (msg) func icrc37_revoke_collection_approvals(args : [RevokeCollectionApprovalArg]) : async [?RevokeCollectionApprovalResult] {
        icrc37().revoke_collection_approvals<system>(msg.caller, args);
    };

    /////////
    // ICRC3 endpoints
    /////////

    public query func icrc3_get_blocks(args : [ICRC3.TransactionRange]) : async ICRC3.GetTransactionsResult {
        return icrc3().get_blocks(args);
    };

    public query func icrc3_get_archives(args : ICRC3.GetArchivesArgs) : async ICRC3.GetArchivesResult {
        return icrc3().get_archives(args);
    };

    public query func icrc3_supported_block_types() : async [ICRC3.BlockType] {
        return icrc3().supported_block_types();
    };

    public query func icrc3_get_tip_certificate() : async ?ICRC3.DataCertificate {
        return icrc3().get_tip_certificate();
    };

    public query func get_tip() : async ICRC3.Tip {
        return icrc3().get_tip();
    };

    /////////
    // The following functions are not part of ICRC7 or ICRC37. They are provided as examples of how
    // one might deploy an NFT.
    /////////

    public shared ({ caller }) func icrcX_mint(ownerNFTPrincipal : Principal, tokens : ICRC7.SetNFTRequest) : async [ICRC7.SetNFTResult] {
        //permitted caller should only be allowed to call this function
        if (not isPermitted(caller)) {
            return [];
        };
        //for now we require an owner to mint.
        switch (icrc7().set_nfts<system>(ownerNFTPrincipal, tokens, true)) {
            case (#ok(val)) val;
            case (#err(err)) D.trap(err);
        };
    };

    ///

    public shared (msg) func icrcX_burn(tokens : ICRC7.BurnNFTRequest) : async ICRC7.BurnNFTBatchResponse {
        switch (icrc7().burn_nfts<system>(msg.caller, tokens)) {
            case (#ok(val)) val;
            case (#err(err)) D.trap(err);
        };
    };

    private stable var _init = false;
    public shared (msg) func init() : async () {
        //can only be called once

        //Warning:  This is a test scenario and should not be used in production.  This creates an approval for the owner of the canister and this can be garbage collected if the max_approvals is hit.  We advise minting with the target owner in the metadata or creating an assign function (see assign)
        if (_init == false) {
            //approve the deployer as a spender on all tokens...
            let current_val = icrc37().get_state().ledger_info.collection_approval_requires_token;
            let update = icrc37().update_ledger_info([#CollectionApprovalRequiresToken(false)]);
            let result = icrc37().approve_collection<system>(Principal.fromActor(this), [{ approval_info = { from_subaccount = null; spender = { owner = icrc7().get_state().owner; subaccount = null }; memo = null; expires_at = null; created_at_time = null } }]);
            let update2 = icrc37().update_ledger_info([#CollectionApprovalRequiresToken(current_val)]);

            D.print(
                "initialized" # debug_show (
                    result,
                    {
                        from_subaccount = null;
                        spender = {
                            owner = icrc7().get_state().owner;
                            subaccount = null;
                        };
                        memo = null;
                        expires_at = null;
                        created_at_time = null;
                    },
                )
            );
        };
        _init := true;
    };

    //this lets an admin assign a token to an account
    public shared (msg) func assign(token_id : Nat, account : Account) : async Nat {
        if (msg.caller != icrc7().get_state().owner) D.trap("Unauthorized");

        switch (icrc7().transfer<system>(Principal.fromActor(this), [{ from_subaccount = null; to = account; token_id = token_id; memo = null; created_at_time = null }])[0]) {

            case (?#Ok(val)) val;
            case (?#Err(err)) D.trap(debug_show (err));
            case (_) D.trap("unknown");

        };
    };

    func ensure_block_types() : async* () {
        D.print("in ensure_block_types: ");
        let supportedBlocks = Buffer.fromIter<ICRC3.BlockType>(icrc3().supported_block_types().vals());

        let blockequal = func(a : { block_type : Text }, b : { block_type : Text }) : Bool {
            a.block_type == b.block_type;
        };

        for (thisItem in icrc7().supported_blocktypes().vals()) {
            if (Buffer.indexOf<ICRC3.BlockType>({ block_type = thisItem.0; url = thisItem.1 }, supportedBlocks, blockequal) == null) {
                supportedBlocks.add({
                    block_type = thisItem.0;
                    url = thisItem.1;
                });
            };
        };

        for (thisItem in icrc37().supported_blocktypes().vals()) {
            if (Buffer.indexOf<ICRC3.BlockType>({ block_type = thisItem.0; url = thisItem.1 }, supportedBlocks, blockequal) == null) {
                supportedBlocks.add({
                    block_type = thisItem.0;
                    url = thisItem.1;
                });
            };
        };

        icrc3().update_supported_blocks(Buffer.toArray(supportedBlocks));
    };

    initManager.calls.add(ensure_block_types);

    // Extra added functions

    private func isPermitted(caller : Principal) : Bool {
        Array.find(permittedPrincipals, func(p : Principal) : Bool { p == caller }) != null;
    };

    public shared ({ caller }) func icrcX_updateHPAndVisits(adminPrincipal : Principal, tokenId : Nat) : async Result.Result<[ICRC7.UpdateNFTResult], Text> {
        // Get current metadata
        if (not isPermitted(caller)) {
            return #err("Unauthorized");
        };

        let tokenMetadata = await icrc7_token_metadata([tokenId]);

        // Extract current values
        let currentAttributes = switch (tokenMetadata[0]) {
            case (?properties) {
                let attributesProp = Array.find(properties, func(p : (Text, ICRC7.Value)) : Bool { p.0 == "attributes" });

                switch (attributesProp) {

                    case (?(_, #Map(attrs))) {
                        let hp = Array.find<(Text, Value)>(attrs, func(p : (Text, Value)) : Bool { p.0 == "HP" });

                        let visits = Array.find<(Text, Value)>(attrs, func(p : (Text, Value)) : Bool { p.0 == "visitCount" });

                        let currentHP = switch (hp) {
                            case (?(_, #Nat(val))) val;
                            case _ return #err("Invalid HP format");
                        };

                        let currentVisits = switch (visits) {
                            case (?(_, #Nat(val))) val;
                            case _ return #err("Invalid visitCount format");
                        };

                        (currentHP, currentVisits);
                    };
                    case _ return #err("Attributes not found");
                };
            };
            case null return #err("Token metadata not found");
        };

        // Calculate new values
        let (currentHP, currentVisits) = currentAttributes;

        if (currentHP < 10) {
            return #err("HP cannot be less than 10");
        };

        let newHP = Nat.max(0, currentHP - 10);

        let newVisits = currentVisits + 1;

        // Create update request
        let updateRequest : ICRC7.UpdateNFTRequest = [{
            memo = null;
            created_at_time = null;
            token_id = tokenId;
            updates = [{
                name = "attributes";
                mode = #Next([
                    {
                        name = "HP";
                        mode = #Set(CandyTypesLib.unshare(#Nat(newHP)));
                    },
                    {
                        name = "visitCount";
                        mode = #Set(CandyTypesLib.unshare(#Nat(newVisits)));
                    },
                ]);
            }];
        }];

        switch (icrc7().update_nfts<system>(adminPrincipal, updateRequest)) {
            case (#ok(val)) {
                #ok(val);
            };
            case (#err(err)) {
                if (err != "NotFound") {
                    #err(err);
                } else {
                    #ok([]);
                };
            };
        };
    };

    public shared ({ caller }) func icrcX_updateHP(adminPrincipal : Principal, tokenId : Nat, amount : Nat) : async Result.Result<[ICRC7.UpdateNFTResult], Text> {
        // Check if caller is permitted
        if (not isPermitted(caller)) {
            return #err("Unauthorized");
        };

        // Get current metadata
        let tokenMetadata = await icrc7_token_metadata([tokenId]);

        // Extract current HP value
        let currentHP = switch (tokenMetadata[0]) {
            case (?properties) {
                let attributesProp = Array.find(properties, func(p : (Text, ICRC7.Value)) : Bool { p.0 == "attributes" });

                switch (attributesProp) {
                    case (?(_, #Map(attrs))) {
                        let hp = Array.find<(Text, Value)>(attrs, func(p : (Text, Value)) : Bool { p.0 == "HP" });

                        switch (hp) {
                            case (?(_, #Nat(val))) val;
                            case _ return #err("Invalid HP format");
                        };
                    };
                    case _ return #err("Attributes not found");
                };
            };
            case null return #err("Token metadata not found");
        };

        // Calculate new HP value
        let newHP = currentHP + amount;

        // Create update request
        let updateRequest : ICRC7.UpdateNFTRequest = [{
            memo = null;
            created_at_time = null;
            token_id = tokenId;
            updates = [{
                name = "attributes";
                mode = #Next([{
                    name = "HP";
                    mode = #Set(CandyTypesLib.unshare(#Nat(newHP)));
                }]);
            }];
        }];

        // Update the NFT
        switch (icrc7().update_nfts<system>(adminPrincipal, updateRequest)) {
            case (#ok(val)) {
                #ok(val);
            };
            case (#err(err)) {
                if (err != "NotFound") {
                    #err(err);
                } else {
                    #ok([]);
                };
            };
        };
    };

    public shared ({ caller }) func icrcX_updateMetadata(adminPrincipal : Principal, tokenId : Nat, attributes : [(Text, Value)]) : async Result.Result<[ICRC7.UpdateNFTResult], Text> {
        if (not isPermitted(caller)) {
            return #err("Unauthorized");
        };

        // Convert flat attributes array to proper Class structure
        let classAttributes = #Class(
            Array.map<(Text, Value), CandyTypesLib.PropertyShared>(
                attributes,
                func((k, v)) = {
                    immutable = false;
                    name = k;
                    value = v;
                },
            )
        );

        let updateRequest : ICRC7.UpdateNFTRequest = [{
            memo = null;
            created_at_time = null;
            token_id = tokenId;
            updates = [{
                name = "attributes";
                mode = #Set(CandyTypesLib.unshare(classAttributes));
            }];
        }];

        switch (icrc7().update_nfts<system>(adminPrincipal, updateRequest)) {
            case (#ok(val)) #ok(val);
            case (#err(err)) {
                if (err != "NotFound") {
                    #err(err);
                } else {
                    #ok([]);
                };
            };
        };
    };

};
