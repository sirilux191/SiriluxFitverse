import { useState, useEffect } from "react";
import {
  Card,
  CardHeader,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Wallet, Receipt, Send, Check } from "lucide-react";
import useWalletStore from "@/State/CryptoAssets/WalletStore";
import useActorStore from "@/State/Actors/ActorStore";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Principal } from "@dfinity/principal";
import { useToast } from "@/components/ui/use-toast";

export default function NewWallet() {
  const { token } = useActorStore();
  const {
    balance,
    transactions,
    fetchBalance,
    sendTokens,
    approveSpender,
    fetchTransactions,
    loading,
    error,
  } = useWalletStore();

  const [sendAmount, setSendAmount] = useState("");
  const [recipient, setRecipient] = useState("");
  const [approveAmount, setApproveAmount] = useState("");
  const [spender, setSpender] = useState("");
  const [memo, setMemo] = useState("");
  const { toast } = useToast();
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);

  useEffect(() => {
    if (token) {
      fetchTransactions();

      fetchBalance();
    }
  }, [token]);

  const handleSend = async () => {
    try {
      await sendTokens({
        to: { owner: Principal.fromText(recipient), subaccount: [] },
        amount: parseFloat(sendAmount),
        memo: memo,
      });
      toast({ title: "Transaction Sent", variant: "success" });
      setSendDialogOpen(false);
      setRecipient("");
      setSendAmount("");
      setMemo("");
    } catch (error) {
      toast({
        title: "Error Sending",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleApprove = async () => {
    try {
      await approveSpender({
        spender: { owner: Principal.fromText(spender), subaccount: [] },
        amount: parseFloat(approveAmount),
      });
      toast({ title: "Approval Successful", variant: "success" });
      setApproveDialogOpen(false);
      setSpender("");
      setApproveAmount("");
    } catch (error) {
      console.log(error);
      toast({
        title: "Approval Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <Card className="bg-background rounded-2xl shadow-lg w-full mx-2 sm:mx-0">
      <CardHeader className="px-4 sm:px-6 pt-4 sm:pt-6 pb-2 sm:pb-4 border-b border-muted/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="bg-primary rounded-full w-6 h-6 sm:w-8 sm:h-8 flex items-center justify-center">
              <Wallet className="w-4 h-4 sm:w-6 sm:h-6 text-primary-foreground" />
            </div>
            <h2 className="text-base sm:text-lg font-semibold">My Wallet</h2>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-4 sm:px-6 py-2 sm:py-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 sm:mb-6 gap-4">
          <div className="space-y-1">
            <div className="text-xs sm:text-sm text-muted-foreground">
              Balance
            </div>
            <div className="text-2xl sm:text-3xl font-bold">
              {balance.toFixed(4)} SIRI
            </div>
          </div>
          <div className="flex flex-col sm:flex-row w-full sm:w-auto gap-2">
            <Dialog
              open={sendDialogOpen}
              onOpenChange={(open) => {
                setSendDialogOpen(open);
                if (!open) {
                  // Reset form when dialog is closed
                  setRecipient("");
                  setSendAmount("");
                  setMemo("");
                }
              }}
            >
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full sm:w-auto"
                >
                  <Send className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                  Send
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-xs sm:max-w-md">
                <DialogHeader>
                  <DialogTitle className="text-lg sm:text-xl">
                    Send Tokens
                  </DialogTitle>
                </DialogHeader>
                <div className="grid gap-2 sm:gap-4">
                  <Input
                    placeholder="Recipient Principal"
                    className="text-xs sm:text-sm"
                    value={recipient}
                    onChange={(e) => setRecipient(e.target.value)}
                  />
                  <Input
                    type="number"
                    placeholder="Amount"
                    className="text-xs sm:text-sm"
                    value={sendAmount}
                    onChange={(e) => setSendAmount(e.target.value)}
                  />
                  <Input
                    placeholder="Memo (optional)"
                    className="text-xs sm:text-sm"
                    value={memo}
                    onChange={(e) => setMemo(e.target.value)}
                  />
                  <Button
                    onClick={handleSend}
                    disabled={loading}
                    className="w-full"
                  >
                    {loading ? "Processing..." : "Confirm Send"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            <Dialog
              open={approveDialogOpen}
              onOpenChange={(open) => {
                setApproveDialogOpen(open);
                if (!open) {
                  // Reset form when dialog is closed
                  setSpender("");
                  setApproveAmount("");
                }
              }}
            >
              <DialogTrigger asChild>
                <Button
                  size="sm"
                  className="w-full sm:w-auto"
                >
                  <Check className="w-5 h-5 mr-2" />
                  Approve
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-xs sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Approve Spender</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4">
                  <Input
                    placeholder="Spender Principal"
                    value={spender}
                    onChange={(e) => setSpender(e.target.value)}
                  />
                  <Input
                    type="number"
                    placeholder="Amount"
                    value={approveAmount}
                    onChange={(e) => setApproveAmount(e.target.value)}
                  />
                  <Button
                    onClick={handleApprove}
                    disabled={loading}
                    className="w-full"
                  >
                    {loading ? "Processing..." : "Confirm Approval"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="border-t border-muted/20 pt-4 sm:pt-6">
          <div className="flex items-center gap-2 mb-4">
            <Receipt className="w-4 h-4 text-muted-foreground" />
            <h3 className="text-base font-semibold">Transaction History</h3>
          </div>
          <div className="grid gap-3 sm:gap-4">
            {transactions.map((tx) => (
              <div
                key={Number(tx.id)}
                className="p-4 border rounded-lg hover:bg-muted/5 transition-colors"
              >
                <div className="flex justify-between items-start">
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          tx.type === "Mint"
                            ? "bg-green-100 text-green-700"
                            : tx.amount > 0
                              ? "bg-green-100 text-green-700"
                              : "bg-red-100 text-red-700"
                        }`}
                      >
                        {tx.type}
                      </span>
                      <span className="text-sm font-semibold">
                        {tx.amount > 0 ? "+" : ""}
                        {tx.amount.toFixed(4)} SIRI
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{tx.timestamp.toLocaleString()}</span>
                      <span>•</span>
                      <span>ID: {tx.id}</span>
                    </div>
                  </div>
                </div>
                <div className="mt-4 space-y-3 bg-muted/5 rounded-lg p-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {tx.from && (
                      <div className="flex flex-col gap-1 bg-background p-2.5 rounded-lg border border-muted/20">
                        <span className="text-xs font-medium text-muted-foreground flex items-center gap-2">
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <path d="M12 19V5M5 12l7-7 7 7" />
                          </svg>
                          From
                        </span>
                        <span
                          className="text-sm font-medium truncate"
                          title={tx.from}
                        >
                          {tx.from}
                        </span>
                      </div>
                    )}

                    {tx.to && (
                      <div className="flex flex-col gap-1 bg-background p-2.5 rounded-lg border border-muted/20">
                        <span className="text-xs font-medium text-muted-foreground flex items-center gap-2">
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <path d="M12 5v14M5 12l7 7 7-7" />
                          </svg>
                          To
                        </span>
                        <span
                          className="text-sm font-medium truncate"
                          title={tx.to}
                        >
                          {tx.to}
                        </span>
                      </div>
                    )}

                    {tx.spender && (
                      <div className="flex flex-col gap-1 bg-background p-2.5 rounded-lg border border-muted/20">
                        <span className="text-xs font-medium text-muted-foreground flex items-center gap-2">
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                            <path d="M12 8v8" />
                            <path d="M8 12h8" />
                          </svg>
                          Spender
                        </span>
                        <span
                          className="text-sm font-medium truncate"
                          title={tx.spender}
                        >
                          {tx.spender}
                        </span>
                      </div>
                    )}
                  </div>

                  {tx.memo && (
                    <div className="flex flex-col gap-1 bg-background p-2.5 rounded-lg border border-muted/20">
                      <span className="text-xs font-medium text-muted-foreground flex items-center gap-2">
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                        </svg>
                        Memo
                      </span>
                      <span className="text-sm font-medium">{tx.memo}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>

      {error && (
        <CardFooter className="px-6 py-4 text-red-500">
          Error: {error}
        </CardFooter>
      )}
    </Card>
  );
}
