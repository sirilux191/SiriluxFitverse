import React, { useState, useContext } from "react";
import { Menu, User } from "lucide-react";
import { ModeToggle } from "@/components/mode-toggle";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useLocation, useNavigate } from "react-router-dom"; // Import useNavigate
import ActorContext from "@/ActorContext"; // Import the context
import { toast } from "@/components/ui/use-toast"; // Ensure toast is imported

const Navbar = ({ toggleSidebar }) => {
  const location = useLocation();
  const navigate = useNavigate(); // Initialize useNavigate
  const { logout, actors } = useContext(ActorContext); // Get the logout function and actors
  const [principalId, setPrincipalId] = useState(null);

  const getCurrentPageName = () => {
    const path = location.pathname.split("/").pop();
    return path.charAt(0).toUpperCase() + path.slice(1);
  };

  const handleLogout = async () => {
    await logout(); // Call the logout function
    navigate("/connect"); // Redirect to the Connect page after logout
  };

  const getPrincipalId = async () => {
    try {
      const principal = await actors.gamificationSystem.whoami();
      setPrincipalId(principal);
      await navigator.clipboard.writeText(principal);
      toast({
        title: "Principal ID Copied",
        description: "Your Principal ID has been copied to the clipboard.",
        duration: 3000,
      });
    } catch (error) {
      console.error("Error getting Principal ID:", error);
      toast({
        title: "Error",
        description: "Failed to get Principal ID. Please try again.",
        variant: "destructive",
        duration: 3000,
      });
    }
  };

  return (
    <div className="sticky z-40 top-0 flex flex-col w-full">
      <header className="bg-background border-b border-muted">
        <div className="flex justify-between items-center py-2 px-2 md:py-4 md:px-6">
          <div className="flex items-center space-x-2 md:space-x-4">
            <button
              className="lg:hidden"
              onClick={toggleSidebar}
            >
              <Menu
                size={20}
                className="text-foreground"
              />
            </button>
            <h1 className="text-sm md:text-xl font-bold truncate">
              {getCurrentPageName()}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <ModeToggle />
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  size="sm"
                  className="text-xs md:text-sm"
                >
                  <User className="h-4 w-4 mr-2" />
                  Account
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-40 p-2">
                <div className="flex flex-col gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={getPrincipalId}
                    className="w-full justify-start text-xs md:text-sm"
                  >
                    Who Am I?
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleLogout}
                    className="w-full justify-start text-xs md:text-sm"
                  >
                    Logout
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </header>
    </div>
  );
};

export default Navbar;
