import React, { useState, useContext } from "react";
import axios from "axios";
import Papa from "papaparse";
import jsPDF from "jspdf";
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
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/use-toast";
import { CircleX } from "lucide-react";
import lighthouse from "@lighthouse-web3/sdk";

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

const FileUpload = () => {
  const { actors } = useActorStore();
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
    const supportedFormats = ["pdf", "csv", "xml", "jpg", "jpeg", "png"];
    const fileType = file.type.split("/")[1];
    const fileSizeMB = file.size / (1024 * 1024);
    if (!supportedFormats.includes(fileType)) {
      setErrorMessage(
        "Unsupported file format. Please select a file with one of the supported formats: PDF, CSV, XML, JPG, JPEG, PNG."
      );
      return false;
    }
    if (fileSizeMB > 1.9) {
      setErrorMessage(
        "File size is larger than 2 MB. Please select a smaller file."
      );
      return false;
    }
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

  const uploadToLighthouse = async (file) => {
    const progressCallback = (progressData) => {
      let percentageDone =
        100 - (progressData?.total / progressData?.uploaded)?.toFixed(2);
      console.log(`Upload progress: ${percentageDone}%`);
    };

    try {
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      const fileList = dataTransfer.files;
      console.log(fileList);
      const output = await lighthouse.upload(
        fileList,
        process.env.LIGHTHOUSEAPI,
        null,
        progressCallback
      );
      console.log("File Status:", output);
      console.log(
        "Visit at https://gateway.lighthouse.storage/ipfs/" + output.data.Hash
      );
      return output.data.Hash;
    } catch (error) {
      console.error("Error uploading to Lighthouse:", error);
      throw error;
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validate file before proceeding
      if (!file || !(file.file instanceof File)) {
        throw new Error("No valid file uploaded. Please upload a valid file.");
      }

      // Step 1: Upload/link an empty file to get a unique ID
      const emptyDataAsset = {
        assetID: "",
        title: "Empty File",
        description: "Placeholder for encryption",
        data: "[]",
        metadata: {
          category: "",
          tags: [],
          format: "empty",
        },
      };

      const result = await actors.dataAsset.uploadDataAsset(emptyDataAsset);
      let uniqueID = "";

      Object.keys(result).forEach((key) => {
        if (key === "err") {
          throw new Error(result[key]);
        }
        if (key === "ok") {
          uniqueID = result[key];
        }
      });
      console.log(uniqueID);
      console.log("This is unique ID: : " + uniqueID);
      if (!uniqueID) {
        throw new Error("Failed to get unique ID");
      }

      // Step 2: Fetch the encrypted key using encrypted_symmetric_key_for_dataAsset
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
      console.log("encrypted key " + encryptedKey);
      if (!encryptedKey) {
        throw new Error("Failed to get encrypted key");
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
      console.log("symmetric verification key " + symmetricVerificiationKey);
      if (!symmetricVerificiationKey) {
        throw new Error("Failed to get encrypted key");
      }

      const aesGCMKey = tsk.decrypt_and_hash(
        hex_decode(encryptedKey),
        hex_decode(symmetricVerificiationKey),
        new TextEncoder().encode(uniqueID),
        32,
        new TextEncoder().encode("aes-256-gcm")
      );
      console.log(aesGCMKey);

      // Step 3: Encrypt the user's file using the AES-GCM key
      const arrayBuffer = await file.file.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      const encryptedData = await aes_gcm_encrypt(uint8Array, aesGCMKey);

      // Step 4: Upload encrypted data to Lighthouse
      const encryptedBlob = new Blob([encryptedData]);
      const encryptedFile = new File([encryptedBlob], "encrypted.bin", {
        type: "application/octet-stream",
      });
      const lighthouseHash = await uploadToLighthouse(encryptedFile);

      const metadata = {
        category: category,
        tags: [keywords],
        format: file.file.type,
      };

      const dataAsset = {
        assetID: uniqueID,
        title: file.file.name,
        description: description,
        data: lighthouseHash,
        metadata: metadata,
      };

      // Step 5: Update the data asset with the Lighthouse hash
      const updateResult = await actors.dataAsset.updateDataAsset(
        uniqueID,
        dataAsset
      );

      Object.keys(updateResult).forEach((key) => {
        if (key === "err") {
          throw new Error(updateResult[key]);
        }
        if (key === "ok") {
          toast({
            title: "Success",
            description: updateResult[key],
            variant: "success",
          });
        }
      });
    } catch (error) {
      handleError(error); // Use utility function for error handling
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
  // const hex_encode = (bytes) =>
  //   bytes.reduce((str, byte) => str + byte.toString(16).padStart(2, "0"), "");
  const hex_decode = (hexString) =>
    Uint8Array.from(
      hexString.match(/.{1,2}/g).map((byte) => parseInt(byte, 16))
    );

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
