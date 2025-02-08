import { create } from "zustand";
import { persist } from "zustand/middleware";
import useWalletStore from "./WalletStore";
import { Principal } from "@dfinity/principal";

const useNFTStore = create(
  persist(
    (set, get) => ({
      nfts: [],
      loading: false,
      error: null,

      fetchNFTs: async (actors) => {
        try {
          set({ loading: true, error: null });

          const avatarsResult =
            await actors.gamificationSystem.getUserAvatarsSelf();
          const formattedAvatars = [];

          for (const [tokenId, metadata] of avatarsResult) {
            try {
              if (!metadata || !Array.isArray(metadata[0])) {
                console.error("Invalid metadata structure for token:", tokenId);
                continue;
              }

              const metadataEntries = metadata[0];
              const attributesEntry = metadataEntries.find(
                (entry) => entry[0] === "attributes"
              );
              const nameEntry = metadataEntries.find(
                (entry) => entry[0] === "name"
              );
              const imageEntry = metadataEntries.find(
                (entry) => entry[0] === "image"
              );

              if (
                !attributesEntry ||
                !attributesEntry[1] ||
                !attributesEntry[1].Map
              ) {
                console.error("No attributes found for token:", tokenId);
                continue;
              }

              const attributesMap = attributesEntry[1].Map;
              const name = nameEntry?.[1]?.Text ?? "Unknown";

              // Helper function to find attribute value
              const getAttributeValue = (name) => {
                const attribute = attributesMap.find(
                  (attr) => attr[0] === name
                );
                if (!attribute) return null;
                const value = attribute[1];
                return value.Nat
                  ? Number(value.Nat)
                  : value.Text
                    ? value.Text
                    : null;
              };

              // Determine NFT type and create appropriate object
              if (attributesMap.some((attr) => attr[0] === "energy")) {
                formattedAvatars.push({
                  type: "avatar",
                  id: Number(tokenId),
                  name,
                  image: imageEntry?.[1]?.Text ?? null,
                  energy: getAttributeValue("energy") ?? 0,
                  focus: getAttributeValue("focus") ?? 0,
                  vitality: getAttributeValue("vitality") ?? 0,
                  resilience: getAttributeValue("resilience") ?? 0,
                  quality:
                    (getAttributeValue("quality") || "Common")
                      .charAt(0)
                      .toUpperCase() +
                    (getAttributeValue("quality") || "Common")
                      .slice(1)
                      .toLowerCase(),
                  avatarType: getAttributeValue("avatarType") ?? "Unknown",
                  level: getAttributeValue("level") ?? 1,
                  HP: getAttributeValue("HP") ?? 100,
                  visitCount: getAttributeValue("visitCount") ?? 0,
                });
              } else if (
                attributesMap.some((attr) => attr[0] === "experience")
              ) {
                // Professional NFT type
                formattedAvatars.push({
                  type: "professional",
                  id: Number(tokenId),
                  name,
                  image: imageEntry?.[1]?.Text ?? null,
                  experience: getAttributeValue("experience") ?? 0,
                  reputation: getAttributeValue("reputation") ?? 0,
                  specialization:
                    getAttributeValue("specialization") ?? "Unknown",
                  quality: getAttributeValue("quality") ?? "Common",
                  HP: getAttributeValue("HP") ?? 100,
                  visitCount: getAttributeValue("visitCount") ?? 0,
                  level: getAttributeValue("level") ?? 1,
                });
              } else if (
                attributesMap.some((attr) => attr[0] === "technologyLevel")
              ) {
                // Facility NFT type
                formattedAvatars.push({
                  type: "facility",
                  id: Number(tokenId),
                  name,
                  image: imageEntry?.[1]?.Text ?? null,
                  technologyLevel: getAttributeValue("technologyLevel") ?? 0,
                  reputation: getAttributeValue("reputation") ?? 0,
                  services: getAttributeValue("services") ?? "Unknown",
                  quality: getAttributeValue("quality") ?? "Common",
                  HP: getAttributeValue("HP") ?? 100,
                  visitCount: getAttributeValue("visitCount") ?? 0,
                  level: getAttributeValue("level") ?? 1,
                });
              }
            } catch (error) {
              console.error(`Error processing token ${tokenId}:`, error);
            }
          }

          set({
            nfts: formattedAvatars,
            loading: false,
          });
        } catch (error) {
          console.error("Error fetching NFTs:", error);
          set({
            error: error.message,
            loading: false,
          });
        }
      },

      levelUpNFT: async (actors, tokenId, quality) => {
        try {
          // Get NFT metadata to determine quality and cost

          const upgradeCost = getUpgradeCost(quality);

          // Approve the gamification system to spend tokens
          const walletStore = useWalletStore.getState();
          try {
            await walletStore.approveSpender(actors, {
              spender: {
                owner: Principal.fromText(
                  process.env.CANISTER_ID_GAMIFICATIONSYSTEM
                ),
                subaccount: [],
              },
              amount: upgradeCost,
              memo: `Level up NFT ${tokenId}`,
            });
          } catch (approvalError) {
            return {
              success: false,
              message: `Token approval failed: ${approvalError.message}`,
            };
          }

          const result = await actors.gamificationSystem.levelUpNFT(tokenId);

          if (result.ok) {
            // Refresh NFTs after successful level up
            await get().fetchNFTs(actors);
            return { success: true, message: "NFT leveled up successfully" };
          } else {
            return { success: false, message: result.err };
          }
        } catch (error) {
          console.error("Error leveling up NFT:", error);
          return {
            success: false,
            message: error.message || "Failed to level up NFT",
          };
        }
      },

      restoreHP: async (actors, tokenId, amount) => {
        try {
          // Approve the gamification system to spend tokens
          const walletStore = useWalletStore.getState();
          try {
            await walletStore.approveSpender(actors, {
              spender: {
                owner: Principal.fromText(
                  process.env.CANISTER_ID_GAMIFICATIONSYSTEM
                ),
                subaccount: [],
              },
              amount: amount,
              memo: `Restore HP for NFT ${tokenId}`,
            });
          } catch (approvalError) {
            return {
              success: false,
              message: `Token approval failed: ${approvalError.message}`,
            };
          }

          const result = await actors.gamificationSystem.restoreHP(
            tokenId,
            amount
          );

          if (result.ok) {
            // Refresh NFTs after successful HP restoration
            await get().fetchNFTs(actors);
            return {
              success: true,
              message: `Successfully restored ${amount} HP`,
            };
          } else {
            return { success: false, message: result.err };
          }
        } catch (error) {
          console.error("Error restoring HP:", error);
          return {
            success: false,
            message: error.message || "Failed to restore HP",
          };
        }
      },

      transferNFT: async (actors, tokenId, principalAddress) => {
        try {
          const result = await actors.gamificationSystem.transferNFT(
            tokenId,
            principalAddress
          );

          if (result.ok) {
            // Refresh NFTs after successful transfer
            await get().fetchNFTs(actors);
            return { success: true, message: "NFT transferred successfully" };
          } else {
            return { success: false, message: result.err };
          }
        } catch (error) {
          console.error("Error transferring NFT:", error);
          return {
            success: false,
            message: error.message || "Failed to transfer NFT",
          };
        }
      },
    }),
    {
      name: "nft-storage",
      partialize: (state) => ({
        nfts: state.nfts,
      }),
    }
  )
);

export default useNFTStore;

export const getUpgradeCost = (quality) => {
  switch (quality) {
    case "Common":
      return 1000;
    case "Uncommon":
      return 2500;
    case "Rare":
      return 5000;
    case "Epic":
      return 10000;
    case "Legendary":
      return 25000;
    default:
      return 1000;
  }
};
