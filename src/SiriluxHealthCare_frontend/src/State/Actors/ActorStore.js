import { create } from "zustand";
import { persist } from "zustand/middleware";
import { AuthClient } from "@dfinity/auth-client";
import { HttpAgent } from "@dfinity/agent";
import { createActor as createUserActor } from "../../../../declarations/User";
import { createActor as createProfessionalActor } from "../../../../declarations/Professional";
import { createActor as createFacilityActor } from "../../../../declarations/Facility";
import { createActor as createDataAssetActor } from "../../../../declarations/DataAsset";
import { createActor as createIdentityManagerActor } from "../../../../declarations/Identity_Manager";
import { createActor as createSharedActivityActor } from "../../../../declarations/Shared_Activity";
import { createActor as createGamificationSystemActor } from "../../../../declarations/GamificationSystem";
import { createActor as createTokenActor } from "../../../../declarations/icrc_ledger_canister";
import { createActor as createIcrcIndexActor } from "../../../../declarations/icrc_index_canister";
import { createActor as createStorageShardActor } from "../../../../declarations/DataStorageShard";

const useActorStore = create(
  persist(
    (set, get) => ({
      actors: {
        user: null,
        professional: null,
        facility: null,
        dataAsset: null,
        identityManager: null,
        sharedActivity: null,
        gamificationSystem: null,
        token: null,
        icrcIndex: null,
        storageShard: null,
      },
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
            actors: {
              user: createUserActor(process.env.CANISTER_ID_USER, { agent }),
              professional: createProfessionalActor(
                process.env.CANISTER_ID_PROFESSIONAL,
                { agent }
              ),
              facility: createFacilityActor(process.env.CANISTER_ID_FACILITY, {
                agent,
              }),
              dataAsset: createDataAssetActor(
                process.env.CANISTER_ID_DATAASSET,
                { agent }
              ),
              identityManager: createIdentityManagerActor(
                process.env.CANISTER_ID_IDENTITY_MANAGER,
                { agent }
              ),
              sharedActivity: createSharedActivityActor(
                process.env.CANISTER_ID_SHARED_ACTIVITY,
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
            },
          });
        } catch (error) {
          console.error("Error initializing actors:", error);
        }
      },

      login: async () => {
        const { authClient } = get();
        if (authClient) {
          await new Promise((resolve) => {
            authClient.login({
              identityProvider: process.env.II_URL,
              onSuccess: resolve,
            });
          });
          set({ isAuthenticated: true });
          await get().initializeActors(authClient);
        }
      },

      logout: async () => {
        const { authClient } = get();
        set({
          actors: {
            user: null,
            professional: null,
            facility: null,
            dataAsset: null,
            identityManager: null,
            sharedActivity: null,
            gamificationSystem: null,
            token: null,
            icrcIndex: null,
            storageShard: null,
          },
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
