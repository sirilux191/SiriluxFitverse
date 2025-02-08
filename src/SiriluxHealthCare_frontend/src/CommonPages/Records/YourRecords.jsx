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
  X,
  DollarSign,
} from "lucide-react";

import LoadingScreen from "@/LoadingScreen"; // Import LoadingScreen
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SellDataFunc } from "@/Functions/SellData";
import { ShareDataFunc } from "@/Functions/ShareData";
import DownloadFile from "@/Functions/DownloadFile";
import { Button } from "@/components/ui/button";
import OpenAI from "openai";

import useActorStore from "@/State/Actors/ActorStore";

// Initialize OpenAI client (make sure to add VITE_OPENAI_API_KEY to your .env)
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  dangerouslyAllowBrowser: true,
});

export default function YourRecords() {
  const [activeTab, setActiveTab] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [records, setRecords] = useState([]);
  const { actors } = useActorStore();
  const [loading, setLoading] = useState(true);
  const [expandedCard, setExpandedCard] = useState(null);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [aiSummary, setAiSummary] = useState("");

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
        const result = await actors.dataAsset.getUserDataAssets();
        if (result.ok) {
          const dataAssets = result.ok.map(([timestamp, asset]) => ({
            id: asset.assetID,
            timestamp: timestamp,
            category: asset.metadata.category,
            title: asset.title,
            description: asset.description,
            date: new Date(timestamp / 1000000).toISOString().split("T")[0],
            format: asset.metadata.format,
            data: asset.data,
            metadata: asset.metadata,
            icon: getIconByCategory(asset.metadata.category),
          }));
          setRecords(dataAssets);
          console.log("Fetched data assets:", dataAssets);
          setLoading(false);
        } else {
          console.error("Error fetching user data assets:", result.err);
          setLoading(false);
        }
      } catch (error) {
        console.error("Error fetching user data assets:", error);
        setLoading(false);
      }
    };

    fetchUserDataAssets();
  }, [actors]);

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

  // Update the generateAISummary function
  const generateAISummary = async (fileName, recordId) => {};

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
                    key={record.id}
                    className="relative bg-gray-900 border border-gray-800 rounded-lg overflow-hidden"
                  >
                    <div className="p-4">
                      <div className="flex flex-col items-center">
                        <div className="text-blue-500 mb-4 flex justify-center">
                          {getIconByCategory(record.category)}
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
                              {record.format}
                            </span>
                          </div>
                          <button
                            onClick={() => setExpandedCard(record.id)}
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
                onOpenChange={() => setExpandedCard(null)}
              >
                <DialogContent className="bg-gray-900 text-white border border-gray-800 w-[90vw] max-w-[600px] max-h-[85vh] overflow-y-auto">
                  <div className="relative">
                    <DialogHeader className="pb-4 space-y-1.5">
                      <DialogTitle className="text-xl font-semibold text-white">
                        {records.find((r) => r.id === expandedCard)?.title}
                      </DialogTitle>
                    </DialogHeader>

                    <div className="grid gap-6">
                      <div className="flex items-center justify-center p-4">
                        {records.find((r) => r.id === expandedCard)?.icon}
                      </div>

                      <div className="space-y-6">
                        <div>
                          <h4 className="text-gray-400 mb-2.5 font-medium">
                            Description
                          </h4>
                          <p className="text-white text-sm leading-relaxed">
                            {
                              records.find((r) => r.id === expandedCard)
                                ?.description
                            }
                          </p>
                        </div>

                        <div>
                          <h4 className="text-gray-400 mb-2.5 font-medium">
                            Keywords
                          </h4>
                          <div className="flex flex-wrap gap-2">
                            {records
                              .find((r) => r.id === expandedCard)
                              ?.metadata?.tags.map((tag, index) => (
                                <span
                                  key={index}
                                  className="bg-gray-800 text-blue-400 px-3 py-1 rounded-full text-xs"
                                >
                                  {tag}
                                </span>
                              ))}
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <span className="bg-gray-800 text-gray-300 px-3 py-1 rounded-full text-xs">
                            {records.find((r) => r.id === expandedCard)?.date}
                          </span>
                          <span className="bg-gray-800 text-blue-400 px-3 py-1 rounded-full text-xs">
                            {records.find((r) => r.id === expandedCard)?.format}
                          </span>
                          <span className="bg-gray-800 text-purple-400 px-3 py-1 rounded-full text-xs">
                            {
                              records.find((r) => r.id === expandedCard)
                                ?.category
                            }
                          </span>
                        </div>

                        <div>
                          <h4 className="text-gray-400 mb-2.5 font-medium">
                            AI Medical Summary
                          </h4>
                          {errorMessage && (
                            <p className="text-red-400 text-sm mb-2">
                              {errorMessage}
                            </p>
                          )}
                          {aiSummary ? (
                            <div className="text-white text-sm whitespace-pre-wrap prose prose-invert">
                              {aiSummary.split("\n").map((line, i) => (
                                <p
                                  key={i}
                                  className="m-0"
                                >
                                  {line}
                                </p>
                              ))}
                            </div>
                          ) : (
                            <p className="text-gray-400 text-sm">
                              {isGeneratingSummary
                                ? "Analyzing with AI..."
                                : "Click 'AI Summary' to generate"}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                        {expandedCard && (
                          <>
                            <DownloadFile
                              data={
                                records.find((r) => r.id === expandedCard)?.data
                              }
                              uniqueID={
                                records.find((r) => r.id === expandedCard)?.id
                              }
                              title={
                                records.find((r) => r.id === expandedCard)
                                  ?.title
                              }
                              format={
                                records.find((r) => r.id === expandedCard)
                                  ?.format
                              }
                              className="w-full bg-green-500 hover:bg-green-600 text-white py-2.5 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm font-medium"
                            />

                            <ShareDataFunc
                              assetID={
                                records.find((r) => r.id === expandedCard)?.id
                              }
                              className="w-full bg-blue-500 hover:bg-blue-600 text-white py-2.5 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm font-medium"
                            />

                            <Button
                              onClick={() => {
                                const record = records.find(
                                  (r) => r.id === expandedCard
                                );
                                if (record) {
                                  SellDataFunc({ assetID: record.timestamp });
                                }
                              }}
                              className="w-full bg-purple-500 hover:bg-purple-600 text-white py-2.5 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm font-medium"
                            >
                              <DollarSign size={16} />
                              Sell
                            </Button>

                            <Button
                              onClick={() => {
                                const record = records.find(
                                  (r) => r.id === expandedCard
                                );
                                if (record) {
                                  generateAISummary(record.title, record.id);
                                }
                              }}
                              disabled={isGeneratingSummary}
                              className="w-full bg-indigo-500 hover:bg-indigo-600 text-white py-2.5 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm font-medium"
                            >
                              {isGeneratingSummary
                                ? "Analyzing..."
                                : "AI Summary"}
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
