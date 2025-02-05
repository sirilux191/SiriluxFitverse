import React from "react";
import { ProgressIndicator } from "@/components/ui/progressIndicator";
import { Button } from "@/components/ui/button";
import {
  User,
  Badge,
  Target,
  Heart,
  Activity,
  Brain,
  Gauge,
  Shield,
  Star,
  Building,
  Briefcase,
} from "lucide-react";

const AvatarStatus = ({ avatar, onLevelUp, onRestoreHP, userTokens }) => {
  // Configure stats based on NFT type
  const getStats = () => {
    switch (avatar.type) {
      case "avatar":
        return [
          {
            name: "Energy",
            value: avatar.energy,
            max: avatar.energy,
            color: "bg-blue-400",
            icon: <Activity className="w-4 h-4 text-blue-400" />,
          },
          {
            name: "Focus",
            value: avatar.focus,
            max: avatar.focus,
            color: "bg-purple-400",
            icon: <Brain className="w-4 h-4 text-purple-400" />,
          },
          {
            name: "Vitality",
            value: avatar.vitality,
            max: avatar.vitality,
            color: "bg-green-400",
            icon: <Gauge className="w-4 h-4 text-green-400" />,
          },
          {
            name: "Resilience",
            value: avatar.resilience,
            max: avatar.resilience,
            color: "bg-orange-400",
            icon: <Shield className="w-4 h-4 text-orange-400" />,
          },
        ];
      case "professional":
        return [
          {
            name: "Experience",
            value: avatar.experience,
            max: avatar.experience,
            color: "bg-yellow-400",
            icon: <Star className="w-4 h-4 text-yellow-400" />,
          },
          {
            name: "Reputation",
            value: avatar.reputation,
            max: avatar.reputation,
            color: "bg-blue-400",
            icon: <Badge className="w-4 h-4 text-blue-400" />,
          },
        ];
      case "facility":
        return [
          {
            name: "Tech Level",
            value: avatar.technologyLevel,
            max: avatar.technologyLevel,
            color: "bg-blue-400",
            icon: <Gauge className="w-4 h-4 text-blue-400" />,
          },
          {
            name: "Reputation",
            value: avatar.reputation,
            max: avatar.reputation,
            color: "bg-yellow-400",
            icon: <Star className="w-4 h-4 text-yellow-400" />,
          },
        ];
      default:
        return [];
    }
  };

  const getTypeIcon = () => {
    switch (avatar.type) {
      case "avatar":
        return <User className="mr-2" />;
      case "professional":
        return <Briefcase className="mr-2" />;
      case "facility":
        return <Building className="mr-2" />;
      default:
        return <User className="mr-2" />;
    }
  };

  const getTypeTitle = () => {
    switch (avatar.type) {
      case "avatar":
        return "Avatar Status";
      case "professional":
        return "Professional Status";
      case "facility":
        return "Facility Status";
      default:
        return "Status";
    }
  };

  const maxHP = 100;
  const stats = getStats();

  // Update getAvatarImage function to use metadata image
  const getAvatarImage = () => {
    return avatar.image || "/assets/default-placeholder.png";
  };

  return (
    <div className="bg-gray-800/40 border-4 border-gray-700 text-white rounded-lg shadow-md mb-6 max-h-[80vh] overflow-y-auto">
      <div className="flex items-center text-blue-400 text-xl font-bold p-4 sticky top-0 bg-gray-800/40 border-b border-gray-700 z-10">
        {getTypeIcon()} {getTypeTitle()}
      </div>

      <div className="p-4 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="relative aspect-square">
            <img
              src={getAvatarImage()}
              alt={avatar.type}
              className="w-full h-full object-cover rounded-lg border-2 border-gray-700"
              onError={(e) => {
                e.target.src = "/assets/default-placeholder.png";
              }}
            />
          </div>
          <div className="flex flex-col justify-center space-y-2">
            <h2 className="text-xl font-bold">
              {avatar.avatarType || avatar.specialization || avatar.services}
            </h2>
            <Badge className="w-fit text-xs bg-gray-700 text-white">
              {avatar.quality}
            </Badge>
            <p className="text-sm bg-gray-700/30 rounded-lg p-2 flex items-center">
              <Target className="w-4 h-4 text-yellow-500 mr-2" />
              Level {avatar.level}
            </p>
          </div>
        </div>

        <div className="bg-gray-700/30 rounded-lg p-3">
          <div className="flex justify-between items-center mb-2">
            <div className="flex items-center">
              <Heart className="w-4 h-4 text-red-500 mr-2" />
              <span className="text-xs text-gray-400">HP</span>
            </div>
            <span className="text-lg font-bold">
              {avatar.hp} / {maxHP}
            </span>
          </div>
          <ProgressIndicator
            value={(avatar.hp / maxHP) * 100}
            className="w-full h-2.5 bg-gray-700/50"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {stats.map((stat) => (
            <div
              key={stat.name}
              className="flex items-center space-x-2 bg-gray-700/20 p-3 rounded-lg"
            >
              {stat.icon}
              <div className="flex-1">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs text-gray-400">{stat.name}</span>
                  <span className="text-sm font-semibold">
                    {stat.value} / {stat.max}
                  </span>
                </div>
                <ProgressIndicator
                  value={(stat.value / stat.max) * 100}
                  className="w-full h-2 bg-gray-700/50"
                />
              </div>
            </div>
          ))}
        </div>

        {/* Additional Info Section */}
        {avatar.type === "professional" && (
          <div className="bg-gray-700/20 p-3 rounded-lg">
            <p className="text-sm text-gray-400 mb-2">Specialization</p>
            <p className="font-medium">{avatar.specialization}</p>
          </div>
        )}

        {avatar.type === "facility" && (
          <div className="bg-gray-700/20 p-3 rounded-lg">
            <p className="text-sm text-gray-400 mb-2">Services</p>
            <p className="font-medium">{avatar.services}</p>
          </div>
        )}
      </div>

      <div className="border-t border-gray-700 p-4 sticky bottom-0 bg-gray-800/40 z-10">
        <div className="flex flex-col sm:flex-row gap-2">
          <Button
            onClick={() => onRestoreHP(10)}
            disabled={userTokens < 10 || avatar.hp >= maxHP}
            className="bg-green-600 hover:bg-green-700 text-white w-full sm:w-auto"
          >
            Restore 10 HP (10 Tokens)
          </Button>
          <Button
            onClick={onLevelUp}
            disabled={userTokens < avatar.level * 100}
            className="bg-blue-600 hover:bg-blue-700 text-white w-full sm:w-auto"
          >
            Level Up ({avatar.level * 100} Tokens)
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AvatarStatus;
