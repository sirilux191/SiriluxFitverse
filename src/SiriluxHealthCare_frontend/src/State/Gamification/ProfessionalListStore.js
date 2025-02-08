import { create } from "zustand";
import { persist } from "zustand/middleware";
import { toast } from "@/components/ui/use-toast";

const useProfessionalListStore = create(
  persist(
    (set) => ({
      professionals: [],
      availableSlots: [],
      isLoading: false,
      error: null,

      fetchProfessionals: async (actors) => {
        try {
          set({ isLoading: true, error: null });
          const result = await actors.gamificationSystem.getAllProfessionals();
          set({ professionals: result, isLoading: false });
        } catch (error) {
          console.error("Error fetching professionals:", error);
          set({ error: error.message, isLoading: false });
        }
      },

      formatDateTime: (nanoseconds) => {
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
      },

      groupSlotsByDate: (slots) => {
        const grouped = {};
        slots.forEach((slot) => {
          const { date } = useProfessionalListStore
            .getState()
            .formatDateTime(slot.start);
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
      },

      fetchAvailableSlots: async (actors, idToVisit) => {
        try {
          const result =
            await actors.gamificationSystem.getAvailableSlots(idToVisit);
          console.log("result", result);
          if (Array.isArray(result)) {
            console.log("Available Slots for ID:", idToVisit);

            // Convert BigInt values to numbers and filter out past slots
            const currentTime = Date.now() * 1_000_000; // Convert to nanoseconds
            const validSlots = result
              .filter((slot) => Number(slot.start) > currentTime)
              .map((slot) => ({
                ...slot,
                capacity: Number(slot.capacity),
                start: Number(slot.start),
                entityId: slot.entityId,
              }));

            // Sort slots by start time
            const sortedSlots = validSlots.sort(
              (a, b) => Number(a.start) - Number(b.start)
            );

            set({ availableSlots: sortedSlots });
          } else {
            console.error("Invalid slots response:", result);
            set({ availableSlots: [] });
          }
        } catch (error) {
          console.error("Error fetching available slots:", error);
          set({ availableSlots: [] });
          toast({
            title: "Error",
            description: "Failed to fetch available slots",
            variant: "destructive",
            duration: 3000,
          });
        }
      },

      initiateVisit: async (
        actors,
        idToVisit,
        slotTime,
        selectedAvatarForVisit
      ) => {
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
            await useProfessionalListStore
              .getState()
              .fetchAvailableSlots(actors, idToVisit);
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
      },
    }),
    {
      name: "professional-storage",
      getStorage: () => localStorage,
    }
  )
);

export default useProfessionalListStore;
