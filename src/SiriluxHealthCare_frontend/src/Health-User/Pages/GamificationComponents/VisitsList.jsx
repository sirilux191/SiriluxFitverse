import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Loader2 as Loader2Icon,
  RefreshCw,
  Calendar,
  Globe,
} from "lucide-react";
import useActorStore from "../../../State/Actors/ActorStore";

const VisitsList = () => {
  const { actors } = useActorStore();
  const [isLoadingVisits, setIsLoadingVisits] = useState(false);
  const [visits, setVisits] = useState([]);

  const getStatusVariant = (status) => {
    const statusKey = Object.keys(status)[0];
    switch (statusKey) {
      case "Completed":
        return "success";
      case "Pending":
        return "warning";
      case "Cancelled":
        return "destructive";
      case "Rejected":
        return "destructive";
      case "Approved":
        return "default";
      default:
        return "secondary";
    }
  };

  const fetchVisits = async () => {
    setIsLoadingVisits(true);
    try {
      const result = await actors.gamificationSystem.getUserVisits();
      if (result.ok) {
        setVisits(result.ok);
      } else {
        console.error("Error fetching visits:", result.err);
      }
    } catch (error) {
      console.error("Error fetching visits:", error);
    } finally {
      setIsLoadingVisits(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between space-y-2 sm:space-y-0">
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-blue-500" />
          My Visits
        </CardTitle>
        <Button
          variant="outline"
          onClick={fetchVisits}
          disabled={isLoadingVisits}
          className="w-full sm:w-auto"
        >
          {isLoadingVisits ? (
            <Loader2Icon className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          Refresh
        </Button>
      </CardHeader>
      <CardContent>
        {isLoadingVisits ? (
          <div className="flex justify-center py-8">
            <Loader2Icon className="h-8 w-8 animate-spin" />
          </div>
        ) : visits.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium">No visits found</p>
            <p className="text-sm">Click refresh to load visits</p>
          </div>
        ) : (
          <div className="space-y-4">
            {visits.map((visit) => (
              <Card
                key={visit.visitId}
                className="hover:shadow-md transition-shadow"
              >
                <CardContent className="p-4">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 space-y-2 sm:space-y-0">
                    <div>
                      <h3 className="font-semibold text-lg">
                        Visit #{Number(visit.visitId)}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {visit.professionalId
                          ? `Professional ID: ${visit.professionalId}`
                          : visit.facilityId
                            ? `Facility ID: ${visit.facilityId}`
                            : "Unspecified Location"}
                      </p>
                    </div>
                    <Badge
                      variant={getStatusVariant(visit.status)}
                      className="capitalize"
                    >
                      {Object.keys(visit.status)[0]}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                    <div className="space-y-1">
                      <p className="text-muted-foreground">User ID</p>
                      <p className="font-medium break-all">{visit.userId}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-muted-foreground">Avatar ID</p>
                      <p className="font-medium">#{Number(visit.avatarId)}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-muted-foreground">Visit Mode</p>
                      <p className="font-medium">
                        {Object.keys(visit.visitMode)[0]}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-muted-foreground">Current Status</p>
                      <p className="font-medium">
                        {Object.keys(visit.status)[0]}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4">
                    <p className="font-semibold mb-2">Timeline</p>
                    <div className="space-y-3 pl-4 border-l-2 border-muted">
                      {visit.timestamp.slotTime && (
                        <div className="relative">
                          <div className="absolute -left-[17px] top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-blue-500"></div>
                          <div className="space-y-1">
                            <p className="text-sm text-muted-foreground">
                              Scheduled For
                            </p>
                            <p className="text-sm font-medium">
                              {new Date(
                                Number(visit.timestamp.slotTime) / 1_000_000
                              ).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      )}
                      {visit.timestamp.bookingTime && (
                        <div className="relative">
                          <div className="absolute -left-[17px] top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-green-500"></div>
                          <div className="space-y-1">
                            <p className="text-sm text-muted-foreground">
                              Booked On
                            </p>
                            <p className="text-sm font-medium">
                              {new Date(
                                Number(visit.timestamp.bookingTime) / 1_000_000
                              ).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      )}
                      {visit.timestamp.completionTime && (
                        <div className="relative">
                          <div className="absolute -left-[17px] top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-green-500"></div>
                          <div className="space-y-1">
                            <p className="text-sm text-muted-foreground">
                              Completed On
                            </p>
                            <p className="text-sm font-medium">
                              {new Date(
                                Number(visit.timestamp.completionTime) /
                                  1_000_000
                              ).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      )}
                      {visit.timestamp.cancellationTime && (
                        <div className="relative">
                          <div className="absolute -left-[17px] top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-red-500"></div>
                          <div className="space-y-1">
                            <p className="text-sm text-muted-foreground">
                              Cancelled On
                            </p>
                            <p className="text-sm font-medium">
                              {new Date(
                                Number(visit.timestamp.cancellationTime) /
                                  1_000_000
                              ).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {visit.meetingLink && (
                    <div className="mt-4">
                      <p className="text-sm text-muted-foreground mb-1">
                        Meeting Link
                      </p>
                      <a
                        href={visit.meetingLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-500 hover:underline break-all inline-flex items-center gap-2"
                      >
                        {visit.meetingLink}
                        <Globe className="h-4 w-4 flex-shrink-0" />
                      </a>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default VisitsList;
