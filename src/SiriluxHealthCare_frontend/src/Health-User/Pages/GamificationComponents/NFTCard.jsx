import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { QUALITY_TIERS } from "./constants";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Send, 
  AlertCircle, 
  Eye, 
  Sword, 
  Activity, 
  Brain, 
  Heart, 
  Shield, 
  Gauge,
  Target
} from "lucide-react";
import { toast } from "@/components/ui/use-toast";

const NFTCard = ({
  nft,
  onVisit,
  isPending,
  showManage = false,
  onManage,
  onTransfer,
}) => {
  const [isTransferOpen, setIsTransferOpen] = useState(false);
  const [principalAddress, setPrincipalAddress] = useState("");
  const [isTransferring, setIsTransferring] = useState(false);
  const qualityStyles = QUALITY_TIERS[nft.quality];

  const handleTransfer = async () => {
    if (!principalAddress.trim()) {
      toast({
        title: "Error",
        description: "Please enter a valid principal address.",
        variant: "destructive",
      });
      return;
    }

    setIsTransferring(true);
    try {
      await onTransfer(nft.id, principalAddress);
      setIsTransferOpen(false);
      setPrincipalAddress("");
      toast({
        title: "Success",
        description: "NFT transferred successfully!",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to transfer NFT. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsTransferring(false);
    }
  };

  return (
<Card 
  className={`
    bg-gray-800/40 text-white rounded-lg shadow-md transition-colors duration-300 ease-in-out relative overflow-hidden group max-w-sm 
    border-4 ${qualityStyles.border} 
    ${nft.quality === 'Common' ? 'hover:border-gray-400' : ''}
    ${nft.quality === 'Uncommon' ? 'hover:border-green-400' : ''}
    ${nft.quality === 'Rare' ? 'hover:border-blue-400' : ''}
    ${nft.quality === 'Epic' ? 'hover:border-purple-400' : ''}
    ${nft.quality === 'Legendary' ? 'hover:border-yellow-400' : ''}
    ${nft.quality === 'Mythic' ? 'hover:border-red-400' : ''}
  `}
>

      <div className="relative z-10">
        <CardHeader className="border-b border-gray-700 flex flex-row items-center space-x-4 p-4">
          <img
            src={nft.image}
            alt={nft.name}
            className="w-16 h-16 rounded-lg object-cover"
          />
          <div className="flex-1">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold">{nft.name}</h2>
            </div>
            <Badge
              className={`${qualityStyles.bg} ${qualityStyles.text} w-fit text-xs`}
            >
              {nft.quality}
            </Badge>
            <p className="text-xs text-gray-400">{nft.type}</p>
          </div>
        </CardHeader>

        <CardContent className="p-3 space-y-4">
          {/* Level and HP Section */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-gray-700/30 rounded-lg p-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <Target className="w-4 h-4 text-yellow-500 mr-2" />
                  <span className="text-xs text-gray-400">LEVEL</span>
                </div>
                <span className="text-lg font-bold">{nft.level}</span>
              </div>
            </div>
            <div className="bg-gray-700/30 rounded-lg p-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <Heart className="w-4 h-4 text-red-500 mr-2" />
                  <span className="text-xs text-gray-400">HP</span>
                </div>
                <span className="text-lg font-bold">{nft.hp}</span>
              </div>
            </div>
          </div>

          {/* Main Stats Grid */}
          <div className="grid grid-cols-2 gap-2">
            <div className="flex items-center space-x-2 bg-gray-700/20 p-2 rounded-lg">
              <Activity className="w-4 h-4 text-blue-400" />
              <div className="flex justify-between items-center w-full">
                <span className="text-xs text-gray-400">ENERGY</span>
                <span className="text-sm font-semibold">{nft.energy}</span>
              </div>
            </div>
            <div className="flex items-center space-x-2 bg-gray-700/20 p-2 rounded-lg">
              <Brain className="w-4 h-4 text-purple-400" />
              <div className="flex justify-between items-center w-full">
                <span className="text-xs text-gray-400">FOCUS</span>
                <span className="text-sm font-semibold">{nft.focus}</span>
              </div>
            </div>
            <div className="flex items-center space-x-2 bg-gray-700/20 p-2 rounded-lg">
              <Gauge className="w-4 h-4 text-green-400" />
              <div className="flex justify-between items-center w-full">
                <span className="text-xs text-gray-400">VITALITY</span>
                <span className="text-sm font-semibold">{nft.vitality}</span>
              </div>
            </div>
            <div className="flex items-center space-x-2 bg-gray-700/20 p-2 rounded-lg">
              <Shield className="w-4 h-4 text-orange-400" />
              <div className="flex justify-between items-center w-full">
                <span className="text-xs text-gray-400">RESILIENCE</span>
                <span className="text-sm font-semibold">{nft.resilience}</span>
              </div>
            </div>
          </div>

          {/* Visits Counter */}
          <div className="flex items-center justify-end text-gray-400">
            <Eye className="w-3 h-3 mr-1" />
            <span className="text-xs">
              Visits: {nft.visitCount || 0}
            </span>
          </div>
        </CardContent>

        <CardFooter className="py-2 border-t border-gray-700 flex justify-between p-3">
          {showManage ? (
            <>
              <Button
                className="bg-green-600 hover:bg-green-700 text-white text-sm"
                onClick={() => onManage(nft)}
              >
                Manage
              </Button>
              <Dialog open={isTransferOpen} onOpenChange={setIsTransferOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-blue-600 hover:bg-blue-700 text-white text-sm">
                    Transfer
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-gray-800 text-white">
                  <DialogHeader>
                    <DialogTitle>Transfer NFT</DialogTitle>
                  </DialogHeader>
                  <div className="flex flex-col space-y-4">
                    <Input
                      placeholder="Enter principal address"
                      value={principalAddress}
                      onChange={(e) => setPrincipalAddress(e.target.value)}
                      className="bg-gray-700 text-white"
                    />
                    <Button
                      onClick={handleTransfer}
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                      disabled={isTransferring}
                    >
                      {isTransferring ? (
                        <>
                          <AlertCircle className="w-4 h-4 mr-2 animate-spin" />
                          Transferring...
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4 mr-2" />
                          Transfer
                        </>
                      )}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </>
          ) : (
            <Button
              className="bg-blue-600 hover:bg-blue-700 text-white w-full text-sm"
              onClick={() => onVisit(nft)}
              disabled={isPending}
            >
              {isPending ? "Pending..." : "Visit"}
            </Button>
          )}
        </CardFooter>
      </div>
    </Card>
  );
};

export default NFTCard;
