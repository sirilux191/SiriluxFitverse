import React, { useState } from "react";

import "jspdf-autotable";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { toast } from "@/components/ui/use-toast";
import { CircleX } from "lucide-react";

import LoadingScreen from "../LoadingScreen";

import * as vetkd from "ic-vetkd-utils";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import useActorStore from "../State/Actors/ActorStore";

import { hex_decode } from "./VETKey/VetKeyFunctions";

const FileUpload = () => {
  const {
    dataAsset,
    createStorageShardActorExternal,
    createDataAssetShardActorExternal,
  } = useActorStore();
  const [file, setFile] = useState(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [description, setDescription] = useState("");
  const [keywords, setKeywords] = useState("");
  const [category, setCategory] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [csvData, setCsvData] = useState(null); // State to store CSV data

  const handleFileInputChange = (event) => {
    if (event.target.files && event.target.files.length > 0) {
      const selectedFile = event.target.files[0];
      if (validateFile(selectedFile)) {
        setFile({
          file: selectedFile,
          description: "",
          keywords: "",
          category: "",
        });
        // Reset error message when a new file is selected
        setErrorMessage("");
      }
    }
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setIsDraggingOver(false);

    const droppedFiles = event.dataTransfer.files;

    if (droppedFiles && droppedFiles.length > 0) {
      const droppedFile = droppedFiles[0];
      if (validateFile(droppedFile)) {
        setFile({
          file: droppedFile,
          description: "",
          keywords: "",
          category: "",
        });
        // Reset error message when a new file is dropped
        setErrorMessage("");
      }
    }
  };

  const validateFile = (file) => {
    const supportedFormats = ["pdf", "csv", "xml", "jpg", "jpeg", "png", "txt"];
    const fileType = file.type.split("/")[1];
    const fileSizeMB = file.size / (1024 * 1024);
    // if (!supportedFormats.includes(fileType)) {
    //   setErrorMessage(
    //     "Unsupported file format. Please select a file with one of the supported formats: PDF, CSV, XML, JPG, JPEG, PNG."
    //   );
    //   return false;
    // }
    // if (fileSizeMB > 1.9) {
    //   setErrorMessage(
    //     "File size is larger than 2 MB. Please select a smaller file."
    //   );
    //   return false;
    // }
    return true;
  };

  const handleDragOver = (event) => {
    event.preventDefault();
    setIsDraggingOver(true);
  };

  const handleDragEnter = (event) => {
    event.preventDefault();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (event) => {
    event.preventDefault();

    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX;
    const y = event.clientY;

    if (
      x >= rect.left &&
      x <= rect.right &&
      y >= rect.top &&
      y <= rect.bottom
    ) {
      setIsDraggingOver(false);
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (!file || !(file.file instanceof File)) {
        throw new Error("No valid file uploaded. Please upload a valid file.");
      }

      toast({
        title: "Upload Started",
        description: "Preparing file for upload...",
      });

      // Step 1: Get upload location and unique ID from DataAsset canister

      const metadata = {
        category: category,
        description: description,
        tags: keywords.split(",").map((k) => k.trim()),
        format: file.file.type,
      };

      const dataAssetFile = {
        assetID: "",
        title: file.file.name,
        dataAssetShardPrincipal: "",
        dataStorageShardPrincipal: "",
        metadata: metadata,
      };

      const result = await dataAsset.uploadDataAsset(dataAssetFile);
      let uniqueID = "";
      let assetShardPrincipal = "";
      let storageShardPrincipal = "";

      Object.keys(result).forEach((key) => {
        if (key === "err") {
          throw new Error(result[key]);
        }
        if (key === "ok") {
          [uniqueID, assetShardPrincipal, storageShardPrincipal] = result[key];
        }
      });

      if (!uniqueID || !assetShardPrincipal || !storageShardPrincipal) {
        throw new Error("Failed to get required upload information");
      }

      // Step 2: Create dataAssetShard actor and get encryption key
      const dataAssetShard =
        await createDataAssetShardActorExternal(assetShardPrincipal);
      if (!dataAssetShard) {
        throw new Error("Failed to create data asset shard actor");
      }
      console.log(dataAssetShard);
      const seed = window.crypto.getRandomValues(new Uint8Array(32));
      const tsk = new vetkd.TransportSecretKey(seed);

      // Get encrypted key from the asset shard
      const encryptedKeyResult =
        await dataAssetShard.encrypted_symmetric_key_for_asset(
          uniqueID,
          Object.values(tsk.public_key())
        );

      let encryptedKey = "";
      Object.keys(encryptedKeyResult).forEach((key) => {
        if (key === "err") throw new Error(encryptedKeyResult[key]);
        if (key === "ok") encryptedKey = encryptedKeyResult[key];
        console.log(encryptedKey);
      });

      // Get verification key from the asset shard
      const symmetricVerificationKey =
        await dataAssetShard.getSymmetricKeyVerificationKey();
      console.log(symmetricVerificationKey);

      const aesGCMKey = tsk.decrypt_and_hash(
        hex_decode(encryptedKey),
        hex_decode(symmetricVerificationKey),
        new TextEncoder().encode(uniqueID),
        32,
        new TextEncoder().encode("aes-256-gcm")
      );

      toast({
        title: "Upload Progress",
        description: "Encrypting file data...",
      });

      // Step 3: Split file into chunks and encrypt each chunk
      const ENCRYPTION_OVERHEAD = 28; // 12 bytes for IV + 16 bytes for auth tag
      const MAX_CHUNK_SIZE = 1.9 * 1000 * 1000; // 1.9MB max for encrypted chunk
      const CHUNK_SIZE = MAX_CHUNK_SIZE - ENCRYPTION_OVERHEAD;
      const arrayBuffer = await file.file.arrayBuffer();
      const fileData = new Uint8Array(arrayBuffer);
      const totalChunks = Math.ceil(fileData.length / CHUNK_SIZE);

      // Create storage shard actor using the principal
      const storageShard = createStorageShardActorExternal(
        storageShardPrincipal
      );
      if (!storageShard) {
        throw new Error("Failed to create storage shard actor");
      }

      // Start chunk upload process
      const startResult = await storageShard.startChunkUpload(
        uniqueID,
        totalChunks
      );
      if ("err" in startResult) {
        throw new Error(startResult.err);
      }

      // Modify the chunk upload section to show progress
      let uploadedChunks = 0;

      // Process and upload each chunk
      for (let i = 0; i < totalChunks; i++) {
        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, fileData.length);
        const chunk = fileData.slice(start, end);

        // Encrypt the chunk
        const encryptedChunk = await aes_gcm_encrypt(chunk, aesGCMKey);

        // Upload the encrypted chunk
        const uploadResult = await storageShard.uploadChunk(
          uniqueID,
          i,
          encryptedChunk
        );

        uploadedChunks++;
        const progress = Math.round((uploadedChunks / totalChunks) * 100);

        // Show toast at 20% intervals
        toast({
          title: "Upload Progress",
          description: `Uploading file: ${progress}% complete`,
        });

        if ("err" in uploadResult) {
          throw new Error(
            `Failed to upload chunk ${i + 1}: ${uploadResult.err}`
          );
        }
      }

      toast({
        title: "Success",
        description: "File uploaded successfully!",
      });
    } catch (error) {
      handleError(error);
    } finally {
      setLoading(false);
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

  const handleRemoveFile = () => {
    setFile(null);
    setDescription("");
    setKeywords("");
    setCategory("");
    setErrorMessage("");
    setCsvData(null);
  };

  const handleCallCloudFunction = async () => {
    if (!file) {
      alert("Please upload a file first!");
      return;
    }

    setLoading(true);

    const formData = new FormData();
    formData.append("image", file.file);

    try {
      const response = await axios.post(
        "https://us-central1-document-416209.cloudfunctions.net/function-1",
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
          responseType: "blob",
        }
      );

      const url = window.URL.createObjectURL(new Blob([response.data]));

      // Parse CSV data using papaparse
      Papa.parse(url, {
        download: true,
        complete: function (results) {
          // Set CSV data to state
          setCsvData(results.data);
        },
      });
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  };

  const convertCsvToPdf = () => {
    const doc = new jsPDF();
    const fileName = `${file.file.name.split(".")[0]}_analyzed.pdf`; // Generate file name based on the original file name

    doc.autoTable({
      head: [Object.keys(csvData[0])],
      body: csvData.slice(1),
    });

    // Save the PDF file
    doc.save(fileName);
  };

  // Utility function for error handling
  const handleError = (error) => {
    console.error("Error:", error);
    toast({
      title: "Error",
      description: error.message,
      variant: "destructive",
    });
  };

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <div>
      <p className="text-sm mb-4 text-gray-500">
        Supported file formats include PDFs, CSVs, XML, JPGs, and JPEGs.
      </p>
      <div
        className={`flex flex-col items-center justify-center p-6 border-2 border-dashed border-gray-600 rounded-lg ${
          isDraggingOver ? "bg-gray-100" : ""
        }`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
      >
        <input
          id="fileInput"
          type="file"
          onChange={handleFileInputChange}
          className="hidden"
        />
        <Button
          className="mb-2"
          onClick={() => document.getElementById("fileInput")?.click()}
        >
          Add File
        </Button>
        <span className="text-sm text-gray-500">or</span>
        <span className="text-sm text-gray-500">drag your file here</span>
      </div>

      {errorMessage && (
        <p className="text-sm mt-1 text-red-500">{errorMessage}</p>
      )}

      {file && (
        <div>
          {/* Desktop View */}
          <div className="hidden md:block overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="dark:border-gray-700">
                  <TableHead className="w-[200px] dark:text-gray-200">
                    Title
                  </TableHead>
                  <TableHead className="w-[400px] dark:text-gray-200">
                    Description
                  </TableHead>
                  <TableHead className="w-[200px] dark:text-gray-200">
                    Keywords
                  </TableHead>
                  <TableHead className="w-[200px] dark:text-gray-200">
                    Category
                  </TableHead>
                  <TableHead className="w-[100px] dark:text-gray-200">
                    Action
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow className="dark:border-gray-700">
                  <TableCell className="dark:text-gray-300">
                    {file.file.name}
                  </TableCell>
                  <TableCell>
                    <Input
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="w-full bg-transparent dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700"
                      placeholder="Enter description"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      value={keywords}
                      onChange={(e) => setKeywords(e.target.value)}
                      className="w-full bg-transparent dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700"
                      placeholder="Enter keywords"
                    />
                  </TableCell>
                  <TableCell>
                    <Select
                      value={category}
                      onValueChange={setCategory}
                    >
                      <SelectTrigger className="w-full dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700">
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent className="dark:bg-gray-800">
                        <SelectItem
                          value="Bills"
                          className="dark:text-gray-200 dark:hover:bg-gray-700"
                        >
                          Bills
                        </SelectItem>
                        <SelectItem
                          value="GeneticData"
                          className="dark:text-gray-200 dark:hover:bg-gray-700"
                        >
                          Genetic Data
                        </SelectItem>
                        <SelectItem
                          value="MedicalImageData"
                          className="dark:text-gray-200 dark:hover:bg-gray-700"
                        >
                          Medical Image Data
                        </SelectItem>
                        <SelectItem
                          value="MedicalStatData"
                          className="dark:text-gray-200 dark:hover:bg-gray-700"
                        >
                          Medical Statistics Data
                        </SelectItem>
                        <SelectItem
                          value="Reports"
                          className="dark:text-gray-200 dark:hover:bg-gray-700"
                        >
                          Reports
                        </SelectItem>
                        <SelectItem
                          value="TrainingModels"
                          className="dark:text-gray-200 dark:hover:bg-gray-700"
                        >
                          Training Models
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <button
                      onClick={handleRemoveFile}
                      className="p-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
                    >
                      <CircleX className="text-gray-500 dark:text-gray-400" />
                    </button>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>

          {/* Mobile View */}
          <div className="md:hidden space-y-4 mt-4">
            <div className="flex justify-between items-center mb-4">
              <div className="font-medium dark:text-gray-200">File Details</div>
              <button
                onClick={handleRemoveFile}
                className="p-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
              >
                <CircleX className="text-gray-500 dark:text-gray-400" />
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium dark:text-gray-200">
                Title
              </label>
              <div className="dark:text-gray-300 text-sm">{file.file.name}</div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium dark:text-gray-200">
                Description
              </label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-transparent dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700"
                placeholder="Enter description"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium dark:text-gray-200">
                Keywords
              </label>
              <Input
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                className="w-full bg-transparent dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700"
                placeholder="Enter keywords"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium dark:text-gray-200">
                Category
              </label>
              <Select
                value={category}
                onValueChange={setCategory}
              >
                <SelectTrigger className="w-full dark:bg-gray-800 dark:text-gray-200 dark:border-gray-700">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent className="dark:bg-gray-800">
                  <SelectItem
                    value="Bills"
                    className="dark:text-gray-200 dark:hover:bg-gray-700"
                  >
                    Bills
                  </SelectItem>
                  <SelectItem
                    value="GeneticData"
                    className="dark:text-gray-200 dark:hover:bg-gray-700"
                  >
                    Genetic Data
                  </SelectItem>
                  <SelectItem
                    value="MedicalImageData"
                    className="dark:text-gray-200 dark:hover:bg-gray-700"
                  >
                    Medical Image Data
                  </SelectItem>
                  <SelectItem
                    value="MedicalStatData"
                    className="dark:text-gray-200 dark:hover:bg-gray-700"
                  >
                    Medical Statistics Data
                  </SelectItem>
                  <SelectItem
                    value="Reports"
                    className="dark:text-gray-200 dark:hover:bg-gray-700"
                  >
                    Reports
                  </SelectItem>
                  <SelectItem
                    value="TrainingModels"
                    className="dark:text-gray-200 dark:hover:bg-gray-700"
                  >
                    Training Models
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      )}

      {file && (
        <>
          <Button
            onClick={handleUpload}
            className="my-2 mr-2"
          >
            Upload
          </Button>
          <CloudFunctionCallButton
            handleCallCloudFunction={handleCallCloudFunction}
          />
        </>
      )}

      {csvData && (
        <Button
          onClick={convertCsvToPdf}
          className="my-2 mr-2"
        >
          Download Analyzed File
        </Button>
      )}

      {csvData && (
        <div className="overflow-x-auto bg-muted rounded-lg p-2 ">
          <table>
            <tbody>
              {csvData.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {row.map((cell, cellIndex) => (
                    <td key={cellIndex}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

const CloudFunctionCallButton = ({ handleCallCloudFunction }) => (
  <Button
    variant="outline"
    onClick={handleCallCloudFunction}
  >
    Run Analytics
  </Button>
);

export default FileUpload;
