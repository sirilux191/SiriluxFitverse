import { toast as originalToast } from "@/components/ui/use-toast";
import { Progress } from "@/components/ui/progress";

// Default duration in milliseconds
const DEFAULT_DURATION = 5000;

export const toast = {
  /**
   * Show a success toast
   * @param {string} title - Toast title
   * @param {string} description - Toast description
   * @param {number} duration - Optional duration in ms
   */
  success: (title, description, duration = DEFAULT_DURATION) => {
    return originalToast({
      title,
      description,
      variant: "success",
      duration,
    });
  },

  /**
   * Show an error toast
   * @param {string} title - Toast title
   * @param {string} description - Toast description
   * @param {number} duration - Optional duration in ms
   */
  error: (title, description, duration = DEFAULT_DURATION) => {
    return originalToast({
      title,
      description,
      variant: "destructive",
      duration,
    });
  },

  /**
   * Show a warning toast
   * @param {string} title - Toast title
   * @param {string} description - Toast description
   * @param {number} duration - Optional duration in ms
   */
  warning: (title, description, duration = DEFAULT_DURATION) => {
    return originalToast({
      title,
      description,
      variant: "warning",
      duration,
    });
  },

  /**
   * Show an info toast
   * @param {string} title - Toast title
   * @param {string} description - Toast description
   * @param {number} duration - Optional duration in ms
   */
  info: (title, description, duration = DEFAULT_DURATION) => {
    return originalToast({
      title,
      description,
      variant: "info",
      duration,
    });
  },

  /**
   * Show a default toast
   * @param {string} title - Toast title
   * @param {string} description - Toast description
   * @param {number} duration - Optional duration in ms
   */
  default: (title, description, duration = DEFAULT_DURATION) => {
    return originalToast({
      title,
      description,
      duration,
    });
  },

  /**
   * Show a progress toast
   * @param {string} id - Unique ID for the toast
   * @param {string} title - Toast title
   * @param {number} progress - Progress value (0-100)
   * @param {string} message - Optional message to show under progress bar
   */
  progress: (id, title, progress, message = "") => {
    return originalToast({
      id,
      title,
      description: (
        <div className="w-full space-y-2">
          <Progress
            value={progress}
            className="w-full"
          />
          {message && <p className="text-sm text-gray-500">{message}</p>}
        </div>
      ),
      duration: Infinity,
    });
  },

  /**
   * Dismiss a toast by its ID
   * @param {string} id - The toast ID to dismiss
   */
  dismiss: (id) => {
    return originalToast.dismiss(id);
  },
};
