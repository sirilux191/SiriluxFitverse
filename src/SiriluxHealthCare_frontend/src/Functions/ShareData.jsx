import React, { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/use-toast";
import useActorStore from "../State/Actors/ActorStore";
import { Share, Loader2 } from "lucide-react";

export function ShareDataFunc({ assetID }) {
  const [userId, setUserId] = useState("");
  const [open, setOpen] = useState(false);
  const [sharing, setSharing] = useState(false);
  const { actors } = useActorStore();

  const handleShare = async () => {
    try {
      setSharing(true);
      console.log(assetID);
      const result = await actors.dataAsset.shareDataAsset(assetID, userId, {
        Shared: null,
      });
      if (result.ok) {
        toast({
          title: "Access Granted!",
          description: "User has been granted access to the data.",
          variant: "success",
        });
        setSharing(false);
        setOpen(false);
      } else {
        setSharing(false);
        toast({
          title: "Error Granting Access",
          description: `Error: ${result.err}`,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error granting access:", error);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
    >
      <DialogTrigger asChild>
        <Button
          variant="default"
          onClick={() => setOpen(true)}
          disabled={sharing}
          className="gap-2"
        >
          {sharing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Share className="h-4 w-4" />
          )}
          Share
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share className="h-5 w-5" />
            Share your data
          </DialogTitle>
          <DialogDescription>
            Enter the user ID you want to share your data with. Click share when
            you're done.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-6 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label
              htmlFor="userId"
              className="text-right"
            >
              User ID
            </Label>
            <Input
              id="userId"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              className="col-span-3 focus-visible:ring-indigo-500"
              placeholder="Enter user ID..."
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            onClick={handleShare}
            disabled={sharing}
            variant="default"
            className="bg-indigo-600 hover:bg-indigo-700"
          >
            {sharing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {sharing ? "Sharing..." : "Share Data"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
