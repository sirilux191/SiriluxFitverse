import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Download, X } from "lucide-react";

export default function InstallPrompt() {
  const [installPrompt, setInstallPrompt] = useState(null);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setInstallPrompt(e);
      setShowPrompt(true);
    };

    window.addEventListener("beforeinstallprompt", handler);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
    };
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;

    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;

    if (outcome === "accepted") {
      setShowPrompt(false);
    }
  };

  const handleClose = () => {
    setShowPrompt(false);
  };

  if (!showPrompt) return null;

  return (
    <div className="fixed bottom-4 left-4 bg-background border border-border p-4 rounded-lg shadow-lg z-50 max-w-xs">
      <button
        onClick={handleClose}
        className="absolute top-2 right-2 text-muted-foreground hover:text-foreground"
        aria-label="Close"
      >
        <X className="w-4 h-4" />
      </button>
      <h3 className="font-medium mb-2">Install SiriluxHealthCare</h3>
      <p className="text-muted-foreground text-sm mb-3">
        Install our app for a better experience with offline access.
      </p>
      <Button
        onClick={handleInstall}
        className="w-full flex items-center justify-center"
      >
        <Download className="w-4 h-4 mr-2" />
        Install App
      </Button>
    </div>
  );
}
