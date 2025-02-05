import { create } from "zustand";
import { persist } from "zustand/middleware";

export const useNFTStore = create(
  persist(
    (set, get) => ({
      nfts: [],
      loading: false,
      error: null,
      lastFetched: null,

      fetchNFTs: async (actors) => {
        try {
          set({ loading: true, error: null });

          // Cache for 5 minutes
          if (get().lastFetched && Date.now() - get().lastFetched < 300000) {
            return;
          }

          const rawNFTs = await actors.gamificationSystem.getUserAvatarsSelf();
          const processedNFTs = [];

          for (const [tokenId, metadata] of rawNFTs) {
            const metadataMap = metadata[0].reduce((acc, [key, value]) => {
              acc[key] = value;
              return acc;
            }, {});

            const attributes = metadataMap.attributes?.Map || [];
            const getAttribute = (name) => {
              const attr = attributes.find(([key]) => key === name);
              if (!attr) return null;
              return attr[1].Nat ? Number(attr[1].Nat) : attr[1].Text;
            };

            // Determine NFT type and properties
            const nftData = {
              id: Number(tokenId),
              name: metadataMap.name?.Text || "Unnamed NFT",
              image: metadataMap.image?.Text || "",
              type: "avatar",
              quality:
                (getAttribute("quality") || "Common").charAt(0).toUpperCase() +
                (getAttribute("quality") || "Common").slice(1).toLowerCase(),
              level: getAttribute("level") || 1,
              hp: getAttribute("HP") || 100,
              visitCount: getAttribute("visitCount") || 0,
            };

            // Type-specific attributes
            if (attributes.some(([key]) => key === "energy")) {
              nftData.type = "avatar";
              nftData.energy = getAttribute("energy");
              nftData.focus = getAttribute("focus");
              nftData.vitality = getAttribute("vitality");
              nftData.resilience = getAttribute("resilience");
              nftData.avatarType = getAttribute("avatarType");
            } else if (attributes.some(([key]) => key === "experience")) {
              nftData.type = "professional";
              nftData.experience = getAttribute("experience");
              nftData.reputation = getAttribute("reputation");
              nftData.specialization = getAttribute("specialization");
            } else if (attributes.some(([key]) => key === "technologyLevel")) {
              nftData.type = "facility";
              nftData.technologyLevel = getAttribute("technologyLevel");
              nftData.reputation = getAttribute("reputation");
              nftData.services = getAttribute("services");
            }

            processedNFTs.push(nftData);
          }

          set({
            nfts: processedNFTs,
            loading: false,
            lastFetched: Date.now(),
          });
        } catch (error) {
          set({
            error: error.message,
            loading: false,
          });
        }
      },
    }),
    {
      name: "nft-storage",
      partialize: (state) => ({
        nfts: state.nfts,
        lastFetched: state.lastFetched,
      }),
    }
  )
);
