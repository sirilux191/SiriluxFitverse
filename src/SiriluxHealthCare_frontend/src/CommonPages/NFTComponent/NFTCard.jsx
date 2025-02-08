import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardContent,
  CardFooter,
} from "@/components/ui/card";

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
  Activity,
  Brain,
  Heart,
  Shield,
  Gauge,
  Target,
  Star,
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import useActorStore from "@/State/Actors/ActorStore";
import useNFTStore from "@/State/CryptoAssets/NFTStore";

const NFTCard = ({ nft, onVisit, isPending, showManage = false, onManage }) => {
  const { actors } = useActorStore();
  const { transferNFT } = useNFTStore();
  const { toast } = useToast();
  const QUALITY_TIERS = {
    Common: {
      bg: "bg-gray-400",
      text: "text-gray-100",
      border: "border-gray-400/60",
    },
    Uncommon: {
      bg: "bg-green-400",
      text: "text-green-100",
      border: "border-green-400/60",
    },
    Rare: {
      bg: "bg-blue-400",
      text: "text-blue-100",
      border: "border-blue-400/60",
    },
    Epic: {
      bg: "bg-purple-400",
      text: "text-purple-100",
      border: "border-purple-400/60",
    },
    Legendary: {
      bg: "bg-yellow-400",
      text: "text-yellow-100",
      border: "border-yellow-400/60",
    },
    Mythic: {
      bg: "bg-red-400",
      text: "text-red-100",
      border: "border-red-400/60",
    },
  };

  const [isTransferOpen, setIsTransferOpen] = useState(false);
  const [principalAddress, setPrincipalAddress] = useState("");
  const [isTransferring, setIsTransferring] = useState(false);
  const qualityStyles = QUALITY_TIERS[nft.quality] || QUALITY_TIERS.Common;

  // Type-specific configuration
  const typeConfig = {
    avatar: {
      theme: "border-blue-400",
      title: "Wellness Avatar",
      attributes: [
        {
          label: "ENERGY",
          value: nft.energy,
          icon: <Activity className="w-4 h-4 text-blue-400" />,
        },
        {
          label: "FOCUS",
          value: nft.focus,
          icon: <Brain className="w-4 h-4 text-purple-400" />,
        },
        {
          label: "VITALITY",
          value: nft.vitality,
          icon: <Gauge className="w-4 h-4 text-green-400" />,
        },
        {
          label: "RESILIENCE",
          value: nft.resilience,
          icon: <Shield className="w-4 h-4 text-orange-400" />,
        },
      ],
    },
    professional: {
      theme: "border-green-400",
      title: "Healthcare Professional",
      attributes: [
        {
          label: "EXPERIENCE",
          value: nft.experience,
          icon: <Badge className="w-4 h-4 text-yellow-400" />,
        },
        {
          label: "REPUTATION",
          value: nft.reputation,
          icon: <Star className="w-4 h-4 text-blue-400" />,
        },
      ],
      specialization: true,
    },
    facility: {
      theme: "border-purple-400",
      title: "Healthcare Facility",
      attributes: [
        {
          label: "TECH LEVEL",
          value: nft.technologyLevel,
          icon: <Gauge className="w-4 h-4 text-blue-400" />,
        },
        {
          label: "REPUTATION",
          value: nft.reputation,
          icon: <Star className="w-4 h-4 text-yellow-400" />,
        },
      ],
      services: true,
    },
  };

  const currentType = typeConfig[nft.type] || typeConfig.avatar;

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
      const result = await transferNFT(actors, nft.id, principalAddress);
      if (result.success) {
        setIsTransferOpen(false);
        setPrincipalAddress("");
      }
      toast({
        title: result.success ? "Success" : "Error",
        description: result.message,
        variant: result.success ? "default" : "destructive",
      });
    } finally {
      setIsTransferring(false);
    }
  };

  // Remove or update getAvatarImage function to use metadata image
  const getAvatarImage = () => {
    // Return the image URL from metadata if available, otherwise use placeholder
    return nft.image || "/assets/default-placeholder.png";
  };

  return (
    <Card
      className={`
      bg-gray-900/95 text-white rounded-lg shadow-xl transition-all duration-300
      hover:shadow-2xl relative overflow-hidden w-full max-w-[500px]
      border-[1px] sm:border-2 ${qualityStyles.border} ${currentType.theme}
    `}
    >
      <div className="relative z-10">
        {/* Header Section */}
        <CardHeader className="space-y-1 sm:space-y-2 p-2 sm:p-3 md:p-4">
          <div className="flex justify-between items-start gap-1">
            <div className="space-y-0.5 sm:space-y-1 min-w-0 flex-1">
              <div className="flex items-center gap-1 sm:gap-2">
                <h2 className="text-sm sm:text-base md:text-lg font-bold truncate">
                  {currentType.title}
                </h2>
                <span className="text-[10px] sm:text-xs md:text-sm text-gray-400 shrink-0">
                  #{nft.id}
                </span>
              </div>
              <Badge
                className={`text-[10px] sm:text-xs md:text-sm px-1 sm:px-2 ${qualityStyles.bg} ${qualityStyles.text}`}
              >
                {nft.quality}
              </Badge>
            </div>
            <Badge
              variant="outline"
              className="capitalize text-[10px] sm:text-xs md:text-sm px-1 sm:px-2 shrink-0"
            >
              {nft.type}
            </Badge>
          </div>
          <p className="text-[10px] sm:text-xs md:text-sm text-gray-400 truncate">
            {nft.avatarType || nft.specialization || nft.services}
          </p>
        </CardHeader>

        {/* Image Section */}
        <CardContent className="space-y-2 sm:space-y-3 md:space-y-4 p-2 sm:p-3 md:p-4">
          <div className="relative w-full aspect-square mb-2 sm:mb-4 rounded-lg overflow-hidden bg-gray-800/50">
            <div className="absolute inset-0 flex items-center justify-center">
              <img
                src={getAvatarImage()}
                alt={`${nft.type} NFT`}
                className="w-full h-full object-contain"
                onError={(e) => {
                  e.target.src = "/assets/default-placeholder.png";
                }}
              />
            </div>
          </div>

          {/* Level and HP Row */}
          <div className="grid grid-cols-2 gap-1 sm:gap-2 md:gap-3">
            <div className="bg-gray-800/50 rounded-lg p-1.5 sm:p-2 md:p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-0.5 sm:gap-1 md:gap-2">
                  <Target className="w-2.5 h-2.5 sm:w-3 sm:h-3 md:w-4 md:h-4 text-yellow-500" />
                  <span className="text-[10px] sm:text-xs md:text-sm text-gray-400">
                    LEVEL
                  </span>
                </div>
                <span className="text-xs sm:text-sm md:text-lg font-bold">
                  {nft.level}
                </span>
              </div>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-1.5 sm:p-2 md:p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-0.5 sm:gap-1 md:gap-2">
                  <Heart className="w-2.5 h-2.5 sm:w-3 sm:h-3 md:w-4 md:h-4 text-red-500" />
                  <span className="text-[10px] sm:text-xs md:text-sm text-gray-400">
                    HP
                  </span>
                </div>
                <span className="text-xs sm:text-sm md:text-lg font-bold">
                  {nft.HP}
                </span>
              </div>
            </div>
          </div>

          {/* Attributes Grid */}
          <div className="grid grid-cols-2 gap-1 sm:gap-2 md:gap-3">
            {currentType.attributes.map((attr) => (
              <div
                key={attr.label}
                className="bg-gray-800/50 rounded-lg p-1.5 sm:p-2 md:p-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-0.5 sm:gap-1 md:gap-2">
                    {React.cloneElement(attr.icon, {
                      className: `w-2.5 h-2.5 sm:w-3 sm:h-3 md:w-4 md:h-4 ${attr.icon.props.className}`,
                    })}
                    <span className="text-[10px] sm:text-xs md:text-sm text-gray-400">
                      {attr.label}
                    </span>
                  </div>
                  <span className="text-xs sm:text-sm md:text-lg font-bold">
                    {attr.value}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Specialization/Services Section */}
          {currentType.specialization && (
            <div className="bg-gray-800/50 rounded-lg p-1.5 sm:p-2 md:p-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] sm:text-xs md:text-sm text-gray-400">
                  SPECIALIZATION
                </span>
                <span className="text-[10px] sm:text-xs md:text-sm font-medium truncate max-w-[50%]">
                  {nft.specialization}
                </span>
              </div>
              <div className="flex items-center justify-between mt-1 sm:mt-2">
                <span className="text-[10px] sm:text-xs md:text-sm text-gray-400">
                  VISITS
                </span>
                <span className="text-[10px] sm:text-xs md:text-sm font-medium">
                  {nft.visitCount || 0}
                </span>
              </div>
            </div>
          )}

          {currentType.services && (
            <div className="bg-gray-800/50 rounded-lg p-1.5 sm:p-2 md:p-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] sm:text-xs md:text-sm text-gray-400">
                  SERVICES
                </span>
                <span className="text-[10px] sm:text-xs md:text-sm font-medium">
                  {nft.services}
                </span>
              </div>
              <div className="flex items-center justify-between mt-1 sm:mt-2">
                <span className="text-[10px] sm:text-xs md:text-sm text-gray-400">
                  VISITS
                </span>
                <span className="text-[10px] sm:text-xs md:text-sm font-medium">
                  {nft.visitCount || 0}
                </span>
              </div>
            </div>
          )}

          {/* Visit Counter for Avatars */}
          {nft.type === "avatar" && (
            <div className="flex items-center justify-end text-gray-400">
              <Eye className="w-2.5 h-2.5 sm:w-3 sm:h-3 mr-0.5 sm:mr-1" />
              <span className="text-[10px] sm:text-xs">
                Visits: {nft.visitCount || 0}
              </span>
            </div>
          )}
        </CardContent>

        {/* Footer Section */}
        <CardFooter className="p-2 sm:p-3 md:p-4 pt-0 flex gap-1 sm:gap-2 md:gap-3">
          {showManage ? (
            <>
              <Button
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-[10px] sm:text-xs md:text-sm py-1 sm:py-2 h-7 sm:h-8 md:h-10"
                onClick={() => onManage(nft)}
              >
                Manage
              </Button>
              <Dialog
                open={isTransferOpen}
                onOpenChange={setIsTransferOpen}
              >
                <DialogTrigger asChild>
                  <Button className="flex-1 bg-blue-600 hover:bg-blue-700 text-[10px] sm:text-xs md:text-sm py-1 sm:py-2 h-7 sm:h-8 md:h-10">
                    Transfer
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-gray-900 text-white">
                  <DialogHeader>
                    <DialogTitle>Transfer NFT</DialogTitle>
                  </DialogHeader>
                  <div className="flex flex-col space-y-4">
                    <Input
                      placeholder="Enter principal address"
                      value={principalAddress}
                      onChange={(e) => setPrincipalAddress(e.target.value)}
                      className="bg-gray-800 text-white"
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
              className="w-full bg-blue-600 hover:bg-blue-700 text-[10px] sm:text-xs md:text-sm py-1 sm:py-2 h-7 sm:h-8 md:h-10"
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
