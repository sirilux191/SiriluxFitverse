import env "mo:env";

module {
    public let admin : Text = (env.admin);
    public let AIAgentAdmin : Text = (env.AIAgentAdmin);
    public let canisterControllersAdmin : Text = (env.canisterControllersAdmin);
    // Canister IDs
    public let icrc_ledger_canister_id : Text = (env.icrc_ledger_canister_id);
    public let vetkdSystemCanisterID : Text = (env.vetkdSystemCanisterID);

    public let wellnessAvatarNFTCanisterID : Text = (env.wellnessAvatarNFTCanisterID);
    public let identityManagerCanisterID : Text = (env.identityManagerCanisterID);

    public let userServiceCanisterID : Text = (env.userServiceCanisterID);
    public let professionalServiceCanisterID : Text = (env.professionalServiceCanisterID);
    public let facilityServiceCanisterID : Text = (env.facilityServiceCanisterID);

    public let dataAssetCanisterID : Text = (env.dataAssetCanisterID);

    public let gamificationSystemCanisterID : Text = (env.gamificationSystemCanisterID);
    public let AIAgentSystemCanisterID : Text = (env.AIAgentSystemCanisterID);
    public let subscriptionManagerCanisterID : Text = (env.subscriptionManagerCanisterID);
};
