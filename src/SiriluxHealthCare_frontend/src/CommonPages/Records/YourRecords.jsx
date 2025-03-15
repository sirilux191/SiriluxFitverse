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
} from "lucide-react";

import LoadingScreen from "@/LoadingScreen";
import useWalletStore from "@/State/CryptoAssets/WalletStore";

import useActorStore from "@/State/Actors/ActorStore";
import { Principal } from "@dfinity/principal";
import { useUserProfileStore } from "@/State/User/UserProfile/UserProfileStore";
import { jsPDF } from "jspdf";
import { useToast } from "@/components/ui/use-toast";
import AssetDetailsDialog from "./AssetDetailsDialog";

export default function YourRecords() {
  const [activeTab, setActiveTab] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [records, setRecords] = useState([]);
  const {
    dataAsset,
    subscriptionManager,
    identityManager,
    createDataAssetShardActorExternal,
  } = useActorStore();
  const userProfile = useUserProfileStore((state) => state.userProfile);
  const approveSpender = useWalletStore((state) => state.approveSpender);

  const [loading, setLoading] = useState(true);
  const [expandedCard, setExpandedCard] = useState(null);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [aiSummary, setAiSummary] = useState("");
  const { toast } = useToast();
  const [sortBy, setSortBy] = useState("newest");

  // Reset AI summary when changing the expanded card
  useEffect(() => {
    if (expandedCard === null) {
      setAiSummary("");
    }
  }, [expandedCard]);

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
        let userIDResult = await identityManager.getIdentity([]);
        if (!userIDResult.ok) {
          throw new Error("Failed to get user ID");
        }
        const userID = userIDResult.ok[0];
        // Get shared activity shard principals for this user

        const shardPrincipalsResult =
          await dataAsset.getUserAssetShardsPrincipal(userID);

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
  }, [
    dataAsset,
    identityManager,
    userProfile,
    createDataAssetShardActorExternal,
  ]);

  const filteredRecords = useMemo(() => {
    let filtered = records;

    // Filter by category
    if (activeTab !== "all") {
      filtered = filtered.filter(
        (record) => record.metadata.category === activeTab
      );
    }

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(
        (record) =>
          record.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          record.description.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Sort records
    if (sortBy === "newest") {
      filtered = [...filtered].sort((a, b) => b.timestamp - a.timestamp);
    } else if (sortBy === "oldest") {
      filtered = [...filtered].sort((a, b) => a.timestamp - b.timestamp);
    } else if (sortBy === "titleAsc") {
      filtered = [...filtered].sort((a, b) => a.title.localeCompare(b.title));
    } else if (sortBy === "titleDesc") {
      filtered = [...filtered].sort((a, b) => b.title.localeCompare(a.title));
    }

    return filtered;
  }, [activeTab, searchTerm, records, sortBy]);

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

      setAiSummary(""); // Reset any previous summary

      const file = await getFileFromIndexedDB(recordId);
      console.log("Retrieved file:", file);

      if (!file) {
        toast({
          title: "Error",
          description:
            "Please download the file first before generating summary",
          variant: "destructive",
        });
        throw new Error(
          "Please download the file first before generating summary"
        );
      }

      // Get file type from stored metadata
      const record = records.find((r) => r.assetID === recordId);
      const fileType = record.metadata.format.toLowerCase();

      // Validate supported MIME types
      const supportedTypes = [
        "application/pdf",
        "image/jpeg",
        "image/jpg",
        "image/png",
        "image/gif",
      ];

      if (!supportedTypes.includes(fileType)) {
        throw new Error("Unsupported file format for AI summary");
      }

      const remainingRequests =
        await subscriptionManager.getRemainingTokenRequest([]);
      if (5 - Number(remainingRequests.ok) <= 0) {
        // First approve the Data Asset canister as spender
        const dataAssetPrincipal = Principal.fromText(
          process.env.CANISTER_ID_SUBSCRIPTION_MANAGER
        );

        await approveSpender({
          spender: { owner: dataAssetPrincipal, subaccount: [] },
          amount: 1,
          memo: "Generating AI Summary",
        });
      }

      // Get authentication token
      const tokenResult =
        await subscriptionManager.generateCloudFunctionToken();
      if (!tokenResult.ok) {
        throw new Error(
          "Failed to get authentication token: " + tokenResult.err
        );
      }
      console.log("Token:", tokenResult.ok);
      // Get user principal
      const principal = await identityManager.whoami();
      const principalText = principal.toString();

      // Create the correct file object to send
      const base64Data = file.data;

      // Call the cloud function with file data and type
      const response = await fetch(
        "https://test-677477691026.asia-south1.run.app/generateAISummary",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${tokenResult.ok}`,
            "X-User-Principal": principalText,
          },
          body: JSON.stringify({
            fileData: base64Data,
            fileType: fileType,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to generate summary");
      }

      const result = await response.json();
      setAiSummary(result.summary);
    } catch (error) {
      console.error("Error generating summary:", error);
      setAiSummary(""); // Clear any partial summary on error
      toast({
        title: "Error",
        description: error.message || "Failed to generate summary",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  // Updated function to download a beautifully formatted AI Summary
  const downloadAISummary = () => {
    try {
      console.log("Starting AI Summary download");
      if (!aiSummary) {
        console.warn("No AI Summary available to download");
        return;
      }

      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 20;
      const textWidth = pageWidth - 2 * margin;

      let y = 20; // Starting Y position
      const lineHeight = 7;

      // Parse and format the summary content
      const lines = aiSummary.split("\n");

      for (let line of lines) {
        // Handle headings
        if (line.startsWith("# ")) {
          doc.setFontSize(18);
          doc.setFont("helvetica", "bold");
          const text = line.substring(2);
          doc.text(text, margin, y);
          y += lineHeight * 1.5;
          doc.setFont("helvetica", "normal");
          doc.setFontSize(12);
          continue;
        }

        if (line.startsWith("## ")) {
          doc.setFontSize(16);
          doc.setFont("helvetica", "bold");
          const text = line.substring(3);
          doc.text(text, margin, y);
          y += lineHeight * 1.3;
          doc.setFont("helvetica", "normal");
          doc.setFontSize(12);
          continue;
        }

        if (line.startsWith("### ")) {
          doc.setFontSize(14);
          doc.setFont("helvetica", "bold");
          const text = line.substring(4);
          doc.text(text, margin, y);
          y += lineHeight * 1.2;
          doc.setFont("helvetica", "normal");
          doc.setFontSize(12);
          continue;
        }

        // Handle bullet points and numbered lists
        if (line.match(/^\d+\.\s/)) {
          const number = line.split(".")[0];
          const text = line.substring(number.length + 2);
          const wrappedText = doc.splitTextToSize(text, textWidth - 10);
          doc.text(number + ".", margin, y);
          doc.text(wrappedText, margin + 10, y);
          y += lineHeight * wrappedText.length;
          continue;
        }

        if (line.match(/^\s*-\s/) || line.match(/^\s*\*\s/)) {
          const indentLevel = line.search(/[^\s]/) / 2;
          const bulletIndent = margin + indentLevel * 5;
          const text = line.trim().substring(2);
          const wrappedText = doc.splitTextToSize(
            text,
            textWidth - bulletIndent - 5
          );

          doc.circle(bulletIndent, y - 1.5, 1, "F");
          doc.text(wrappedText, bulletIndent + 5, y);
          y += lineHeight * wrappedText.length;
          continue;
        }

        // Handle bold text
        if (line.includes("**")) {
          const parts = line.split("**");
          let xPos = margin;

          for (let i = 0; i < parts.length; i++) {
            if (parts[i].trim() === "") continue;

            if (i % 2 === 0) {
              doc.setFont("helvetica", "normal");
              const wrappedText = doc.splitTextToSize(parts[i], textWidth);
              doc.text(wrappedText, xPos, y);
              xPos += doc.getTextWidth(parts[i]);
            } else {
              doc.setFont("helvetica", "bold");
              const wrappedText = doc.splitTextToSize(parts[i], textWidth);
              doc.text(wrappedText, xPos, y);
              xPos += doc.getTextWidth(parts[i]);
              doc.setFont("helvetica", "normal");
            }
          }
          y += lineHeight;
          continue;
        }

        // Handle regular text
        if (line.trim() !== "") {
          const wrappedText = doc.splitTextToSize(line, textWidth);
          doc.text(wrappedText, margin, y);
          y += lineHeight * wrappedText.length;
        } else {
          // Empty line - add some spacing
          y += lineHeight / 2;
        }

        // Check if we need a new page
        if (y > doc.internal.pageSize.getHeight() - margin) {
          doc.addPage();
          y = margin;
        }
      }

      // Add metadata
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text(
        `Generated on: ${new Date().toLocaleString()}`,
        margin,
        doc.internal.pageSize.getHeight() - 10
      );

      // Save the PDF
      doc.save("medical-ai-summary.pdf");
      console.log("AI Summary PDF downloaded successfully");
    } catch (error) {
      console.error("Error downloading AI Summary:", error);
      toast({
        title: "Error",
        description: "Failed to download AI Summary",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (assetID) => {
    try {
      toast({
        title: "Deleting record...",
        description: "Please wait while we delete your record.",
      });

      const result = await dataAsset.deleteDataAsset(assetID);

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

  // Modify the setExpandedCard call to also reset the AI summary
  const handleCardClick = (assetID) => {
    setExpandedCard(assetID);
    setAiSummary(""); // Reset AI summary when opening a new card
  };

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <div>
      <div className="max-w-6xl mx-auto py-4 sm:py-12 px-2 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center justify-center p-2 sm:p-8">
          <div className="mt-2 sm:mt-4 w-full">
            <div className="max-w-6xl mx-auto p-2 sm:p-6 lg:p-8">
              {/* Title Section */}
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-1 sm:mb-2">
                Your Health Records
              </h1>
              <p className="text-muted-foreground mb-3 sm:mb-6">
                Choose the documents below to share or analyze.
              </p>

              {/* Search Section */}
              <div className="relative mb-3 sm:mb-6">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  size={20}
                />
                <input
                  type="text"
                  placeholder="Search..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded-full bg-background border border-input focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {/* Filter Buttons */}
              <div className="flex flex-wrap gap-1 sm:gap-2 mb-3 sm:mb-6">
                <button
                  className={`rounded-full px-4 py-2 text-sm flex items-center gap-2 transition-colors ${
                    activeTab === "all"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-accent"
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

              {/* Sorting Dropdown */}
              <div className="flex justify-end mb-4">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="bg-muted text-muted-foreground border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="newest">Newest First</option>
                  <option value="oldest">Oldest First</option>
                  <option value="titleAsc">Title (A-Z)</option>
                  <option value="titleDesc">Title (Z-A)</option>
                </select>
              </div>

              {/* Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-6">
                {filteredRecords.length === 0 ? (
                  <div className="col-span-full text-center py-10">
                    <p className="text-gray-400 mb-2">No records found</p>
                    <p className="text-sm text-gray-500">
                      Try adjusting your filters or search terms
                    </p>
                  </div>
                ) : (
                  filteredRecords.map((record) => (
                    <Card
                      key={record.assetID}
                      className="overflow-hidden transition-all duration-200 border border-border bg-card hover:bg-accent/30 hover:shadow-lg hover:shadow-primary/20 hover:-translate-y-1"
                    >
                      <div className="p-4 sm:p-5 flex flex-col h-full">
                        <div className="flex flex-col items-center flex-grow">
                          <div className="mb-3 transform transition-transform hover:scale-110">
                            {getIconByCategory(record.metadata.category)}
                          </div>
                          <h3 className="text-card-foreground font-medium mb-3 line-clamp-2 text-center break-all hover:text-primary transition-colors">
                            {record.title}
                          </h3>
                          <div className="mt-auto w-full space-y-3">
                            <div className="flex flex-wrap justify-center gap-2 text-xs">
                              <span className="bg-muted text-muted-foreground px-2.5 py-1 rounded-full">
                                {record.date}
                              </span>
                              <span className="bg-muted text-primary px-2.5 py-1 rounded-full">
                                {record.metadata.format}
                              </span>
                            </div>
                            <button
                              onClick={() => handleCardClick(record.assetID)}
                              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground py-2.5 rounded-lg transition-all duration-300 text-sm font-medium shadow-md hover:shadow-primary/30"
                            >
                              More Details
                            </button>
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))
                )}
              </div>

              {/* Details Modal */}
              {expandedCard && (
                <AssetDetailsDialog
                  isOpen={expandedCard !== null}
                  onClose={() => setExpandedCard(null)}
                  record={records.find((r) => r.assetID === expandedCard)}
                  getIconByCategory={getIconByCategory}
                  handleDelete={handleDelete}
                  generateAISummary={generateAISummary}
                  isGeneratingSummary={isGeneratingSummary}
                  aiSummary={aiSummary}
                  downloadAISummary={downloadAISummary}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
