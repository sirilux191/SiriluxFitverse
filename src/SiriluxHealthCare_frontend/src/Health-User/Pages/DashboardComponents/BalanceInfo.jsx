import { useState, useEffect } from "react";
import { Battery, Clock, Coins, Crown, Upload, AlarmClock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import useActorStore from "../../../State/Actors/ActorStore";
import { bytesToSize, formatTimeRemaining } from "../../../utils/formatters";

export default function BalanceInfo() {
  const { subscriptionManager } = useActorStore();
  const [balanceData, setBalanceData] = useState(null);
  const [premiumExpirationTime, setPremiumExpirationTime] = useState(null);
  const [dailyMaxRequests, setDailyMaxRequests] = useState(5);
  const [remainingRequests, setRemainingRequests] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [timeRemaining, setTimeRemaining] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        console.log("subscriptionManager", subscriptionManager);
        // Fetch balance data
        const balanceResult = await subscriptionManager.getTotalDataBalance([]);
        if (balanceResult.ok) {
          setBalanceData(balanceResult.ok.balance);
          setPremiumExpirationTime(balanceResult.ok.premiumExpirationTime);

          // Calculate time remaining based on fetched data
          const { tokens, dataBytes, isPremium } = balanceResult.ok.balance;
          calculateTimeRemaining(Number(tokens), Number(dataBytes), isPremium);
        } else {
          setError(`Failed to fetch balance: ${balanceResult.err}`);
        }

        // Fetch remaining token requests
        const requestsResult =
          await subscriptionManager.getRemainingTokenRequest([]);
        if (requestsResult.ok) {
          setRemainingRequests(dailyMaxRequests - Number(requestsResult.ok));
        } else {
          console.error("Error fetching token requests:", requestsResult.err);
        }
      } catch (err) {
        setError(`Error: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    // Set up a refresh interval
    const interval = setInterval(fetchData, 30000); // Refresh every 30 seconds

    return () => clearInterval(interval);
  }, [subscriptionManager]);

  // Calculate time remaining based on balance data
  const calculateTimeRemaining = (tokens, dataBytes, isPremium) => {
    const TOKEN_PER_DATA_MB_PER_SECOND = 1; // 1 token per 1MB / Second
    const FREE_DATA_MB = 100; // 100MB
    const FREE_DATA_GB_PREMIUM = 5; // 5GB
    const BYTES_PER_MB = 1_000_000;
    const BYTES_PER_GB = 1_000_000_000;

    // Reset time remaining
    let remainingSeconds = 0;

    // Calculate chargeable bytes (above free tier)
    let chargeableBytes = 0;
    if (isPremium) {
      chargeableBytes = Math.max(
        0,
        dataBytes - FREE_DATA_GB_PREMIUM * BYTES_PER_GB
      );
    } else {
      chargeableBytes = Math.max(0, dataBytes - FREE_DATA_MB * BYTES_PER_MB);
    }

    // Case 1: User is within free limits
    if (chargeableBytes === 0) {
      setTimeRemaining(null); // No time to display if within free limits
      return;
    }

    // Case 2: User has chargeable bytes but no tokens
    if (tokens === 0) {
      setTimeRemaining(null); // No time to display if no tokens available
      return;
    }

    // Case 3: Calculate time remaining based on tokens and usage
    const chargeableMB = chargeableBytes / BYTES_PER_MB;
    remainingSeconds = tokens / (TOKEN_PER_DATA_MB_PER_SECOND * chargeableMB);

    // Case 4: If time remaining is less than 2 seconds, don't show anything
    if (remainingSeconds < 2) {
      setTimeRemaining(null);
      return;
    }

    setTimeRemaining({
      seconds: remainingSeconds,
      minutes: remainingSeconds / 60,
      hours: remainingSeconds / (60 * 60),
      days: remainingSeconds / (24 * 60 * 60),
    });
  };

  if (loading) {
    return (
      <Card className="bg-card shadow-sm border border-border">
        <CardContent className="p-6">
          <div className="flex justify-center">
            <div className="animate-pulse text-muted-foreground">
              Loading balance information...
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="bg-card shadow-sm border border-border">
        <CardContent className="p-6">
          <div className="text-destructive">{error}</div>
        </CardContent>
      </Card>
    );
  }

  if (!balanceData) return null;

  const { tokens, dataBytes, lastUpdateTime, isPremium } = balanceData;
  const freeStorageLimit = isPremium ? "5 GB" : "100 MB";
  const dataBytesNumber = Number(dataBytes);
  const formattedDataUsage = bytesToSize(dataBytesNumber);

  // Format premium expiration date if available
  let formattedExpirationDate = null;
  if (isPremium && premiumExpirationTime) {
    const expirationDate = new Date(Number(premiumExpirationTime) * 1000); // Convert seconds to milliseconds
    formattedExpirationDate = expirationDate.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  return (
    <Card className="bg-card shadow-sm border border-border">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2">
          <Battery className="h-5 w-5 text-primary" />
          Storage & Balance
          {isPremium && (
            <Crown
              className="h-5 w-5 text-yellow-500"
              title="Premium Account"
            />
          )}
        </CardTitle>
      </CardHeader>

      <CardContent className="pt-2">
        <div className="grid grid-cols-1 gap-6">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Coins className="h-4 w-4 text-amber-500" />
              <span className="text-sm font-medium">Token Balance:</span>
              <span className="font-semibold">
                {Number(tokens).toLocaleString()}
              </span>
              <span className="text-xs text-muted-foreground">
                (1 token = 1MB/sec storage)
              </span>
            </div>

            {Number(tokens) > 0 && (
              <div className="flex items-center gap-2 ml-6 text-xs text-muted-foreground">
                <span>
                  At 100MB/min:{" "}
                  {(() => {
                    const totalMinutes = Number(tokens) / (100 * 60);
                    if (totalMinutes < 60) {
                      return `${Math.floor(totalMinutes)} minutes`;
                    } else if (totalMinutes < 24 * 60) {
                      const hours = Math.floor(totalMinutes / 60);
                      const minutes = Math.floor(totalMinutes % 60);
                      return `${hours} hours${minutes > 0 ? ` ${minutes} minutes` : ""}`;
                    } else {
                      const days = Math.floor(totalMinutes / (24 * 60));
                      const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
                      return `${days} days${hours > 0 ? ` ${hours} hours` : ""}`;
                    }
                  })()}
                </span>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <Upload className="h-4 w-4 text-teal-500" />
              <span className="text-sm font-medium">Data Usage:</span>
              <span className="font-semibold">{formattedDataUsage}</span>
              <span className="text-xs text-muted-foreground">
                (Free up to {freeStorageLimit})
              </span>
            </div>

            {!isPremium && (
              <div className="flex flex-wrap items-center gap-2">
                <Clock className="h-4 w-4 text-blue-500" />
                <span className="text-sm font-medium">AI Requests:</span>
                <span className="font-semibold">{remainingRequests || 0}</span>
                <span className="text-xs text-muted-foreground">
                  remaining today
                </span>
              </div>
            )}

            {isPremium && (
              <div className="flex flex-wrap items-center gap-2">
                <Clock className="h-4 w-4 text-blue-500" />
                <span className="text-sm font-medium">AI Requests:</span>
                <span className="font-semibold">Unlimited</span>
                <span className="text-xs text-muted-foreground">
                  (Premium benefit)
                </span>
              </div>
            )}

            {isPremium && formattedExpirationDate && (
              <div className="flex flex-wrap items-center gap-2">
                <Crown className="h-4 w-4 text-yellow-500" />
                <span className="text-sm font-medium">Premium Until:</span>
                <span className="font-semibold">{formattedExpirationDate}</span>
              </div>
            )}

            {timeRemaining && (
              <div className="flex flex-wrap items-center gap-2">
                <AlarmClock className="h-4 w-4 text-red-500" />
                <span className="text-sm font-medium">Storage Time:</span>
                <span className="font-semibold">
                  {formatTimeRemaining(timeRemaining)}
                </span>
                <span className="text-xs text-muted-foreground">
                  remaining at current usage
                </span>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <div>
              <div className="text-sm font-medium mb-1">Storage Status</div>
              <div className="w-full bg-muted rounded-full h-2.5">
                <div
                  className={`h-2.5 rounded-full ${isPremium ? "bg-purple-600" : "bg-primary"}`}
                  style={{
                    width: `${Math.min(
                      100,
                      (dataBytesNumber /
                        (isPremium ? 5 * 1_000_000_000 : 100 * 1_000_000)) *
                        100
                    )}%`,
                  }}
                ></div>
              </div>
              <div className="mt-1 text-xs text-muted-foreground flex justify-between">
                <span>0</span>
                <span>{freeStorageLimit}</span>
              </div>
            </div>

            {isPremium ? (
              <div className="mt-2 text-sm flex items-center gap-1">
                <Crown className="h-4 w-4 text-yellow-500" />
                <span className="font-medium text-yellow-500">
                  Premium Account
                </span>
              </div>
            ) : (
              <div className="mt-2 text-sm text-muted-foreground">
                Upgrade to Premium for 5GB free storage and unlimited AI
                requests
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
