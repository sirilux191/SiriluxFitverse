import React, { useState } from "react";

import VisitsList from "./GamificationComponents/VisitsList";
import ProfessionalList from "./GamificationComponents/ProfessionalList";
import FacilityList from "./GamificationComponents/FacilityList";
import GamificationNavigationMenu from "./GamificationComponents/GamificationNavigation";

const Gamification = () => {
  const [activeTab, setActiveTab] = useState("professionals");

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
              <FacilityList />
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
