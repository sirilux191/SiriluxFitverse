import React, { useState, useEffect, useContext } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  User,
  Building,
  Calendar,
  Briefcase,
  Globe,
  Loader2 as Loader2Icon,
  RefreshCw,
  Star,
  Coins,
  Users,
  UserCheck,
  Award,
  Mail,
  Clock,
  AlertCircle,
  PlusCircle,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import { Badge } from "@/components/ui/badge";
import AvatarStatus from "./GamificationComponents/AvatarStatus";
import NFTCard from "./GamificationComponents/NFTCard";

import ActorContext from "../../ActorContext";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { MapPin, Phone } from "lucide-react";

const NavigationMenu = ({ activeTab, setActiveTab }) => {
  const tabs = [
    { id: "avatars", label: "Avatars", icon: <User className="h-4 w-4" /> },
    {
      id: "professionals",
      label: "Professionals",
      icon: <Briefcase className="h-4 w-4" />,
    },
    {
      id: "facilities",
      label: "Facilities",
      icon: <Building className="h-4 w-4" />,
    },
    {
      id: "visits",
      label: "My Visits",
      icon: <Calendar className="h-4 w-4" />,
    },
  ];

  return (
    <div className="w-full mb-6">
      {/* Mobile View - Popover */}
      <div className="sm:hidden w-full">
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className="w-full justify-between"
            >
              <div className="flex items-center gap-2">
                {tabs.find((tab) => tab.id === activeTab)?.icon}
                {tabs.find((tab) => tab.id === activeTab)?.label}
              </div>
              <ChevronDown className="h-4 w-4 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className="w-full p-0"
            align="start"
          >
            <div className="grid gap-1 p-1">
              {tabs.map((tab) => (
                <Button
                  key={tab.id}
                  variant={activeTab === tab.id ? "secondary" : "ghost"}
                  className="w-full justify-start gap-2"
                  onClick={() => setActiveTab(tab.id)}
                >
                  {tab.icon}
                  {tab.label}
                </Button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Desktop View - Regular Tabs */}
      <div className="hidden sm:block">
        <div className="flex space-x-2 bg-gray-800/95 text-white rounded-lg p-1">
          {tabs.map((tab) => (
            <Button
              key={tab.id}
              variant={activeTab === tab.id ? "secondary" : "ghost"}
              className={`flex-1 gap-2 ${
                activeTab === tab.id ? "bg-white/10" : "hover:bg-white/5"
              }`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.icon}
              {tab.label}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
};

const Gamification = () => {
  const { actors } = useContext(ActorContext);
  const [userAvatars, setUserAvatars] = useState([]);
  const [professionals, setProfessionals] = useState([]);
  const [facilities, setFacilities] = useState([]);
  const [selectedAvatar, setSelectedAvatar] = useState(null);
  const [selectedProfessional, setSelectedProfessional] = useState(null);
  const [selectedFacility, setSelectedFacility] = useState(null);
  const [visitDuration, setVisitDuration] = useState(30);
  const [availableSlots, setAvailableSlots] = useState([]);
  const [selectedAvatarForVisit, setSelectedAvatarForVisit] = useState(null);
  const [userTokens, setUserTokens] = useState(null);
  const [isAvatarStatusOpen, setIsAvatarStatusOpen] = useState(false);
  const [visits, setVisits] = useState([]);
  const [isLoadingVisits, setIsLoadingVisits] = useState(false);
  const [activeTab, setActiveTab] = useState("avatars");

  useEffect(() => {
    fetchUserAvatars();
    fetchProfessionals();
    fetchFacilities();
    fetchUserTokens();
  }, [actors]);

  const fetchUserAvatars = async () => {
    try {
      const avatarsResult =
        await actors.gamificationSystem.getUserAvatarsSelf();
      console.log("Raw avatars result:", avatarsResult);

      const formattedAvatars = [];
      for (const [tokenId, metadata] of avatarsResult) {
        try {
          if (!metadata || !Array.isArray(metadata[0])) {
            console.error("Invalid metadata structure for token:", tokenId);
            continue;
          }

          const metadataEntries = metadata[0];
          if (!Array.isArray(metadataEntries)) {
            console.error("Invalid metadata entries for token:", tokenId);
            continue;
          }

          // Find the attributes, name, and image in metadata
          const attributesEntry = metadataEntries.find(
            (entry) => entry[0] === "attributes"
          );
          const nameEntry = metadataEntries.find(
            (entry) => entry[0] === "name"
          );
          const imageEntry = metadataEntries.find(
            (entry) => entry[0] === "image"
          );

          if (
            !attributesEntry ||
            !attributesEntry[1] ||
            !attributesEntry[1].Map
          ) {
            console.error("No attributes found for token:", tokenId);
            continue;
          }

          const attributesMap = attributesEntry[1].Map;
          const name = nameEntry?.[1]?.Text ?? "Unknown";

          // Helper function to find attribute value
          const getAttributeValue = (name) => {
            const attribute = attributesMap.find((attr) => attr[0] === name);
            if (!attribute) return null;

            const value = attribute[1];
            if (value.Nat) return Number(value.Nat);
            if (value.Text) return value.Text;
            return null;
          };

          // Determine NFT type and create appropriate object
          if (attributesMap.some((attr) => attr[0] === "energy")) {
            formattedAvatars.push({
              type: "avatar",
              id: Number(tokenId),
              name,
              image: imageEntry?.[1]?.Text ?? null,
              energy: getAttributeValue("energy") ?? 0,
              focus: getAttributeValue("focus") ?? 0,
              vitality: getAttributeValue("vitality") ?? 0,
              resilience: getAttributeValue("resilience") ?? 0,
              quality:
                (getAttributeValue("quality") || "Common")
                  .charAt(0)
                  .toUpperCase() +
                (getAttributeValue("quality") || "Common")
                  .slice(1)
                  .toLowerCase(),
              avatarType: getAttributeValue("avatarType") ?? "Unknown",
              level: getAttributeValue("level") ?? 1,
              HP: getAttributeValue("HP") ?? 100,
              visitCount: getAttributeValue("visitCount") ?? 0,
            });
          } else if (attributesMap.some((attr) => attr[0] === "experience")) {
            formattedAvatars.push({
              type: "professional",
              id: Number(tokenId),
              name,
              image: imageEntry?.[1]?.Text ?? null,
              experience: getAttributeValue("experience") ?? 0,
              reputation: getAttributeValue("reputation") ?? 0,
              specialization: getAttributeValue("specialization") ?? "Unknown",
              quality: getAttributeValue("quality") ?? "Common",
              HP: getAttributeValue("HP") ?? 100,
              visitCount: getAttributeValue("visitCount") ?? 0,
              level: getAttributeValue("level") ?? 1,
            });
          } else if (
            attributesMap.some((attr) => attr[0] === "technologyLevel")
          ) {
            formattedAvatars.push({
              type: "facility",
              id: Number(tokenId),
              name,
              image: imageEntry?.[1]?.Text ?? null,
              technologyLevel: getAttributeValue("technologyLevel") ?? 0,
              reputation: getAttributeValue("reputation") ?? 0,
              services: getAttributeValue("services") ?? "Unknown",
              quality: getAttributeValue("quality") ?? "Common",
              HP: getAttributeValue("HP") ?? 100,
              visitCount: getAttributeValue("visitCount") ?? 0,
              level: getAttributeValue("level") ?? 1,
            });
          }
        } catch (error) {
          console.error(`Error processing token ${tokenId}:`, error);
        }
      }

      console.log("Final formatted NFTs:", formattedAvatars);
      setUserAvatars(formattedAvatars);
    } catch (error) {
      console.error("Error fetching NFTs:", error);
      toast({
        title: "Error",
        description: "Failed to fetch NFTs",
        variant: "destructive",
      });
    }
  };

  const fetchProfessionals = async () => {
    try {
      const result = await actors.visitManager.getAllProfessionals();
      setProfessionals(result); // Ensure result is in the expected format
    } catch (error) {
      console.error("Error fetching professionals:", error);
    }
  };

  const fetchFacilities = async () => {
    try {
      const result = await actors.visitManager.getAllFacilities();
      setFacilities(result); // Ensure result is in the expected format
    } catch (error) {
      console.error("Error fetching facilities:", error);
    }
  };

  const formatDateTime = (nanoseconds) => {
    // Convert nanoseconds to milliseconds
    const milliseconds = Number(nanoseconds) / 1_000_000;
    const date = new Date(milliseconds);

    return {
      date: date.toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
      time: date.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      }),
    };
  };

  const groupSlotsByDate = (slots) => {
    const grouped = {};
    slots.forEach((slot) => {
      const { date } = formatDateTime(slot.start);
      if (!grouped[date]) {
        grouped[date] = [];
      }
      grouped[date].push(slot);
    });

    // Sort slots within each date
    Object.keys(grouped).forEach((date) => {
      grouped[date].sort((a, b) => Number(a.start) - Number(b.start));
    });

    return grouped;
  };

  const fetchAvailableSlots = async (idToVisit) => {
    try {
      const result = await actors.visitManager.getAvailableSlots(idToVisit);
      if (Array.isArray(result)) {
        console.log("Available Slots for ID:", idToVisit);

        // Filter out past slots
        const currentTime = Date.now() * 1_000_000; // Convert to nanoseconds
        const validSlots = result.filter(
          (slot) => Number(slot.start) > currentTime
        );

        // Sort slots by start time
        const sortedSlots = validSlots.sort(
          (a, b) => Number(a.start) - Number(b.start)
        );

        setAvailableSlots(sortedSlots);
      } else {
        console.error("Invalid slots response:", result);
        setAvailableSlots([]);
      }
    } catch (error) {
      console.error("Error fetching available slots:", error);
      setAvailableSlots([]);
      toast({
        title: "Error",
        description: "Failed to fetch available slots",
        variant: "destructive",
        duration: 3000,
      });
    }
  };

  const initiateVisit = async (idToVisit, slotTime) => {
    try {
      const result = await actors.gamificationSystem.initiateVisit(
        idToVisit,
        slotTime,
        { Online: null },
        Number(selectedAvatarForVisit)
      );

      if (result.ok) {
        toast({
          title: "Visit Initiated",
          description: "Your visit has been successfully booked.",
          duration: 3000,
        });
        await fetchAvailableSlots(idToVisit);
      } else {
        throw new Error(result.err);
      }
    } catch (error) {
      console.error("Error initiating visit:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to book the visit.",
        variant: "destructive",
        duration: 3000,
      });
    }
  };

  const levelUp = async () => {
    try {
      const result = await actors.gamificationSystem.levelUpAvatar(
        selectedAvatar.id
      );
      console.log("result", result);
      if (result.ok) {
        const updatedAttributes =
          await actors.gamificationSystem.getAvatarAttributes(
            selectedAvatar.id
          );
        setUserAvatars((prevAvatars) =>
          prevAvatars.map((avatar) =>
            avatar.id === selectedAvatar.id
              ? {
                  ...avatar,
                  ...updatedAttributes,
                  level: avatar.level + 1,
                  tokens: avatar.tokens - avatar.level * 100,
                  hp: 100,
                }
              : avatar
          )
        );
        setSelectedAvatar((prevAvatar) => ({
          ...prevAvatar,
          ...updatedAttributes,
          level: prevAvatar.level + 1,
          tokens: prevAvatar.tokens - prevAvatar.level * 100,
          hp: 100,
        }));
      }
    } catch (error) {
      console.error("Error leveling up avatar:", error);
    }
  };

  const restoreHP = async (amount) => {
    try {
      await actors.gamificationSystem.restoreHP(
        Number(selectedAvatar.id),
        Number(amount)
      );
      setUserAvatars((prevAvatars) =>
        prevAvatars.map((avatar) =>
          avatar.id === selectedAvatar.id
            ? {
                ...avatar,
                hp: Math.min(avatar.hp + amount, 100),
                tokens: avatar.tokens - amount,
              }
            : avatar
        )
      );
      setSelectedAvatar((prevAvatar) => ({
        ...prevAvatar,
        hp: Math.min(prevAvatar.hp + amount, 100),
        tokens: prevAvatar.tokens - amount,
      }));
    } catch (error) {
      console.error("Error restoring HP:", error);
    }
  };

  const manageAvatar = (avatar) => {
    setSelectedAvatar(avatar);
    setIsAvatarStatusOpen(true);
  };

  const transferAvatar = async (avatarId, principalAddress) => {
    try {
      const result = await actors.gamificationSystem.transferNFT(
        avatarId,
        principalAddress
      );
      console.log("result", result);
      // After successful transfer, update the user avatars
      await fetchUserAvatars();
      toast({
        title: "Avatar Transferred",
        description: "The avatar has been successfully transferred.",
        duration: 3000,
      });
    } catch (error) {
      console.error("Error transferring avatar:", error);
      toast({
        title: "Transfer Failed",
        description: "Failed to transfer the avatar. Please try again.",
        variant: "destructive",
        duration: 3000,
      });
      throw error;
    }
  };

  const handleProfessionalSelect = async (prof) => {
    setSelectedProfessional(prof);
    await fetchAvailableSlots(prof.id); // Fetch slots when a professional is selected
  };

  const fetchUserTokens = async () => {
    try {
      const result = await actors.gamificationSystem.getUserTokens();
      if (result.ok) {
        setUserTokens(Number(result.ok[0]) || 0);
      } else {
        console.error("Error fetching user tokens:", result.err);
      }
    } catch (error) {
      console.error("Error fetching user tokens:", error);
    }
  };

  const TokenDisplay = () => (
    <div className="flex items-center">
      <div className="bg-blue-500/10 text-blue-500 font-semibold py-2 px-4 rounded-full flex items-center gap-2">
        <Coins className="h-4 w-4" />
        <span>{userTokens}</span>
        <span>Tokens</span>
      </div>
    </div>
  );

  const formatAvailableSlots = (slots) => {
    return slots.map(([start, end]) => ({
      date: new Date(start).toLocaleDateString(),
      startTime: new Date(start).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
      endTime: new Date(end).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    }));
  };

  const fetchVisits = async () => {
    setIsLoadingVisits(true);
    try {
      const result = await actors.visitManager.getUserVisits();
      if (result.ok) {
        setVisits(result.ok);
      } else {
        console.error("Error fetching visits:", result.err);
        toast({
          title: "Error",
          description: "Failed to fetch visits",
          variant: "destructive",
          duration: 3000,
        });
      }
    } catch (error) {
      console.error("Error fetching visits:", error);
      toast({
        title: "Error",
        description: "Failed to fetch visits",
        variant: "destructive",
        duration: 3000,
      });
    } finally {
      setIsLoadingVisits(false);
    }
  };

  const getStatusVariant = (status) => {
    const statusKey = Object.keys(status)[0];
    switch (statusKey) {
      case "Completed":
        return "success";
      case "Pending":
        return "warning";
      case "Cancelled":
        return "destructive";
      case "Rejected":
        return "destructive";
      case "Approved":
        return "default";
      default:
        return "secondary";
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col sm:flex-row justify-between items-center mb-8 gap-4">
        <h1 className="text-3xl sm:text-4xl font-bold text-foreground">
          Wellness Avatar Platform
        </h1>
        {userTokens !== null && <TokenDisplay />}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="lg:col-span-2">
          <NavigationMenu
            activeTab={activeTab}
            setActiveTab={setActiveTab}
          />

          {activeTab === "avatars" && (
            <div className="mt-4 sm:mt-6">
              <h2 className="text-xl sm:text-2xl font-semibold mb-4 text-blue-400">
                User Avatars
              </h2>
              {userAvatars.length === 0 ? (
                <div className="text-center p-8 bg-gray-800/50 rounded-lg">
                  <User className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                  <p className="text-gray-400">
                    No Avatars. Visit Professionals and Facilities to find
                    Avatars.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4 max-w-[1200px] mx-auto">
                  {userAvatars.map((nft) => (
                    <div
                      key={nft.id}
                      className="w-full flex justify-center"
                    >
                      <NFTCard
                        nft={{
                          ...nft,
                          hp: nft.HP,
                        }}
                        showManage={true}
                        onManage={manageAvatar}
                        onTransfer={transferAvatar}
                        onVisit={() => console.log("Visit initiated")}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === "professionals" && (
            <div className="mt-4 sm:mt-6">
              <div className="space-y-4 sm:space-y-6">
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
                        {userAvatars.map((avatar) => (
                          <SelectItem
                            key={avatar.id}
                            value={avatar.id}
                          >
                            <span className="flex items-center gap-2">
                              <Star className="h-4 w-4 text-yellow-400" />
                              {avatar.avatarType} (Level {avatar.level})
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
                      className="hover:shadow-lg transition-shadow"
                    >
                      <CardHeader className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-t-lg">
                        <CardTitle className="flex items-center gap-3">
                          <UserCheck className="h-6 w-6" />
                          <div>
                            <h3 className="text-xl font-bold">{prof.name}</h3>
                            <p className="text-sm opacity-90">{prof.id}</p>
                          </div>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-6 space-y-4">
                        <div className="flex items-center gap-2">
                          <Award className="h-5 w-5 text-blue-500" />
                          <Badge
                            variant="secondary"
                            className="text-sm"
                          >
                            {prof.specialization}
                          </Badge>
                        </div>

                        <div className="space-y-2">
                          <p className="text-sm text-muted-foreground leading-relaxed">
                            {prof.description}
                          </p>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Mail className="h-4 w-4" />
                            <span>Contact via platform</span>
                          </div>
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Globe className="h-4 w-4" />
                            <span>Online consultations</span>
                          </div>
                        </div>

                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              className="w-full bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600"
                              disabled={!selectedAvatarForVisit}
                              onClick={() => handleProfessionalSelect(prof)}
                            >
                              <Calendar className="h-4 w-4 mr-2" />
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
                                                    </div>
                                                    <Button
                                                      size="sm"
                                                      onClick={() =>
                                                        initiateVisit(
                                                          slot.entityId,
                                                          Number(slot.start)
                                                        )
                                                      }
                                                      disabled={
                                                        !selectedAvatarForVisit
                                                      }
                                                      className="w-full sm:w-auto"
                                                    >
                                                      Book Slot
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
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === "facilities" && (
            <div className="mt-4 sm:mt-6">
              <div className="space-y-4 sm:space-y-6">
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
                        {userAvatars.map((avatar) => (
                          <SelectItem
                            key={avatar.id}
                            value={avatar.id}
                          >
                            <span className="flex items-center gap-2">
                              <Star className="h-4 w-4 text-yellow-400" />
                              {avatar.avatarType} (Level {avatar.level})
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
                      <CardHeader className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-t-lg">
                        <CardTitle className="flex items-center gap-3">
                          <Building className="h-6 w-6" />
                          <div>
                            <h3 className="text-xl font-bold">
                              {facility.name}
                            </h3>
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

                        <Button
                          className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600"
                          disabled={!selectedAvatarForVisit}
                          onClick={() => initiateVisit(facility.id)}
                        >
                          <Calendar className="h-4 w-4 mr-2" />
                          Book Visit
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === "visits" && (
            <div className="mt-4 sm:mt-6">
              <Card>
                <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between space-y-2 sm:space-y-0">
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-blue-500" />
                    My Visits
                  </CardTitle>
                  <Button
                    variant="outline"
                    onClick={fetchVisits}
                    disabled={isLoadingVisits}
                    className="w-full sm:w-auto"
                  >
                    {isLoadingVisits ? (
                      <Loader2Icon className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <RefreshCw className="h-4 w-4 mr-2" />
                    )}
                    Refresh
                  </Button>
                </CardHeader>
                <CardContent>
                  {isLoadingVisits ? (
                    <div className="flex justify-center py-8">
                      <Loader2Icon className="h-8 w-8 animate-spin" />
                    </div>
                  ) : visits.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p className="text-lg font-medium">No visits found</p>
                      <p className="text-sm">Click refresh to load visits</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {visits.map((visit) => (
                        <Card
                          key={visit.visitId}
                          className="hover:shadow-md transition-shadow"
                        >
                          <CardContent className="p-4">
                            {/* Visit Header */}
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 space-y-2 sm:space-y-0">
                              <div>
                                <h3 className="font-semibold text-lg">
                                  Visit #{Number(visit.visitId)}
                                </h3>
                                <p className="text-sm text-muted-foreground">
                                  {visit.professionalId
                                    ? `Professional ID: ${visit.professionalId}`
                                    : visit.facilityId
                                      ? `Facility ID: ${visit.facilityId}`
                                      : "Unspecified Location"}
                                </p>
                              </div>
                              <Badge
                                variant={getStatusVariant(visit.status)}
                                className="capitalize"
                              >
                                {Object.keys(visit.status)[0]}
                              </Badge>
                            </div>

                            {/* Visit Details Grid */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                              <div className="space-y-1">
                                <p className="text-muted-foreground">User ID</p>
                                <p className="font-medium break-all">
                                  {visit.userId}
                                </p>
                              </div>
                              <div className="space-y-1">
                                <p className="text-muted-foreground">
                                  Avatar ID
                                </p>
                                <p className="font-medium">
                                  #{Number(visit.avatarId)}
                                </p>
                              </div>
                              <div className="space-y-1">
                                <p className="text-muted-foreground">
                                  Visit Mode
                                </p>
                                <p className="font-medium">
                                  {Object.keys(visit.visitMode)[0]}
                                </p>
                              </div>
                              <div className="space-y-1">
                                <p className="text-muted-foreground">
                                  Current Status
                                </p>
                                <p className="font-medium">
                                  {Object.keys(visit.status)[0]}
                                </p>
                              </div>
                            </div>

                            {/* Timeline Section */}
                            <div className="mt-4">
                              <p className="font-semibold mb-2">Timeline</p>
                              <div className="space-y-3 pl-4 border-l-2 border-muted">
                                {visit.timestamp.slotTime && (
                                  <div className="relative">
                                    <div className="absolute -left-[17px] top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-blue-500"></div>
                                    <div className="space-y-1">
                                      <p className="text-sm text-muted-foreground">
                                        Scheduled For
                                      </p>
                                      <p className="text-sm font-medium">
                                        {new Date(
                                          Number(visit.timestamp.slotTime) /
                                            1_000_000
                                        ).toLocaleString()}
                                      </p>
                                    </div>
                                  </div>
                                )}
                                {visit.timestamp.bookingTime && (
                                  <div className="relative">
                                    <div className="absolute -left-[17px] top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-green-500"></div>
                                    <div className="space-y-1">
                                      <p className="text-sm text-muted-foreground">
                                        Booked On
                                      </p>
                                      <p className="text-sm font-medium">
                                        {new Date(
                                          Number(visit.timestamp.bookingTime) /
                                            1_000_000
                                        ).toLocaleString()}
                                      </p>
                                    </div>
                                  </div>
                                )}
                                {visit.timestamp.completionTime && (
                                  <div className="relative">
                                    <div className="absolute -left-[17px] top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-green-500"></div>
                                    <div className="space-y-1">
                                      <p className="text-sm text-muted-foreground">
                                        Completed On
                                      </p>
                                      <p className="text-sm font-medium">
                                        {new Date(
                                          Number(
                                            visit.timestamp.completionTime
                                          ) / 1_000_000
                                        ).toLocaleString()}
                                      </p>
                                    </div>
                                  </div>
                                )}
                                {visit.timestamp.cancellationTime && (
                                  <div className="relative">
                                    <div className="absolute -left-[17px] top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-red-500"></div>
                                    <div className="space-y-1">
                                      <p className="text-sm text-muted-foreground">
                                        Cancelled On
                                      </p>
                                      <p className="text-sm font-medium">
                                        {new Date(
                                          Number(
                                            visit.timestamp.cancellationTime
                                          ) / 1_000_000
                                        ).toLocaleString()}
                                      </p>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Meeting Link Section */}
                            {visit.meetingLink && (
                              <div className="mt-4">
                                <p className="text-sm text-muted-foreground mb-1">
                                  Meeting Link
                                </p>
                                <a
                                  href={visit.meetingLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-500 hover:underline break-all inline-flex items-center gap-2"
                                >
                                  {visit.meetingLink}
                                  <Globe className="h-4 w-4 flex-shrink-0" />
                                </a>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>

      <Dialog
        open={isAvatarStatusOpen}
        onOpenChange={setIsAvatarStatusOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Avatar Status</DialogTitle>
          </DialogHeader>
          {selectedAvatar && (
            <>
              <AvatarStatus
                avatar={selectedAvatar}
                onLevelUp={levelUp}
                onRestoreHP={restoreHP}
                userTokens={userTokens}
              />
              {selectedAvatar.hp <= 20 && (
                <div className="mt-4 p-4 bg-yellow-900 text-yellow-200 rounded-md flex items-center">
                  <AlertCircle className="mr-2" />
                  <p>
                    Warning: Your HP is low! Consider restoring it to maintain
                    optimal performance.
                  </p>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Gamification;
