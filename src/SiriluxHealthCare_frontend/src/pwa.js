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
});

export default updateSW;
