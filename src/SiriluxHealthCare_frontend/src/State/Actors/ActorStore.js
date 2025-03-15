import { create } from "zustand";
import { persist } from "zustand/middleware";
import { AuthClient } from "@dfinity/auth-client";
import { HttpAgent } from "@dfinity/agent";
import { createActor as createUserActor } from "../../../../declarations/User";
import { createActor as createProfessionalActor } from "../../../../declarations/Professional";
import { createActor as createFacilityActor } from "../../../../declarations/Facility";
import { createActor as createDataAssetActor } from "../../../../declarations/DataAsset";
import { createActor as createIdentityManagerActor } from "../../../../declarations/Identity_Manager";
import { createActor as createGamificationSystemActor } from "../../../../declarations/GamificationSystem";
import { createActor as createTokenActor } from "../../../../declarations/icrc_ledger_canister";
import { createActor as createIcrcIndexActor } from "../../../../declarations/icrc_index_canister";
import { createActor as createStorageShardActor } from "../../../../declarations/DataStorageShard";
import { createActor as createSharedActivityShardActor } from "../../../../declarations/SharedActivityShard";
import { createActor as createDataAssetShardActor } from "../../../../declarations/DataAssetShard";
import { createActor as createSubscriptionManagerActor } from "../../../../declarations/Subscription_Manager";
import { createActor as createAIAgentSystemActor } from "../../../../declarations/AIAgentSystem";

const useActorStore = create(
  persist(
    (set, get) => ({
      user: null,
      professional: null,
      facility: null,
      dataAsset: null,
      identityManager: null,
      gamificationSystem: null,
      token: null,
      icrcIndex: null,
      storageShard: null,
      sharedActivity: null,
      dataAssetShard: null,
      subscriptionManager: null,
      aiAgentSystem: null,
      isAuthenticated: false,
      authClient: null,
      initializationStatus: "uninitialized",

      initAuthClient: async () => {
        const client = await AuthClient.create();
        set({ authClient: client });
        if (await client.isAuthenticated()) {
          set({ initializationStatus: "initializing" });
          await get().initializeActors(client);
          set({ isAuthenticated: true, initializationStatus: "initialized" });
        } else {
          set({ initializationStatus: "initialized" });
        }
      },

      initializeActors: async (client) => {
        const identity = client.getIdentity();
        const agent = new HttpAgent({ identity });

        if (process.env.DFX_NETWORK !== "ic") {
          await agent.fetchRootKey().catch(console.error);
        }

        try {
          set({
            user: createUserActor(process.env.CANISTER_ID_USER, { agent }),
            professional: createProfessionalActor(
              process.env.CANISTER_ID_PROFESSIONAL,
              { agent }
            ),
            facility: createFacilityActor(process.env.CANISTER_ID_FACILITY, {
              agent,
            }),
            dataAsset: createDataAssetActor(process.env.CANISTER_ID_DATAASSET, {
              agent,
            }),
            identityManager: createIdentityManagerActor(
              process.env.CANISTER_ID_IDENTITY_MANAGER,
              { agent }
            ),
            gamificationSystem: createGamificationSystemActor(
              process.env.CANISTER_ID_GAMIFICATIONSYSTEM,
              { agent }
            ),
            token: createTokenActor(process.env.CANISTER_ID_TOKEN, { agent }),
            icrcIndex: createIcrcIndexActor(
              process.env.CANISTER_ID_ICRC_INDEX_CANISTER,
              { agent }
            ),
            subscriptionManager: createSubscriptionManagerActor(
              process.env.CANISTER_ID_SUBSCRIPTION_MANAGER,
              { agent }
            ),
            aiAgentSystem: createAIAgentSystemActor(
              process.env.CANISTER_ID_AIAGENTSYSTEM,
              { agent }
            ),
          });
        } catch (error) {
          console.error("Error initializing actors:", error);
        }
      },

      login: async () => {
        let { authClient } = get();
        if (!authClient) {
          authClient = await AuthClient.create();
          set({ authClient });
        }

        await new Promise((resolve) => {
          authClient.login({
            identityProvider: process.env.II_URL,
            onSuccess: resolve,
          });
        });
        set({ isAuthenticated: true });
        await get().initializeActors(authClient);
      },

      logout: async () => {
        const { authClient } = get();
        set({
          user: null,
          professional: null,
          facility: null,
          dataAsset: null,
          identityManager: null,
          gamificationSystem: null,
          token: null,
          icrcIndex: null,
          storageShard: null,
          sharedActivityShard: null,
          dataAssetShard: null,
          subscriptionManager: null,
          aiAgentSystem: null,
          isAuthenticated: false,
          authClient: null,
          initializationStatus: "uninitialized",
        });
        console.log("logout");
        window.localStorage.clear();
        if (authClient) {
          await authClient.logout();
        }
      },

      createStorageShardActorExternal: (storagePrincipal) => {
        const { authClient } = get();
        if (!authClient) return null;

        const identity = authClient.getIdentity();
        const agent = new HttpAgent({ identity });

        if (process.env.DFX_NETWORK !== "ic") {
          agent.fetchRootKey().catch(console.error);
        }

        return createStorageShardActor(storagePrincipal, { agent });
      },

      createSharedActivityShardActorExternal: async (
        sharedActivityPrincipal
      ) => {
        const { authClient } = get();
        if (!authClient) return null;

        const identity = authClient.getIdentity();
        const agent = new HttpAgent({
          identity,
          host:
            process.env.DFX_NETWORK === "ic"
              ? "https://ic0.app"
              : "http://localhost:4943",
        });

        // Always fetch root key for non-mainnet environments
        if (process.env.DFX_NETWORK !== "ic") {
          try {
            await agent.fetchRootKey();
          } catch (error) {
            console.error("Error fetching root key:", error);
            return null;
          }
        }

        return createSharedActivityShardActor(sharedActivityPrincipal, {
          agent,
        });
      },

      createDataAssetShardActorExternal: async (dataAssetPrincipal) => {
        const { authClient } = get();
        if (!authClient) return null;

        const identity = authClient.getIdentity();
        const agent = new HttpAgent({
          identity,
          host:
            process.env.DFX_NETWORK === "ic"
              ? "https://ic0.app"
              : "http://localhost:4943",
        });

        // Always fetch root key for non-mainnet environments
        if (process.env.DFX_NETWORK !== "ic") {
          try {
            await agent.fetchRootKey();
          } catch (error) {
            console.error("Error fetching root key:", error);
            return null;
          }
        }

        return createDataAssetShardActor(dataAssetPrincipal, { agent });
      },
    }),
    {
      name: "actor-storage",
      partialize: (state) => ({
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

export default useActorStore;
