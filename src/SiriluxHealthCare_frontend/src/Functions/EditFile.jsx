import React, { useState, useEffect } from "react";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "@/components/ui/use-toast";
import { useToastProgressStore } from "../State/ProgressStore/ToastProgressStore";
import useActorStore from "../State/Actors/ActorStore";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const EditFile = ({
  dataAssetShardPrincipal,
  uniqueID,
  format,
  title,
  category,
}) => {
  const { createDataAssetShardActorExternal } = useActorStore();
  const [uploading, setUploading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const setProgress = useToastProgressStore((state) => state.setProgress);
  const resetProgress = useToastProgressStore((state) => state.resetProgress);
  const progress = useToastProgressStore((state) => state.progress);
  const [metadata, setMetadata] = useState({
    category: category || "Reports",
    description: "",
    tags: "",
  });

  // Update metadata when dialog opens
  useEffect(() => {
    if (isOpen) {
      setMetadata((prev) => ({
        ...prev,
        category: category || "Reports",
      }));
    }
  }, [isOpen, category]);

  // Extract timestamp from uniqueID (format: assetNum-userID-timestamp)
  const getTimestamp = (uniqueID) => {
    const parts = uniqueID.split("-");
    return parts[2];
  };

  const updateDataAssetMetadata = async (uniqueID, toastId) => {
    const dataAssetShard = await createDataAssetShardActorExternal(
      dataAssetShardPrincipal
    );
    if (!dataAssetShard) {
      throw new Error("Failed to create data asset shard actor");
    }

    const timestamp = getTimestamp(uniqueID);

    // Convert tags string to array
    const tagsArray = metadata.tags
      .split(",")
      .map((tag) => tag.trim())
      .filter((tag) => tag !== "");

    // Create new metadata object with format from props
    const metadataToUpdate = {
      ...metadata,
      tags: tagsArray,
      format: format, // Include format from props
    };

    const result = await dataAssetShard.updateDataAsset(
      timestamp,
      metadataToUpdate
    );
    console.log(result);

    if (result.err) {
      throw new Error(result.err);
    }

    return true;
  };

  const handleUpload = async () => {
    if (!metadata.category || !metadata.description || !metadata.tags) {
      toast({
        title: "Missing Fields",
        description: "Please fill in all metadata fields",
        variant: "destructive",
      });
      return;
    }

    const toastId = Date.now().toString();
    try {
      setUploading(true);
      resetProgress();

      toast({
        id: toastId,
        title: "Updating File",
        description: (
          <div className="w-full space-y-2">
            <Progress
              value={progress.value}
              className="w-full"
            />
            <p className="text-sm text-gray-500">{progress.message}</p>
          </div>
        ),
        duration: Infinity,
      });

      // Update metadata in DataAssetShard
      await updateDataAssetMetadata(uniqueID, toastId);

      // Success toast
      toast({
        id: toastId,
        title: "Update Complete",
        description: "File metadata updated successfully",
        duration: 3000,
      });

      setIsOpen(false);
    } catch (error) {
      console.error("Error updating file:", error);
      toast({
        id: toastId,
        title: "Update Failed",
        description: error.message || "Failed to update file",
        variant: "destructive",
        duration: 3000,
      });
    } finally {
      setUploading(false);
      setTimeout(() => resetProgress(), 3000);
    }
  };

  return (
    <>
      <Button
        className="p-2 text-white w-full sm:w-auto"
        onClick={() => setIsOpen(true)}
        disabled={uploading}
      >
        <Pencil className="mr-2" />
        {uploading ? "Updating..." : "Edit"}
      </Button>

      <Dialog
        open={isOpen}
        onOpenChange={setIsOpen}
      >
        <DialogContent className="w-[90vw] max-w-[500px] p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-lg break-all">
              Edit File: {title}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-3">
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium block mb-1">
                  Category
                </label>
                <div className="w-full rounded-md border bg-muted px-3 py-2 text-sm text-muted-foreground">
                  {metadata.category}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium block mb-1">
                  Description
                </label>
                <textarea
                  className="w-full min-h-[80px] rounded-md border bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  placeholder="Enter description"
                  value={metadata.description}
                  onChange={(e) =>
                    setMetadata({ ...metadata, description: e.target.value })
                  }
                />
              </div>

              <div>
                <label className="text-sm font-medium block mb-1">
                  Tags (comma-separated)
                </label>
                <input
                  type="text"
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  placeholder="Enter tags (e.g., health, data, research)"
                  value={metadata.tags}
                  onChange={(e) =>
                    setMetadata({ ...metadata, tags: e.target.value })
                  }
                />
              </div>

              <div>
                <label className="text-sm font-medium block mb-1">Format</label>
                <div className="w-full rounded-md border bg-muted px-3 py-2 text-sm text-muted-foreground">
                  {format}
                </div>
              </div>
            </div>

            <Button
              onClick={handleUpload}
              disabled={uploading}
              className="w-full mt-2"
            >
              {uploading ? "Updating..." : "Update Metadata"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default EditFile;
