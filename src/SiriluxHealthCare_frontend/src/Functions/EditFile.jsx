import React, { useState } from "react";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "@/components/ui/use-toast";
import { useToastProgressStore } from "../State/ProgressStore/ToastProgressStore";
import useActorStore from "../State/Actors/ActorStore";
import * as vetkd from "ic-vetkd-utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const EditFile = ({ data, uniqueID, format, title }) => {
  const { actors, createStorageShardActorExternal } = useActorStore();
  const [uploading, setUploading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const setProgress = useToastProgressStore((state) => state.setProgress);
  const resetProgress = useToastProgressStore((state) => state.resetProgress);
  const progress = useToastProgressStore((state) => state.progress);

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file && file.type === format) {
      setSelectedFile(file);
    } else {
      toast({
        title: "Invalid File Type",
        description: `Please select a file with format: ${format}`,
        variant: "destructive",
      });
    }
  };

  const uploadToStorageShard = async (
    file,
    storagePrincipal,
    uniqueID,
    toastId
  ) => {
    const storageShard = createStorageShardActorExternal(storagePrincipal);
    if (!storageShard) {
      throw new Error("Failed to create storage shard actor");
    }

    try {
      // Get encryption key setup
      const seed = window.crypto.getRandomValues(new Uint8Array(32));
      const tsk = new vetkd.TransportSecretKey(seed);
      const encryptedKeyResult =
        await actors.dataAsset.getEncryptedSymmetricKeyForAsset(
          uniqueID,
          Object.values(tsk.public_key())
        );

      let encryptedKey = "";
      Object.keys(encryptedKeyResult).forEach((key) => {
        if (key === "err") throw new Error(encryptedKeyResult[key]);
        if (key === "ok") encryptedKey = encryptedKeyResult[key];
      });

      const pkBytesHex =
        await actors.dataAsset.getSymmetricKeyVerificationKey(uniqueID);
      let symmetricVerificationKey = "";
      Object.keys(pkBytesHex).forEach((key) => {
        if (key === "err") throw new Error(pkBytesHex[key]);
        if (key === "ok") symmetricVerificationKey = pkBytesHex[key];
      });

      const aesGCMKey = tsk.decrypt_and_hash(
        hex_decode(encryptedKey),
        hex_decode(symmetricVerificationKey),
        new TextEncoder().encode(uniqueID),
        32,
        new TextEncoder().encode("aes-256-gcm")
      );

      // Read and encrypt file
      const fileData = await file.arrayBuffer();
      const fileContent = new Uint8Array(fileData);

      // Split into chunks and encrypt
      const CHUNK_SIZE = 1.9 * 1000 * 1000; // 1.9MB
      const totalChunks = Math.ceil(fileContent.length / CHUNK_SIZE);

      // Start chunk upload - this will check storage space
      const startResult = await storageShard.startChunkUpload(
        uniqueID,
        totalChunks
      );
      if ("err" in startResult) {
        throw new Error(startResult.err);
      }

      setProgress(0, "Starting upload...", toastId);

      // Upload chunks
      for (let i = 0; i < totalChunks; i++) {
        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, fileContent.length);
        const chunk = fileContent.slice(start, end);

        // Encrypt chunk
        const encryptedChunk = await aes_gcm_encrypt(chunk, aesGCMKey);

        // Upload encrypted chunk
        const uploadResult = await storageShard.uploadChunk(
          uniqueID,
          i,
          encryptedChunk
        );

        if ("err" in uploadResult) {
          throw new Error(uploadResult.err);
        }

        const progress = Math.round(((i + 1) / totalChunks) * 100);
        setProgress(
          progress,
          `Uploading chunk ${i + 1} of ${totalChunks}...`,
          toastId
        );
      }

      return true;
    } catch (error) {
      console.error("Storage shard error:", error);
      throw error;
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast({
        title: "No File Selected",
        description: "Please select a file to upload",
        variant: "destructive",
      });
      return;
    }

    const toastId = Date.now().toString();
    try {
      setUploading(true);
      resetProgress();

      // Show initial toast
      toast({
        id: toastId,
        title: "Uploading File",
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

      // Upload and encrypt data
      await uploadToStorageShard(selectedFile, data, uniqueID, toastId);

      // Success toast
      toast({
        id: toastId,
        title: "Upload Complete",
        description: "File updated successfully",
        duration: 3000,
      });

      setIsOpen(false);
      setSelectedFile(null);
    } catch (error) {
      console.error("Error uploading file:", error);
      toast({
        id: toastId,
        title: "Upload Failed",
        description: error.message || "Failed to upload file",
        variant: "destructive",
        duration: 3000,
      });
    } finally {
      setUploading(false);
      setTimeout(() => resetProgress(), 3000);
    }
  };

  const aes_gcm_encrypt = async (data, rawKey) => {
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const aes_key = await window.crypto.subtle.importKey(
      "raw",
      rawKey,
      "AES-GCM",
      false,
      ["encrypt"]
    );
    const ciphertext_buffer = await window.crypto.subtle.encrypt(
      { name: "AES-GCM", iv: iv },
      aes_key,
      data
    );
    const ciphertext = new Uint8Array(ciphertext_buffer);
    const iv_and_ciphertext = new Uint8Array(iv.length + ciphertext.length);
    iv_and_ciphertext.set(iv, 0);
    iv_and_ciphertext.set(ciphertext, iv.length);
    return iv_and_ciphertext;
  };

  const hex_decode = (hexString) =>
    Uint8Array.from(
      hexString.match(/.{1,2}/g).map((byte) => parseInt(byte, 16))
    );

  return (
    <>
      <Button
        className="p-2 text-white"
        onClick={() => setIsOpen(true)}
        disabled={uploading}
      >
        <Pencil />
        {uploading ? "Uploading..." : "Edit"}
      </Button>

      <Dialog
        open={isOpen}
        onOpenChange={setIsOpen}
      >
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit File: {title}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="flex items-center gap-4">
              <input
                type="file"
                accept={format}
                onChange={handleFileChange}
                className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-violet-50 file:text-violet-700 hover:file:bg-violet-100"
              />
            </div>
            <Button
              onClick={handleUpload}
              disabled={!selectedFile || uploading}
            >
              {uploading ? "Uploading..." : "Upload"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default EditFile;
