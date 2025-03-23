import React, { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/use-toast";
import useActorStore from "../../State/Actors/ActorStore";
import {
  PlusIcon,
  TrashIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/outline";
import TimeSlotPicker from "@/components/TimeSlotPicker";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Loader2Icon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import useNFTStore from "../../State/CryptoAssets/NFTStore";
import useWalletStore from "../../State/CryptoAssets/WalletStore";
import { Principal } from "@dfinity/principal";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const GamificationTab = () => {
  const { gamificationSystem, identityManager } = useActorStore();
  const { nfts, loading: nftsLoading, fetchNFTs } = useNFTStore();
  const [professionalInfo, setProfessionalInfo] = useState({
    id: "",
    name: "",
    specialization: "",
    description: "",
  });

  const [availableSlots, setAvailableSlots] = useState([]);
  const [multipleSlots, setMultipleSlots] = useState([
    { date: null, time: "", start: "", capacity: "1", price: "0" },
  ]);
  const [selectedSlots, setSelectedSlots] = useState([]);
  const [slotRange, setSlotRange] = useState({
    startDate: null,
    endDate: null,
    startTime: "",
    endTime: "",
    capacity: "1",
    price: "0",
  });
  const [currentPage, setCurrentPage] = useState(1);
  const DATES_PER_PAGE = 5;
  const [visits, setVisits] = useState([]);
  const [bookedSlots, setBookedSlots] = useState([]);
  const [isLoadingVisits, setIsLoadingVisits] = useState(false);
  const [isLoadingBookedSlots, setIsLoadingBookedSlots] = useState(false);
  const [selectedAvatarId, setSelectedAvatarId] = useState(null);
  const [confirmationDialog, setConfirmationDialog] = useState({
    isOpen: false,
    type: null, // 'complete' or 'reject'
    visit: null,
  });

  useEffect(() => {
    fetchProfessionalInfo();
    fetchAvailableSlots();
  }, []);

  const fetchProfessionalInfo = async () => {
    try {
      const identityResult = await identityManager.getIdentity([]);
      if (!identityResult.ok) {
        throw new Error("Failed to get identity");
      }

      const professionalId = identityResult.ok[0];
      const result = await gamificationSystem.getProfessionalInfoSelf();

      console.log("Service Info Result:", result);

      if (result.ok) {
        setProfessionalInfo({
          id: professionalId,
          name: result.ok.name || "",
          specialization: result.ok.specialization || "",
          description: result.ok.description || "",
        });
      } else {
        toast({
          title: "Error",
          description: "Failed to fetch professional information",
          variant: "destructive",
        });
        setProfessionalInfo({
          id: professionalId,
          name: "",
          specialization: "",
          description: "",
        });
      }
    } catch (error) {
      console.error("Error fetching professional info:", error);
      toast({
        title: "Error",
        description: "Failed to fetch professional information",
        variant: "destructive",
      });
    }
  };

  const fetchAvailableSlots = async () => {
    try {
      const result = await gamificationSystem.getAvailableSlotsSelf();
      console.log("Available Slots Result:", result);
      if (result.ok) {
        setAvailableSlots(result.ok);
      } else {
        throw new Error(result.err);
      }
    } catch (error) {
      console.error("Error fetching available slots:", error);
      toast({
        title: "Error",
        description: "Failed to fetch available slots",
        variant: "destructive",
      });
    }
  };

  const handleUpdateInfo = async (e) => {
    e.preventDefault();
    try {
      const identityResult = await identityManager.getIdentity([]);
      if (!identityResult.ok) {
        throw new Error("Failed to get identity");
      }

      const professionalId = identityResult.ok[0];

      const updateData = {
        id: professionalId,
        name: professionalInfo.name,
        specialization: professionalInfo.specialization,
        description: professionalInfo.description,
      };

      console.log("Updating with data:", updateData);

      const result =
        await gamificationSystem.updateProfessionalInfo(updateData);

      if (result.ok) {
        toast({
          title: "Success",
          description: "Professional information updated successfully",
        });
        await fetchProfessionalInfo();
      } else {
        throw new Error(result.err);
      }
    } catch (error) {
      console.error("Error updating professional info:", error);
      toast({
        title: "Error",
        description: "Failed to update professional information",
        variant: "destructive",
      });
    }
  };

  const generateSlotsFromRange = () => {
    const slots = [];
    const currentDate = new Date(slotRange.startDate);
    const endDate = new Date(slotRange.endDate);

    // Validate inputs
    if (
      !currentDate ||
      !endDate ||
      !slotRange.startTime ||
      !slotRange.endTime
    ) {
      throw new Error("Please fill in all date and time fields");
    }

    while (currentDate <= endDate) {
      const [startHour, startMinute] = slotRange.startTime.split(":");
      const [endHour, endMinute] = slotRange.endTime.split(":");

      let currentTime = new Date(currentDate);
      currentTime.setHours(parseInt(startHour, 10), parseInt(startMinute));

      const endTime = new Date(currentDate);
      endTime.setHours(parseInt(endHour), parseInt(endMinute));

      while (currentTime < endTime) {
        slots.push({
          entityId: professionalInfo.id || "",
          start: BigInt(currentTime.getTime() * 1000000),
          capacity: parseInt(slotRange.capacity, 10),
          price: parseInt(slotRange.price, 10) || 0,
        });
        currentTime = new Date(currentTime.getTime() + 30 * 60000); // Add 30 minutes
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return slots;
  };

  const handleAddMultipleSlots = async (e) => {
    e.preventDefault();
    try {
      const slots = generateSlotsFromRange();
      console.log("Adding slots:", slots);
      const result =
        await gamificationSystem.addMultipleAvailabilitySlots(slots);
      if (result.ok) {
        toast({
          title: "Success",
          description: "Multiple availability slots added successfully",
        });
        fetchAvailableSlots();
        setSlotRange({
          startDate: null,
          endDate: null,
          startTime: "",
          endTime: "",
          capacity: "1",
          price: "0",
        });
      } else {
        throw new Error(result.err);
      }
    } catch (error) {
      console.error("Error adding slots:", error);
      toast({
        title: "Error",
        description: "Failed to add availability slots: " + error.message,
        variant: "destructive",
      });
    }
  };

  const handleSlotChange = (index, field, value) => {
    setMultipleSlots((prevSlots) => {
      const newSlots = [...prevSlots];
      const slot = { ...newSlots[index] };

      switch (field) {
        case "date":
          slot.date = value;
          // Update start if we have both date and time
          if (slot.time) {
            const dateObj = new Date(value);
            const [hours, minutes] = slot.time.split(":");
            dateObj.setHours(parseInt(hours, 10), parseInt(minutes, 10));
            slot.start = dateObj.toISOString();
          }
          break;

        case "time":
          slot.time = value;
          // Update start if we have both date and time
          if (slot.date) {
            const dateObj = new Date(slot.date);
            const [hours, minutes] = value.split(":");
            dateObj.setHours(parseInt(hours, 10), parseInt(minutes, 10));
            slot.start = dateObj.toISOString();
          }
          break;

        default:
          slot[field] = value;
      }

      newSlots[index] = slot;
      return newSlots;
    });
  };

  const addSlotField = () => {
    setMultipleSlots([
      ...multipleSlots,
      { date: null, time: "", start: "", capacity: "1", price: "0" },
    ]);
  };

  const removeSlotField = (index) => {
    if (multipleSlots.length > 1) {
      const newSlots = multipleSlots.filter((_, i) => i !== index);
      setMultipleSlots(newSlots);
    }
  };

  const handleRemoveMultipleSlots = async () => {
    try {
      if (selectedSlots.length === 0) {
        toast({
          title: "Error",
          description: "No slots selected for removal",
          variant: "destructive",
        });
        return;
      }

      // Convert BigInt to number for backend
      const slotTimesAsNumbers = selectedSlots.map((slot) => Number(slot));

      const result = await gamificationSystem.removeMultipleAvailabilitySlots(
        professionalInfo.id,
        slotTimesAsNumbers
      );

      if (result.ok) {
        toast({
          title: "Success",
          description: "Selected slots removed successfully",
        });
        setSelectedSlots([]);
        fetchAvailableSlots();
      } else {
        throw new Error(result.err);
      }
    } catch (error) {
      console.error("Error removing slots:", error);
      toast({
        title: "Error",
        description: "Failed to remove selected slots: " + error.message,
        variant: "destructive",
      });
    }
  };

  const groupSlotsByDate = (slots) => {
    const groups = {};
    slots.forEach((slot) => {
      const date = new Date(Number(slot.start) / 1000000);
      const dateKey = date.toISOString().split("T")[0];
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(slot);
    });
    return groups;
  };

  const formatTimeRange = (slots) => {
    if (slots.length === 0) return "";
    if (slots.length === 1) {
      const time = new Date(Number(slots[0].start) / 1000000);
      return time.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    }

    // Check if slots are continuous
    const times = slots.map((slot) => new Date(Number(slot.start) / 1000000));
    times.sort((a, b) => a - b);

    const isContiguous = times.every((time, i) => {
      if (i === 0) return true;
      const diff = time.getTime() - times[i - 1].getTime();
      return diff === 30 * 60 * 1000; // 30 minutes in milliseconds
    });

    if (isContiguous) {
      return `${times[0].toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} - ${times[times.length - 1].toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
    } else {
      return times
        .map((time) =>
          time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        )
        .join(", ");
    }
  };

  const paginateSlots = (groupedSlots) => {
    const sortedDates = Object.entries(groupedSlots).sort(([dateA], [dateB]) =>
      dateA.localeCompare(dateB)
    );

    const totalPages = Math.ceil(sortedDates.length / DATES_PER_PAGE);
    const startIndex = (currentPage - 1) * DATES_PER_PAGE;
    const paginatedDates = sortedDates.slice(
      startIndex,
      startIndex + DATES_PER_PAGE
    );

    return {
      paginatedDates,
      totalPages,
      totalDates: sortedDates.length,
    };
  };

  const handleAddIndividualSlots = async (e) => {
    e.preventDefault();
    try {
      const formattedSlots = multipleSlots
        .filter((slot) => slot.date && slot.time) // Only include complete slots
        .map((slot) => {
          const dateTime = new Date(slot.date);
          const [hours, minutes] = slot.time.split(":");
          dateTime.setHours(parseInt(hours, 10), parseInt(minutes, 10));

          return {
            entityId: professionalInfo.id || "",
            start: BigInt(dateTime.getTime() * 1000000),
            capacity: parseInt(slot.capacity, 10) || 1,
            price: parseInt(slot.price, 10) || 0,
          };
        });

      if (formattedSlots.length === 0) {
        toast({
          title: "Error",
          description: "Please add at least one complete slot",
          variant: "destructive",
        });
        return;
      }

      console.log("Adding individual slots:", formattedSlots);
      const result =
        await gamificationSystem.addMultipleAvailabilitySlots(formattedSlots);
      if (result.ok) {
        toast({
          title: "Success",
          description: "Multiple availability slots added successfully",
        });
        fetchAvailableSlots();
        setMultipleSlots([
          { date: null, time: "", start: "", capacity: "1", price: "0" },
        ]);
      } else {
        throw new Error(result.err);
      }
    } catch (error) {
      console.error("Error adding slots:", error);
      toast({
        title: "Error",
        description: "Failed to add availability slots: " + error.message,
        variant: "destructive",
      });
    }
  };

  const fetchVisits = async () => {
    setIsLoadingVisits(true);
    try {
      const result = await gamificationSystem.getEntityVisits();
      if (result.ok) {
        setVisits(result.ok);
      } else {
        toast({
          title: "Error",
          description: result.err,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error fetching visits:", error);
      toast({
        title: "Error",
        description: "Failed to fetch visits",
        variant: "destructive",
      });
    } finally {
      setIsLoadingVisits(false);
    }
  };

  const fetchBookedSlots = async () => {
    setIsLoadingBookedSlots(true);
    try {
      const result = await gamificationSystem.getBookedSlotsSelf();
      if (result.ok) {
        console.log(result.ok);
        setBookedSlots(result.ok);
      } else {
        toast({
          title: "Error",
          description: result.err,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error fetching booked slots:", error);
      toast({
        title: "Error",
        description: "Failed to fetch booked slots",
        variant: "destructive",
      });
    } finally {
      setIsLoadingBookedSlots(false);
    }
  };

  const getStatusVariant = (status) => {
    // status will be like { Completed: null } or { Pending: null }
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

  const handleCompleteVisit = async (visitId) => {
    if (!selectedAvatarId) {
      toast({
        title: "Error",
        description: "Please select an avatar to complete the visit",
        variant: "destructive",
      });
      return;
    }

    try {
      const visitResult = await gamificationSystem.getVisitById(visitId);
      if (visitResult.err) {
        throw new Error(visitResult.err);
      }

      // Instead of window.confirm, show the modal
      setConfirmationDialog({
        isOpen: true,
        type: "complete",
        visit: visitResult.ok,
      });
    } catch (error) {
      console.error("Error fetching visit:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to fetch visit details",
        variant: "destructive",
      });
    }
  };

  const handleRejectVisit = async (visitId) => {
    try {
      const visitResult = await gamificationSystem.getVisitById(visitId);
      if (visitResult.err) {
        throw new Error(visitResult.err);
      }

      // Instead of window.confirm, show the modal
      setConfirmationDialog({
        isOpen: true,
        type: "reject",
        visit: visitResult.ok,
      });
    } catch (error) {
      console.error("Error fetching visit:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to fetch visit details",
        variant: "destructive",
      });
    }
  };

  const handleConfirmAction = async () => {
    const { type, visit } = confirmationDialog;

    try {
      if (type === "complete") {
        const result = await gamificationSystem.processVisitCompletion(
          visit.visitId,
          selectedAvatarId
        );
        if (result.ok) {
          toast({
            description: "Visit completed successfully",
          });
          fetchVisits();
          fetchBookedSlots();
          setSelectedAvatarId(null);
        } else {
          throw new Error(result.err);
        }
      } else if (type === "reject") {
        const walletStore = useWalletStore.getState();
        await walletStore.approveSpender({
          spender: {
            owner: Principal.fromText(
              process.env.CANISTER_ID_GAMIFICATIONSYSTEM
            ),
            subaccount: [],
          },
          amount: Number(visit.payment),
          memo: `Reject visit ${visit.visitId}`,
        });

        const result = await gamificationSystem.rejectVisitAndRestoreHP(
          visit.visitId
        );
        if (result.ok) {
          toast({
            title: "Success",
            description: "Visit rejected successfully",
          });
          fetchVisits();
          fetchBookedSlots();
        } else {
          throw new Error(result.err);
        }
      }
    } catch (error) {
      console.error("Error processing visit:", error);
      toast({
        title: "Error",
        description: error.message || `Failed to ${type} visit`,
        variant: "destructive",
      });
    } finally {
      setConfirmationDialog({ isOpen: false, type: null, visit: null });
    }
  };

  const handleRefreshNFTs = async () => {
    console.log("Current NFTs:", nfts);
    await fetchNFTs();
    console.log("Refreshed NFTs:", nfts);
  };

  // Add this confirmation dialog component before the return statement
  const ConfirmationDialog = () => {
    const { isOpen, type, visit } = confirmationDialog;
    if (!visit) return null;

    const visitDate = new Date(Number(visit.timestamp.slotTime) / 1000000);
    const selectedAvatar = nfts.find((a) => a.id === selectedAvatarId);

    return (
      <Dialog
        open={isOpen}
        onOpenChange={(open) =>
          setConfirmationDialog((prev) => ({ ...prev, isOpen: open }))
        }
      >
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="text-xl">
              {type === "complete" ? "Complete Visit" : "Reject Visit"}
            </DialogTitle>
            <DialogDescription className="pt-4">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-muted-foreground">Visit ID</p>
                    <p className="font-medium">#{Number(visit.visitId)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Patient ID</p>
                    <p className="font-medium">{visit.userId}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-muted-foreground">Date & Time</p>
                    <p className="font-medium">
                      {visitDate.toLocaleDateString(undefined, {
                        weekday: "long",
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}{" "}
                      at{" "}
                      {visitDate.toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                  {type === "complete" && selectedAvatar && (
                    <div className="col-span-2">
                      <p className="text-muted-foreground">Selected Avatar</p>
                      <div className="flex items-center gap-2 mt-1">
                        {selectedAvatar.image && (
                          <img
                            src={selectedAvatar.image}
                            alt={selectedAvatar.name}
                            className="w-8 h-8 rounded"
                          />
                        )}
                        <p className="font-medium">{selectedAvatar.name}</p>
                      </div>
                    </div>
                  )}
                  {type === "reject" && (
                    <div className="col-span-2">
                      <p className="text-muted-foreground">Refund Amount</p>
                      <p className="font-medium">
                        {Number(visit.payment)} tokens
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2 mt-6">
            <Button
              variant="outline"
              onClick={() =>
                setConfirmationDialog({
                  isOpen: false,
                  type: null,
                  visit: null,
                })
              }
            >
              Cancel
            </Button>
            <Button
              variant={type === "reject" ? "destructive" : "default"}
              onClick={handleConfirmAction}
            >
              {type === "complete" ? "Complete Visit" : "Reject Visit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  };

  return (
    <div className="container mx-auto py-6">
      <ConfirmationDialog />
      <Tabs defaultValue="information">
        <TabsList className="w-full">
          <TabsTrigger
            value="information"
            className="w-1/2"
          >
            Your Information
          </TabsTrigger>
          <TabsTrigger
            value="visits"
            className="w-1/2"
          >
            Visits
          </TabsTrigger>
        </TabsList>

        <TabsContent value="information">
          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Professional Information</CardTitle>
              </CardHeader>
              <CardContent>
                <form
                  onSubmit={handleUpdateInfo}
                  className="space-y-4"
                >
                  <div>
                    <Label htmlFor="id">Professional ID</Label>
                    <Input
                      id="id"
                      value={professionalInfo.id}
                      disabled
                      className="bg-muted cursor-not-allowed"
                    />
                  </div>
                  <div>
                    <Label htmlFor="name">Name</Label>
                    <Input
                      id="name"
                      value={professionalInfo.name}
                      onChange={(e) =>
                        setProfessionalInfo((prev) => ({
                          ...prev,
                          name: e.target.value,
                        }))
                      }
                      placeholder="Enter your full name"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="specialization">Specialization</Label>
                    <Input
                      id="specialization"
                      value={professionalInfo.specialization}
                      onChange={(e) =>
                        setProfessionalInfo((prev) => ({
                          ...prev,
                          specialization: e.target.value,
                        }))
                      }
                      placeholder="Enter your medical specialization"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="description">Description</Label>
                    <Input
                      id="description"
                      value={professionalInfo.description}
                      onChange={(e) =>
                        setProfessionalInfo((prev) => ({
                          ...prev,
                          description: e.target.value,
                        }))
                      }
                      placeholder="Enter a brief description of your practice"
                      required
                    />
                  </div>
                  <Button type="submit">Update Information</Button>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Add Availability Slots</CardTitle>
              </CardHeader>
              <CardContent>
                <Tabs
                  defaultValue="range"
                  className="space-y-4"
                >
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="range">Date Range</TabsTrigger>
                    <TabsTrigger value="multiple">Multiple Slots</TabsTrigger>
                  </TabsList>

                  <TabsContent value="range">
                    <form
                      onSubmit={handleAddMultipleSlots}
                      className="space-y-4"
                    >
                      <div className="space-y-4">
                        <TimeSlotPicker
                          mode="range"
                          startDate={slotRange.startDate}
                          endDate={slotRange.endDate}
                          onDateRangeChange={(range) =>
                            setSlotRange((prev) => ({
                              ...prev,
                              startDate: range?.from || null,
                              endDate: range?.to || null,
                            }))
                          }
                          startTime={slotRange.startTime}
                          endTime={slotRange.endTime}
                          onTimeRangeChange={({ start, end }) =>
                            setSlotRange((prev) => ({
                              ...prev,
                              startTime: start,
                              endTime: end,
                            }))
                          }
                        />
                        <div className="flex gap-4">
                          <div>
                            <Label>Capacity per slot</Label>
                            <Input
                              type="number"
                              min="1"
                              value={slotRange.capacity}
                              onChange={(e) =>
                                setSlotRange((prev) => ({
                                  ...prev,
                                  capacity: e.target.value,
                                }))
                              }
                              className="w-24"
                            />
                          </div>
                          <div>
                            <Label>Price (tokens)</Label>
                            <Input
                              type="number"
                              min="0"
                              value={slotRange.price}
                              onChange={(e) =>
                                setSlotRange((prev) => ({
                                  ...prev,
                                  price: e.target.value,
                                }))
                              }
                              className="w-24"
                            />
                          </div>
                        </div>
                      </div>
                      <Button
                        type="submit"
                        className="w-full"
                      >
                        Add Range Slots
                      </Button>
                    </form>
                  </TabsContent>

                  <TabsContent value="multiple">
                    <form
                      onSubmit={handleAddIndividualSlots}
                      className="space-y-4"
                    >
                      {multipleSlots.map((slot, index) => (
                        <div
                          key={index}
                          className="flex gap-4 items-start border p-4 rounded-lg"
                        >
                          <div className="space-y-2 flex-1">
                            <Label>Date and Time</Label>
                            <TimeSlotPicker
                              mode="single"
                              selectedDate={
                                slot.date ? new Date(slot.date) : null
                              }
                              onDateChange={(date) => {
                                if (date) {
                                  handleSlotChange(
                                    index,
                                    "date",
                                    date.toISOString().split("T")[0]
                                  );
                                }
                              }}
                              selectedTime={slot.time}
                              onTimeChange={(time) =>
                                handleSlotChange(index, "time", time)
                              }
                            />
                            {/* Debug info - remove in production */}
                            <div className="text-xs text-muted-foreground">
                              Selected: {slot.date} {slot.time}
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor={`capacity-${index}`}>
                              Capacity
                            </Label>
                            <Input
                              id={`capacity-${index}`}
                              type="number"
                              min="1"
                              value={slot.capacity}
                              onChange={(e) =>
                                handleSlotChange(
                                  index,
                                  "capacity",
                                  e.target.value
                                )
                              }
                              className="w-24"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor={`price-${index}`}>Price</Label>
                            <Input
                              id={`price-${index}`}
                              type="number"
                              min="0"
                              value={slot.price || "0"}
                              onChange={(e) =>
                                handleSlotChange(index, "price", e.target.value)
                              }
                              className="w-24"
                            />
                          </div>
                          {multipleSlots.length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="mt-8"
                              onClick={() => removeSlotField(index)}
                            >
                              <TrashIcon className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      ))}

                      <div className="flex gap-4">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={addSlotField}
                          className="flex items-center gap-2"
                        >
                          <PlusIcon className="h-4 w-4" />
                          Add Another Slot
                        </Button>
                        <Button
                          type="submit"
                          className="flex-1"
                          disabled={
                            !multipleSlots.some(
                              (slot) => slot.date && slot.time
                            )
                          }
                        >
                          Save All Slots
                        </Button>
                      </div>
                    </form>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle>Available Slots</CardTitle>
                {selectedSlots.length > 0 && (
                  <Button
                    variant="destructive"
                    onClick={handleRemoveMultipleSlots}
                    className="flex items-center gap-2"
                  >
                    <TrashIcon className="h-4 w-4" />
                    Remove Selected ({selectedSlots.length})
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {(() => {
                    const groupedSlots = groupSlotsByDate(availableSlots);
                    const { paginatedDates, totalPages, totalDates } =
                      paginateSlots(groupedSlots);

                    if (totalDates === 0) {
                      return (
                        <p className="text-muted-foreground text-center py-4">
                          No available slots found
                        </p>
                      );
                    }

                    return (
                      <>
                        {paginatedDates.map(([date, slots]) => (
                          <div
                            key={date}
                            className="space-y-2"
                          >
                            <div className="flex items-center gap-2">
                              <Checkbox
                                checked={slots.every((slot) =>
                                  selectedSlots.includes(slot.start)
                                )}
                                onCheckedChange={(checked) => {
                                  setSelectedSlots((old) => {
                                    const slotStarts = slots.map(
                                      (s) => s.start
                                    );
                                    if (checked) {
                                      return [
                                        ...new Set([...old, ...slotStarts]),
                                      ];
                                    } else {
                                      return old.filter(
                                        (s) => !slotStarts.includes(s)
                                      );
                                    }
                                  });
                                }}
                              />
                              <h3 className="font-medium">
                                {new Date(date).toLocaleDateString(undefined, {
                                  weekday: "long",
                                  year: "numeric",
                                  month: "long",
                                  day: "numeric",
                                })}
                              </h3>
                            </div>
                            <div className="ml-6 space-y-2">
                              {Object.entries(
                                slots.reduce((groups, slot) => {
                                  const time = new Date(
                                    Number(slot.start) / 1000000
                                  );
                                  const hour = time.getHours();
                                  if (!groups[hour]) groups[hour] = [];
                                  groups[hour].push(slot);
                                  return groups;
                                }, {})
                              )
                                .sort(
                                  ([hourA], [hourB]) =>
                                    Number(hourA) - Number(hourB)
                                )
                                .map(([hour, hourSlots]) => (
                                  <div
                                    key={hour}
                                    className="flex items-center justify-between p-2 border rounded"
                                  >
                                    <div className="flex items-center gap-4">
                                      <Checkbox
                                        checked={hourSlots.every((slot) =>
                                          selectedSlots.includes(slot.start)
                                        )}
                                        onCheckedChange={(checked) => {
                                          setSelectedSlots((old) => {
                                            const slotStarts = hourSlots.map(
                                              (s) => s.start
                                            );
                                            if (checked) {
                                              return [
                                                ...new Set([
                                                  ...old,
                                                  ...slotStarts,
                                                ]),
                                              ];
                                            } else {
                                              return old.filter(
                                                (s) => !slotStarts.includes(s)
                                              );
                                            }
                                          });
                                        }}
                                      />
                                      <div>
                                        <p>{formatTimeRange(hourSlots)}</p>
                                        <p className="text-sm text-muted-foreground">
                                          Capacity:{" "}
                                          {Number(hourSlots[0].capacity)}
                                        </p>
                                      </div>
                                    </div>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => {
                                        const slotStarts = hourSlots.map(
                                          (s) => s.start
                                        );
                                        handleRemoveMultipleSlots(slotStarts);
                                      }}
                                    >
                                      <TrashIcon className="h-4 w-4" />
                                    </Button>
                                  </div>
                                ))}
                            </div>
                          </div>
                        ))}

                        {totalPages > 1 && (
                          <Pagination className="mt-4">
                            <PaginationContent>
                              <PaginationItem>
                                <PaginationPrevious
                                  onClick={() =>
                                    setCurrentPage((p) => Math.max(1, p - 1))
                                  }
                                  disabled={currentPage === 1}
                                />
                              </PaginationItem>

                              {[...Array(totalPages)].map((_, i) => (
                                <PaginationItem key={i + 1}>
                                  <PaginationLink
                                    onClick={() => setCurrentPage(i + 1)}
                                    isActive={currentPage === i + 1}
                                  >
                                    {i + 1}
                                  </PaginationLink>
                                </PaginationItem>
                              ))}

                              <PaginationItem>
                                <PaginationNext
                                  onClick={() =>
                                    setCurrentPage((p) =>
                                      Math.min(totalPages, p + 1)
                                    )
                                  }
                                  disabled={currentPage === totalPages}
                                />
                              </PaginationItem>
                            </PaginationContent>
                          </Pagination>
                        )}
                      </>
                    );
                  })()}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="visits">
          <div className="grid gap-6">
            <Card>
              <CardHeader className="flex flex-col xs:flex-row items-start xs:items-center justify-between gap-2">
                <CardTitle className="text-lg">Select NFT</CardTitle>
                <Button
                  variant="outline"
                  onClick={handleRefreshNFTs}
                  disabled={nftsLoading}
                  size="sm"
                  className="w-full xs:w-auto"
                >
                  {nftsLoading ? (
                    <Loader2Icon className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <ArrowPathIcon className="h-4 w-4 mr-2" />
                  )}
                  Refresh NFTs
                </Button>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {nftsLoading ? (
                    <p className="text-sm text-muted-foreground">
                      Loading NFTs...
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-3 gap-3">
                      {nfts.map((nft) => (
                        <div
                          key={nft.id}
                          className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                            selectedAvatarId === nft.id
                              ? "border-primary bg-accent"
                              : "hover:bg-accent/50"
                          }`}
                          onClick={() => setSelectedAvatarId(nft.id)}
                        >
                          <div className="flex items-center gap-2">
                            {nft.image && (
                              <img
                                src={nft.image}
                                alt={nft.name}
                                className="w-10 h-10 rounded"
                              />
                            )}
                            <div className="overflow-hidden">
                              <p className="font-medium text-sm truncate">
                                {nft.name}
                              </p>
                              <p className="text-xs text-muted-foreground truncate">
                                Type: {nft.type} • ID: {nft.id}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {!nftsLoading && nfts.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center">
                      No NFTs available in your wallet
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-col xs:flex-row items-start xs:items-center justify-between gap-2">
                <CardTitle className="text-lg">Pending Visits</CardTitle>
                <Button
                  variant="outline"
                  onClick={fetchBookedSlots}
                  disabled={isLoadingBookedSlots}
                  size="sm"
                  className="w-full xs:w-auto"
                >
                  {isLoadingBookedSlots ? (
                    <Loader2Icon className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <ArrowPathIcon className="h-4 w-4 mr-2" />
                  )}
                  Refresh
                </Button>
              </CardHeader>
              <CardContent className="px-3 sm:px-6">
                {isLoadingBookedSlots ? (
                  <div className="flex justify-center py-8">
                    <Loader2Icon className="h-8 w-8 animate-spin" />
                  </div>
                ) : bookedSlots.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    No pending visits found
                  </p>
                ) : (
                  <div className="space-y-3">
                    {bookedSlots.map((slot, index) => (
                      <div
                        key={index}
                        className="flex flex-col p-3 border rounded-lg hover:bg-accent/50 transition-colors"
                      >
                        <div className="flex flex-col xs:flex-row justify-between items-start mb-3 gap-2">
                          <div>
                            <p className="font-medium text-sm">
                              {new Date(
                                Number(slot.start) / 1000000
                              ).toLocaleDateString(undefined, {
                                weekday: "short",
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                              })}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(
                                Number(slot.start) / 1000000
                              ).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </p>
                          </div>
                          <div className="text-left xs:text-right w-full xs:w-auto">
                            <p className="text-xs font-medium">
                              Visit ID: {Number(slot.visitId)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Capacity: {Number(slot.capacity)}
                            </p>
                            <p className="text-xs text-muted-foreground truncate max-w-[180px]">
                              User ID: {slot.userId || "Unknown"}
                            </p>
                            {slot.payment !== undefined && (
                              <p className="text-xs text-muted-foreground">
                                Payment: {Number(slot.payment)} tokens
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-col xs:flex-row justify-end gap-2">
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => handleCompleteVisit(slot.visitId)}
                            disabled={!selectedAvatarId}
                            className="flex items-center gap-1 w-full xs:w-auto text-xs"
                          >
                            {selectedAvatarId
                              ? `Complete with ${nfts.find((a) => a.id === selectedAvatarId)?.name?.substring(0, 8)}${nfts.find((a) => a.id === selectedAvatarId)?.name?.length > 8 ? "..." : ""}`
                              : "Select an avatar above"}
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleRejectVisit(slot.visitId)}
                            className="w-full xs:w-auto text-xs"
                          >
                            Reject
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-col xs:flex-row items-start xs:items-center justify-between gap-2">
                <CardTitle className="text-lg">All Visits</CardTitle>
                <Button
                  variant="outline"
                  onClick={fetchVisits}
                  disabled={isLoadingVisits}
                  size="sm"
                  className="w-full xs:w-auto"
                >
                  {isLoadingVisits ? (
                    <Loader2Icon className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <ArrowPathIcon className="h-4 w-4 mr-2" />
                  )}
                  Refresh
                </Button>
              </CardHeader>
              <CardContent className="px-3 sm:px-6">
                {isLoadingVisits ? (
                  <div className="flex justify-center py-8">
                    <Loader2Icon className="h-8 w-8 animate-spin" />
                  </div>
                ) : visits.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    No visits found
                  </p>
                ) : (
                  <div className="space-y-3">
                    {visits.map((visit, index) => (
                      <div
                        key={index}
                        className="p-3 border rounded-lg hover:bg-accent/50 transition-colors"
                      >
                        <div className="flex flex-col xs:flex-row justify-between items-start mb-2 gap-2">
                          <div>
                            <p className="font-medium text-sm">
                              Visit ID: {Number(visit.visitId)}
                            </p>
                            <p className="text-xs text-muted-foreground truncate max-w-[180px]">
                              User ID: {visit.userId}
                            </p>
                          </div>
                          <Badge
                            variant={getStatusVariant(visit.status)}
                            className="mt-1 xs:mt-0 text-xs"
                          >
                            {Object.keys(visit.status)[0]}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
                          <div>
                            <p className="text-muted-foreground">Mode</p>
                            <p>{Object.keys(visit.visitMode)[0]}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Avatar ID</p>
                            <p>{Number(visit.avatarId)}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Payment</p>
                            <p>{Number(visit.payment)} tokens</p>
                          </div>
                          {visit.meetingLink && (
                            <div className="col-span-2">
                              <p className="text-muted-foreground">
                                Meeting Link
                              </p>
                              <a
                                href={visit.meetingLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-500 hover:underline break-all text-xs"
                              >
                                {visit.meetingLink}
                              </a>
                            </div>
                          )}
                          <div className="col-span-2">
                            <p className="text-muted-foreground">Timestamps</p>
                            <div className="grid grid-cols-1 xs:grid-cols-2 gap-1 mt-1">
                              {visit.timestamp.slotTime && (
                                <p className="text-xs">
                                  Slot:{" "}
                                  {new Date(
                                    Number(visit.timestamp.slotTime) / 1000000
                                  ).toLocaleString(undefined, {
                                    month: "short",
                                    day: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </p>
                              )}
                              {visit.timestamp.bookingTime && (
                                <p className="text-xs">
                                  Booked:{" "}
                                  {new Date(
                                    Number(visit.timestamp.bookingTime) /
                                      1000000
                                  ).toLocaleString(undefined, {
                                    month: "short",
                                    day: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </p>
                              )}
                              {visit.timestamp.completionTime && (
                                <p className="text-xs">
                                  Completed:{" "}
                                  {new Date(
                                    Number(visit.timestamp.completionTime) /
                                      1000000
                                  ).toLocaleString(undefined, {
                                    month: "short",
                                    day: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </p>
                              )}
                              {visit.timestamp.cancellationTime && (
                                <p className="text-xs">
                                  Cancelled:{" "}
                                  {new Date(
                                    Number(visit.timestamp.cancellationTime) /
                                      1000000
                                  ).toLocaleString(undefined, {
                                    month: "short",
                                    day: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </p>
                              )}
                              {visit.timestamp.rejectionTime && (
                                <p className="text-xs">
                                  Rejected:{" "}
                                  {new Date(
                                    Number(visit.timestamp.rejectionTime) /
                                      1000000
                                  ).toLocaleString(undefined, {
                                    month: "short",
                                    day: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default GamificationTab;
