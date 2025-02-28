import React, { useState, useEffect } from "react";

import {
  Building,
  Calendar,
  Loader2 as Loader2Icon,
  Users,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";

import { Badge } from "@/components/ui/badge";

import useActorStore from "../../State/Actors/ActorStore";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
} from "@/components/ui/select";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { MapPin, Phone } from "lucide-react";
import VisitsList from "./GamificationComponents/VisitsList";
import ProfessionalList from "./GamificationComponents/ProfessionalList";

import GamificationNavigationMenu from "./GamificationComponents/GamificationNavigation";

const Gamification = () => {
  const { gamificationSystem } = useActorStore();

  const [facilities, setFacilities] = useState([]);

  const [activeTab, setActiveTab] = useState("professionals");

  useEffect(() => {
    if (gamificationSystem) {
      fetchFacilities();
    }
  }, [gamificationSystem]);

  const fetchFacilities = async () => {
    try {
      const result = await gamificationSystem.getAllFacilities();
      setFacilities(result); // Ensure result is in the expected format
    } catch (error) {
      console.error("Error fetching facilities:", error);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col sm:flex-row justify-between items-center mb-8 gap-4">
        <h1 className="text-3xl sm:text-4xl font-bold text-foreground">
          Wellness Avatar Platform
        </h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="lg:col-span-2">
          <GamificationNavigationMenu
            activeTab={activeTab}
            setActiveTab={setActiveTab}
          />

          {activeTab === "professionals" && (
            <div className="mt-4 sm:mt-6">
              <ProfessionalList />
            </div>
          )}

          {activeTab === "facilities" && (
            <div className="mt-4 sm:mt-6">
              <div className="space-y-4 sm:space-y-6">
                <Card className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950 dark:to-teal-950">
                  <CardHeader className="p-4 sm:p-6">
                    <CardTitle className="text-lg sm:text-xl flex items-center gap-2">
                      <Users className="h-5 w-5 text-emerald-500" />
                      Select Avatar for Visit
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 sm:p-6">
                    <Select
                      onValueChange={setSelectedAvatarForVisit}
                      value={selectedAvatarForVisit}
                    >
                      <SelectTrigger className="w-full bg-white dark:bg-gray-800">
                        <SelectValue placeholder="Choose an avatar for your visit" />
                      </SelectTrigger>
                      <SelectContent>{[]}</SelectContent>
                    </Select>
                  </CardContent>
                </Card>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                  {facilities.map((facility) => (
                    <Card
                      key={facility.id}
                      className="hover:shadow-lg transition-shadow"
                    >
                      <CardHeader className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-t-lg">
                        <CardTitle className="flex items-center gap-3">
                          <Building className="h-6 w-6" />
                          <div>
                            <h3 className="text-xl font-bold">
                              {facility.name}
                            </h3>
                            <p className="text-sm opacity-90">{facility.id}</p>
                          </div>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-6 space-y-4">
                        <div className="flex items-center gap-2">
                          <MapPin className="h-5 w-5 text-emerald-500" />
                          <Badge
                            variant="secondary"
                            className="text-sm"
                          >
                            {facility.facilityType}
                          </Badge>
                        </div>

                        <div className="space-y-2">
                          <p className="text-sm text-muted-foreground leading-relaxed">
                            {facility.description}
                          </p>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Phone className="h-4 w-4" />
                            <span>Contact via platform</span>
                          </div>
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Clock className="h-4 w-4" />
                            <span>Operating hours</span>
                          </div>
                        </div>

                        <Button
                          className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600"
                          disabled={!selectedAvatarForVisit}
                          onClick={() => initiateVisit(facility.id)}
                        >
                          <Calendar className="h-4 w-4 mr-2" />
                          Book Visit
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === "visits" && (
            <div className="mt-4 sm:mt-6">
              <VisitsList />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Gamification;
