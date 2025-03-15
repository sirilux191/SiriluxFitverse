import { useNavigate } from "react-router-dom";
import { toast } from "@/components/ui/use-toast";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import OnboardingBanner from "../OnboardingBanner";
import LoadingScreen from "../LoadingScreen";
import useActorStore from "../State/Actors/ActorStore";

export default function ConnectPage() {
  const [isLoading, setIsLoading] = useState(false);

  const navigate = useNavigate();
  const { identityManager, isAuthenticated, login } = useActorStore();

  useEffect(() => {
    const checkRegistration = async () => {
      if (isAuthenticated && identityManager) {
        setIsLoading(true);
        try {
          let resultOfRegistration = await identityManager.getIdentity([]);

          if (resultOfRegistration.ok) {
            if (resultOfRegistration.ok[1] == "Facility") {
              navigate(`/Health-Service/Profile`);
            } else {
              navigate(`/Health-${resultOfRegistration.ok[1]}/Profile`);
            }
          } else {
            navigate(`/Register`);
          }
          // Your navigation logic here based on the registration status and type
        } catch (error) {
          setIsLoading(false);
          console.error("Error checking registration:", error);
          toast({
            title: "Error",
            description: "Failed to check registration status",
            variant: "destructive",
          });
        }
      }
    };
    checkRegistration();
  }, [isAuthenticated, identityManager]);

  const handleConnectClick = async () => {
    setIsLoading(true);
    try {
      login();
      // The useEffect will handle the rest
    } catch (error) {
      console.error("Error during signing process:", error);
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return <LoadingScreen />;
  }
  return (
    <section className="bg-gradient-to-br from-green-800 via-green-900 to-slate-900 h-screen flex justify-center items-center">
      <OnboardingBanner />
      <div className="px-6 flex justify-center items-center h-screen">
        <div className="flex flex-col md:flex-row w-full max-w-3xl">
          <div className="flex-1 flex flex-col justify-center text-white p-4">
            <div className="flex items-center mb-4">
              <img
                alt="Logo"
                className="h-10 w-auto object-contain"
                src="assets/SiriluxHealthCare.png"
              />
            </div>
            <p className="text-xl md:text-2xl">
              Digitally Linking your health.
            </p>
          </div>

          <div className="flex-1 items-center bg-background rounded-lg p-8 py-12 shadow-lg relative">
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-green-400 to-green-500 rounded-t-lg"></div>
            <h2 className="text-xl md:text-2xl font-bold mb-4">
              Connect Your Wallet
            </h2>
            <div className="flex items-center gap-2">
              <Button
                className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={handleConnectClick}
              >
                Connect
              </Button>
              <div className="relative group">
                <Button
                  variant="outline"
                  size="icon"
                  className="w-8 h-8 rounded-full"
                >
                  i
                </Button>
                <div className="fixed hidden group-hover:block left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-black p-4 rounded-lg z-50">
                  <img
                    src="assets/your-info-gif.gif"
                    alt="Wallet connection info"
                    className="w-[50vw] h-auto rounded"
                    style={{ minWidth: "50vw" }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
