import React from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  hex_decode,
  aes_gcm_decrypt,
} from "../Functions/VETKey/VetKeyFunctions";
import * as vetkd from "ic-vetkd-utils";
import { useState } from "react";
import useActorStore from "../State/Actors/ActorStore";

// Helper to download file from Lighthouse
const downloadFromLighthouse = async (hash) => {
  const response = await fetch(
    `https://gateway.lighthouse.storage/ipfs/${hash}`
  );
  console.log(response);
  if (!response) {
    throw new Error("Failed to download file from Lighthouse");
  }
  const arrayBuffer = await response.arrayBuffer();
  return new Uint8Array(arrayBuffer);
};

const DownloadFile = ({ data, uniqueID, format, title }) => {
  const { actors } = useActorStore();
  const [downloading, setDownloading] = useState(false);

  function downloadData(file, uniqueID) {
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download = file.name;
    link.click();

    // Read file and store in localStorage as part of an array
    const reader = new FileReader();
    reader.onloadend = () => {
      // Get existing files array or initialize new one
      const existingFiles = JSON.parse(
        localStorage.getItem("downloadedFiles") || "[]"
      );

      // Create new file entry
      const fileEntry = {
        id: uniqueID,
        name: file.name,
        data: reader.result,
        timestamp: new Date().toISOString(),
      };

      // Add new file to array, replace if exists
      const index = existingFiles.findIndex((f) => f.id === uniqueID);
      if (index !== -1) {
        existingFiles[index] = fileEntry;
      } else {
        existingFiles.push(fileEntry);
      }

      // Store updated array back in localStorage
      localStorage.setItem("downloadedFiles", JSON.stringify(existingFiles));
    };
    reader.readAsDataURL(file);

    URL.revokeObjectURL(url);
  }

  const downloadFile = async () => {
    try {
      setDownloading(true);
      console.log(data);
      // Step 1: Download encrypted file from Lighthouse using the hash
      const encryptedData = await downloadFromLighthouse(data);
      console.log(encryptedData);

      // Step 2: Retrieve the encrypted key using encrypted_symmetric_key_for_dataAsset
      const seed = window.crypto.getRandomValues(new Uint8Array(32));
      const tsk = new vetkd.TransportSecretKey(seed);
      const encryptedKeyResult =
        await actors.dataAsset.getEncryptedSymmetricKeyForAsset(
          uniqueID,
          Object.values(tsk.public_key())
        );

      let encryptedKey = "";

      Object.keys(encryptedKeyResult).forEach((key) => {
        if (key === "err") {
          throw new Error(encryptedKeyResult[key]);
        }
        if (key === "ok") {
          encryptedKey = encryptedKeyResult[key];
        }
      });

      if (!encryptedKey) {
        throw new Error("Failed to retrieve the encrypted key.");
      }

      const pkBytesHex =
        await actors.dataAsset.getSymmetricKeyVerificationKey(uniqueID);

      let symmetricVerificiationKey = "";

      Object.keys(pkBytesHex).forEach((key) => {
        if (key === "err") {
          throw new Error(pkBytesHex[key]);
        }
        if (key === "ok") {
          symmetricVerificiationKey = pkBytesHex[key];
        }
      });

      if (!symmetricVerificiationKey) {
        throw new Error("Failed to get encrypted key");
      }

      // Step 3: Decrypt the key using tsk.decrypt_and_hash
      const aesGCMKey = tsk.decrypt_and_hash(
        hex_decode(encryptedKey),
        hex_decode(symmetricVerificiationKey),
        new TextEncoder().encode(uniqueID),
        32,
        new TextEncoder().encode("aes-256-gcm")
      );

      // Step 4: Decrypt the file data using the AES-GCM key
      const decryptedData = await aes_gcm_decrypt(encryptedData, aesGCMKey);

      // Step 5: Create a Blob and File from the decrypted data
      const decryptedFileBlob = new Blob([decryptedData], {
        type: format,
      });
      const decryptedFile = new File([decryptedFileBlob], title, {
        type: format,
      });

      // Step 6: Download the decrypted file
      downloadData(decryptedFile, uniqueID);
      setDownloading(false);
    } catch (error) {
      console.error("Error downloading file:", error);
      alert("Failed to download the file. Please try again.");
      setDownloading(false);
    }
  };

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
