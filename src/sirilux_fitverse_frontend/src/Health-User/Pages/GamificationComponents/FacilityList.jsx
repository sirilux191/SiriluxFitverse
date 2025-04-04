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
  Building,
  MapPin,
  Users,
  Star,
  User,
  Loader2Icon,
  Coins,
  Phone,
} from "lucide-react";
import useFacilityListStore from "../../../State/Gamification/FacilityListStore";
import useNFTStore from "../../../State/CryptoAssets/NFTStore";
import useActorStore from "../../../State/Actors/ActorStore";
import useWalletStore from "../../../State/CryptoAssets/WalletStore";

const FacilityList = () => {
  const { nfts } = useNFTStore();
  const [selectedAvatarForVisit, setSelectedAvatarForVisit] = useState(null);
  const {
    facilities,
    isLoading,
    error,
    availableSlots,
    fetchAvailableSlots,
    initiateVisit,
    groupSlotsByDate,
    formatDateTime,
    fetchFacilities,
  } = useFacilityListStore();
  const { balance } = useWalletStore();

  const { gamificationSystem } = useActorStore();
  const handleFacilitySelect = async (facility) => {
    await fetchAvailableSlots(facility.id);
  };

  useEffect(() => {
    if (gamificationSystem) {
      console.log("Fetching Facilities");
      fetchFacilities();
    }
  }, [gamificationSystem]);

  return (
    <div className="space-y-4 sm:space-y-6">
      {isLoading && (
        <div className="flex justify-center py-8">
          <Loader2Icon className="h-8 w-8 animate-spin text-emerald-500" />
        </div>
      )}

      {error && (
        <div className="text-red-500 p-4 text-center">
          Error loading facilities: {error}
        </div>
      )}

      {!isLoading && !error && facilities.length === 0 && (
        <div className="text-muted-foreground p-4 text-center">
          No facilities found
        </div>
      )}

      {!isLoading && !error && facilities.length > 0 && (
        <>
          <Card className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950 dark:to-teal-950">
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="text-lg sm:text-xl flex items-center gap-2">
                <Users className="h-5 w-5 text-emerald-500" />
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
            {facilities.map((facility) => (
              <Card
                key={facility.id}
                className="hover:shadow-lg transition-shadow"
              >
                <CardHeader className="bg-gradient-to-r from-emerald-600 to-teal-500 text-white rounded-t-lg shadow-md">
                  <CardTitle className="flex items-center gap-3">
                    <Building className="h-6 w-6" />
                    <div>
                      <h3 className="text-xl font-bold">{facility.name}</h3>
                      <p className="text-sm opacity-90">{facility.id}</p>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6 space-y-4">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-emerald-500" />
                    <Badge
                      variant="secondary"
                      className="text-sm"
                    >
                      {facility.facilityType}
                    </Badge>
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {facility.description}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Phone className="h-4 w-4" />
                      <span>Contact via platform</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      <span>Operating hours</span>
                    </div>
                  </div>

                  <Dialog>
                    <DialogTrigger asChild>
                      <Button
                        className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600"
                        disabled={!selectedAvatarForVisit}
                        onClick={() => handleFacilitySelect(facility)}
                      >
                        <Calendar className="h-4 w-4 mr-2" />
                        View Available Slots
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="w-[95vw] max-w-2xl p-0">
                      <DialogHeader className="p-4 sm:p-6 border-b">
                        <DialogTitle className="text-xl font-bold flex items-center gap-2">
                          <Calendar className="h-5 w-5 text-emerald-500" />
                          Available Slots
                        </DialogTitle>
                        <DialogDescription className="text-sm text-muted-foreground">
                          Select a time slot to book your visit with{" "}
                          {facility.name}
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
                                                  <Clock className="h-4 w-4 text-emerald-500" />
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
                                Try selecting a different facility or check back
                                later
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
                              onClick={() => setSelectedAvatarForVisit(null)}
                            >
                              Change
                            </Button>
                          </div>
                        </div>
                      )}
                    </DialogContent>
                  </Dialog>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default FacilityList;
