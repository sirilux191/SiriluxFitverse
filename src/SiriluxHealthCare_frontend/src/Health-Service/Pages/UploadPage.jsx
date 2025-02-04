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
import lighthouse from "@lighthouse-web3/sdk";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";

import { useState, useContext } from "react";

import LoadingScreen from "../../LoadingScreen";
import * as vetkd from "ic-vetkd-utils";
import ActorContext from "../../ActorContext";
export default function UploadContent() {
  const { actors } = useContext(ActorContext);
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
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
      // Generate PDF
      const doc = new jsPDF();
      let pdfContent = "";
      for (const [key, value] of Object.entries(formData)) {
        pdfContent += `${key}: ${value}\n\n`;
      }
      doc.text(pdfContent, 10, 10);

      // Save PDF as a file
      const pdfBlob = doc.output("blob");
      const pdfFile = new File([pdfBlob], "generated.pdf", {
        type: "application/pdf",
      });

      const arrayBuffer = await pdfFile.arrayBuffer();
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
        format: pdfFile.type,
      };

      const dataAsset = {
        assetID: uniqueID,
        title: pdfFile.name,
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
  // const hex_encode = (bytes) =>
  //   bytes.reduce((str, byte) => str + byte.toString(16).padStart(2, "0"), "");
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
          className="mt-4 text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent"
        >
          Upload your Health Data
        </motion.h1>
        <p className="mt-2 text-lg text-gray-600">
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
              <Card className="p-4 sm:p-6 shadow-lg border-t-4 border-blue-500">
                <CardContent>
                  <form
                    className="space-y-8"
                    onSubmit={handleSubmit}
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
                          <label className="font-medium text-gray-700 dark:text-gray-200">
                            Date of Checkup
                          </label>
                          <DatePicker
                            id="date-of-checkup"
                            value={formData.dateOfCheckup}
                            onChange={handleChange}
                            className="rounded-lg border-gray-300 focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div className="flex flex-col space-y-2 transition-all duration-200 hover:transform hover:scale-[1.02]">
                          <label className="font-medium text-gray-700 dark:text-gray-200">
                            Type of Checkup
                          </label>
                          <Select
                            id="type-of-checkup"
                            value={formData.typeOfCheckup}
                            onValueChange={(value) =>
                              handleSelectChange("typeOfCheckup", value)
                            }
                          >
                            <SelectTrigger className="w-full rounded-lg border-gray-300 focus:ring-2 focus:ring-blue-500">
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
                          <label className="font-medium text-gray-700 dark:text-gray-200">
                            Healthcare Provider/Facility Name
                          </label>
                          <Input
                            id="healthcareProvider"
                            placeholder="Enter name"
                            value={formData.healthcareProvider}
                            onChange={handleChange}
                            className="rounded-lg border-gray-300 focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div className="flex flex-col space-y-2 transition-all duration-200 hover:transform hover:scale-[1.02]">
                          <label className="font-medium text-gray-700 dark:text-gray-200">
                            Reason for Checkup
                          </label>
                          <Select
                            id="reason-for-checkup"
                            value={formData.reasonForCheckup}
                            onValueChange={(value) =>
                              handleSelectChange("reasonForCheckup", value)
                            }
                          >
                            <SelectTrigger className="w-full rounded-lg border-gray-300 focus:ring-2 focus:ring-blue-500">
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
                          <label className="font-medium text-gray-700 dark:text-gray-200">
                            Medication Name(s)
                          </label>
                          <Input
                            id="medicationName"
                            placeholder="Enter medication name"
                            value={formData.medicationName}
                            onChange={handleChange}
                            className="rounded-lg border-gray-300 focus:ring-2 focus:ring-purple-500"
                          />
                        </div>
                        <div className="flex flex-col space-y-2 transition-all duration-200 hover:transform hover:scale-[1.02]">
                          <label className="font-medium text-gray-700 dark:text-gray-200">
                            Dosage
                          </label>
                          <Input
                            id="dosage"
                            placeholder="Enter dosage"
                            value={formData.dosage}
                            onChange={handleChange}
                            className="rounded-lg border-gray-300 focus:ring-2 focus:ring-purple-500"
                          />
                        </div>
                        <div className="flex flex-col space-y-2 transition-all duration-200 hover:transform hover:scale-[1.02]">
                          <label className="font-medium text-gray-700 dark:text-gray-200">
                            Frequency
                          </label>
                          <Input
                            id="frequency"
                            placeholder="Enter frequency"
                            value={formData.frequency}
                            onChange={handleChange}
                            className="rounded-lg border-gray-300 focus:ring-2 focus:ring-purple-500"
                          />
                        </div>
                        <div className="flex flex-col space-y-2 transition-all duration-200 hover:transform hover:scale-[1.02]">
                          <label className="font-medium text-gray-700 dark:text-gray-200">
                            Prescribing Doctor
                          </label>
                          <Input
                            id="prescribingDoctor"
                            placeholder="Enter doctor's name"
                            value={formData.prescribingDoctor}
                            onChange={handleChange}
                            className="rounded-lg border-gray-300 focus:ring-2 focus:ring-purple-500"
                          />
                        </div>
                      </div>
                    </motion.div>

                    <motion.div
                      initial={{ x: -20 }}
                      animate={{ x: 0 }}
                      transition={{ delay: 0.6 }}
                      className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6"
                    >
                      <div className="hidden md:block overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow className="dark:border-gray-700">
                              <TableHead className="w-[150px] dark:text-gray-200">
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
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            <TableRow className="dark:border-gray-700">
                              <TableCell className="dark:text-gray-300">
                                {"Report Generated"}
                              </TableCell>
                              <TableCell>
                                <Input
                                  value={description}
                                  onChange={(e) =>
                                    setDescription(e.target.value)
                                  }
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
                            </TableRow>
                          </TableBody>
                        </Table>
                      </div>

                      <div className="md:hidden space-y-4">
                        <div className="space-y-2">
                          <label className="text-sm font-medium dark:text-gray-200">
                            Title
                          </label>
                          <div className="dark:text-gray-300">
                            {"Report Generated"}
                          </div>
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
