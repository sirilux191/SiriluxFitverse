import { registerSW } from "virtual:pwa-register";

// This is a simple reload on update approach
const updateSW = registerSW({
  onNeedRefresh() {
    if (confirm("New content available. Reload?")) {
      updateSW(true);
    }
  },
  onOfflineReady() {
    console.log("App ready to work offline");
  },
  // Add more reliable offline detection
  onRegistered(registration) {
    // Check network status periodically
    setInterval(() => {
      if (registration && registration.active) {
        // Only check when we have an active service worker
        if (navigator.onLine) {
          registration.active.postMessage({
            type: "ONLINE_STATUS",
            online: true,
          });
        } else {
          registration.active.postMessage({
            type: "ONLINE_STATUS",
            online: false,
          });
        }
      }
    }, 5000);
  },
  // Add this configuration to increase the file size limit
  workbox: {
    maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5 MB
  },
});

export default updateSW;
