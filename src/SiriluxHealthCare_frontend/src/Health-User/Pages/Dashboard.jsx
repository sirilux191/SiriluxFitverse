import { useState } from "react";
import { HeartPulse, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import NotificationRequest from "./DashboardComponents/NotificationRequest";
import HealthAnalyticsOld from "../../Functions/healthanalyticsold";

export default function DashboardContent() {
  const [isNotificationModalOpen, setIsNotificationModalOpen] = useState(false);

  return (
    <div className="bg-background min-h-screen">
      <div className="max-w-6xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        {/* Header Section with Notification Button */}
        <div className="mb-12 flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-600 to-sky-400 bg-clip-text text-transparent">
              Health Dashboard
            </h1>
          </div>
          <Button
            variant="outline"
            size="icon"
            className="relative"
            onClick={() => setIsNotificationModalOpen(true)}
          >
            <Bell className="h-10 w-10" />
          </Button>
        </div>

        {/* Health Analytics Section */}
        <section className="bg-card rounded-xl p-6 shadow-sm border border-border mb-12">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <HeartPulse className="w-8 h-8 text-primary" />
              <h2 className="text-2xl font-semibold">Health Trends</h2>
            </div>
          </div>
          <HealthAnalyticsOld />
        </section>

        {/* Add NotificationRequest Modal */}
        <NotificationRequest
          isOpen={isNotificationModalOpen}
          onClose={() => setIsNotificationModalOpen(false)}
        />
      </div>
    </div>
  );
}
