import { create } from "zustand";
import { persist } from "zustand/middleware";
import useWalletStore from "./WalletStore";
import { Principal } from "@dfinity/principal";
import useActorStore from "../Actors/ActorStore";

const useNFTStore = create(
  persist(
    (set, get) => ({
      nfts: [],
      loading: false,
      error: null,

      fetchNFTs: async () => {
        try {
          set({ loading: true, error: null });
          const actorStore = useActorStore.getState();
          const gamificationSystem = actorStore.gamificationSystem;

          if (!gamificationSystem) {
            throw new Error("Gamification system actor not initialized");
          }

          const avatarsResult = await gamificationSystem.getUserAvatarsSelf();
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

      levelUpNFT: async (tokenId, quality) => {
        try {
          // Get NFT metadata to determine quality and cost
          const actorStore = useActorStore.getState();
          const gamificationSystem = actorStore.gamificationSystem;

          if (!gamificationSystem) {
            return {
              success: false,
              message: "Gamification system actor not initialized",
            };
          }

          const upgradeCost = getUpgradeCost(quality);

          // Approve the gamification system to spend tokens
          const walletStore = useWalletStore.getState();
          try {
            await walletStore.approveSpender({
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

          const result = await gamificationSystem.levelUpNFT(tokenId);

          if (result.ok) {
            // Refresh NFTs after successful level up
            await get().fetchNFTs();
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

      restoreHP: async (tokenId, amount) => {
        try {
          const actorStore = useActorStore.getState();
          const gamificationSystem = actorStore.gamificationSystem;

          if (!gamificationSystem) {
            return {
              success: false,
              message: "Gamification system actor not initialized",
            };
          }

          // Approve the gamification system to spend tokens
          const walletStore = useWalletStore.getState();
          try {
            await walletStore.approveSpender({
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

          const result = await gamificationSystem.restoreHP(tokenId, amount);

          if (result.ok) {
            // Refresh NFTs after successful HP restoration
            await get().fetchNFTs();
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

      transferNFT: async (tokenId, principalAddress) => {
        try {
          const actorStore = useActorStore.getState();
          const gamificationSystem = actorStore.gamificationSystem;

          if (!gamificationSystem) {
            return {
              success: false,
              message: "Gamification system actor not initialized",
            };
          }

          const result = await gamificationSystem.transferNFT(
            tokenId,
            principalAddress
          );

          if (result.ok) {
            // Refresh NFTs after successful transfer
            await get().fetchNFTs();
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

      mintNFT: async (principalId, nftType, specificType) => {
        try {
          const actorStore = useActorStore.getState();
          const gamificationSystem = actorStore.gamificationSystem;

          if (!gamificationSystem) {
            return {
              success: false,
              message: "Gamification system actor not initialized",
            };
          }

          // Approve the gamification system to spend tokens
          const walletStore = useWalletStore.getState();
          const mintCost = 500; // Base cost for minting an NFT

          try {
            await walletStore.approveSpender({
              spender: {
                owner: Principal.fromText(
                  process.env.CANISTER_ID_GAMIFICATIONSYSTEM
                ),
                subaccount: [],
              },
              amount: mintCost,
              memo: `Mint ${nftType} NFT`,
            });
          } catch (approvalError) {
            return {
              success: false,
              message: `Token approval failed: ${approvalError.message}`,
            };
          }

          let result;
          if (nftType === "avatar") {
            const avatarTypeVariant = { [specificType]: null };
            result = await gamificationSystem.mintWellnessAvatar(
              principalId,
              [],
              avatarTypeVariant
            );
          } else if (nftType === "professional") {
            const professionalTypeVariant = { [specificType]: null };
            result = await gamificationSystem.mintProfessionalNFT(
              principalId,
              [],
              professionalTypeVariant
            );
          } else if (nftType === "facility") {
            const facilityTypeVariant = { [specificType]: null };
            result = await gamificationSystem.mintFacilityNFT(
              principalId,
              [],
              facilityTypeVariant
            );
          }

          if (result && result[0]?.Ok) {
            // Refresh NFTs after successful minting
            await get().fetchNFTs();
            return {
              success: true,
              message: `${nftType.charAt(0).toUpperCase() + nftType.slice(1)} NFT minted successfully`,
            };
          } else {
            const error = result[0]?.Err || result[0]?.GenericError;
            return {
              success: false,
              message: error?.message || "Unknown error occurred",
            };
          }
        } catch (error) {
          console.error(`Error minting ${nftType} NFT:`, error);
          return {
            success: false,
            message: error.message || `Failed to mint ${nftType} NFT`,
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
