import { create } from "zustand";
import { persist } from "zustand/middleware";
import * as vetkd from "ic-vetkd-utils";
import {
  hex_decode,
  aes_gcm_encrypt,
  aes_gcm_decrypt,
} from "../../../Functions/VETKey/VetKeyFunctions";

export const useUserProfileStore = create(
  persist(
    (set, get) => ({
      userProfile: null,
      loading: false,
      error: null,

      fetchUserProfile: async (actors, forceRefresh = false) => {
        if (!forceRefresh && get().userProfile) return;
        set({ loading: true, error: null });

        try {
          const result = await actors.user.readUser();

          if (!result.ok) throw new Error(result.err);

          const { IDNum, UUID, MetaData } = result.ok;
          const {
            DemographicInformation,
            BasicHealthParameters,
            BiometricData,
            FamilyInformation,
          } = MetaData;

          // Get encryption key
          const seed = window.crypto.getRandomValues(new Uint8Array(32));
          const tsk = new vetkd.TransportSecretKey(seed);
          const encryptedKeyResult =
            await actors.user.encrypted_symmetric_key_for_user(
              Object.values(tsk.public_key())
            );

          if (encryptedKeyResult.err) throw new Error(encryptedKeyResult.err);
          const encryptedKey = encryptedKeyResult.ok;

          const pkBytesHex = await actors.user.symmetric_key_verification_key();
          const principal = await actors.user.whoami();

          const aesGCMKey = tsk.decrypt_and_hash(
            hex_decode(encryptedKey),
            hex_decode(pkBytesHex),
            new TextEncoder().encode(principal),
            32,
            new TextEncoder().encode("aes-256-gcm")
          );

          // Decrypt data
          const decryptedDataDemo = await aes_gcm_decrypt(
            new Uint8Array(DemographicInformation),
            aesGCMKey
          );
          const decryptedDataBasicHealth = await aes_gcm_decrypt(
            new Uint8Array(BasicHealthParameters),
            aesGCMKey
          );

          const parsedDemographicInfo = JSON.parse(
            String.fromCharCode.apply(null, decryptedDataDemo)
          );
          const parsedBasicHealthParams = JSON.parse(
            String.fromCharCode.apply(null, decryptedDataBasicHealth)
          );
          const parsedBiometricData =
            BiometricData.length > 0
              ? JSON.parse(String.fromCharCode.apply(null, BiometricData))
              : null;
          const parsedFamilyInfo =
            FamilyInformation.length > 0
              ? JSON.parse(String.fromCharCode.apply(null, FamilyInformation))
              : null;

          const processedData = {
            IDNum,
            UUID,
            DemographicInformation: parsedDemographicInfo,
            BasicHealthParameters: parsedBasicHealthParams,
            BiometricData: parsedBiometricData,
            FamilyInformation: parsedFamilyInfo,
          };

          set({ userProfile: processedData, loading: false });
        } catch (error) {
          set({ error: error.message, loading: false });
        }
      },

      updateUserProfile: async (actors, demoInfo, basicHealthPara) => {
        set({ loading: true, error: null });
        try {
          // Convert to JSON strings
          const demoInfoJson = JSON.stringify(demoInfo);
          const basicHealthParaJson = JSON.stringify(basicHealthPara);

          // Convert to Uint8Array
          const demoInfoArray = new TextEncoder().encode(demoInfoJson);
          const basicHealthParaArray = new TextEncoder().encode(
            basicHealthParaJson
          );

          // Get encryption key
          const seed = window.crypto.getRandomValues(new Uint8Array(32));
          const tsk = new vetkd.TransportSecretKey(seed);
          console.log(actors.user);
          const encryptedKeyResult =
            await actors.user.encrypted_symmetric_key_for_user(
              Object.values(tsk.public_key())
            );

          if (encryptedKeyResult.err) throw new Error(encryptedKeyResult.err);
          const encryptedKey = encryptedKeyResult.ok;

          const pkBytesHex = await actors.user.symmetric_key_verification_key();
          const principal = await actors.user.whoami();

          const aesGCMKey = tsk.decrypt_and_hash(
            hex_decode(encryptedKey),
            hex_decode(pkBytesHex),
            new TextEncoder().encode(principal),
            32,
            new TextEncoder().encode("aes-256-gcm")
          );

          // Encrypt data
          const encryptedDataDemo = await aes_gcm_encrypt(
            demoInfoArray,
            aesGCMKey
          );
          const encryptedDataBasicHealth = await aes_gcm_encrypt(
            basicHealthParaArray,
            aesGCMKey
          );

          const result = await actors.user.updateUser({
            DemographicInformation: Object.values(encryptedDataDemo),
            BasicHealthParameters: Object.values(encryptedDataBasicHealth),
            BiometricData: [],
            FamilyInformation: [],
          });

          if (result.err) throw new Error(result.err);

          // Update local state with new data
          const updatedProfile = {
            ...get().userProfile,
            DemographicInformation: demoInfo,
            BasicHealthParameters: basicHealthPara,
          };

          set({ userProfile: updatedProfile, loading: false });
          return { success: true, message: result.ok };
        } catch (error) {
          set({ error: error.message, loading: false });
          return { success: false, message: error.message };
        }
      },
    }),
    {
      name: "user-profile-storage",
      getStorage: () => localStorage,
    }
  )
);
