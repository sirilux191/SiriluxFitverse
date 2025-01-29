import DataAssetShardManager "../DataAsset/DataAssetShardManager";
import ProfessionalShardManager "../Professional/ProfessionalShardManager";
import SharedActivityShardManager "../SharedActivitySystem/SharedActivityShardManager";
import CanisterIDs "CanisterIDs";
module ManagerCanisterTypes {

    public let dataAssetShardManager : DataAssetShardManager.DataAssetShardManager = actor (CanisterIDs.dataAssetShardManagerCanisterID);

    public let professionalShardManager : ProfessionalShardManager.ProfessionalShardManager = actor (CanisterIDs.professionalShardManagerCanisterID);
    public let sharedActivityShardManager : SharedActivityShardManager.SharedActivityShardManager = actor (CanisterIDs.sharedActivityShardManagerCanisterID);
};
