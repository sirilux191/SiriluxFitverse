import React, { useState } from "react";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, Building2, Database, Coins, Shield } from "lucide-react";
import ProfessionalApproval from "./ProfessionalApproval";
import FacilityApproval from "./FacilityApproval";
import ShardManagement from "./ShardManagement";
import NFTManagement from "./NFTManagement";
import AdminRegistration from "./AdminRegistration";

const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState("professionals");

  const tabs = [
    { id: "professionals", label: "Professional Approval", icon: <Users /> },
    { id: "facilities", label: "Facility Approval", icon: <Building2 /> },
    { id: "shards", label: "Shard Management", icon: <Database /> },
    { id: "nfts", label: "NFT Management", icon: <Coins /> },
    { id: "admin", label: "Admin Registration", icon: <Shield /> },
  ];

  return (
    <div className="flex h-screen bg-background">
      <aside className="w-64 bg-card text-card-foreground p-4">
        <h1 className="text-2xl font-bold mb-6">Admin Dashboard</h1>
        <nav>
          {tabs.map((tab) => (
            <Button
              key={tab.id}
              variant={activeTab === tab.id ? "default" : "ghost"}
              className="w-full justify-start mb-2"
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.icon}
              <span className="ml-2">{tab.label}</span>
            </Button>
          ))}
        </nav>
      </aside>
      <main className="flex-1 p-6 overflow-auto">
        <Card>
          <CardHeader>
            <CardTitle>
              {tabs.find((tab) => tab.id === activeTab)?.label}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs
              value={activeTab}
              onValueChange={setActiveTab}
            >
              <TabsContent value="professionals">
                <ProfessionalApproval />
              </TabsContent>
              <TabsContent value="facilities">
                <FacilityApproval />
              </TabsContent>
              <TabsContent value="shards">
                <ShardManagement />
              </TabsContent>
              <TabsContent value="nfts">
                <NFTManagement />
              </TabsContent>
              <TabsContent value="admin">
                <AdminRegistration />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default AdminDashboard;
