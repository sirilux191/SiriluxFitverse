import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Star,
  Clock,
  Bot,
  Shield,
  MessageSquare,
  Coins,
  CreditCard,
  X,
  Loader2,
  User,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import useActorStore from "@/State/Actors/ActorStore";
import useNFTStore from "@/State/CryptoAssets/NFTStore";
import useWalletStore from "@/State/CryptoAssets/WalletStore";
import { Principal } from "@dfinity/principal";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectItem,
  SelectContent,
} from "@/components/ui/select";
import { toast } from "@/components/ui/use-toast";
const AIConsultCard = ({ agent }) => {
  const navigate = useNavigate();
  const { aiAgentSystem, isAuthenticated } = useActorStore();
  const { nfts } = useNFTStore();
  const approveSpender = useWalletStore((state) => state.approveSpender);

  const [selectedAvatarForConsult, setSelectedAvatarForConsult] =
    useState(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isTokenPaymentLoading, setIsTokenPaymentLoading] = useState(false);
  const [error, setError] = useState(null);

  // Function to handle fiat payment through Razorpay
  const handleFiatPayment = async () => {
    try {
      // This function will load Razorpay and initiate payment
      // After successful payment, it will call temporaryToken and redirect
      const cloudFunctionUrl =
        "https://razorpay-sirilux-healthcare-agent-677477691026.us-central1.run.app";

      // Load Razorpay script
      const scriptLoaded = await loadScript(
        "https://checkout.razorpay.com/v1/checkout.js"
      );
      if (!scriptLoaded) {
        throw new Error("Razorpay failed to load");
      }

      // Generate temporary token for verification
      const tokenResult = await aiAgentSystem.temporaryToken();
      const tempToken = tokenResult.ok || "";

      if (!tempToken) {
        throw new Error("Failed to generate temporary token");
      }

      // Get order ID from cloud function
      const orderResponse = await fetch(cloudFunctionUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_payment",
          currency: "INR",
          agentId: agent.id,
        }),
      });

      const orderData = await orderResponse.json();
      console.log("Payment order response:", orderData); // Debug the response structure

      // Check for different response structures
      let orderId, amount, currency, keyId;

      if (orderData.success && orderData.data) {
        // Format: { success: true, data: { id, amount, currency, ... } }
        orderId = orderData.data.id;
        amount = orderData.data.amount;
        currency = orderData.data.currency;
        keyId = orderData.data.key_id;
      } else if (orderData.id) {
        // Format: { id, amount, currency, ... }
        orderId = orderData.id;
        amount = orderData.amount;
        currency = orderData.currency;
        keyId = orderData.key_id;
      } else {
        // Error response
        throw new Error(
          orderData.message ||
            (orderData.error && orderData.error.description) ||
            "Could not create payment order"
        );
      }

      if (!orderId) {
        throw new Error("Invalid order ID in response");
      }

      // Initialize Razorpay
      const options = {
        key: keyId || process.env.RAZORPAY_KEY_ID,
        amount: amount,
        currency: currency,
        name: "Sirilux Health Care",
        description: `Consultation with ${agent.name}`,
        order_id: orderId,
        handler: async function (response) {
          try {
            // Send verification to cloud function
            const verifyResponse = await fetch(cloudFunctionUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                action: "verify_payment",
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_signature: response.razorpay_signature,
                temp_token: tempToken,
                agent_id: agent.id,
                avatar_id: selectedAvatarForConsult,
              }),
            });

            const result = await verifyResponse.json();
            console.log("Payment verification response:", result); // Debug verification response

            // Check various response formats
            let token;
            if (result.success && result.data && result.data.token) {
              token = result.data.token;
            } else if (result.success && result.token) {
              token = result.token;
            }

            if (token) {
              // Navigate to consultation page with token and assistant ID
              navigate(`/Health-User/consult/${agent.id}`, {
                state: {
                  token: token,
                  assistantId: agent.assistantId,
                },
              });
            } else {
              throw new Error(result.message || "Payment verification failed");
            }
          } catch (verifyError) {
            console.error("Verification error:", verifyError);
            setError(verifyError.message || "Payment verification failed");
          }
        },
        prefill: {
          name: "Sirilux User",
          email: "",
          contact: "",
        },
        notes: {
          address: "Sirilux Health Care",
          agentId: agent.id,
          avatarId: selectedAvatarForConsult,
        },
        theme: {
          color: "#3399cc",
        },
        modal: {
          ondismiss: function () {
            setIsPaymentModalOpen(false);
          },
        },
      };

      console.log("Razorpay options:", { ...options, key: "HIDDEN" }); // Debug Razorpay options
      const paymentObject = new window.Razorpay(options);
      paymentObject.open();
    } catch (error) {
      console.error("Payment error:", error);
      setError(error.message || "Payment failed");
    }
  };

  // Function to process token payment
  const handleTokenPayment = async () => {
    if (!isAuthenticated) {
      setError("Please login to continue");
      return;
    }

    if (!selectedAvatarForConsult) {
      setError("Please select an avatar for your consultation");
      return;
    }

    setIsTokenPaymentLoading(true);
    setError(null);

    try {
      // First approve the AI Agent System canister as spender
      console.log(process.env.CANISTER_ID_AIAGENTSYSTEM);
      const aiAgentPrincipal = Principal.fromText(
        process.env.CANISTER_ID_AIAGENTSYSTEM
      );

      await approveSpender({
        spender: { owner: aiAgentPrincipal, subaccount: [] },
        amount: agent.consultationFee,
        memo: "AI consultation payment",
      });

      toast({
        title: "Payment approved",
        description: "Payment approved successfully",
      });

      // Then proceed with processing the visit
      const result = await aiAgentSystem.processVisit(
        agent.id,
        selectedAvatarForConsult,
        []
      );

      if (result.ok) {
        const token = result.ok;
        toast({
          title: "Payment successful",
          description: "Payment successful, redirecting to consultation page",
        });

        // Navigate to consultation page with token and assistant ID
        navigate(`/Health-User/consult/${agent.id}`, {
          state: {
            token: token,
            assistantId: agent.assistantId,
          },
        });
      } else {
        toast({
          title: "Payment failed",
          description: "Payment failed, result: " + result.err,
        });
        setError(result.err || "Failed to process payment");
      }
    } catch (error) {
      console.error("Error processing token payment:", error);
      setError("Error processing payment: " + error.message);
    } finally {
      setIsTokenPaymentLoading(false);
      setIsPaymentModalOpen(false);
    }
  };

  // Helper function to load script
  const loadScript = (src) => {
    return new Promise((resolve) => {
      const script = document.createElement("script");
      script.src = src;
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  // Calculate rating stars
  const renderStars = (rating) => {
    return (
      <div className="flex items-center gap-1">
        <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
        <span className="text-sm font-medium">{rating}</span>
        <span className="text-sm text-muted-foreground">
          ({agent.reviewCount} reviews)
        </span>
      </div>
    );
  };

  return (
    <>
      <Card className="bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-800 hover:border-gray-700 transition-all duration-300 overflow-hidden h-full">
        <div className="p-2 sm:p-6 flex flex-col h-full">
          {/* Header Section - Vertical on mobile */}
          <div className="flex flex-col gap-2 sm:gap-0 sm:flex-row sm:items-start sm:justify-between mb-2 sm:mb-4">
            {/* Bot Icon and Name - Centered on mobile */}
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-2 sm:gap-4">
              <div className="bg-gradient-to-br from-blue-500/20 to-purple-500/20 p-2 sm:p-3 rounded-xl">
                <Bot className="w-5 h-5 sm:w-8 sm:h-8 text-blue-400" />
              </div>
              <div className="text-center sm:text-left">
                <h3 className="text-sm sm:text-lg font-semibold text-white">
                  {agent.name}
                </h3>
                {/* Rating - Centered on mobile */}
                <div className="flex justify-center sm:justify-start">
                  {renderStars(agent.rating)}
                </div>
              </div>
            </div>
          </div>

          {/* Specialties Section - Centered on mobile */}
          <div className="mb-2 sm:mb-4">
            <div className="flex flex-wrap justify-center sm:justify-start gap-0.5 sm:gap-2">
              {agent.specialties.map((specialty, index) => (
                <Badge
                  key={index}
                  variant="secondary"
                  className="bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[8px] sm:text-sm 
                  px-1 py-0 sm:px-2.5 sm:py-1 leading-tight sm:leading-normal whitespace-nowrap"
                >
                  {specialty}
                </Badge>
              ))}
            </div>
          </div>

          {/* Description - Centered on mobile */}
          <p className="text-gray-400 text-[10px] sm:text-sm mb-2 sm:mb-6 line-clamp-2 sm:line-clamp-3 flex-grow text-center sm:text-left">
            {agent.description}
          </p>

          {/* Status Indicators - Stacked on mobile */}
          <div className="mt-auto space-y-1.5 sm:space-y-3">
            <div className="flex flex-col sm:flex-row gap-1.5 sm:gap-0 sm:items-center sm:justify-between text-[9px] sm:text-sm text-gray-400">
              <div className="flex items-center justify-center sm:justify-start gap-1 sm:gap-2">
                <Clock className="w-3 h-3 sm:w-4 sm:h-4" />
                <span>Available 24/7</span>
              </div>
              <div className="flex items-center justify-center sm:justify-start gap-1 sm:gap-2">
                <Shield className="w-3 h-3 sm:w-4 sm:h-4" />
                <span>Verified AI</span>
              </div>
            </div>

            {/* Price and Button Section */}
            <div className="flex flex-col sm:flex-row items-center sm:justify-between pt-1.5 sm:pt-3 border-t border-gray-800 gap-2 sm:gap-0">
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-0.5 sm:gap-1">
                <span className="text-sm sm:text-lg font-bold text-white">
                  {agent.consultationFee} SIRILUX
                </span>
                <span className="text-[8px] sm:text-sm text-gray-400">
                  per consultation
                </span>
              </div>
              <Button
                onClick={() => setIsPaymentModalOpen(true)}
                className="w-full sm:w-auto bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 
                text-white text-[9px] sm:text-sm px-1.5 sm:px-3 py-1 sm:py-2 h-auto"
              >
                <MessageSquare className="w-2.5 h-2.5 sm:w-4 sm:h-4 mr-1" />
                Consult Now
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Payment Options Dialog */}
      <Dialog
        open={isPaymentModalOpen}
        onOpenChange={setIsPaymentModalOpen}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Choose Payment Method</DialogTitle>
            <DialogDescription>
              Select how you would like to pay for your consultation with{" "}
              {agent.name}
            </DialogDescription>
          </DialogHeader>

          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}

          {/* Avatar Selection */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">
              Select Avatar for Consultation
            </label>
            <Select
              onValueChange={setSelectedAvatarForConsult}
              value={selectedAvatarForConsult}
            >
              <SelectTrigger className="w-full bg-white dark:bg-gray-800">
                <SelectValue placeholder="Choose an avatar for your consultation" />
              </SelectTrigger>
              <SelectContent>
                {nfts.map((avatar) => (
                  <SelectItem
                    key={avatar.id}
                    value={avatar.id}
                  >
                    <span className="flex items-center gap-2">
                      <Star className="h-4 w-4 text-yellow-400" />
                      {avatar.avatarType ||
                        avatar.specialization ||
                        avatar.services}{" "}
                      (Level {avatar.level})
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 gap-4 py-4">
            <Button
              onClick={handleTokenPayment}
              className="flex justify-between items-center w-full"
              disabled={isTokenPaymentLoading || !selectedAvatarForConsult}
            >
              <div className="flex items-center">
                <Coins className="w-5 h-5 mr-2" />
                <span>Pay with SIRILUX Tokens</span>
              </div>
              <span>{agent.consultationFee} SIRILUX</span>
              {isTokenPaymentLoading && (
                <Loader2 className="w-4 h-4 ml-2 animate-spin" />
              )}
            </Button>

            {/* <Button
              onClick={handleFiatPayment}
              className="flex justify-between items-center w-full"
              variant="outline"
              disabled={!selectedAvatarForConsult}
            >
              <div className="flex items-center">
                <CreditCard className="w-5 h-5 mr-2" />
                <span>Pay with Fiat Currency</span>
              </div>
              <span>₹{(agent.consultationFee * 10).toFixed(2)}</span>
            </Button> */}
          </div>

          {selectedAvatarForConsult && (
            <div className="border-t pt-4 mt-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm">
                  <User className="h-4 w-4" />
                  <span>Selected Avatar:</span>
                  <Badge variant="secondary">#{selectedAvatarForConsult}</Badge>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedAvatarForConsult(null)}
                >
                  Change
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default AIConsultCard;
