import React from "react";
import { Building, Briefcase, Calendar, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

const GamificationNavigationMenu = ({ activeTab, setActiveTab }) => {
  const tabs = [
    {
      id: "professionals",
      label: "Professionals",
      icon: <Briefcase className="h-4 w-4" />,
    },
    {
      id: "facilities",
      label: "Facilities",
      icon: <Building className="h-4 w-4" />,
    },
    {
      id: "visits",
      label: "My Visits",
      icon: <Calendar className="h-4 w-4" />,
    },
  ];

  return (
    <div className="w-full mb-6">
      {/* Mobile View - Popover */}
      <div className="sm:hidden w-full">
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className="w-full justify-between"
            >
              <div className="flex items-center gap-2">
                {tabs.find((tab) => tab.id === activeTab)?.icon}
                {tabs.find((tab) => tab.id === activeTab)?.label}
              </div>
              <ChevronDown className="h-4 w-4 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className="w-full p-0"
            align="start"
          >
            <div className="grid gap-1 p-1">
              {tabs.map((tab) => (
                <Button
                  key={tab.id}
                  variant={activeTab === tab.id ? "secondary" : "ghost"}
                  className="w-full justify-start gap-2"
                  onClick={() => setActiveTab(tab.id)}
                >
                  {tab.icon}
                  {tab.label}
                </Button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Desktop View - Regular Tabs */}
      <div className="hidden sm:block">
        <div className="flex space-x-2 bg-gray-800/95 text-white rounded-lg p-1">
          {tabs.map((tab) => (
            <Button
              key={tab.id}
              variant={activeTab === tab.id ? "secondary" : "ghost"}
              className={`flex-1 gap-2 ${
                activeTab === tab.id ? "bg-white/10" : "hover:bg-white/5"
              }`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.icon}
              {tab.label}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default GamificationNavigationMenu;
