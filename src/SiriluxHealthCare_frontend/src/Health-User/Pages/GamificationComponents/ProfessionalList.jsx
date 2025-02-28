import React, { useState, useEffect } from "react";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectItem,
  SelectContent,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Calendar,
  Clock,
  UserCheck,
  Award,
  Mail,
  Globe,
  Users,
  Star,
  User,
  Loader2Icon,
  Coins,
} from "lucide-react";
import useProfessionalListStore from "../../../State/Gamification/ProfessionalListStore";
import useNFTStore from "../../../State/CryptoAssets/NFTStore";
import useActorStore from "../../../State/Actors/ActorStore";
import useWalletStore from "../../../State/CryptoAssets/WalletStore";

const ProfessionalList = () => {
  const { nfts } = useNFTStore();
  const [selectedAvatarForVisit, setSelectedAvatarForVisit] = useState(null);
  const {
    professionals,
    isLoading,
    error,
    availableSlots,
    fetchAvailableSlots,
    initiateVisit,
    groupSlotsByDate,
    formatDateTime,
    fetchProfessionals,
  } = useProfessionalListStore();
  const { balance } = useWalletStore();

  const { gamificationSystem } = useActorStore();
  const handleProfessionalSelect = async (prof) => {
    await fetchAvailableSlots(prof.id);
  };

  useEffect(() => {
    if (gamificationSystem) {
      fetchProfessionals();
    }
  }, [gamificationSystem]);

  return (
    <div className="space-y-4 sm:space-y-6">
      {isLoading && (
        <div className="flex justify-center py-8">
          <Loader2Icon className="h-8 w-8 animate-spin text-blue-500" />
        </div>
      )}

      {error && (
        <div className="text-red-500 p-4 text-center">
          Error loading professionals: {error}
        </div>
      )}

      {!isLoading && !error && professionals.length === 0 && (
        <div className="text-muted-foreground p-4 text-center">
          No professionals found
        </div>
      )}

      {!isLoading && !error && professionals.length > 0 && (
        <>
          <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950">
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="text-lg sm:text-xl flex items-center gap-2">
                <Users className="h-5 w-5 text-blue-500" />
                Select Avatar for Visit
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-6">
              <Select
                onValueChange={setSelectedAvatarForVisit}
                value={selectedAvatarForVisit}
              >
                <SelectTrigger className="w-full bg-white dark:bg-gray-800">
                  <SelectValue placeholder="Choose an avatar for your visit" />
                </SelectTrigger>
                <SelectContent>
                  {nfts.map((avatar) => (
                    <SelectItem
                      key={avatar.id}
                      value={avatar.id}
                    >
                      <span className="flex items-center gap-2">
                        <Star className="h-4 w-4 text-yellow-400" />
                        {avatar.avatarType ||
                          avatar.specialization ||
                          avatar.services}{" "}
                        (Level {avatar.level})
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
            {professionals.map((prof) => (
              <Card
                key={prof.id}
                className="bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-800 hover:border-gray-700 transition-all duration-300 overflow-hidden h-full"
              >
                <div className="p-2 sm:p-6 flex flex-col h-full">
                  {/* Header Section */}
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between mb-2 sm:mb-4">
                    <div className="flex flex-col sm:flex-row items-center sm:items-start gap-2 sm:gap-4">
                      <div className="bg-gradient-to-br from-blue-500/20 to-purple-500/20 p-2 sm:p-3 rounded-xl">
                        <UserCheck className="w-5 h-5 sm:w-8 sm:h-8 text-blue-400" />
                      </div>
                      <div className="text-center sm:text-left">
                        <h3 className="text-sm sm:text-lg font-semibold text-white">
                          {prof.name}
                        </h3>
                        <p className="text-xs text-gray-400">{prof.id}</p>
                      </div>
                    </div>
                  </div>

                  {/* Specialties Section */}
                  <ScrollArea className="mb-2 sm:mb-4 h-[40px] sm:h-[50px]">
                    <div className="flex flex-wrap justify-center sm:justify-start gap-0.5 sm:gap-2 pr-4">
                      <Badge
                        variant="secondary"
                        className="bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[8px] sm:text-sm 
                        px-1 py-0 sm:px-2.5 sm:py-1 leading-tight sm:leading-normal whitespace-normal break-words max-w-full"
                      >
                        {prof.specialization}
                      </Badge>
                    </div>
                  </ScrollArea>

                  {/* Description */}
                  <p className="text-gray-400 text-[10px] sm:text-sm mb-2 sm:mb-6 line-clamp-3 md:line-clamp-4 flex-grow text-center sm:text-left overflow-hidden overflow-ellipsis">
                    {prof.description}
                  </p>

                  {/* Status Indicators */}
                  <div className="mt-auto space-y-1.5 sm:space-y-3">
                    <div className="flex flex-col sm:flex-row gap-1.5 sm:gap-0 sm:items-center sm:justify-between text-[9px] sm:text-sm text-gray-400">
                      <div className="flex items-center justify-center sm:justify-start gap-1 sm:gap-2">
                        <Mail className="w-3 h-3 sm:w-4 sm:h-4" />
                        <span>Contact via platform</span>
                      </div>
                      <div className="flex items-center justify-center sm:justify-start gap-1 sm:gap-2">
                        <Globe className="w-3 h-3 sm:w-4 sm:h-4" />
                        <span>Online consultations</span>
                      </div>
                    </div>

                    {/* Book Button Section */}
                    <div className="flex flex-col sm:flex-row items-center sm:justify-between pt-1.5 sm:pt-3 border-t border-gray-800 gap-2 sm:gap-0">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            className="w-full sm:w-auto bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 
                            text-white text-[9px] sm:text-sm px-1.5 sm:px-3 py-1 sm:py-2 h-auto"
                            disabled={!selectedAvatarForVisit}
                            onClick={() => handleProfessionalSelect(prof)}
                          >
                            <Calendar className="w-2.5 h-2.5 sm:w-4 sm:h-4 mr-1" />
                            View Available Slots
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="w-[95vw] max-w-2xl p-0">
                          <DialogHeader className="p-4 sm:p-6 border-b">
                            <DialogTitle className="text-xl font-bold flex items-center gap-2">
                              <Calendar className="h-5 w-5 text-blue-500" />
                              Available Slots
                            </DialogTitle>
                            <DialogDescription className="text-sm text-muted-foreground">
                              Select a time slot to book your visit with{" "}
                              {prof.name}
                            </DialogDescription>
                          </DialogHeader>

                          <ScrollArea className="max-h-[60vh] sm:max-h-[70vh] w-full">
                            <div className="p-4 sm:p-6">
                              {availableSlots.length > 0 ? (
                                <div className="space-y-6">
                                  {Object.entries(
                                    groupSlotsByDate(availableSlots)
                                  ).map(([date, dateSlots]) => (
                                    <div
                                      key={date}
                                      className="space-y-3"
                                    >
                                      <h3 className="text-lg font-semibold sticky top-0 bg-background py-2 border-b z-10">
                                        {date}
                                      </h3>
                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        {dateSlots.map((slot, index) => {
                                          const { time } = formatDateTime(
                                            slot.start
                                          );
                                          return (
                                            <Card
                                              key={index}
                                              className="hover:bg-accent transition-colors"
                                            >
                                              <CardContent className="p-3 sm:p-4">
                                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                                  <div className="space-y-1">
                                                    <p className="text-sm font-medium flex items-center gap-2">
                                                      <Clock className="h-4 w-4 text-blue-500" />
                                                      {time}
                                                    </p>
                                                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                                      <Clock className="h-3 w-3" />
                                                      <span>30 minutes</span>
                                                    </div>
                                                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                                      <Coins className="h-3 w-3 text-amber-500" />
                                                      <span>
                                                        {slot.price} SIRI Tokens
                                                      </span>
                                                    </div>
                                                  </div>
                                                  <Button
                                                    size="sm"
                                                    onClick={() =>
                                                      initiateVisit(
                                                        slot.entityId,
                                                        Number(slot.start),
                                                        selectedAvatarForVisit,
                                                        slot.price
                                                      )
                                                    }
                                                    disabled={
                                                      !selectedAvatarForVisit ||
                                                      balance < slot.price
                                                    }
                                                    className="w-full sm:w-auto"
                                                  >
                                                    {balance < slot.price
                                                      ? "Insufficient Tokens"
                                                      : "Book Slot"}
                                                  </Button>
                                                </div>
                                              </CardContent>
                                            </Card>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                                  <Calendar className="h-12 w-12 mb-4 opacity-50" />
                                  <p className="text-lg font-medium text-center">
                                    No available slots
                                  </p>
                                  <p className="text-sm text-center mt-1">
                                    Try selecting a different professional or
                                    check back later
                                  </p>
                                </div>
                              )}
                            </div>
                          </ScrollArea>

                          {selectedAvatarForVisit && (
                            <div className="border-t p-4 bg-muted/50">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 text-sm">
                                  <User className="h-4 w-4" />
                                  <span>Selected Avatar:</span>
                                  <Badge variant="secondary">
                                    #{selectedAvatarForVisit}
                                  </Badge>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() =>
                                    setSelectedAvatarForVisit(null)
                                  }
                                >
                                  Change
                                </Button>
                              </div>
                            </div>
                          )}
                        </DialogContent>
                      </Dialog>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default ProfessionalList;
