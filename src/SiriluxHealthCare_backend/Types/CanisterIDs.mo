import env "mo:env";

module {

    public let admin : Text = (env.admin);
    // Canister IDs
    public let icrc_ledger_canister_id : Text = (env.icrc_ledger_canister_id);
    public let vetkdSystemCanisterID : Text = (env.vetkdSystemCanisterID);
    public let wellnessAvatarNFTCanisterID : Text = (env.wellnessAvatarNFTCanisterID);
    public let identityManagerCanisterID : Text = (env.identityManagerCanisterID);
    public let userServiceCanisterID : Text = (env.userServiceCanisterID);
    public let professionalServiceCanisterID : Text = (env.professionalServiceCanisterID);
    public let facilityServiceCanisterID : Text = (env.facilityServiceCanisterID);
    public let dataAssetCanisterID : Text = (env.dataAssetCanisterID);
    public let sharedActivityCanisterID : Text = (env.sharedActivityCanisterID);
    public let userShardManagerCanisterID : Text = (env.userShardManagerCanisterID);
    public let professionalShardManagerCanisterID : Text = (env.professionalShardManagerCanisterID);
    public let facilityShardManagerCanisterID : Text = (env.facilityShardManagerCanisterID);
    public let dataAssetShardManagerCanisterID : Text = (env.dataAssetShardManagerCanisterID);
    public let sharedActivityShardManagerCanisterID : Text = (env.sharedActivityShardManagerCanisterID);
    public let xpSystemCanisterID : Text = (env.xpSystemCanisterID);
    public let gamificationSystemCanisterID : Text = (env.gamificationSystemCanisterID);
    public let visitManagerCanisterID : Text = (env.visitManagerCanisterID);
    public let marketplaceShardManagerCanisterID : Text = (env.marketplaceShardManagerCanisterID);

};
