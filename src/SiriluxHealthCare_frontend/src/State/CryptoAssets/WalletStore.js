import { create } from "zustand";
import { persist } from "zustand/middleware";
import { Principal } from "@dfinity/principal";
import useActorStore from "../Actors/ActorStore";

const useWalletStore = create(
  persist(
    (set) => ({
      balance: 0,
      transactions: [],
      loading: false,
      error: null,

      fetchBalance: async () => {
        set({ loading: true, error: null });
        try {
          const { identityManager, token } = useActorStore.getState();

          const account = {
            owner: await identityManager.whoami(),
            subaccount: [],
          };

          const balance = await token.icrc1_balance_of(account);

          set({ balance: Number(balance) / 1e8, loading: false });
        } catch (error) {
          console.log(error);
          set({ error: error.message, loading: false });
        }
      },

      sendTokens: async (transferArgs) => {
        set({ loading: true, error: null });
        try {
          const { token } = useActorStore.getState();

          const result = await token.icrc1_transfer({
            to: transferArgs.to,
            amount: BigInt(transferArgs.amount * 1e8),
            fee: transferArgs.fee ? [BigInt(transferArgs.fee * 1e8)] : [],
            memo: transferArgs.memo
              ? [new TextEncoder().encode(transferArgs.memo)]
              : [],
            from_subaccount: [],
            created_at_time: [],
          });

          if (result.Err) {
            // Convert any BigInt values in the error to strings
            const processedError = JSON.stringify(result.Err, (_, value) =>
              typeof value === "bigint" ? value.toString() : value
            );
            throw new Error(processedError);
          }

          set((state) => ({
            balance: state.balance - transferArgs.amount,
            loading: false,
            transactions: [
              {
                type: "Sent",
                amount: -Number(transferArgs.amount),
                to: transferArgs.to.owner.toText(),
                timestamp: Date.now(),
                block: Number(result.Ok),
              },
              ...state.transactions,
            ],
          }));
        } catch (error) {
          set({ error: error.message, loading: false });
          throw error;
        }
      },

      approveSpender: async (approveArgs) => {
        set({ loading: true, error: null });
        try {
          const { token } = useActorStore.getState();

          const result = await token.icrc2_approve({
            spender: approveArgs.spender,
            amount: BigInt(approveArgs.amount * 1e8),
            expected_allowance: approveArgs.expected_allowance
              ? [BigInt(approveArgs.expected_allowance * 1e8)]
              : [],
            expires_at: [],
            fee: [],
            memo: approveArgs.memo
              ? [new TextEncoder().encode(approveArgs.memo)]
              : [],
            from_subaccount: [],
            created_at_time: [],
          });

          if (result.Err) {
            // Convert any BigInt values in the error to strings
            const processedError = JSON.stringify(result.Err, (_, value) =>
              typeof value === "bigint" ? value.toString() : value
            );
            throw new Error(processedError);
          }
          set({ loading: false });
        } catch (error) {
          set({ error: error.message, loading: false });
          throw error;
        }
      },

      fetchTransactions: async () => {
        set({ loading: true, error: null });
        try {
          const { identityManager, icrcIndex } = useActorStore.getState();

          const principal = await identityManager.whoami();
          const account = {
            owner: principal,
            subaccount: [],
          };

          const response = await icrcIndex.get_account_transactions({
            account,
            max_results: 25n,
            start: [],
          });

          if (response.Err) {
            // Convert any BigInt values in the error to strings
            const processedError = JSON.stringify(response.Err, (_, value) =>
              typeof value === "bigint" ? value.toString() : value
            );
            throw new Error(processedError);
          }

          if (response.Ok) {
            console.log(response.Ok);
            const processedTransactions = response.Ok.transactions.map((tx) => {
              const transaction = tx.transaction;
              console.log(transaction);
              const commonData = {
                id: Number(tx.id),
                timestamp: new Date(Number(transaction.timestamp) / 1000000),
                memo: transaction.transfer?.[0]?.memo?.[0]
                  ? new TextDecoder().decode(
                      new Uint8Array(
                        Object.values(transaction.transfer[0].memo[0])
                      )
                    )
                  : "",
              };

              if (transaction.kind === "mint") {
                return {
                  ...commonData,
                  type: "Mint",
                  to: transaction.mint[0].to.owner.toText(),
                  amount: Number(transaction.mint[0].amount) / 1e8,
                };
              }

              if (transaction.kind === "burn") {
                return {
                  ...commonData,
                  type: "Burn",
                  from: transaction.burn[0].from.owner.toText(),
                  amount: -Number(transaction.burn[0].amount) / 1e8,
                  spender:
                    transaction.burn[0].spender?.[0]?.owner.toText() || "",
                };
              }

              if (transaction.kind === "approve") {
                return {
                  ...commonData,
                  type: "Approve",
                  from: transaction.approve[0].from.owner.toText(),
                  spender: transaction.approve[0].spender.owner.toText(),
                  amount: Number(transaction.approve[0].amount) / 1e8,
                };
              }

              const transferData = transaction.transfer[0];

              const isSender =
                transferData.from.owner.toText() === principal.toText();
              return {
                ...commonData,
                type: isSender ? "Sent" : "Received",
                from: transferData.from.owner.toText(),
                to: transferData.to.owner.toText(),
                amount: isSender
                  ? -Number(transferData.amount) / 1e8
                  : Number(transferData.amount) / 1e8,
                spender: transferData.spender[0]?.owner.toText() || "",
              };
            });

            set({ transactions: processedTransactions, loading: false });
          }
        } catch (error) {
          console.error("Transaction fetch error:", error);
          set({
            error: error.message || "Failed to fetch transactions",
            loading: false,
          });
        }
      },
    }),
    {
      name: "wallet-storage",
      partialize: (state) => ({
        balance: state.balance,
        transactions: state.transactions,
      }),
    }
  )
);

export default useWalletStore;
