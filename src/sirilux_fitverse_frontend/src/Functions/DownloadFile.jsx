import React, { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  hex_decode,
  aes_gcm_decrypt,
} from "../Functions/VETKey/VetKeyFunctions";
import * as vetkd from "ic-vetkd-utils";
import { toast } from "@/components/ui/use-toast";
import { Progress } from "@/components/ui/progress";
import { useToastProgressStore } from "../State/ProgressStore/ToastProgressStore";
import useActorStore from "../State/Actors/ActorStore";

const DownloadFile = ({
  dataAssetShardPrincipal,
  dataStorageShardPrincipal,
  uniqueID,
  format,
  title,
  accessLevel,
}) => {
  const { createStorageShardActorExternal, createDataAssetShardActorExternal } =
    useActorStore();
  const [downloading, setDownloading] = useState(false);
  const setProgress = useToastProgressStore((state) => state.setProgress);
  const resetProgress = useToastProgressStore((state) => state.resetProgress);
  const progress = useToastProgressStore((state) => state.progress);

  const initDB = () => {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open("downloadedFiles", 1);

      request.onerror = () => reject(request.error);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains("files")) {
          db.createObjectStore("files", { keyPath: "id" });
        }
      };

      request.onsuccess = () => resolve(request.result);
    });
  };

  function downloadData(file, uniqueID) {
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download = file.name;
    link.click();

    // Read file and store in IndexedDB
    const reader = new FileReader();
    reader.onloadend = async () => {
      try {
        const db = await initDB();
        const transaction = db.transaction(["files"], "readwrite");
        const store = transaction.objectStore("files");

        const fileEntry = {
          id: uniqueID,
          name: file.name,
          data: reader.result,
          timestamp: new Date().toISOString(),
        };

        store.put(fileEntry);

        transaction.oncomplete = () => {
          db.close();
        };
      } catch (error) {
        console.error("Error storing file in IndexedDB:", error);
      }
    };

    reader.readAsDataURL(file);
    URL.revokeObjectURL(url);
  }

  const downloadFromStorageShard = async (uniqueID, toastId) => {
    const dataStorageShard = await createStorageShardActorExternal(
      dataStorageShardPrincipal
    );
    if (!dataStorageShard) {
      throw new Error("Failed to create storage shard actor");
    }

    const dataAssetShard = await createDataAssetShardActorExternal(
      dataAssetShardPrincipal
    );
    if (!dataAssetShard) {
      throw new Error("Failed to create data asset shard actor");
    }

    try {
      // Get encryption key and setup first
      const seed = window.crypto.getRandomValues(new Uint8Array(32));
      const tsk = new vetkd.TransportSecretKey(seed);
      const encryptedKeyResult =
        await dataAssetShard.encrypted_symmetric_key_for_asset(
          uniqueID,
          Object.values(tsk.public_key())
        );

      let encryptedKey = "";
      Object.keys(encryptedKeyResult).forEach((key) => {
        if (key === "err") throw new Error(encryptedKeyResult[key]);
        if (key === "ok") encryptedKey = encryptedKeyResult[key];
      });

      if (!encryptedKey)
        throw new Error("Failed to retrieve the encrypted key.");

      const symmetricVerificiationKey =
        await dataAssetShard.getSymmetricKeyVerificationKey();

      if (!symmetricVerificiationKey)
        throw new Error("Failed to get symmetric key verification key");

      const aesGCMKey = tsk.decrypt_and_hash(
        hex_decode(encryptedKey),
        hex_decode(symmetricVerificiationKey),
        new TextEncoder().encode(uniqueID),
        32,
        new TextEncoder().encode("aes-256-gcm")
      );

      const CHUNK_SIZE = 1.9 * 1000 * 1000; // 1.9MB in bytes
      const totalSize = await dataStorageShard.getDataSize(uniqueID);
      const decryptedChunks = [];
      let downloadedSize = 0;

      for (let offset = 0; offset < totalSize; offset += CHUNK_SIZE) {
        // Use different methods based on access level
        const chunkResult =
          accessLevel === "owned"
            ? await dataStorageShard.getDataChunk(
                uniqueID,
                Number(offset),
                Number(CHUNK_SIZE)
              )
            : await dataStorageShard.getDataChunkForReadPermittedPrincipal(
                uniqueID,
                Number(offset),
                Number(CHUNK_SIZE)
              );

        if ("err" in chunkResult) {
          throw new Error(chunkResult.err);
        }

        const encryptedChunk = chunkResult.ok;
        try {
          const decryptedChunk = await aes_gcm_decrypt(
            encryptedChunk,
            aesGCMKey
          );
          decryptedChunks.push(decryptedChunk);
          downloadedSize += encryptedChunk.length;

          const progress = Math.round(
            (Number(downloadedSize) / Number(totalSize)) * 100
          );
          setProgress(progress, "Downloading and Decrypting File...", toastId);
        } catch (error) {
          console.error("Decryption error:", error);
          throw error;
        }
      }

      // Combine decrypted chunks
      const totalLength = decryptedChunks.reduce(
        (sum, chunk) => sum + chunk.length,
        0
      );
      let combinedData = new Uint8Array(totalLength);
      let offset = 0;
      for (const chunk of decryptedChunks) {
        combinedData.set(chunk, offset);
        offset += chunk.length;
      }

      return combinedData;
    } catch (error) {
      console.error("Storage shard error:", error);
      throw error;
    }
  };

  const checkLocalStorage = async (uniqueID) => {
    try {
      const db = await initDB();
      const transaction = db.transaction(["files"], "readonly");
      const store = transaction.objectStore("files");
      const result = await new Promise((resolve, reject) => {
        const request = store.get(uniqueID);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      db.close();
      return result;
    } catch (error) {
      console.error("Error checking IndexedDB:", error);
      return null;
    }
  };

  const downloadFile = async () => {
    const toastId = Date.now().toString();
    try {
      setDownloading(true);
      resetProgress();

      // Show initial toast
      toast({
        id: toastId,
        title: "Downloading File",
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

      // Check if file exists in IndexedDB
      const localFile = await checkLocalStorage(uniqueID);
      if (localFile) {
        setProgress(100, "Loading from local storage", toastId);
        // Convert base64 to blob
        const response = await fetch(localFile.data);
        const blob = await response.blob();
        const file = new File([blob], localFile.name, { type: format });
        downloadData(file, uniqueID);

        // Update toast for success
        toast({
          id: toastId,
          title: "Download Complete",
          description: "File loaded from local storage",
          duration: 3000,
        });

        setDownloading(false);
        return;
      }

      // If not in local storage
      setProgress(0, "Starting download and decryption...", toastId);

      // Download and decrypt data
      const decryptedData = await downloadFromStorageShard(uniqueID, toastId);

      // Create blob and trigger download
      const decryptedBlob = new Blob([decryptedData], { type: format });
      const decryptedFile = new File([decryptedBlob], title, {
        type: format,
      });

      // Final success toast
      toast({
        id: toastId,
        title: "Download Complete",
        description: "File downloaded successfully",
        duration: 3000,
      });

      downloadData(decryptedFile, uniqueID);
    } catch (error) {
      console.error("Error downloading file:", error);
      // Error toast
      toast({
        id: toastId,
        title: "Download Failed",
        description: error.message || "Failed to download file",
        variant: "destructive",
        duration: 3000,
      });
    } finally {
      setDownloading(false);
      setTimeout(() => resetProgress(), 3000);
    }
  };

  // Add progress effect to update toast
  useEffect(() => {
    if (progress.toastId) {
      toast({
        id: progress.toastId,
        title: "Downloading File",
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
    }
  }, [progress]);

  return (
    <Button
      className="p-2 text-white"
      onClick={downloadFile}
      disabled={downloading}
    >
      <Download />
      {downloading ? "Downloading..." : "Download"}
    </Button>
  );
};

export default DownloadFile;
