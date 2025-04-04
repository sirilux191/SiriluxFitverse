"use client";

import React, { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import {
  FileText,
  Dna,
  ImageIcon,
  BarChart2,
  FileStack,
  Brain,
} from "lucide-react";

import LoadingScreen from "@/LoadingScreen";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import DownloadFile from "@/Functions/DownloadFile";
import useActorStore from "@/State/Actors/ActorStore";

export default function SharedWithYou() {
  const [activities, setActivities] = useState([]);
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingAsset, setLoadingAsset] = useState(false);
  const {
    dataAsset,
    identityManager,
    createSharedActivityShardActorExternal,
    createDataAssetShardActorExternal,
  } = useActorStore();

  // Fetch activities on mount
  useEffect(() => {
    const fetchActivities = async () => {
      try {
        let userIDResult = await identityManager.getIdentity([]);
        if (!userIDResult.ok) {
          throw new Error("Failed to get user ID");
        }
        const userID = userIDResult.ok[0];
        // Get shared activity shard principals for this user
        const shardPrincipalsResult =
          await dataAsset.getUserSharedActivityShardsPrincipal(userID);
        if (!shardPrincipalsResult.ok) {
          throw new Error("Failed to get shard principals");
        }

        const allActivities = [];
        for (const shardPrincipal of shardPrincipalsResult.ok) {
          const shardActor = await createSharedActivityShardActorExternal(
            shardPrincipal.toText()
          );

          const shardActivitiesResult =
            await shardActor.getUserReceivedActivities();

          if (shardActivitiesResult.ok) {
            allActivities.push(...shardActivitiesResult.ok);
          }
        }

        // Process and set activities
        const processedActivities = allActivities.map((activity) => ({
          activityID: activity.activityID,
          assetID: activity.assetID,
          date: new Date(Number(activity.sharedAt) / 1000000).toLocaleString(),
          sharedTill: new Date(
            Number(activity.sharedTill) / 1000000
          ).toLocaleString(),
          sharedBy: activity.usedSharedBy,
          sharedTo: activity.usedSharedTo,
          assetShardPrincipal: activity.assetShardPrincipal,
          activityShardPrincipal: activity.activityShardPrincipal,
        }));
        console.log(processedActivities);
        setActivities(processedActivities);
      } catch (error) {
        console.error("Error fetching activities:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchActivities();
  }, [dataAsset]);

  // Fetch asset details when clicking "More Details"
  const handleShowDetails = async (activity) => {
    setSelectedActivity(activity);
    setLoadingAsset(true);
    setSelectedAsset(null); // Reset selected asset

    try {
      const assetShardActor = await createDataAssetShardActorExternal(
        activity.assetShardPrincipal
      );
      const assetResult = await assetShardActor.getDataAsset(activity.assetID);
      console.log(assetResult);
      if (assetResult.ok) {
        setSelectedAsset({
          assetID: activity.assetID,
          title: assetResult.ok.title,
          description:
            assetResult.ok.metadata.description || "No description available",
          metadata: assetResult.ok.metadata,
          dataAssetShardPrincipal: assetResult.ok.dataAssetShardPrincipal,
          dataStorageShardPrincipal: assetResult.ok.dataStorageShardPrincipal,
          error: null,
        });
      } else {
        setSelectedAsset({
          assetID: activity.assetID,
          error: assetResult.err,
        });
      }
    } catch (error) {
      console.error("Error fetching asset:", error);
      setSelectedAsset({
        assetID: activity.assetID,
        error: "Failed to fetch asset details",
      });
    } finally {
      setLoadingAsset(false);
    }
  };

  const getIconByCategory = (category) => {
    const iconSize = 48;
    const iconStyles = "p-3 rounded-xl";

    const iconMap = {
      Bills: {
        icon: FileText,
        bg: "bg-orange-100 dark:bg-orange-900/30",
        color: "text-orange-500",
      },
      GeneticData: {
        icon: Dna,
        bg: "bg-purple-500/20",
        color: "text-purple-500",
      },
      MedicalImageData: {
        icon: ImageIcon,
        bg: "bg-green-500/20",
        color: "text-green-500",
      },
      MedicalStatData: {
        icon: BarChart2,
        bg: "bg-green-100 dark:bg-green-900/30",
        color: "text-green-500",
      },
      Reports: {
        icon: FileStack,
        bg: "bg-pink-100 dark:bg-pink-900/30",
        color: "text-pink-500",
      },
      TrainingModels: {
        icon: Brain,
        bg: "bg-cyan-100 dark:bg-cyan-900/30",
        color: "text-cyan-500",
      },
    };

    const {
      icon: Icon,
      bg,
      color,
    } = iconMap[category] || {
      icon: FileText,
      bg: "bg-gray-100 dark:bg-gray-900/30",
      color: "text-gray-500",
    };

    return (
      <div className={`${iconStyles} ${bg}`}>
        <Icon
          size={iconSize}
          className={color}
        />
      </div>
    );
  };
  if (loading) return <LoadingScreen />;

  return (
    <div>
      <div className="max-w-4xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <div className="mt-4 w-full max-w-2xl">
          <div className="max-w-[1800px] mx-auto px-4 sm:px-8 lg:px-12 py-8">
            {/* Title Section */}
            <div className="mb-8">
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-100 mb-3">
                Received Health Records
              </h1>
              <p className="text-gray-400">
                View and manage your received health records
              </p>
            </div>

            {/* Activities Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {activities.map((activity) => (
                <Card
                  key={activity.activityID}
                  className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden hover:border-gray-700 transition-colors"
                >
                  <div className="p-6 flex flex-col h-full">
                    <div className="mb-6 flex justify-center">
                      {getIconByCategory("FileText")}{" "}
                      {/* Default icon until asset details are loaded */}
                    </div>

                    <div className="flex flex-col flex-grow">
                      <h3 className="text-gray-100 font-medium mb-3 text-center">
                        Activity ID: {activity.activityID}
                      </h3>

                      <div className="mt-auto space-y-4">
                        <div className="flex flex-col items-center gap-2">
                          <span className="bg-gray-800 text-gray-300 px-3 py-1 rounded-full text-sm">
                            Shared: {activity.date}
                          </span>
                          <span
                            className={`bg-gray-800 px-3 py-1 rounded-full text-sm ${
                              new Date(activity.sharedTill) < new Date()
                                ? "text-red-400"
                                : "text-orange-400"
                            }`}
                          >
                            Access Till: {activity.sharedTill}
                          </span>
                        </div>

                        <button
                          onClick={() => handleShowDetails(activity)}
                          className="w-full bg-blue-600/30 hover:bg-blue-600/40 text-blue-400 py-2.5 rounded-lg transition-colors text-sm font-medium"
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
              open={selectedActivity !== null}
              onOpenChange={() => setSelectedActivity(null)}
            >
              <DialogContent className="bg-gray-900 text-white border border-gray-800 w-[95vw] max-w-[800px] p-6 overflow-hidden">
                {loadingAsset ? (
                  <div className="text-center py-8">
                    Loading asset details...
                  </div>
                ) : selectedAsset?.error ? (
                  <div className="space-y-6">
                    <DialogHeader>
                      <DialogTitle className="text-xl font-semibold">
                        Error Loading Asset
                      </DialogTitle>
                    </DialogHeader>
                    <div className="p-4 bg-red-900/30 border border-red-800 rounded-lg">
                      <p className="text-red-400">{selectedAsset.error}</p>
                    </div>
                  </div>
                ) : (
                  selectedAsset && (
                    <div className="space-y-6 overflow-y-auto max-h-[80vh]">
                      <DialogHeader>
                        <DialogTitle className="text-xl font-semibold break-all">
                          {selectedAsset.title}
                        </DialogTitle>
                      </DialogHeader>

                      <div className="flex justify-center">
                        {getIconByCategory(selectedAsset.metadata.category)}
                      </div>

                      <div className="space-y-4">
                        <div>
                          <h4 className="text-gray-400 mb-2">Description</h4>
                          <p className="text-sm text-gray-200 break-all whitespace-pre-wrap">
                            {selectedAsset.description}
                          </p>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <span className="bg-gray-800 text-gray-300 px-3 py-1 rounded-full text-xs break-all max-w-full">
                            Format: {selectedAsset.metadata.format}
                          </span>
                          <span className="bg-gray-800 text-purple-400 px-3 py-1 rounded-full text-xs break-all max-w-full">
                            Category: {selectedAsset.metadata.category}
                          </span>
                          <span
                            className={`bg-gray-800 px-3 py-1 rounded-full text-xs break-all max-w-full ${
                              new Date(selectedActivity?.sharedTill) <
                              new Date()
                                ? "text-red-400"
                                : "text-orange-400"
                            }`}
                          >
                            Access Till: {selectedActivity?.sharedTill}
                          </span>
                        </div>

                        <DownloadFile
                          dataAssetShardPrincipal={
                            selectedAsset?.dataAssetShardPrincipal
                          }
                          dataStorageShardPrincipal={
                            selectedAsset?.dataStorageShardPrincipal
                          }
                          uniqueID={selectedAsset?.assetID}
                          title={selectedAsset.title}
                          format={selectedAsset.metadata.format}
                          accessLevel={"shared"}
                          className="w-full bg-green-500 hover:bg-green-600 text-white py-2.5 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm font-medium"
                        />
                      </div>
                    </div>
                  )
                )}
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>
    </div>
  );
}
