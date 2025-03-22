import { create } from "zustand";
import { persist } from "zustand/middleware";
import * as vetkd from "ic-vetkd-utils";
import {
  hex_decode,
  aes_gcm_encrypt,
  aes_gcm_decrypt,
} from "../../../Functions/VETKey/VetKeyFunctions";
import { useToastProgressStore } from "../../ProgressStore/ToastProgressStore";

export const useUserProfileStore = create(
  persist(
    (set, get) => ({
      userProfile: null,
      loading: false,
      error: null,

      resetStore: () => {
        set({ userProfile: null, loading: false, error: null });
      },

      fetchUserProfile: async (user, identityManager, forceRefresh = false) => {
        if (!forceRefresh && get().userProfile) return;
        set({ loading: true, error: null });
        const { setProgress } = useToastProgressStore.getState();

        try {
          setProgress(5, "Initializing profile fetch...");
          const result = await user.readUser();
          console.log(result);
          if (!result.ok) throw new Error(result.err);
          setProgress(15, "User data retrieved...");

          const { IDNum, UUID, MetaData } = result.ok;
          const {
            DemographicInformation,
            BasicHealthParameters,
            BiometricData,
            FamilyInformation,
          } = MetaData;

          setProgress(25, "Setting up encryption...");
          const seed = window.crypto.getRandomValues(new Uint8Array(32));
          const tsk = new vetkd.TransportSecretKey(seed);

          setProgress(35, "Getting encryption keys...");
          const encryptedKeyResult =
            await user.encrypted_symmetric_key_for_user(
              Object.values(tsk.public_key())
            );

          if (encryptedKeyResult.err) throw new Error(encryptedKeyResult.err);

          setProgress(45, "Processing encryption keys...");
          const encryptedKey = encryptedKeyResult.ok;
          const pkBytesHex = await user.symmetric_key_verification_key();
          const principal = await identityManager.whoami();

          setProgress(55, "Generating decryption key...");
          const aesGCMKey = tsk.decrypt_and_hash(
            hex_decode(encryptedKey),
            hex_decode(pkBytesHex),
            new TextEncoder().encode(principal),
            32,
            new TextEncoder().encode("aes-256-gcm")
          );

          setProgress(65, "Decrypting demographic information...");
          const decryptedDataDemo = await aes_gcm_decrypt(
            new Uint8Array(DemographicInformation),
            aesGCMKey
          );

          setProgress(75, "Decrypting health parameters...");
          const decryptedDataBasicHealth = await aes_gcm_decrypt(
            new Uint8Array(BasicHealthParameters),
            aesGCMKey
          );

          setProgress(85, "Parsing demographic data...");
          const parsedDemographicInfo = JSON.parse(
            String.fromCharCode.apply(null, decryptedDataDemo)
          );

          setProgress(90, "Parsing health data...");
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

          setProgress(95, "Finalizing profile data...");
          const processedData = {
            IDNum,
            UUID,
            DemographicInformation: parsedDemographicInfo,
            BasicHealthParameters: parsedBasicHealthParams,
            BiometricData: parsedBiometricData,
            FamilyInformation: parsedFamilyInfo,
          };

          setProgress(100, "Profile loaded successfully!");
          set({ userProfile: processedData, loading: false });
        } catch (error) {
          set({
            error: error.message,
            loading: false,
          });
        }
      },

      updateUserProfile: async (
        user,
        identityManager,
        demoInfo,
        basicHealthPara
      ) => {
        set({ loading: true, error: null });
        const { setProgress } = useToastProgressStore.getState();

        try {
          setProgress(10, "Preparing data for update...");
          // Convert to JSON strings
          const demoInfoJson = JSON.stringify(demoInfo);
          const basicHealthParaJson = JSON.stringify(basicHealthPara);

          setProgress(20, "Converting data format...");
          // Convert to Uint8Array
          const demoInfoArray = new TextEncoder().encode(demoInfoJson);
          const basicHealthParaArray = new TextEncoder().encode(
            basicHealthParaJson
          );

          setProgress(40, "Generating encryption keys...");
          // Get encryption key
          const seed = window.crypto.getRandomValues(new Uint8Array(32));
          const tsk = new vetkd.TransportSecretKey(seed);
          const encryptedKeyResult =
            await user.encrypted_symmetric_key_for_user(
              Object.values(tsk.public_key())
            );

          if (encryptedKeyResult.err) throw new Error(encryptedKeyResult.err);
          setProgress(60, "Encrypting updated data...");

          const encryptedKey = encryptedKeyResult.ok;

          const pkBytesHex = await user.symmetric_key_verification_key();
          const principal = await identityManager.whoami();

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

          setProgress(80, "Sending update to server...");
          const result = await user.updateUser({
            DemographicInformation: Object.values(encryptedDataDemo),
            BasicHealthParameters: Object.values(encryptedDataBasicHealth),
            BiometricData: [],
            FamilyInformation: [],
          });

          if (result.err) throw new Error(result.err);

          setProgress(90, "Updating local state...");
          // Update local state with new data
          const updatedProfile = {
            ...get().userProfile,
            DemographicInformation: demoInfo,
            BasicHealthParameters: basicHealthPara,
          };

          setProgress(100, "Profile updated successfully!");
          set({
            userProfile: updatedProfile,
            loading: false,
          });
          return { success: true, message: result.ok };
        } catch (error) {
          set({
            error: error.message,
            loading: false,
          });
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
