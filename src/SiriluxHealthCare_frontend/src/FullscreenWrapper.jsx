// FullscreenWrapper.jsx
import { useState, useEffect } from "react";
import { Maximize, Minimize } from "lucide-react";

const FullscreenWrapper = ({ children }) => {
  const [isFullscreen, setIsFullscreen] = useState(false);

  const toggleFullscreen = async () => {
    try {
      if (!isFullscreen) {
        const element = document.documentElement;
        if (element.requestFullscreen) {
          await element.requestFullscreen();
        } else if (element.webkitRequestFullscreen) {
          await element.webkitRequestFullscreen();
        } else if (element.msRequestFullscreen) {
          await element.msRequestFullscreen();
        }
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
          await document.webkitExitFullscreen();
        } else if (document.msExitFullscreen) {
          await document.msExitFullscreen();
        }
      }
    } catch (error) {
      console.error("Failed to toggle fullscreen:", error);
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
    document.addEventListener("mozfullscreenchange", handleFullscreenChange);
    document.addEventListener("MSFullscreenChange", handleFullscreenChange);

    // Cleanup function to remove event listeners
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener(
        "webkitfullscreenchange",
        handleFullscreenChange
      );
      document.removeEventListener(
        "mozfullscreenchange",
        handleFullscreenChange
      );
      document.removeEventListener(
        "MSFullscreenChange",
        handleFullscreenChange
      );
    };
  }, []);

  return (
    <div className="relative w-screen h-screen overflow-hidden">
      {/* Main content wrapper */}
      <div className="w-full h-full">{children}</div>

      {/* Fullscreen toggle button */}
      <button
        onClick={toggleFullscreen}
        className="fixed top-4 right-4 p-2 bg-white rounded-full shadow-lg hover:bg-gray-100 transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 z-50"
        aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
      >
        {isFullscreen ? (
          <Minimize className="w-6 h-6 text-gray-700" />
        ) : (
          <Maximize className="w-6 h-6 text-gray-700" />
        )}
      </button>
    </div>
  );
};

export default FullscreenWrapper;
