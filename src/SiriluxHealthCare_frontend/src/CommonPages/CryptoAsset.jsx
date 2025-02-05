import React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import NewWallet from "@/Functions/NewWallet";
import NFT from "./NFTComponent/NFT";

export default function CryptoAsset() {
  return (
    <div>
      <div className="max-w-4xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <h1 className="text-4xl font-bold text-foreground">Your Assets</h1>

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
