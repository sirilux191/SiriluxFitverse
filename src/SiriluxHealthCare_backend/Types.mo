import Blob "mo:base/Blob";
import Nat "mo:base/Nat";
import Text "mo:base/Text";
import Time "mo:base/Time";
import env "mo:env";
module Types {

    public type SharedType = {
        #Sold;
        #Shared;
    };

    public type Metadata = {
        category : Text;
        description : Text;
        tags : [Text];
        format : Text; //  e.g., "CSV", "JSON", "image/png"
    };

    public type HealthIDUserData = {
        DemographicInformation : Blob;
        BasicHealthParameters : Blob;
        BiometricData : ?Blob;
        FamilyInformation : ?Blob;
    };
    public type HealthIDUser = {
        IDNum : Text;
        UUID : Text;
        MetaData : HealthIDUserData;
    };

    public type HealthIDProfessionalData = {
        DemographicInformation : Blob;
        OccupationInformation : Blob;
        CertificationInformation : Blob;
    };
    public type HealthIDProfessional = {
        IDNum : Text;
        UUID : Text;
        MetaData : HealthIDProfessionalData;
    };

    public type HealthIDFacilityData = {
        DemographicInformation : Blob;
        ServicesOfferedInformation : Blob;
        LicenseInformation : Blob;
    };
    public type HealthIDFacility = {
        IDNum : Text;
        UUID : Text;
        MetaData : HealthIDFacilityData;
    };

    public type DataAsset = {
        assetID : Text;
        title : Text;
        data : Text;
        metadata : Metadata;
    };

    public type DataAssetInfo = {
        title : Text;
        description : Text;
        metadata : Metadata;
    };

    public type sharedActivityInfo = {
        activityID : Text;
        assetID : Text;
        usedSharedTo : Text;
        time : Nat;
        sharedType : SharedType;
    };

    public type IdenitySharedInfo = {
        timeShared : Int;
        accessTill : Int;
        userSharedToType : Text;
        userSharedToID : Text;
    };

    public type TimeRemaining = {
        seconds : Float;
        minutes : Float;
        hours : Float;
        days : Float;
    };

    public type Balance = {
        tokens : Nat;
        dataMB : Nat;
        lastUpdateTime : Time.Time;
    };

    public type TokenRequestAmounts = {
        currentRequestAmount : Nat;
        approvedTillNow : Nat;
    };

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

    public let admin : Text = (env.admin);

    public type QuotaInfo = {
        maxStorage : Nat; // in bytes
        usedStorage : Nat;
        maxAssets : Nat;
        currentAssets : Nat;
        lastResetTime : Int;
    };

};
