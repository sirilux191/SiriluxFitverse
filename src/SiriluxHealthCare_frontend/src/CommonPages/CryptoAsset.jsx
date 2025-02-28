import React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";

import NewWallet from "@/Functions/NewWallet";
import NFT from "./NFTComponent/NFT";

export default function CryptoAsset() {
  const navigate = useNavigate();

  return (
    <div>
      <div className="max-w-4xl mx-auto py-8 sm:py-12 px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sm:gap-0 mb-6">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-foreground">
            Your Assets
          </h1>
          <Button
            onClick={() => navigate("/mint-nft")}
            className="bg-primary hover:bg-primary/90 w-full sm:w-auto"
          >
            <Plus className="w-4 h-4 mr-2" />
            Mint NFT
          </Button>
        </div>

        <Tabs
          defaultValue="NFT"
          className=""
        >
          <TabsList className="w-full">
            <TabsTrigger
              value="NFT"
              className="w-1/2"
            >
              NFT
            </TabsTrigger>
            <TabsTrigger
              value="Token"
              className="w-1/2"
            >
              Token
            </TabsTrigger>
          </TabsList>

          <TabsContent value="NFT">
            <NFT />
          </TabsContent>

          <TabsContent value="Token">
            <NewWallet />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
