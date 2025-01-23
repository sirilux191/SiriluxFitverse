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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import { Badge } from "@/components/ui/badge";
import AvatarStatus from "./GamificationComponents/AvatarStatus";
import NFTCard from "./GamificationComponents/NFTCard";
import { INITIAL_HP } from "./GamificationComponents/constants";
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
import { ArrowPathIcon } from "@heroicons/react/24/outline";

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

  useEffect(() => {
    fetchUserAvatars();
    fetchProfessionals();
    fetchFacilities();
    fetchUserTokens();
  }, [actors]);

  const fetchUserAvatars = async () => {
    try {
      const avatars = await actors.gamificationSystem.getUserAvatarsSelf();

      if (!avatars.ok) {
        console.error("Error fetching user avatars:", avatars.err);
        return;
      }

      const formattedAvatars = await Promise.all(
        avatars.ok.map(async ([tokenId, metadata]) => {
          console.log("metadata", metadata);
          console.log("metadata[0]", metadata[0]);

          if (!Array.isArray(metadata[0]) || metadata[0].length < 4) {
            console.error("Invalid metadata structure:", metadata[0]);
            return null;
          }

          const [nameArray, descriptionArray, imageArray, attributesArray] =
            metadata[0];
          console.log("nameArray", nameArray);
          console.log("descriptionArray", descriptionArray);
          console.log("imageArray", imageArray);
          console.log("attributesArray", attributesArray);

          const getName = (arr) =>
            arr && arr[1] && arr[1].Text ? arr[1].Text : "Unknown";
          const getDescription = (arr) =>
            arr && arr[1] && arr[1].Text ? arr[1].Text : "No description";
          const getImage = (arr) =>
            arr && arr[1] && arr[1].Text ? arr[1].Text : "";
          const getAttributes = (arr) => {
            if (!arr || !arr[1] || !arr[1].Map) {
              console.error("Invalid attributes array:", arr);
              return {};
            }
            const attributesMap = arr[1].Map;
            return attributesMap.reduce((acc, [key, value]) => {
              if (value && value.Nat) {
                acc[key] = Number(value.Nat);
              } else if (value && value.Text) {
                acc[key] = value.Text;
              }
              return acc;
            }, {});
          };

          const name = getName(nameArray);
          const description = getDescription(descriptionArray);
          const image = getImage(imageArray);
          const attributes = getAttributes(attributesArray);
          console.log("attributes", attributes);

          // Fetch additional details
          const avatarAttributes =
            await actors.gamificationSystem.getAvatarAttributes(tokenId);
          console.log("avatarAttributes", avatarAttributes);
          const visitCount =
            //   await actors.visitManager.getAvatarVisitCount(tokenId);
            // console.log("visitCount", visitCount);

            console.log({
              id: Number(tokenId),
              name,
              description,
              image,
              type: attributes.avatarType,
              quality: attributes.quality,
              level: attributes.level,
              energy: attributes.energy,
              focus: attributes.focus,
              vitality: attributes.vitality,
              resilience: attributes.resilience,
              hp: avatarAttributes.ok ? avatarAttributes.ok[1] : INITIAL_HP, // Use the HP from getAvatarAttributes

              visitCount: 0, //Number(visitCount),
            });
          return {
            id: Number(tokenId),
            name,
            description,
            image,
            type: attributes.avatarType,
            quality: attributes.quality,
            level: attributes.level,
            energy: attributes.energy,
            focus: attributes.focus,
            vitality: attributes.vitality,
            resilience: attributes.resilience,
            hp: avatarAttributes.ok
              ? Number(avatarAttributes.ok[1])
              : INITIAL_HP, // Use the HP from getAvatarAttributes
            visitCount: 0,
          };
        })
      );

      // Filter out any null values that might have been created due to invalid data
      const validAvatars = formattedAvatars.filter((avatar) => avatar !== null);
      setUserAvatars(validAvatars);
    } catch (error) {
      console.error("Error fetching user avatars:", error);
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
                  hp: INITIAL_HP + avatar.level * 10,
                }
              : avatar
          )
        );
        setSelectedAvatar((prevAvatar) => ({
          ...prevAvatar,
          ...updatedAttributes,
          level: prevAvatar.level + 1,
          tokens: prevAvatar.tokens - prevAvatar.level * 100,
          hp: INITIAL_HP + prevAvatar.level * 10,
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
                hp: Math.min(
                  avatar.hp + amount,
                  INITIAL_HP + (avatar.level - 1) * 10
                ),
                tokens: avatar.tokens - amount,
              }
            : avatar
        )
      );
      setSelectedAvatar((prevAvatar) => ({
        ...prevAvatar,
        hp: Math.min(
          prevAvatar.hp + amount,
          INITIAL_HP + (prevAvatar.level - 1) * 10
        ),
        tokens: prevAvatar.tokens - amount,
      }));
    } catch (error) {
      console.error("Error restoring HP:", error);
    }
  };

  const manageAvatar = (avatar) => {
    console.log("avatar", avatar);
    setSelectedAvatar(avatar);
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
    <div className="flex items-center space-x-2 mb-4">
      <div className="bg-gradient-to-r from-blue-400 to-blue-200 text-black font-bold py-2 px-4 rounded-full flex items-center">
        <Coins className="mr-2" />
        <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-blue-800">
          {userTokens}
          <span className="text-lg font-semibold"> Tokens</span>
        </span>
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
    <div className="max-w-4xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
      <h1 className="text-4xl font-bold text-foreground mb-6">
        Wellness Avatar Platform
      </h1>

      <span className="flex justify-end">
        {userTokens !== null && <TokenDisplay />}
      </span>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="lg:col-span-2">
          <Tabs
            defaultValue="avatars"
            className="mb-6"
          >
            <TabsList className="flex justify-center bg-gray-800 text-white rounded-lg">
              <TabsTrigger
                value="avatars"
                className="w-1/4 flex items-center justify-center gap-2 text-white"
              >
                <User size={18} /> Avatars
              </TabsTrigger>
              <TabsTrigger
                value="professionals"
                className="w-1/4 flex items-center justify-center gap-2 text-white"
              >
                <Briefcase size={18} /> Professionals
              </TabsTrigger>
              <TabsTrigger
                value="facilities"
                className="w-1/4 flex items-center justify-center gap-2 text-white"
              >
                <Building size={18} /> Facilities
              </TabsTrigger>
              <TabsTrigger
                value="visits"
                className="w-1/4 flex items-center justify-center gap-2 text-white"
              >
                <Calendar size={18} /> My Visits
              </TabsTrigger>
            </TabsList>
            <TabsContent value="avatars">
              <h2 className="text-2xl font-semibold mb-4 text-blue-400">
                User Avatars
              </h2>
              {userAvatars.length === 0 ? (
                <p className="text-gray-400">
                  No Avatars. Visit Professionals and Facilities to find
                  Avatars.
                </p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {userAvatars.map((avatar) => (
                    <NFTCard
                      key={avatar.id}
                      nft={avatar}
                      showManage={true}
                      onManage={() => {
                        setSelectedAvatar(avatar);
                        setIsAvatarStatusOpen(true);
                      }}
                      onTransfer={transferAvatar}
                    />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="professionals">
              <div className="space-y-6">
                <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="h-5 w-5 text-blue-500" />
                      Select Avatar for Visit
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
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
                              {avatar.name} (Level {avatar.level})
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </CardContent>
                </Card>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                          <DialogContent className="max-w-2xl">
                            <DialogHeader>
                              <DialogTitle className="text-xl font-bold">
                                Available Slots
                              </DialogTitle>
                              <DialogDescription>
                                Select a time slot to book your visit
                              </DialogDescription>
                            </DialogHeader>

                            <ScrollArea className="h-[500px] w-full p-4">
                              {availableSlots.length > 0 ? (
                                <div className="space-y-6">
                                  {Object.entries(
                                    groupSlotsByDate(availableSlots)
                                  ).map(([date, dateSlots]) => (
                                    <div
                                      key={date}
                                      className="space-y-3"
                                    >
                                      <h3 className="text-lg font-semibold sticky top-0 bg-background py-2 border-b">
                                        {date}
                                      </h3>
                                      <div className="grid grid-cols-2 gap-3">
                                        {dateSlots.map((slot, index) => {
                                          const { time } = formatDateTime(
                                            slot.start
                                          );
                                          return (
                                            <Card
                                              key={index}
                                              className="hover:bg-accent transition-colors"
                                            >
                                              <CardContent className="p-4">
                                                <div className="flex items-center justify-between">
                                                  <div className="space-y-1">
                                                    <p className="text-sm font-medium flex items-center gap-2">
                                                      <Clock className="h-4 w-4" />
                                                      {time}
                                                    </p>
                                                    <p className="text-xs text-muted-foreground">
                                                      Duration: 30 minutes
                                                    </p>
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
                                                  >
                                                    Book
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
                                <div className="flex flex-col items-center justify-center h-[400px] text-muted-foreground">
                                  <Calendar className="h-12 w-12 mb-4 opacity-50" />
                                  <p className="text-lg font-medium">
                                    No available slots
                                  </p>
                                  <p className="text-sm">
                                    Try selecting a different professional or
                                    check back later
                                  </p>
                                </div>
                              )}
                            </ScrollArea>
                          </DialogContent>
                        </Dialog>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="facilities">
              <div className="space-y-6">
                <Card className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950 dark:to-teal-950">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="h-5 w-5 text-emerald-500" />
                      Select Avatar for Visit
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
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
                              {avatar.name} (Level {avatar.level})
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </CardContent>
                </Card>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
            </TabsContent>

            <TabsContent value="visits">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-blue-500" />
                    My Visits
                  </CardTitle>
                  <Button
                    variant="outline"
                    onClick={fetchVisits}
                    disabled={isLoadingVisits}
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
                      <p>No visits found. Click refresh to load visits.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {visits.map(
                        (visit) => (
                          console.log(visit),
                          (
                            <Card
                              key={visit.visitId}
                              className="hover:shadow-md transition-shadow"
                            >
                              <CardContent className="p-4">
                                <div className="flex justify-between items-start mb-4">
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
                                </div>

                                <div className="grid grid-cols-2 gap-4 text-sm">
                                  <div>
                                    <p className="text-muted-foreground">
                                      User ID
                                    </p>
                                    <p className="font-medium">
                                      {visit.userId}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-muted-foreground">
                                      Avatar ID
                                    </p>
                                    <p className="font-medium">
                                      #{Number(visit.avatarId)}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-muted-foreground">
                                      Visit Mode
                                    </p>
                                    <p className="font-medium">
                                      {Object.keys(visit.visitMode)[0]}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-muted-foreground">
                                      Current Status
                                    </p>
                                    <p className="font-medium">
                                      {Object.keys(visit.status)[0]}
                                    </p>
                                  </div>

                                  <div className="col-span-2 mt-2">
                                    <p className="font-semibold mb-2">
                                      Timeline
                                    </p>
                                    <div className="space-y-2 pl-4 border-l-2 border-muted">
                                      {visit.timestamp.slotTime && (
                                        <div>
                                          <p className="text-muted-foreground">
                                            Scheduled For
                                          </p>
                                          <p className="font-medium">
                                            {new Date(
                                              Number(visit.timestamp.slotTime) /
                                                1_000_000
                                            ).toLocaleString()}
                                          </p>
                                        </div>
                                      )}
                                      {visit.timestamp.bookingTime && (
                                        <div>
                                          <p className="text-muted-foreground">
                                            Booked On
                                          </p>
                                          <p className="font-medium">
                                            {new Date(
                                              Number(
                                                visit.timestamp.bookingTime
                                              ) / 1_000_000
                                            ).toLocaleString()}
                                          </p>
                                        </div>
                                      )}
                                      {visit.timestamp.completionTime && (
                                        <div>
                                          <p className="text-muted-foreground">
                                            Completed On
                                          </p>
                                          <p className="font-medium">
                                            {new Date(
                                              Number(
                                                visit.timestamp.completionTime
                                              ) / 1_000_000
                                            ).toLocaleString()}
                                          </p>
                                        </div>
                                      )}
                                      {visit.timestamp.cancellationTime && (
                                        <div>
                                          <p className="text-muted-foreground">
                                            Cancelled On
                                          </p>
                                          <p className="font-medium">
                                            {new Date(
                                              Number(
                                                visit.timestamp.cancellationTime
                                              ) / 1_000_000
                                            ).toLocaleString()}
                                          </p>
                                        </div>
                                      )}
                                      {visit.timestamp.rejectionTime && (
                                        <div>
                                          <p className="text-muted-foreground">
                                            Rejected On
                                          </p>
                                          <p className="font-medium">
                                            {new Date(
                                              Number(
                                                visit.timestamp.rejectionTime
                                              ) / 1_000_000
                                            ).toLocaleString()}
                                          </p>
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  {visit.meetingLink && (
                                    <div className="col-span-2 mt-2">
                                      <p className="text-muted-foreground mb-1">
                                        Meeting Link
                                      </p>
                                      <a
                                        href={visit.meetingLink}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-blue-500 hover:underline break-all inline-flex items-center gap-2"
                                      >
                                        {visit.meetingLink}
                                        <Globe className="h-4 w-4" />
                                      </a>
                                    </div>
                                  )}
                                </div>
                              </CardContent>
                            </Card>
                          )
                        )
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
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
