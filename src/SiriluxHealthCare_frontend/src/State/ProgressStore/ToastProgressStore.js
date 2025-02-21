import { create } from "zustand";

export const useToastProgressStore = create((set) => ({
  // Store the current progress state
  progress: { value: 0, message: "", toastId: null },

  // Method to set progress with value, message and optional toastId
  setProgress: (value, message, toastId = null) => {
    set({ progress: { value, message, toastId } });
  },

  // Reset progress state
  resetProgress: () => {
    set({ progress: { value: 0, message: "", toastId: null } });
  },
}));
