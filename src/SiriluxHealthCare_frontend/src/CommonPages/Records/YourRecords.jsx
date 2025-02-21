import { useState, useMemo, useEffect } from "react";
import { Card } from "@/components/ui/card";
import {
  FileText,
  Dna,
  ImageIcon,
  BarChart2,
  FileStack,
  Brain,
  Search,
  Download,
  Trash2,
} from "lucide-react";

import LoadingScreen from "@/LoadingScreen"; // Import LoadingScreen
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { ShareDataFunc } from "@/Functions/ShareData";
import DownloadFile from "@/Functions/DownloadFile";
import { Button } from "@/components/ui/button";
import OpenAI from "openai";

import useActorStore from "@/State/Actors/ActorStore";
import * as pdfjs from "pdfjs-dist";
import EditFile from "@/Functions/EditFile";
import { useUserProfileStore } from "../../State/User/UserProfile/UserProfileStore";
import { jsPDF } from "jspdf";
import { useToast } from "@/components/ui/use-toast";

// Initialize OpenAI client (make sure to add VITE_OPENAI_API_KEY to your .env)
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  dangerouslyAllowBrowser: true,
});

// Set worker path directly
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.mjs",
  import.meta.url
).toString();

export default function YourRecords() {
  const [activeTab, setActiveTab] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [records, setRecords] = useState([]);
  const { actors, createDataAssetShardActorExternal } = useActorStore();
  const userProfile = useUserProfileStore((state) => state.userProfile);
  const [loading, setLoading] = useState(true);
  const [expandedCard, setExpandedCard] = useState(null);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [aiSummary, setAiSummary] = useState("");
  const { toast } = useToast();

  // Function to get icon based on category
  const getIconByCategory = (category) => {
    const iconSize = 48;
    const iconStyles = "p-3 rounded-xl";

    switch (category) {
      case "Bills":
        return (
          <div className={`${iconStyles} bg-orange-100 dark:bg-orange-900/30`}>
            <FileText
              size={iconSize}
              className="text-orange-500"
            />
          </div>
        );
      case "GeneticData":
        return (
          <div className={`${iconStyles} bg-purple-100 dark:bg-purple-900/30`}>
            <Dna
              size={iconSize}
              className="text-purple-500"
            />
          </div>
        );
      case "MedicalImageData":
        return (
          <div className={`${iconStyles} bg-blue-100 dark:bg-blue-900/30`}>
            <ImageIcon
              size={iconSize}
              className="text-blue-500"
            />
          </div>
        );
      case "MedicalStatData":
        return (
          <div className={`${iconStyles} bg-green-100 dark:bg-green-900/30`}>
            <BarChart2
              size={iconSize}
              className="text-green-500"
            />
          </div>
        );
      case "Reports":
        return (
          <div className={`${iconStyles} bg-pink-100 dark:bg-pink-900/30`}>
            <FileStack
              size={iconSize}
              className="text-pink-500"
            />
          </div>
        );
      case "TrainingModels":
        return (
          <div className={`${iconStyles} bg-cyan-100 dark:bg-cyan-900/30`}>
            <Brain
              size={iconSize}
              className="text-cyan-500"
            />
          </div>
        );
      default:
        return (
          <div className={`${iconStyles} bg-gray-100 dark:bg-gray-900/30`}>
            <FileText
              size={iconSize}
              className="text-gray-500"
            />
          </div>
        );
    }
  };

  useEffect(() => {
    const fetchUserDataAssets = async () => {
      try {
        let userIDResult = await actors.identityManager.getIdentityBySelf();
        if (!userIDResult.ok) {
          throw new Error("Failed to get user ID");
        }
        const userID = userIDResult.ok[0];
        // Get shared activity shard principals for this user

        const shardPrincipalsResult =
          await actors.dataAsset.getUserAssetShardsPrincipal(userID);

        if ("err" in shardPrincipalsResult) {
          throw new Error(shardPrincipalsResult.err);
        }

        const shardPrincipals = shardPrincipalsResult.ok;
        const allDataAssets = [];

        for (const principal of shardPrincipals) {
          const shardActor = await createDataAssetShardActorExternal(principal);
          if (!shardActor) {
            console.error(
              "Failed to create shard actor for principal:",
              principal
            );
            continue;
          }

          const result = await shardActor.getUserDataAssets();
          if ("ok" in result) {
            const dataAssets = result.ok.map(([timestamp, asset]) => ({
              assetID: asset.assetID,
              title: asset.title,
              dataAssetShardPrincipal: principal,
              dataStorageShardPrincipal: asset.dataStorageShardPrincipal,
              metadata: {
                category: asset.metadata.category,
                description: asset.metadata.description,
                tags: asset.metadata.tags,
                format: asset.metadata.format,
              },
              // Additional fields for UI
              timestamp: timestamp,
              date: new Date(timestamp / 1000000).toISOString().split("T")[0],
              icon: getIconByCategory(asset.metadata.category),
              description: asset.description || "",
            }));
            allDataAssets.push(...dataAssets);
          } else {
            console.error("Error fetching data from shard:", result.err);
          }
        }

        setRecords(allDataAssets);
        console.log("Fetched data assets:", allDataAssets);
        setLoading(false);
      } catch (error) {
        console.error("Error fetching user data assets:", error);
        setLoading(false);
      }
    };

    fetchUserDataAssets();
  }, [actors, userProfile, createDataAssetShardActorExternal]);

  const filteredRecords = useMemo(() => {
    let filtered = records;

    if (activeTab !== "all") {
      filtered = filtered.filter((record) => record.category === activeTab);
    }

    if (searchTerm) {
      filtered = filtered.filter(
        (record) =>
          record.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          record.description.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    return filtered;
  }, [activeTab, searchTerm, records]);

  // Add this helper function to get file from IndexedDB
  const getFileFromIndexedDB = async (recordId) => {
    console.log(
      "Attempting to get file from IndexedDB for recordId:",
      recordId
    );
    return new Promise((resolve, reject) => {
      const request = indexedDB.open("downloadedFiles", 1);

      request.onerror = () => {
        console.error("Error opening IndexedDB:", request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        console.log("Successfully opened IndexedDB");
        const db = request.result;
        const transaction = db.transaction(["files"], "readonly");
        const store = transaction.objectStore("files");
        const getRequest = store.get(recordId);

        getRequest.onsuccess = () => {
          console.log("Retrieved file from IndexedDB:", getRequest.result);
          resolve(getRequest.result);
        };
        getRequest.onerror = () => {
          console.error("Error getting file from store:", getRequest.error);
          reject(getRequest.error);
        };
      };
    });
  };

  // Update generateAISummary function
  const generateAISummary = async (recordId) => {
    try {
      console.log("Starting AI Summary generation for recordId:", recordId);
      setIsGeneratingSummary(true);
      setErrorMessage("");

      const file = await getFileFromIndexedDB(recordId);
      console.log("Retrieved file:", file);

      if (!file) {
        throw new Error(
          "Please download the file first before generating summary"
        );
      }

      // Convert base64 to Uint8Array
      console.log("Converting base64 to binary...");
      const base64Data = file.data.split(",")[1];
      const binaryData = atob(base64Data);
      const bytes = new Uint8Array(binaryData.length);
      for (let i = 0; i < binaryData.length; i++) {
        bytes[i] = binaryData.charCodeAt(i);
      }
      console.log("Binary conversion complete, byte length:", bytes.length);

      // Load and parse PDF
      console.log("Loading PDF...");
      const pdf = await pdfjs.getDocument({ data: bytes }).promise;
      console.log("PDF loaded, number of pages:", pdf.numPages);

      let textContent = "";

      // Extract text from each page
      for (let i = 1; i <= pdf.numPages; i++) {
        console.log(`Processing page ${i}/${pdf.numPages}`);
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        textContent += content.items.map((item) => item.str).join(" ") + "\n";
      }

      // Clean up the text
      textContent = textContent.replace(/\s+/g, " ").trim();
      console.log("Extracted text length:", textContent.length);
      console.log(
        "First 100 characters of text:",
        textContent.substring(0, 100)
      );

      console.log("Sending request to OpenAI...");
      const response = await openai.chat.completions.create({
        model: "gpt-4-turbo",
        messages: [
          {
            role: "system",
            content: `You are an expert medical document analyzer. Analyze medical documents and provide structured summaries focusing on:
            1. Patient Information (if available)
            2. Key Diagnoses
            3. Vital Signs & Lab Results
            4. Medications & Treatments
            5. Recommendations & Follow-up
            6. Critical Findings or Concerns`,
          },
          {
            role: "user",
            content: `Please analyze this medical document and provide a structured summary: ${textContent}`,
          },
        ],
        temperature: 0.3,
        max_tokens: 1000,
      });

      console.log("Received OpenAI response:", response);
      setAiSummary(response.choices[0].message.content);
      console.log("AI Summary set successfully");
    } catch (error) {
      console.error("Error generating summary:", error);
      console.error("Error stack:", error.stack);
      setErrorMessage(error.message || "Failed to generate summary");
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  // Update generateAllPDFsSummary function
  const generateAllPDFsSummary = async () => {
    try {
      console.log("Starting generation of summary for all PDFs");
      setIsGeneratingSummary(true);
      setErrorMessage("");

      const db = await new Promise((resolve, reject) => {
        const request = indexedDB.open("downloadedFiles", 1);
        request.onerror = () => {
          console.error("Error opening IndexedDB:", request.error);
          reject(request.error);
        };
        request.onsuccess = () => {
          console.log("Successfully opened IndexedDB");
          resolve(request.result);
        };
      });

      const transaction = db.transaction(["files"], "readonly");
      const store = transaction.objectStore("files");
      const allFiles = await new Promise((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      const pdfFiles = allFiles.filter((file) =>
        file.name.toLowerCase().endsWith(".pdf")
      );

      if (pdfFiles.length === 0) {
        throw new Error("No PDF files found in downloads");
      }

      // Process all PDFs
      console.log("Processing all PDF files...");
      const processedPDFs = await Promise.all(
        pdfFiles.map(async (file) => {
          const base64Data = file.data.split(",")[1];
          const binaryData = atob(base64Data);
          const bytes = new Uint8Array(binaryData.length);
          for (let i = 0; i < binaryData.length; i++) {
            bytes[i] = binaryData.charCodeAt(i);
          }

          const pdf = await pdfjs.getDocument({ data: bytes }).promise;
          let textContent = "";

          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            textContent +=
              content.items.map((item) => item.str).join(" ") + "\n";
          }

          return {
            name: file.name,
            content: textContent.replace(/\s+/g, " ").trim(),
          };
        })
      );

      const response = await openai.chat.completions.create({
        model: "gpt-4-turbo",
        messages: [
          {
            role: "system",
            content: `You are an expert medical document analyzer reviewing multiple medical documents. Provide a comprehensive analysis that:
            1. Summarizes each document briefly
            2. Identifies patterns and trends across documents
            3. Highlights key medical findings and their progression
            4. Notes any contradictions or inconsistencies
            5. Provides a timeline of medical events
            6. Flags critical information requiring attention`,
          },
          {
            role: "user",
            content: `Please analyze these medical documents and provide a comprehensive summary:\n\n${processedPDFs
              .map(
                (pdf) => `Document: ${pdf.name}\nContent: ${pdf.content}\n---`
              )
              .join("\n")}`,
          },
        ],
        temperature: 0.3,
        max_tokens: 1500,
      });

      setAiSummary(response.choices[0].message.content);
    } catch (error) {
      console.error("Error generating all PDFs summary:", error);
      console.error("Error stack:", error.stack);
      setErrorMessage(error.message || "Failed to generate summary");
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  // Add this helper function to download the AI Summary
  const downloadAISummary = () => {
    try {
      console.log("Starting AI Summary download");
      if (!aiSummary) {
        console.warn("No AI Summary available to download");
        return;
      }

      const doc = new jsPDF();
      const splitText = doc.splitTextToSize(aiSummary, 180); // 180 is the max width

      // Add title
      doc.setFontSize(16);
      doc.text("AI Generated Medical Summary", 20, 20);

      // Add date
      doc.setFontSize(10);
      doc.text(`Generated on: ${new Date().toLocaleString()}`, 20, 30);

      // Add main content
      doc.setFontSize(12);
      doc.text(splitText, 20, 40);

      // Save the PDF
      doc.save("medical-ai-summary.pdf");
      console.log("AI Summary PDF downloaded successfully");
    } catch (error) {
      console.error("Error downloading AI Summary:", error);
      setErrorMessage("Failed to download AI Summary");
    }
  };

  const handleDelete = async (assetID) => {
    try {
      toast({
        title: "Deleting record...",
        description: "Please wait while we delete your record.",
      });

      const result = await actors.dataAsset.deleteDataAsset(assetID);

      if ("ok" in result) {
        setRecords(records.filter((record) => record.assetID !== assetID));
        toast({
          title: "Success",
          description: "Record deleted successfully",
          variant: "default",
        });
        setExpandedCard(null); // Close the dialog after successful deletion
      } else {
        toast({
          title: "Error",
          description: result.err || "Failed to delete record",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error deleting record:", error);
      toast({
        title: "Error",
        description: "An unexpected error occurred while deleting the record",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <div>
      <div className="max-w-6xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center justify-center p-8">
          <div className="mt-4 w-full">
            <div className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-8">
              {/* Title Section */}
              <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">
                Your Health Records
              </h1>
              <p className="text-gray-400 mb-6">
                Choose the documents below to share or sell the data.
              </p>

              {/* Search Section */}
              <div className="relative mb-6">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                  size={20}
                />
                <input
                  type="text"
                  placeholder="Search..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Filter Buttons */}
              <div className="flex flex-wrap gap-2 mb-6">
                <button
                  className={`rounded-full px-4 py-2 text-sm flex items-center gap-2 transition-colors ${
                    activeTab === "all"
                      ? "bg-blue-500 text-white"
                      : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                  }`}
                  onClick={() => setActiveTab("all")}
                >
                  <FileStack size={16} />
                  All
                </button>
                <button
                  className={`rounded-full px-4 py-2 text-sm flex items-center gap-2 transition-colors ${
                    activeTab === "GeneticData"
                      ? "bg-purple-500 text-white"
                      : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                  }`}
                  onClick={() => setActiveTab("GeneticData")}
                >
                  <Dna size={16} />
                  Genetic Data
                </button>
                <button
                  className={`rounded-full px-4 py-2 text-sm flex items-center gap-2 transition-colors ${
                    activeTab === "MedicalImageData"
                      ? "bg-blue-500 text-white"
                      : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                  }`}
                  onClick={() => setActiveTab("MedicalImageData")}
                >
                  <ImageIcon size={16} />
                  Medical Image Data
                </button>
                <button
                  className={`rounded-full px-4 py-2 text-sm flex items-center gap-2 transition-colors ${
                    activeTab === "MedicalStatData"
                      ? "bg-green-500 text-white"
                      : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                  }`}
                  onClick={() => setActiveTab("MedicalStatData")}
                >
                  <BarChart2 size={16} />
                  Medical Statistics Data
                </button>
                <button
                  className={`rounded-full px-4 py-2 text-sm flex items-center gap-2 transition-colors ${
                    activeTab === "Reports"
                      ? "bg-pink-500 text-white"
                      : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                  }`}
                  onClick={() => setActiveTab("Reports")}
                >
                  <FileText size={16} />
                  Reports
                </button>
                <button
                  className={`rounded-full px-4 py-2 text-sm flex items-center gap-2 transition-colors ${
                    activeTab === "TrainingModels"
                      ? "bg-cyan-500 text-white"
                      : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                  }`}
                  onClick={() => setActiveTab("TrainingModels")}
                >
                  <Brain size={16} />
                  Training Models
                </button>
              </div>

              {/* Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredRecords.map((record) => (
                  <Card
                    key={record.assetID}
                    className="relative bg-gray-900 border border-gray-800 rounded-lg overflow-hidden"
                  >
                    <div className="p-4">
                      <div className="flex flex-col items-center">
                        <div className="text-blue-500 mb-4 flex justify-center">
                          {getIconByCategory(record.metadata.category)}
                        </div>
                        <h3 className="text-white font-medium mb-2 line-clamp-1 text-center">
                          {record.title}
                        </h3>
                        <div className="mt-auto space-y-3 w-full">
                          <div className="flex flex-wrap justify-center gap-2 text-xs">
                            <span className="bg-gray-800 text-gray-300 px-2 py-1 rounded-full">
                              {record.date}
                            </span>
                            <span className="bg-gray-800 text-blue-400 px-2 py-1 rounded-full">
                              {record.metadata.format}
                            </span>
                          </div>
                          <button
                            onClick={() => {
                              console.log(
                                "Setting expandedCard to:",
                                record.assetID
                              );
                              setExpandedCard(record.assetID);
                            }}
                            className="w-full bg-blue-500 hover:bg-blue-600 text-white py-2 rounded-lg transition-colors text-sm"
                          >
                            More Details
                          </button>
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>

              {/* Details Modal */}
              <Dialog
                open={expandedCard !== null}
                onOpenChange={() => {
                  console.log(
                    "Closing dialog, expandedCard was:",
                    expandedCard
                  );
                  setExpandedCard(null);
                }}
              >
                <DialogContent className="bg-gray-900 text-white border border-gray-800 w-[90vw] max-w-[600px] max-h-[85vh] overflow-y-auto">
                  {expandedCard &&
                    (() => {
                      const record = records.find(
                        (r) => r.assetID === expandedCard
                      );
                      console.log("Found record:", record);

                      if (!record) return null;

                      return (
                        <div className="relative">
                          <DialogHeader className="pb-4 space-y-1.5">
                            <DialogTitle className="text-xl font-semibold text-white">
                              {record.title}
                            </DialogTitle>
                          </DialogHeader>

                          <div className="grid gap-6">
                            <div className="flex items-center justify-center p-4">
                              {getIconByCategory(record.metadata.category)}
                            </div>

                            <div className="space-y-6">
                              <div>
                                <h4 className="text-gray-400 mb-2.5 font-medium">
                                  Description
                                </h4>
                                <p className="text-white text-sm leading-relaxed">
                                  {record.metadata.description}
                                </p>
                              </div>

                              <div>
                                <h4 className="text-gray-400 mb-2.5 font-medium">
                                  Keywords
                                </h4>
                                <div className="flex flex-wrap gap-2">
                                  {record.metadata.tags.map((tag, index) => (
                                    <span
                                      key={index}
                                      className="bg-gray-800 text-blue-400 px-3 py-1 rounded-full text-xs"
                                    >
                                      {tag}
                                    </span>
                                  ))}
                                </div>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                                <DownloadFile
                                  dataAssetShardPrincipal={
                                    record.dataAssetShardPrincipal
                                  }
                                  dataStorageShardPrincipal={
                                    record.dataStorageShardPrincipal
                                  }
                                  uniqueID={record.assetID}
                                  title={record.title}
                                  format={record.metadata.format}
                                  accessLevel="owned"
                                  className="w-full bg-green-500 hover:bg-green-600 text-white py-2.5 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm font-medium"
                                />

                                <EditFile
                                  data={record.dataStorageShardPrincipal}
                                  uniqueID={record.assetID}
                                  title={record.title}
                                  format={record.metadata.format}
                                />

                                <ShareDataFunc
                                  assetID={record.assetID}
                                  className="w-full bg-blue-500 hover:bg-blue-600 text-white py-2.5 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm font-medium"
                                />

                                <Button
                                  onClick={() => handleDelete(record.assetID)}
                                  className="w-full bg-red-500 hover:bg-red-600 text-white py-2.5 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm font-medium"
                                >
                                  <Trash2 size={16} />
                                  Delete
                                </Button>

                                <Button
                                  onClick={() =>
                                    generateAISummary(record.assetID)
                                  }
                                  disabled={isGeneratingSummary}
                                  className="w-full bg-indigo-500 hover:bg-indigo-600 text-white py-2.5 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm font-medium"
                                >
                                  {isGeneratingSummary
                                    ? "Analyzing..."
                                    : "AI Summary"}
                                </Button>

                                <Button
                                  onClick={generateAllPDFsSummary}
                                  disabled={isGeneratingSummary}
                                  className="w-full bg-orange-500 hover:bg-orange-600 text-white py-2.5 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm font-medium col-span-full"
                                >
                                  {isGeneratingSummary
                                    ? "Analyzing All PDFs..."
                                    : "Summarize All PDFs"}
                                </Button>
                              </div>
                            </div>
                          </div>

                          {aiSummary && (
                            <div className="mt-4">
                              <h4 className="text-gray-400 mb-2.5 font-medium">
                                AI Summary
                              </h4>
                              <div className="bg-gray-800 p-4 rounded-lg">
                                <pre className="whitespace-pre-wrap text-sm text-white">
                                  {aiSummary}
                                </pre>
                                <Button
                                  onClick={downloadAISummary}
                                  className="mt-4 w-full bg-green-500 hover:bg-green-600 text-white py-2.5 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm font-medium"
                                >
                                  <Download size={16} />
                                  Download Summary
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
