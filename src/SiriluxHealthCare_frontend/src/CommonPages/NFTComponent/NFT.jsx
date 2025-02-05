import React, { useEffect } from "react";
import { useNFTStore } from "@/State/CryptoAssets/NFTStore";
import NFTCard from "@/Health-User/Pages/GamificationComponents/NFTCard";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import useActorStore from "@/State/Actors/ActorStore";
import { useToast } from "@/components/ui/use-toast";

const NFT = () => {
  const { actors } = useActorStore();
  const { nfts, loading, error, fetchNFTs } = useNFTStore();
  const { toast } = useToast();

  useEffect(() => {
    if (actors) {
      fetchNFTs(actors);
    }
  }, [actors, fetchNFTs]);

  const handleTransfer = async (id, principal) => {
    try {
      await actors.gamificationSystem.transferNFT(id, principal);
      toast({
        title: "Success",
        description: "NFT transferred successfully!",
      });
      fetchNFTs(actors);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to transfer NFT",
        variant: "destructive",
      });
    }
  };

  const handleManage = (nft) => {
    // Implement manage logic
    console.log("Managing NFT:", nft);
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">My NFTs</h1>
        <Button
          onClick={() => fetchNFTs(actors)}
          disabled={loading}
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Refresh"}
        </Button>
      </div>

      {loading && !nfts.length ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-6">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="animate-pulse bg-gray-800/50 rounded-lg p-6 h-96"
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-6">
          {nfts.map((nft) => (
            <NFTCard
              key={nft.id}
              nft={nft}
              showManage={true}
              onManage={handleManage}
              onTransfer={handleTransfer}
              onVisit={() => console.log("Visit initiated")}
            />
          ))}
        </div>
      )}

      {!loading && !nfts.length && (
        <div className="text-center p-8 text-gray-400">
          <p>No NFTs found in your collection</p>
        </div>
      )}
    </div>
  );
};

export default NFT;
