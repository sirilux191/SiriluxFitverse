"use client";

import React, { useEffect, useState, useContext } from "react";
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
  Download,
} from "lucide-react";
import ActorContext from "../../ActorContext";
import LoadingScreen from "../../LoadingScreen";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import DownloadFile from "../../Functions/DownloadFile";

export function DataReceivedTable() {
  const [activeTab, setActiveTab] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [records, setRecords] = useState([]);
  const { actors } = useContext(ActorContext);
  const [loading, setLoading] = useState(true);
  const [expandedCard, setExpandedCard] = useState(null);

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
          <div className={`${iconStyles} bg-purple-500/20`}>
            <Dna
              size={iconSize}
              className="text-purple-500"
            />
          </div>
        );
      case "MedicalImageData":
        return (
          <div className={`${iconStyles} bg-blue-500/20`}>
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
        const result = await actors.dataAsset.getReceivedDataAssets();
        if (result.ok) {
          const dataAssets = result.ok.map(([activityInfo, asset]) => ({
            id: asset.assetID,
            activityID: activityInfo.activityID,
            title: asset.title,
            description: asset.description || "No description available",
            date: new Date(
              Number(activityInfo.time) / 1000000
            ).toLocaleString(),
            format: asset.metadata.format,
            category: asset.metadata.category,
            data: asset.data,
            metadata: asset.metadata,
          }));
          console.log("Fetched data assets:", dataAssets);
          setRecords(dataAssets);
          setLoading(false);
        } else {
          console.error("Error fetching received data assets:", result.err);
          setLoading(false);
        }
      } catch (error) {
        console.error("Error fetching received data assets:", error);
        setLoading(false);
      }
    };

    fetchUserDataAssets();
  }, [actors]);

  const filteredRecords = records.filter((record) => {
    const matchesSearch = record.title
      .toLowerCase()
      .includes(searchTerm.toLowerCase());
    const matchesCategory =
      activeTab === "all" || record.category === activeTab;
    return matchesSearch && matchesCategory;
  });

  // Add category filters array
  const categoryFilters = [
    { id: "all", label: "All Records", icon: FileText },
    { id: "Bills", label: "Bills", icon: FileText },
    { id: "GeneticData", label: "Genetic Data", icon: Dna },
    { id: "MedicalImageData", label: "Medical Images", icon: ImageIcon },
    { id: "MedicalStatData", label: "Medical Statistics", icon: BarChart2 },
    { id: "Reports", label: "Reports", icon: FileStack },
    { id: "TrainingModels", label: "Training Models", icon: Brain },
  ];

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <div className="max-w-[1600px] mx-auto p-4 sm:p-6 lg:p-8">
      {/* Title Section */}
      <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">
        Received Health Records
      </h1>
      <p className="text-gray-400 mb-6">
        View and manage your received health records.
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
      <div className="flex flex-wrap gap-2 mb-6 overflow-x-auto pb-2">
        {categoryFilters.map((filter) => {
          const Icon = filter.icon;
          return (
            <button
              key={filter.id}
              className={`rounded-full px-4 py-2 text-sm flex items-center gap-2 transition-colors whitespace-nowrap ${
                activeTab === filter.id
                  ? filter.id === "Bills"
                    ? "bg-orange-500 text-white"
                    : filter.id === "GeneticData"
                      ? "bg-purple-500 text-white"
                      : filter.id === "MedicalImageData"
                        ? "bg-blue-500 text-white"
                        : filter.id === "MedicalStatData"
                          ? "bg-green-500 text-white"
                          : filter.id === "Reports"
                            ? "bg-pink-500 text-white"
                            : filter.id === "TrainingModels"
                              ? "bg-cyan-500 text-white"
                              : "bg-blue-500 text-white"
                  : "bg-gray-700 text-gray-300 hover:bg-gray-600"
              }`}
              onClick={() => setActiveTab(filter.id)}
            >
              <Icon size={16} />
              {filter.label}
            </button>
          );
        })}
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
                {records.find((r) => r.id === expandedCard)?.category &&
                  getIconByCategory(
                    records.find((r) => r.id === expandedCard)?.category
                  )}
              </div>

              <div className="space-y-6">
                <div>
                  <h4 className="text-gray-400 mb-2.5 font-medium">
                    Description
                  </h4>
                  <p className="text-white text-sm leading-relaxed">
                    {records.find((r) => r.id === expandedCard)?.description}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <span className="bg-gray-800 text-gray-300 px-3 py-1 rounded-full text-xs">
                    {records.find((r) => r.id === expandedCard)?.date}
                  </span>
                  <span className="bg-gray-800 text-blue-400 px-3 py-1 rounded-full text-xs">
                    {records.find((r) => r.id === expandedCard)?.format}
                  </span>
                  <span className="bg-gray-800 text-purple-400 px-3 py-1 rounded-full text-xs">
                    {records.find((r) => r.id === expandedCard)?.category}
                  </span>
                </div>
              </div>

              <div className="pt-2">
                {expandedCard && (
                  <DownloadFile
                    data={records.find((r) => r.id === expandedCard)?.data}
                    uniqueID={records.find((r) => r.id === expandedCard)?.id}
                    title={records.find((r) => r.id === expandedCard)?.title}
                    format={records.find((r) => r.id === expandedCard)?.format}
                    className="w-full bg-green-500 hover:bg-green-600 text-white py-2.5 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm font-medium"
                  />
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
