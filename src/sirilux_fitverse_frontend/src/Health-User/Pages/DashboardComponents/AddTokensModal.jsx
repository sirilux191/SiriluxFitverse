import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import useActorStore from "../../../State/Actors/ActorStore";
import useWalletStore from "../../../State/CryptoAssets/WalletStore";
import { Principal } from "@dfinity/principal";
import { registerSW } from "virtual:pwa-register";

export default function AddTokensModal({ onClose }) {
  const [amount, setAmount] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { subscriptionManager } = useActorStore();
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

      setIsLoading(true);

      // First approve the Data Asset canister as spender
      const dataAssetPrincipal = Principal.fromText(
        process.env.CANISTER_ID_SUBSCRIPTION_MANAGER
      );

      await approveSpender({
        spender: { owner: dataAssetPrincipal, subaccount: [] },
        amount: numAmount,
        memo: "Adding tokens to balance",
      });

      // Then proceed with adding tokens
      const result = await subscriptionManager.addTokensToBalance(numAmount);

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
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-4 bg-card rounded-lg border border-border shadow-md max-w-md w-full mx-4">
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
            disabled={isLoading}
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleAddTokens}
            disabled={isLoading}
          >
            {isLoading ? "Processing..." : "Add Tokens"}
          </Button>
        </div>
      </div>
    </div>
  );
}
