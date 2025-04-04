import { useContext } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import OnboardingBanner from "../OnboardingBanner";
import {
  ChevronRight,
  User,
  BriefcaseMedical,
  Building,
  UserPlus,
} from "lucide-react";
import useActorStore from "../State/Actors/ActorStore";

export default function FirstPageContent() {
  const navigate = useNavigate();
  const { isAuthenticated, logout } = useActorStore();

  const checkRegistration = async (type) => {
    if (!isAuthenticated) {
      toast({
        title: "Error",
        description: "Please log in first",
        variant: "destructive",
      });
      return;
    }
    navigate(`/Register/${type}`);
  };

  const handleLogout = async () => {
    await logout();
    navigate("/Connect");
  };

  return (
    <section className="bg-gradient-to-br from-green-800 via-green-900 to-slate-900">
      <OnboardingBanner />
      <div className="px-6 flex justify-center items-center h-screen">
        <div className="flex flex-col md:flex-row md:w-1/2">
          <div className="flex-1 flex flex-col justify-center text-white p-4">
            <div className="flex items-center mb-4">
              <img
                alt="Logo"
                className="h-10 w-48 dark:brightness-0 invert"
                src="/assets/logo.svg"
              />
            </div>
            <p className="text-xl md:text-2xl">
              Access, Analyze, and Amplify your fitness journey.
            </p>
          </div>

          <div className="flex-1 items-center max-w-md bg-background rounded-lg p-8">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl md:text-2xl font-bold text-foreground">
                Get Started
              </h2>
              {isAuthenticated && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleLogout}
                  className="text-xs px-2 py-1 h-8"
                >
                  Logout
                </Button>
              )}
            </div>
            <p className="text-sm text-muted-foreground mb-4">Register As</p>
            <div>
              <Button
                className="flex justify-between items-center w-full border border-input p-3 rounded-md mb-2"
                variant="secondary"
                onClick={() => checkRegistration("Health-User")}
              >
                <div className="flex items-center">
                  <User className="text-primary" />
                  <span className="ml-2 font-bold">Health User</span>
                </div>
                <ChevronRight />
              </Button>

              {/* <Button
                className="flex justify-between items-center w-full border border-input p-3 rounded-md mb-2"
                variant="secondary"
                onClick={() => checkRegistration("Health-Professional")}
              >
                <div className="flex items-center">
                  <BriefcaseMedical className="text-primary" />
                  <span className="ml-2 font-bold">Health Professional</span>
                </div>
                <ChevronRight />
              </Button>

              <Button
                className="flex justify-between items-center w-full border border-input p-3 rounded-md mb-2"
                variant="secondary"
                onClick={() => checkRegistration("Health-Service")}
              >
                <div className="flex items-center">
                  <Building className="text-primary" />
                  <span className="ml-2 font-bold">Health Service</span>
                </div>
                <ChevronRight />
              </Button> */}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
