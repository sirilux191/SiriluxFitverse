import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  SelectValue,
  SelectTrigger,
  SelectItem,
  SelectContent,
  Select,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/components/ui/use-toast";
import FileUpload from "../../Functions/file-upload";
import { DatePicker } from "@/Functions/DatePicker";
import { jsPDF } from "jspdf";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";

import { useState } from "react";

import LoadingScreen from "../../LoadingScreen";
import * as vetkd from "ic-vetkd-utils";

import useActorStore from "../../State/Actors/ActorStore";

const generateBeautifulPDF = (formData, metadata) => {
  const doc = new jsPDF();

  // Set document properties
  doc.setProperties({
    title: "Health Report",
    subject: "Medical Checkup and Prescription Details",
    author: "Sirilux Healthcare",
    creator: "Sirilux Healthcare Platform",
  });

  // Add a header with logo
  doc.setFillColor(41, 98, 255);
  doc.rect(0, 0, 210, 30, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text("SIRILUX HEALTHCARE", 105, 15, { align: "center" });
  doc.setFontSize(12);
  doc.text("Medical Report", 105, 23, { align: "center" });

  // Add report title
  doc.setTextColor(41, 98, 255);
  doc.setFontSize(18);
  doc.text("Health Checkup Report", 105, 40, { align: "center" });

  // Add date
  const today = new Date();
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text(`Generated on: ${today.toLocaleDateString()}`, 105, 47, {
    align: "center",
  });

  // Add divider
  doc.setDrawColor(200, 200, 200);
  doc.line(20, 50, 190, 50);

  // Health Checkup Section
  doc.setFontSize(14);
  doc.setTextColor(41, 98, 255);
  doc.setFont("helvetica", "bold");
  doc.text("Health Checkup Details", 20, 60);

  // Add checkup details
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(60, 60, 60);
  let yPos = 70;

  // Format the checkup details
  if (formData.dateOfCheckup) {
    doc.setFont("helvetica", "bold");
    doc.text("Date of Checkup:", 20, yPos);
    doc.setFont("helvetica", "normal");
    doc.text(formData.dateOfCheckup, 80, yPos);
    yPos += 8;
  }

  if (formData.typeOfCheckup) {
    doc.setFont("helvetica", "bold");
    doc.text("Type of Checkup:", 20, yPos);
    doc.setFont("helvetica", "normal");
    doc.text(formData.typeOfCheckup, 80, yPos);
    yPos += 8;
  }

  if (formData.healthcareProvider) {
    doc.setFont("helvetica", "bold");
    doc.text("Healthcare Provider:", 20, yPos);
    doc.setFont("helvetica", "normal");
    doc.text(formData.healthcareProvider, 80, yPos);
    yPos += 8;
  }

  if (formData.reasonForCheckup) {
    doc.setFont("helvetica", "bold");
    doc.text("Reason for Checkup:", 20, yPos);
    doc.setFont("helvetica", "normal");
    doc.text(formData.reasonForCheckup, 80, yPos);
    yPos += 8;
  }

  // Add divider
  yPos += 5;
  doc.setDrawColor(200, 200, 200);
  doc.line(20, yPos, 190, yPos);
  yPos += 10;

  // Prescription Section
  doc.setFontSize(14);
  doc.setTextColor(128, 0, 128); // Purple color for prescription section
  doc.setFont("helvetica", "bold");
  doc.text("Prescription Details", 20, yPos);
  yPos += 10;

  // Add prescription details
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(60, 60, 60);

  if (formData.medicationName) {
    doc.setFont("helvetica", "bold");
    doc.text("Medication Name(s):", 20, yPos);
    doc.setFont("helvetica", "normal");
    doc.text(formData.medicationName, 80, yPos);
    yPos += 8;
  }

  if (formData.dosage) {
    doc.setFont("helvetica", "bold");
    doc.text("Dosage:", 20, yPos);
    doc.setFont("helvetica", "normal");
    doc.text(formData.dosage, 80, yPos);
    yPos += 8;
  }

  if (formData.frequency) {
    doc.setFont("helvetica", "bold");
    doc.text("Frequency:", 20, yPos);
    doc.setFont("helvetica", "normal");
    doc.text(formData.frequency, 80, yPos);
    yPos += 8;
  }

  if (formData.prescribingDoctor) {
    doc.setFont("helvetica", "bold");
    doc.text("Prescribing Doctor:", 20, yPos);
    doc.setFont("helvetica", "normal");
    doc.text(formData.prescribingDoctor, 80, yPos);
    yPos += 8;
  }

  // Add metadata section
  yPos += 5;
  doc.setDrawColor(200, 200, 200);
  doc.line(20, yPos, 190, yPos);
  yPos += 10;

  doc.setFontSize(14);
  doc.setTextColor(60, 60, 60);
  doc.setFont("helvetica", "bold");
  doc.text("Report Metadata", 20, yPos);
  yPos += 10;

  doc.setFontSize(11);
  if (metadata.category) {
    doc.setFont("helvetica", "bold");
    doc.text("Category:", 20, yPos);
    doc.setFont("helvetica", "normal");
    doc.text(metadata.category, 80, yPos);
    yPos += 8;
  }

  if (metadata.tags && metadata.tags.length > 0) {
    doc.setFont("helvetica", "bold");
    doc.text("Keywords:", 20, yPos);
    doc.setFont("helvetica", "normal");
    doc.text(metadata.tags.join(", "), 80, yPos);
    yPos += 8;
  }

  if (metadata.description) {
    doc.setFont("helvetica", "bold");
    doc.text("Description:", 20, yPos);
    doc.setFont("helvetica", "normal");

    // Handle multi-line description
    const splitDescription = doc.splitTextToSize(metadata.description, 110);
    doc.text(splitDescription, 80, yPos);
  }

  // Add footer
  doc.setFontSize(10);
  doc.setTextColor(150, 150, 150);
  doc.text(
    "This is a confidential medical document generated by Sirilux Healthcare.",
    105,
    280,
    { align: "center" }
  );
  doc.text("Page 1 of 1", 105, 285, { align: "center" });

  return doc;
};

export default function UploadContent() {
  const {
    dataAsset,
    createDataAssetShardActorExternal,
    createStorageShardActorExternal,
  } = useActorStore();
  const [formData, setFormData] = useState({
    dateOfCheckup: "",
    typeOfCheckup: "",
    healthcareProvider: "",
    reasonForCheckup: "",
    medicationName: "",
    dosage: "",
    frequency: "",
    prescribingDoctor: "",
  });
  const [description, setDescription] = useState("");
  const [keywords, setKeywords] = useState("");
  const [category, setCategory] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.id]: e.target.value });
  };

  const handleSelectChange = (field, value) => {
    setFormData({ ...formData, [field]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Step 1: Upload/link an empty file to get a unique ID
      const metadata = {
        category: category,
        tags: keywords ? [keywords] : [],
        description: description,
        format: "application/pdf",
      };

      const dataAssetFile = {
        assetID: "",
        title: "Generated Report",
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
      });

      // Get verification key from the asset shard
      const symmetricVerificationKey =
        await dataAssetShard.getSymmetricKeyVerificationKey();

      const aesGCMKey = tsk.decrypt_and_hash(
        hex_decode(encryptedKey),
        hex_decode(symmetricVerificationKey),
        new TextEncoder().encode(uniqueID),
        32,
        new TextEncoder().encode("aes-256-gcm")
      );

      // Step 3: Generate PDF from form data
      const doc = generateBeautifulPDF(formData, metadata);
      const pdfBlob = doc.output("blob");
      const pdfFile = new File([pdfBlob], "generated.pdf", {
        type: "application/pdf",
      });

      // Step 4: Encrypt the PDF file
      const arrayBuffer = await pdfFile.arrayBuffer();
      const fileData = new Uint8Array(arrayBuffer);

      // Create storage shard actor using the principal
      const storageShard = await createStorageShardActorExternal(
        storageShardPrincipal
      );
      if (!storageShard) {
        throw new Error("Failed to create storage shard actor");
      }

      // Calculate chunks for upload
      const ENCRYPTION_OVERHEAD = 28; // 12 bytes for IV + 16 bytes for auth tag
      const MAX_CHUNK_SIZE = 1.9 * 1000 * 1000; // 1.9MB max for encrypted chunk
      const CHUNK_SIZE = MAX_CHUNK_SIZE - ENCRYPTION_OVERHEAD;
      const totalChunks = Math.ceil(fileData.length / CHUNK_SIZE);

      // Start chunk upload process
      const startResult = await storageShard.startChunkUpload(
        uniqueID,
        totalChunks
      );
      if ("err" in startResult) {
        throw new Error(startResult.err);
      }

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

        if ("err" in uploadResult) {
          throw new Error(
            `Failed to upload chunk ${i + 1}: ${uploadResult.err}`
          );
        }
      }

      toast({
        title: "Success",
        description: "Health data uploaded successfully!",
        variant: "success",
      });
    } catch (error) {
      console.error("Error:", error);
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
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

  const hex_decode = (hexString) =>
    Uint8Array.from(
      hexString.match(/.{1,2}/g).map((byte) => parseInt(byte, 16))
    );

  if (loading) {
    return <LoadingScreen />;
  }
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="max-w-6xl mx-auto py-12 px-2 sm:px-4 lg:px-6"
    >
      <div className="flex flex-col items-center justify-center p-4 sm:p-6 lg:p-8">
        <motion.h1
          initial={{ y: -20 }}
          animate={{ y: 0 }}
          className="mt-4 text-4xl font-bold bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent"
        >
          Upload your Health Data
        </motion.h1>
        <p className="mt-2 text-lg text-muted-foreground">
          Choose a suitable format to upload your data.
        </p>
        <div className="mt-6 w-full max-w-4xl mx-auto">
          <Tabs defaultValue="Document">
            <TabsList className="w-full">
              <TabsTrigger
                className="w-1/2"
                value="Document"
              >
                Document
              </TabsTrigger>
              <TabsTrigger
                className="w-1/2"
                value="Form"
              >
                Form
              </TabsTrigger>
            </TabsList>
            <TabsContent value="Document">
              <FileUpload />
            </TabsContent>

            <TabsContent value="Form">
              <Card className="border-border">
                <CardContent className="pt-6">
                  {loading && <LoadingScreen />}
                  <form
                    onSubmit={handleSubmit}
                    className="space-y-8"
                  >
                    <motion.div
                      initial={{ x: -20 }}
                      animate={{ x: 0 }}
                      transition={{ delay: 0.2 }}
                    >
                      <h2 className="text-xl font-semibold flex items-center gap-2 mb-4">
                        <span className="h-8 w-1 bg-blue-500 rounded-full"></span>
                        Health Checkup Details
                      </h2>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="flex flex-col space-y-2 transition-all duration-200 hover:transform hover:scale-[1.02]">
                          <label className="font-medium text-foreground">
                            Date of Checkup
                          </label>
                          <DatePicker
                            date={formData.dateOfCheckup}
                            setDate={(date) =>
                              handleSelectChange("dateOfCheckup", date)
                            }
                          />
                        </div>
                        <div className="flex flex-col space-y-2 transition-all duration-200 hover:transform hover:scale-[1.02]">
                          <label className="font-medium text-foreground">
                            Type of Checkup
                          </label>
                          <Select
                            id="type-of-checkup"
                            value={formData.typeOfCheckup}
                            onValueChange={(value) =>
                              handleSelectChange("typeOfCheckup", value)
                            }
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select" />
                            </SelectTrigger>
                            <SelectContent position="popper">
                              <SelectItem value="general">
                                General Checkup
                              </SelectItem>
                              <SelectItem value="blood-test">
                                Blood Test
                              </SelectItem>
                              <SelectItem value="cholesterol">
                                Cholesterol Test
                              </SelectItem>
                              <SelectItem value="cardiac">
                                Cardiac Evaluation
                              </SelectItem>
                              <SelectItem value="other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex flex-col space-y-2 transition-all duration-200 hover:transform hover:scale-[1.02]">
                          <label className="font-medium text-foreground">
                            Healthcare Provider/Facility Name
                          </label>
                          <Input
                            id="healthcareProvider"
                            placeholder="Enter name"
                            value={formData.healthcareProvider}
                            onChange={handleChange}
                          />
                        </div>
                        <div className="flex flex-col space-y-2 transition-all duration-200 hover:transform hover:scale-[1.02]">
                          <label className="font-medium text-foreground">
                            Reason for Checkup
                          </label>
                          <Select
                            id="reason-for-checkup"
                            value={formData.reasonForCheckup}
                            onValueChange={(value) =>
                              handleSelectChange("reasonForCheckup", value)
                            }
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select" />
                            </SelectTrigger>
                            <SelectContent position="popper">
                              <SelectItem value="routine">Routine</SelectItem>
                              <SelectItem value="symptoms">
                                Specific Symptoms
                              </SelectItem>
                              <SelectItem value="pre-surgery">
                                Pre-Surgery
                              </SelectItem>
                              <SelectItem value="other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </motion.div>

                    <motion.div
                      initial={{ x: -20 }}
                      animate={{ x: 0 }}
                      transition={{ delay: 0.4 }}
                    >
                      <h2 className="text-xl font-semibold flex items-center gap-2 mb-4">
                        <span className="h-8 w-1 bg-purple-500 rounded-full"></span>
                        Prescription Details
                      </h2>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="flex flex-col space-y-2 transition-all duration-200 hover:transform hover:scale-[1.02]">
                          <label className="font-medium text-foreground">
                            Medication Name(s)
                          </label>
                          <Input
                            id="medicationName"
                            placeholder="Enter medication name"
                            value={formData.medicationName}
                            onChange={handleChange}
                          />
                        </div>
                        <div className="flex flex-col space-y-2 transition-all duration-200 hover:transform hover:scale-[1.02]">
                          <label className="font-medium text-foreground">
                            Dosage
                          </label>
                          <Input
                            id="dosage"
                            placeholder="Enter dosage"
                            value={formData.dosage}
                            onChange={handleChange}
                          />
                        </div>
                        <div className="flex flex-col space-y-2 transition-all duration-200 hover:transform hover:scale-[1.02]">
                          <label className="font-medium text-foreground">
                            Frequency
                          </label>
                          <Input
                            id="frequency"
                            placeholder="Enter frequency"
                            value={formData.frequency}
                            onChange={handleChange}
                          />
                        </div>
                        <div className="flex flex-col space-y-2 transition-all duration-200 hover:transform hover:scale-[1.02]">
                          <label className="font-medium text-foreground">
                            Prescribing Doctor
                          </label>
                          <Input
                            id="prescribingDoctor"
                            placeholder="Enter doctor's name"
                            value={formData.prescribingDoctor}
                            onChange={handleChange}
                          />
                        </div>
                      </div>
                    </motion.div>

                    <motion.div
                      initial={{ x: -20 }}
                      animate={{ x: 0 }}
                      transition={{ delay: 0.6 }}
                      className="bg-muted rounded-lg p-6"
                    >
                      <div className="hidden md:block overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-[150px]">Title</TableHead>
                              <TableHead className="w-[400px]">
                                Description
                              </TableHead>
                              <TableHead className="w-[200px]">
                                Keywords
                              </TableHead>
                              <TableHead className="w-[200px]">
                                Category
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            <TableRow>
                              <TableCell>{"Report Generated"}</TableCell>
                              <TableCell>
                                <Input
                                  value={description}
                                  onChange={(e) =>
                                    setDescription(e.target.value)
                                  }
                                  className="w-full bg-transparent"
                                  placeholder="Enter description"
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  value={keywords}
                                  onChange={(e) => setKeywords(e.target.value)}
                                  className="w-full bg-transparent"
                                  placeholder="Enter keywords"
                                />
                              </TableCell>
                              <TableCell>
                                <Select
                                  value={category}
                                  onValueChange={setCategory}
                                >
                                  <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Select category" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="Bills">Bills</SelectItem>
                                    <SelectItem value="GeneticData">
                                      Genetic Data
                                    </SelectItem>
                                    <SelectItem value="MedicalImageData">
                                      Medical Image Data
                                    </SelectItem>
                                    <SelectItem value="MedicalStatData">
                                      Medical Statistics Data
                                    </SelectItem>
                                    <SelectItem value="Reports">
                                      Reports
                                    </SelectItem>
                                    <SelectItem value="TrainingModels">
                                      Training Models
                                    </SelectItem>
                                  </SelectContent>
                                </Select>
                              </TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                      </div>

                      <div className="md:hidden space-y-4">
                        <div className="space-y-2">
                          <label className="text-sm font-medium text-foreground">
                            Title
                          </label>
                          <div className="text-foreground">
                            {"Report Generated"}
                          </div>
                        </div>

                        <div className="space-y-2">
                          <label className="text-sm font-medium text-foreground">
                            Description
                          </label>
                          <Input
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="w-full bg-transparent"
                            placeholder="Enter description"
                          />
                        </div>

                        <div className="space-y-2">
                          <label className="text-sm font-medium text-foreground">
                            Keywords
                          </label>
                          <Input
                            value={keywords}
                            onChange={(e) => setKeywords(e.target.value)}
                            className="w-full bg-transparent"
                            placeholder="Enter keywords"
                          />
                        </div>

                        <div className="space-y-2">
                          <label className="text-sm font-medium text-foreground">
                            Category
                          </label>
                          <Select
                            value={category}
                            onValueChange={setCategory}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select category" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Bills">Bills</SelectItem>
                              <SelectItem value="GeneticData">
                                Genetic Data
                              </SelectItem>
                              <SelectItem value="MedicalImageData">
                                Medical Image Data
                              </SelectItem>
                              <SelectItem value="MedicalStatData">
                                Medical Statistics Data
                              </SelectItem>
                              <SelectItem value="Reports">Reports</SelectItem>
                              <SelectItem value="TrainingModels">
                                Training Models
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </motion.div>

                    <motion.div
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <Button
                        type="submit"
                        className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-2 rounded-lg hover:opacity-90 transition-all duration-200"
                      >
                        Submit Health Data
                      </Button>
                    </motion.div>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </motion.div>
  );
}
