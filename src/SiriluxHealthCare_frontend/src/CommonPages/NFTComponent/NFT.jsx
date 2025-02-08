import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import useActorStore from "@/State/Actors/ActorStore";
import useNFTStore from "@/State/CryptoAssets/NFTStore";
import NFTCard from "./NFTCard";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import AvatarStatus from "./AvatarStatus";

const NFT = () => {
  const { actors } = useActorStore();
  const { nfts, loading, error, fetchNFTs } = useNFTStore();
  const { toast } = useToast();
  const [selectedAvatar, setSelectedAvatar] = useState(null);
  const [isAvatarStatusOpen, setIsAvatarStatusOpen] = useState(false);

  useEffect(() => {
    if (actors) {
      fetchNFTs(actors);
    }
  }, [actors, fetchNFTs]);

  const handleTransfer = async (avatarId, principalAddress) => {
    try {
      result = await actors.gamificationSystem.transferNFT(
        avatarId,
        principalAddress
      );
      toast({
        title: "Avatar Transferred",
        description: "The avatar has been successfully transferred.",
        duration: 3000,
      });
      fetchNFTs(actors);
    } catch (error) {
      console.error("Error transferring avatar:", error);
      toast({
        title: "Transfer Failed",
        description: "Failed to transfer the avatar. Please try again.",
        variant: "destructive",
        duration: 3000,
      });
    }
  };

  const manageAvatar = (avatar) => {
    setSelectedAvatar(avatar);
    setIsAvatarStatusOpen(true);
  };

  if (error) {
    return (
      <div className="text-center p-8 text-red-500">
        <p>Error loading NFTs: {error}</p>
        <Button
          onClick={() => fetchNFTs(actors)}
          className="mt-4"
        >
          Retry
        </Button>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4 max-w-[1200px] mx-auto">
        {loading ? (
          [1, 2, 3].map((i) => (
            <div
              key={i}
              className="animate-pulse bg-gray-800/50 rounded-lg p-6 h-96"
            />
          ))
        ) : nfts.length === 0 ? (
          <div className="col-span-2 text-center p-8 bg-gray-800/50 rounded-lg">
            <p className="text-gray-400">No NFTs found in your collection</p>
          </div>
        ) : (
          nfts.map((nft) => (
            <div
              key={nft.id}
              className="w-full flex justify-center"
            >
              <NFTCard
                nft={{
                  ...nft,
                }}
                showManage={true}
                onManage={manageAvatar}
                onTransfer={handleTransfer}
                onVisit={() => console.log("Visit initiated")}
              />
            </div>
          ))
        )}
      </div>

      <Dialog
        open={isAvatarStatusOpen}
        onOpenChange={setIsAvatarStatusOpen}
      >
        <DialogContent className="max-w-3xl">
          {selectedAvatar && <AvatarStatus avatar={selectedAvatar} />}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default NFT;
