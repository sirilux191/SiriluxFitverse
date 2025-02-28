import { useState } from "react";
import { HeartPulse, Bell, Coins } from "lucide-react";
import { Button } from "@/components/ui/button";
import NotificationRequest from "./DashboardComponents/NotificationRequest";
import HealthAnalyticsOld from "../../Functions/healthanalyticsold";
import useActorStore from "../../State/Actors/ActorStore";
import { toast } from "@/components/ui/use-toast";
import useWalletStore from "../../State/CryptoAssets/WalletStore";
import { Principal } from "@dfinity/principal";

// Add a new AddTokens component
const AddTokens = ({ onClose }) => {
  const [amount, setAmount] = useState("");
  const { dataAsset } = useActorStore();
  const approveSpender = useWalletStore((state) => state.approveSpender);

  const handleAddTokens = async () => {
    try {
      const numAmount = parseInt(amount);
      if (isNaN(numAmount) || numAmount <= 0) {
        toast({
          title: "Invalid Amount",
          description: "Please enter a valid amount",
          variant: "destructive",
        });
        return;
      }

      // First approve the Data Asset canister as spender
      const dataAssetPrincipal = Principal.fromText(
        process.env.CANISTER_ID_DATAASSET
      );
      await approveSpender({
        spender: { owner: dataAssetPrincipal, subaccount: [] },
        amount: numAmount,
        memo: "Adding tokens to balance",
      });

      // Then proceed with adding tokens
      const result = await dataAsset.addTokensToBalance(numAmount);
      console.log(result);
      if (result.ok) {
        toast({
          title: "Success",
          description: `Successfully added ${numAmount} tokens`,
        });
        onClose();
      } else {
        toast({
          title: "Error",
          description: `Failed to add tokens: ${result.err}`,
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: `Error adding tokens: ${error.message}`,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="p-4 bg-card rounded-lg border border-border">
      <h3 className="text-lg font-semibold mb-4">Add Tokens</h3>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Amount</label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full p-2 rounded-md border border-input bg-background"
            placeholder="Enter amount"
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button onClick={handleAddTokens}>Add Tokens</Button>
        </div>
      </div>
    </div>
  );
};

export default function DashboardContent() {
  const [isNotificationModalOpen, setIsNotificationModalOpen] = useState(false);
  const [isAddTokensOpen, setIsAddTokensOpen] = useState(false);

  return (
    <div className="bg-background min-h-screen">
      <div className="max-w-6xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        {/* Header Section with Notification and Add Tokens Buttons */}
        <div className="mb-12 flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-600 to-sky-400 bg-clip-text text-transparent">
              Health Dashboard
            </h1>
          </div>
          <div className="flex gap-4">
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

        {/* Add Tokens Modal */}
        {isAddTokensOpen && (
          <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
            <AddTokens onClose={() => setIsAddTokensOpen(false)} />
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
