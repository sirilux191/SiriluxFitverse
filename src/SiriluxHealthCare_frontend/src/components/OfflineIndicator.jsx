import React, { useState, useEffect } from "react";
import { WifiOff } from "lucide-react";

export default function OfflineIndicator() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div className="fixed bottom-4 right-4 bg-destructive text-destructive-foreground py-2 px-4 rounded-lg shadow-lg flex items-center z-50">
      <WifiOff className="w-5 h-5 mr-2" />
      <span>You are offline. Some features may be unavailable.</span>
    </div>
  );
}
