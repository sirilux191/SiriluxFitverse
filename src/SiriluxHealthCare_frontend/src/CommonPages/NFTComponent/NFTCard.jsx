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
import { toast } from "@/components/ui/use-toast";

const NFTCard = ({
  nft,
  onVisit,
  isPending,
  showManage = false,
  onManage,
  onTransfer,
}) => {
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
      border-2 ${qualityStyles.border} ${currentType.theme}
    `}
    >
      <div className="relative z-10">
        {/* Header Section */}
        <CardHeader className="space-y-2 p-4">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold">{currentType.title}</h2>
                <span className="text-sm text-gray-400">#{nft.id}</span>
              </div>
              <Badge className={`${qualityStyles.bg} ${qualityStyles.text}`}>
                {nft.quality}
              </Badge>
            </div>
            <Badge
              variant="outline"
              className="capitalize"
            >
              {nft.type}
            </Badge>
          </div>
          <p className="text-sm text-gray-400">
            {nft.avatarType || nft.specialization || nft.facilityType}
          </p>
        </CardHeader>

        {/* Image Section */}
        <CardContent className="space-y-4 p-4">
          <div className="relative w-full aspect-square mb-4 rounded-lg overflow-hidden bg-gray-800/50">
            <div className="absolute inset-0 flex items-center justify-center">
              <img
                src={getAvatarImage()}
                alt={`${nft.type} NFT`}
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.target.src = "/assets/default-placeholder.png";
                }}
              />
            </div>
          </div>

          {/* Level and HP Row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-800/50 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Target className="w-4 h-4 text-yellow-500" />
                  <span className="text-sm text-gray-400">LEVEL</span>
                </div>
                <span className="text-lg font-bold">{nft.level}</span>
              </div>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Heart className="w-4 h-4 text-red-500" />
                  <span className="text-sm text-gray-400">HP</span>
                </div>
                <span className="text-lg font-bold">{nft.hp}</span>
              </div>
            </div>
          </div>

          {/* Attributes Grid */}
          <div className="grid grid-cols-2 gap-3">
            {currentType.attributes.map((attr) => (
              <div
                key={attr.label}
                className="bg-gray-800/50 rounded-lg p-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {attr.icon}
                    <span className="text-sm text-gray-400">{attr.label}</span>
                  </div>
                  <span className="text-lg font-bold">{attr.value}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Specialization/Services Section */}
          {currentType.specialization && (
            <div className="bg-gray-800/50 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">SPECIALIZATION</span>
                <span className="text-sm font-medium">
                  {nft.specialization}
                </span>
              </div>
              <div className="flex items-center justify-between mt-2">
                <span className="text-sm text-gray-400">VISITS</span>
                <span className="text-sm font-medium">
                  {nft.visitCount || 0}
                </span>
              </div>
            </div>
          )}

          {currentType.services && (
            <div className="bg-gray-800/50 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">SERVICES</span>
                <span className="text-sm font-medium">{nft.services}</span>
              </div>
              <div className="flex items-center justify-between mt-2">
                <span className="text-sm text-gray-400">VISITS</span>
                <span className="text-sm font-medium">
                  {nft.visitCount || 0}
                </span>
              </div>
            </div>
          )}

          {/* Visit Counter for Avatars */}
          {nft.type === "avatar" && (
            <div className="flex items-center justify-end text-gray-400">
              <Eye className="w-3 h-3 mr-1" />
              <span className="text-xs">Visits: {nft.visitCount || 0}</span>
            </div>
          )}
        </CardContent>

        {/* Footer Section */}
        <CardFooter className="p-4 pt-0 flex gap-3">
          {showManage ? (
            <>
              <Button
                className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                onClick={() => onManage(nft)}
              >
                Manage
              </Button>
              <Dialog
                open={isTransferOpen}
                onOpenChange={setIsTransferOpen}
              >
                <DialogTrigger asChild>
                  <Button className="flex-1 bg-blue-600 hover:bg-blue-700">
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
              className="w-full bg-blue-600 hover:bg-blue-700"
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
