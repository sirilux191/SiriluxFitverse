import React, { useState } from "react";
import { Routes, Route } from "react-router-dom";
import Navbar from "@/CommonPages/Navbar";
import Sidebar from "./Sidebar";
import DashboardContent from "./Pages/Dashboard";
import CryptoAsset from "@/CommonPages/CryptoAsset";
import ProfileContent from "./Pages/Profile";
import UploadContent from "./Pages/UploadPage";
import AnalyticsContent from "./Pages/Analytics";
import Gamification from "./Pages/Gamification";
import YourRecords from "@/CommonPages/Records/YourRecords";
import SharedWithYou from "@/CommonPages/Records/SharedWithYou";
import ConsultAI from "./Pages/ConsultAI";
import NotFoundPage from "@/CommonPages/NotFoundPage";
import AppBanner from "../AppBanner";

import ConsultationPage from "./Pages/ConsultAI/ConsultationPage";
export default function AppRoute1() {
  const [isSidebarOpen, setSidebarOpen] = useState(false);

  const toggleSidebar = () => {
    setSidebarOpen(!isSidebarOpen);
  };

  const closeSidebar = () => {
    setSidebarOpen(false);
  };

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={closeSidebar}
      />
      <div className="flex-1 flex flex-col overflow-auto">
        <Navbar toggleSidebar={toggleSidebar} />
        <AppBanner />
        <div className="relative flex-1">
          <div className="circlePosition w-11/12 h-11/12 bg-gradient-radial from-green-400/10 to-transparent rounded-full absolute -z-10 blur-[100px] flex justify-center items-center">
            <div className="circle w-[17rem] h-[17rem] bg-gradient-radial from-emerald-300/15 to-green-800/10 rounded-full" />
          </div>
          <Routes>
            <Route
              path="/Home"
              element={<DashboardContent />}
            />
            <Route
              path="/Records/Your-Records"
              element={<YourRecords />}
            />
            <Route
              path="/Records/Shared-With-You"
              element={<SharedWithYou />}
            />
            <Route
              path="/Analytics"
              element={<AnalyticsContent />}
            />
            <Route
              path="/Upload"
              element={<UploadContent />}
            />
            <Route
              path="/Assets"
              element={<CryptoAsset />}
            />

            <Route
              path="/ConsultAI"
              element={<ConsultAI />}
            />
            <Route
              path="/Gamification"
              element={<Gamification />}
            />
            <Route
              path="/Profile"
              element={<ProfileContent />}
            />
            <Route
              path="/consult/:id"
              element={<ConsultationPage />}
            />
            <Route
              path="*"
              element={<NotFoundPage />}
            />
          </Routes>
        </div>
      </div>
    </div>
  );
}
