import { useState } from "react";
import {
  X,
  Crown,
  Check,
  Coins,
  CreditCard,
  CalendarDays,
  CalendarClock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import useActorStore from "../../../State/Actors/ActorStore";
import useWalletStore from "../../../State/CryptoAssets/WalletStore";
import { Principal } from "@dfinity/principal";
import { toast } from "@/components/ui/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function PurchasePremium({ onClose }) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState("token");
  const [premiumType, setPremiumType] = useState("Monthly");

  const { subscriptionManager, identityManager } = useActorStore();
  const approveSpender = useWalletStore((state) => state.approveSpender);

  // Calculate prices based on premium type
  const monthlyTokenPrice = 1000;
  const yearlyTokenPrice = Math.round(monthlyTokenPrice * 12 * 0.8); // 20% discount
  const monthlyFiatPrice = 2200;
  const yearlyFiatPrice = Math.round(monthlyFiatPrice * 12 * 0.8); // 20% discount

  const tokenPrice =
    premiumType === "Yearly" ? yearlyTokenPrice : monthlyTokenPrice;
  const fiatPrice =
    premiumType === "Yearly" ? yearlyFiatPrice : monthlyFiatPrice;

  // Function to load Razorpay script
  const loadScript = (src) => {
    return new Promise((resolve) => {
      const script = document.createElement("script");
      script.src = src;
      script.onload = () => {
        resolve(true);
      };
      script.onerror = () => {
        resolve(false);
      };
      document.body.appendChild(script);
    });
  };

  // Function to handle token payment
  const handleTokenPayment = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // First approve the Subscription Manager canister as spender
      const subscriptionManagerPrincipal = Principal.fromText(
        process.env.CANISTER_ID_SUBSCRIPTION_MANAGER
      );

      await approveSpender({
        spender: { owner: subscriptionManagerPrincipal, subaccount: [] },
        amount: tokenPrice,
        memo: "Premium Subscription",
      });

      // Call the buyPremiumStatus function on the Subscription Manager with premium type
      const result = await subscriptionManager.buyPremiumStatus([], {
        [premiumType === "Yearly" ? "Yearly" : "Monthly"]: null,
      });

      if (result.ok) {
        toast({
          title: "Success",
          description: "Premium subscription activated successfully!",
        });
        onClose();
      } else {
        setError(`Failed to activate premium status: ${result.err}`);
      }
    } catch (error) {
      setError(`Error processing token payment: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Function to initiate Razorpay payment
  const displayRazorpay = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Load Razorpay script
      const res = await loadScript(
        "https://checkout.razorpay.com/v1/checkout.js"
      );
      if (!res) {
        setError(
          "Razorpay SDK failed to load. Please check your internet connection."
        );
        setIsLoading(false);
        return;
      }

      // Call your Cloud Function to create a payment order
      const cloudFunctionUrl =
        "https://razorpay-sirilux-healthcare-677477691026.us-central1.run.app";

      const response = await fetch(cloudFunctionUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "create_payment",
          currency: "INR",
          premiumType:
            premiumType.charAt(0).toUpperCase() + premiumType.slice(1), // Ensure first letter is capitalized
        }),
      });

      const orderData = await response.json();

      if (!orderData.id) {
        throw new Error("Could not create payment order");
      }

      // Get user principal for verification
      const principal = await identityManager.whoami();
      const principalText = principal.toString();

      // Configure Razorpay options
      const options = {
        key: process.env.RAZORPAY_KEY_ID,
        amount: orderData.amount,
        currency: orderData.currency,
        name: "Sirilux Health Care",
        description: `Premium ${premiumType} Subscription`,
        order_id: orderData.id,
        image:
          "https://gateway.lighthouse.storage/ipfs/bafkreigk5xcplinpfjailkx7inxrd3t5k4exxpuntjjjzs6rwyvz7bqcte",
        handler: async function (response) {
          try {
            // Call your Cloud Function to verify payment
            const verifyResponse = await fetch(cloudFunctionUrl, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                action: "verify_payment",
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_signature: response.razorpay_signature,
                payment_details: {
                  user_id: principalText,
                  timestamp: Date.now(),
                },
              }),
            });

            const verifyData = await verifyResponse.json();

            if (verifyData.success) {
              // Payment successful
              toast({
                title: "Success",
                description:
                  verifyData.message ||
                  "Premium subscription activated successfully!",
              });
              onClose();
            } else {
              // Payment verification failed
              setError(verifyData.error || "Payment verification failed");
            }
          } catch (error) {
            setError("Error verifying payment: " + error.message);
          } finally {
            setIsLoading(false);
          }
        },
        prefill: {
          name: "User Name", // Replace with actual user name if available
          email: "user@example.com", // Replace with actual user email if available
          contact: "", // Replace with actual user phone if available
        },
        theme: {
          color: "#3B82F6", // Change to match your app's color theme
        },
        modal: {
          ondismiss: function () {
            setIsLoading(false);
          },
        },
      };

      // Create and open Razorpay payment form
      const paymentObject = new window.Razorpay(options);
      paymentObject.open();
    } catch (error) {
      setError("Error initiating payment: " + error.message);
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 max-w-md w-full relative">
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute right-4 top-4 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
      >
        <X className="h-6 w-6" />
      </button>

      {/* Header */}
      <div className="flex items-center justify-center flex-col mb-6">
        <Crown className="h-12 w-12 text-amber-500 mb-4" />
        <h2 className="text-2xl font-bold text-center">Upgrade to Premium</h2>
        <p className="text-gray-500 dark:text-gray-400 text-center mt-2">
          Unlock exclusive features and benefits
        </p>
      </div>

      {/* Premium type selection */}
      <div className="mb-6">
        <h3 className="text-sm font-medium mb-2">Subscription Plan</h3>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setPremiumType("Monthly")}
            className={`flex items-center justify-center gap-2 p-3 rounded-lg border ${
              premiumType === "Monthly"
                ? "border-amber-500 bg-amber-50 dark:bg-amber-900/20"
                : "border-gray-200 dark:border-gray-700"
            }`}
          >
            <CalendarDays className="h-4 w-4" />
            <span>Monthly</span>
          </button>
          <button
            onClick={() => setPremiumType("Yearly")}
            className={`flex items-center justify-center gap-2 p-3 rounded-lg border ${
              premiumType === "Yearly"
                ? "border-amber-500 bg-amber-50 dark:bg-amber-900/20"
                : "border-gray-200 dark:border-gray-700"
            }`}
          >
            <CalendarClock className="h-4 w-4" />
            <span>Yearly (20% off)</span>
          </button>
        </div>
      </div>

      {/* Price and features */}
      <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-4 mb-6">
        <div className="text-center mb-4">
          <span className="text-3xl font-bold">
            ₹
            {premiumType === "Yearly"
              ? yearlyFiatPrice.toLocaleString()
              : monthlyFiatPrice.toLocaleString()}
          </span>
          <span className="text-gray-500 dark:text-gray-400">
            /{premiumType === "Yearly" ? "year" : "month"}
          </span>
          <span className="block text-sm text-gray-500 dark:text-gray-400 mt-1">
            or{" "}
            {premiumType === "Yearly"
              ? yearlyTokenPrice.toLocaleString()
              : monthlyTokenPrice.toLocaleString()}{" "}
            tokens
          </span>
        </div>

        <ul className="space-y-2">
          <li className="flex items-center">
            <Check className="h-5 w-5 text-green-500 mr-2" />
            <span>Advanced health analytics</span>
          </li>
          <li className="flex items-center">
            <Check className="h-5 w-5 text-green-500 mr-2" />
            <span>Unlimited AI Document Summaries</span>
          </li>
          <li className="flex items-center">
            <Check className="h-5 w-5 text-green-500 mr-2" />
            <span>More Storage</span>
          </li>
          <li className="flex items-center">
            <Check className="h-5 w-5 text-green-500 mr-2" />
            <span>No ads experience</span>
          </li>
        </ul>
      </div>

      {/* Payment method tabs */}
      <Tabs
        defaultValue="token"
        onValueChange={setPaymentMethod}
        className="mb-6"
      >
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger
            value="token"
            className="flex items-center justify-center gap-2"
          >
            <Coins className="h-4 w-4" />
            <span>Tokens</span>
          </TabsTrigger>
          <TabsTrigger
            value="fiat"
            className="flex items-center justify-center gap-2"
          >
            <CreditCard className="h-4 w-4" />
            <span>Fiat Currency</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent
          value="token"
          className="mt-4"
        >
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 text-center">
            Pay with{" "}
            {premiumType === "Yearly"
              ? yearlyTokenPrice.toLocaleString()
              : monthlyTokenPrice.toLocaleString()}{" "}
            tokens from your wallet
          </p>
        </TabsContent>

        <TabsContent
          value="fiat"
          className="mt-4"
        >
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 text-center">
            Secure payment via Razorpay
          </p>
        </TabsContent>
      </Tabs>

      {/* Error message */}
      {error && (
        <div className="text-red-500 text-sm mb-4 text-center">{error}</div>
      )}

      {/* Payment button */}
      <Button
        className="w-full bg-gradient-to-r from-amber-400 to-amber-600 hover:from-amber-500 hover:to-amber-700 text-white"
        onClick={
          paymentMethod === "token" ? handleTokenPayment : displayRazorpay
        }
        disabled={isLoading}
      >
        {isLoading ? "Processing..." : "Subscribe Now"}
      </Button>
    </div>
  );
}
