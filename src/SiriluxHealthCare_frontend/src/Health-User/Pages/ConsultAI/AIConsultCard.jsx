import React from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Star, Clock, Bot, Shield, MessageSquare } from "lucide-react";
import { useNavigate } from "react-router-dom";

const AIConsultCard = ({ agent }) => {
  const navigate = useNavigate();

  // Calculate rating stars
  const renderStars = (rating) => {
    return (
      <div className="flex items-center gap-1">
        <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
        <span className="text-sm font-medium">{rating}</span>
        <span className="text-sm text-muted-foreground">
          ({agent.reviewCount} reviews)
        </span>
      </div>
    );
  };

  return (
    <Card className="bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-800 hover:border-gray-700 transition-all duration-300 overflow-hidden h-full">
      <div className="p-2 sm:p-6 flex flex-col h-full">
        {/* Header Section - Vertical on mobile */}
        <div className="flex flex-col gap-2 sm:gap-0 sm:flex-row sm:items-start sm:justify-between mb-2 sm:mb-4">
          {/* Bot Icon and Name - Centered on mobile */}
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-2 sm:gap-4">
            <div className="bg-gradient-to-br from-blue-500/20 to-purple-500/20 p-2 sm:p-3 rounded-xl">
              <Bot className="w-5 h-5 sm:w-8 sm:h-8 text-blue-400" />
            </div>
            <div className="text-center sm:text-left">
              <h3 className="text-sm sm:text-lg font-semibold text-white">
                {agent.name}
              </h3>
              {/* Rating - Centered on mobile */}
              <div className="flex justify-center sm:justify-start">
                {renderStars(agent.rating)}
              </div>
            </div>
          </div>
        </div>

        {/* Specialties Section - Centered on mobile */}
        <div className="mb-2 sm:mb-4">
          <div className="flex flex-wrap justify-center sm:justify-start gap-0.5 sm:gap-2">
            {agent.specialties.map((specialty, index) => (
              <Badge
                key={index}
                variant="secondary"
                className="bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[8px] sm:text-sm 
                px-1 py-0 sm:px-2.5 sm:py-1 leading-tight sm:leading-normal whitespace-nowrap"
              >
                {specialty}
              </Badge>
            ))}
          </div>
        </div>

        {/* Description - Centered on mobile */}
        <p className="text-gray-400 text-[10px] sm:text-sm mb-2 sm:mb-6 line-clamp-2 sm:line-clamp-3 flex-grow text-center sm:text-left">
          {agent.description}
        </p>

        {/* Status Indicators - Stacked on mobile */}
        <div className="mt-auto space-y-1.5 sm:space-y-3">
          <div className="flex flex-col sm:flex-row gap-1.5 sm:gap-0 sm:items-center sm:justify-between text-[9px] sm:text-sm text-gray-400">
            <div className="flex items-center justify-center sm:justify-start gap-1 sm:gap-2">
              <Clock className="w-3 h-3 sm:w-4 sm:h-4" />
              <span>Available 24/7</span>
            </div>
            <div className="flex items-center justify-center sm:justify-start gap-1 sm:gap-2">
              <Shield className="w-3 h-3 sm:w-4 sm:h-4" />
              <span>Verified AI</span>
            </div>
          </div>

          {/* Price and Button Section */}
          <div className="flex flex-col sm:flex-row items-center sm:justify-between pt-1.5 sm:pt-3 border-t border-gray-800 gap-2 sm:gap-0">
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-0.5 sm:gap-1">
              <span className="text-sm sm:text-lg font-bold text-white">
                ${agent.consultationFee}
              </span>
              <span className="text-[8px] sm:text-sm text-gray-400">
                per consultation
              </span>
            </div>
            <Button
              onClick={() => navigate(`/Health-User/consult/${agent.id}`)}
              className="w-full sm:w-auto bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 
              text-white text-[9px] sm:text-sm px-1.5 sm:px-3 py-1 sm:py-2 h-auto"
            >
              <MessageSquare className="w-2.5 h-2.5 sm:w-4 sm:h-4 mr-1" />
              Consult Now
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default AIConsultCard;
