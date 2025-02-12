import Result "mo:base/Result";

import IdentityManager "../IdentityManager/IdentityManager";
import CanisterIDs "CanisterIDs";

module CanisterTypes {
    public let admin : Text = CanisterIDs.admin;

    public type VETKD_SYSTEM_API = actor {
        vetkd_public_key : ({
            canister_id : ?Principal;
            derivation_path : [Blob];
            key_id : { curve : { #bls12_381 }; name : Text };
        }) -> async ({ public_key : Blob });

        vetkd_encrypted_key : ({
            derivation_id : Blob;
            public_key_derivation_path : [Blob];

            key_id : { curve : { #bls12_381 }; name : Text };
            encryption_public_key : Blob;
        }) -> async ({ encrypted_key : Blob });
    };

    public type DataService = actor {
        updateDataStorageUsedMap : (Principal, Int) -> async Result.Result<(), Text>;

    };

    public let identityManager : IdentityManager.IdentityManager = actor (CanisterIDs.identityManagerCanisterID);
    public let vetkd_system_api : VETKD_SYSTEM_API = actor (CanisterIDs.vetkdSystemCanisterID);
    public let dataStorageService : DataService = actor (CanisterIDs.dataAssetCanisterID);
};
