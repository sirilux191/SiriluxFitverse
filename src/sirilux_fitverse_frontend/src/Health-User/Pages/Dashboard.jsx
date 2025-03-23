import { useState } from "react";
import { HeartPulse, Bell, Coins, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import NotificationRequest from "./DashboardComponents/NotificationRequest";
import BalanceInfo from "./DashboardComponents/BalanceInfo";
import AddTokensModal from "./DashboardComponents/AddTokensModal";
import PurchasePremium from "./DashboardComponents/PurchasePremium";
import HealthAnalyticsOld from "../../Functions/healthanalyticsold";

export default function DashboardContent() {
  const [isNotificationModalOpen, setIsNotificationModalOpen] = useState(false);
  const [isAddTokensOpen, setIsAddTokensOpen] = useState(false);
  const [isPremiumModalOpen, setIsPremiumModalOpen] = useState(false);

  return (
    <div className="bg-background min-h-screen">
      <div className="max-w-6xl mx-auto py-6 sm:py-12 px-4 sm:px-6 lg:px-8">
        {/* Header Section with Notification and Add Tokens Buttons */}
        <div className="mb-6 sm:mb-12 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-green-400  to-amber-400 bg-clip-text text-transparent">
              Health Dashboard
            </h1>
          </div>
          <div className="flex gap-4">
            <Button
              variant="outline"
              onClick={() => setIsPremiumModalOpen(true)}
              className="flex items-center gap-2 bg-gradient-to-r from-amber-400 to-amber-600 text-white hover:from-amber-500 hover:to-amber-700"
            >
              <Crown className="h-5 w-5" />
              Go Premium
            </Button>
            <Button
              variant="outline"
              onClick={() => setIsAddTokensOpen(true)}
              className="flex items-center gap-2"
            >
              <Coins className="h-5 w-5" />
              Add Tokens
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="relative"
              onClick={() => setIsNotificationModalOpen(true)}
            >
              <Bell className="h-10 w-10" />
            </Button>
          </div>
        </div>

        {/* Balance Info Section */}
        <section className="mb-8">
          <BalanceInfo />
        </section>

        {/* Health Analytics Section */}
        <section className="bg-card rounded-xl p-4 sm:p-6 shadow-sm border border-border mb-8 sm:mb-12">
          <div className="flex items-center justify-between mb-4 sm:mb-6">
            <div className="flex items-center gap-2 sm:gap-3">
              <HeartPulse className="w-6 sm:w-8 h-6 sm:h-8 text-primary" />
              <h2 className="text-xl sm:text-2xl font-semibold">
                Health Trends
              </h2>
            </div>
          </div>
          <HealthAnalyticsOld />
        </section>

        {/* Add Tokens Modal */}
        {isAddTokensOpen && (
          <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
            <AddTokensModal onClose={() => setIsAddTokensOpen(false)} />
          </div>
        )}

        {/* Premium Subscription Modal */}
        {isPremiumModalOpen && (
          <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
            <PurchasePremium onClose={() => setIsPremiumModalOpen(false)} />
          </div>
        )}

        {/* Notification Modal */}
        <NotificationRequest
          isOpen={isNotificationModalOpen}
          onClose={() => setIsNotificationModalOpen(false)}
        />
      </div>
    </div>
  );
}
