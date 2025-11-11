// import { Connection, PublicKey } from "@solana/web3.js";
import {
  buildMixAddress,
  MixinApi,
  SafeUtxoOutput,
  Keystore,
  UserResponse,
  SafeAsset,
} from "@mixin.dev/mixin-node-sdk";
import { create, StateCreator } from "zustand";
import { persist, PersistOptions, devtools } from "zustand/middleware";
import {
  ComputerAsset,
  ComputerAssetResponse,
  ComputerInfoResponse,
  ComputerUserResponse,
  UserAssetBalance,
  UserAssetBalanceWithoutAsset,
} from "@/types/computer.types";
// import { initComputerClient } from "../computer";
// import { SOL_ASSET_ID } from "../constants";
// import { NATIVE_MINT, SYSTEM_PROGRAM_ID } from "@mrgnlabs/mrgn-common";
// import { add } from "../number";
// import { initFluxorClient } from "../fluxor";
import { add } from "@/types/number";

export type MixinClient = ReturnType<typeof MixinApi>;

interface ComputerState {
  // State
  user?: UserResponse;
  keystore?: Keystore;
  balances: Record<string, UserAssetBalance>;
  balanceAddressMap: Record<string, UserAssetBalance>;
  info?: ComputerInfoResponse;
  account?: ComputerUserResponse;
  // publicKey?: PublicKey | string; // 允许字符串类型以兼容 localStorage 持久化
  connected: boolean;
  register: boolean;

  // Asset selection state
  selectedAssets: UserAssetBalance[];
  totalSelectedValue: number;

  // Actions
  getMixinClient: () => MixinClient;
  setKeystore: (k: Keystore) => MixinClient;
  getMe: () => Promise<void>;
  updateBalances: (cas: ComputerAssetResponse[]) => Promise<void>;
  getUserMix: () => string;
  getComputerInfo: () => Promise<void>;
  getComputerAccount: () => Promise<void>;
  getComputerRecipient: () => string;
  clear: () => void;

  // Asset selection actions
  toggleAssetSelection: (asset: UserAssetBalance) => void;
  clearSelection: () => void;

  // // Computed getters
  // getPublicKey: () => PublicKey | undefined;

  // State
  computerAssets: ComputerAsset[];
  computerAssetIdMap: Record<string, ComputerAsset>;
  computerAssetAddressMap: Record<string, ComputerAsset>;

  // Actions
  getComputerAssets: () => Promise<void>;
}

const initComputerState = {
  balances: {},
  balanceAddressMap: {},
  connected: false,
  register: false,
  // publicKey: PublicKey.default, // 设置为 undefined 而不是 PublicKey.default
  computerAssets: [],
  computerAssetIdMap: {},
  computerAssetAddressMap: {},
  selectedAssets: [],
  totalSelectedValue: 0,
};

// const computerClient = initComputerClient();

type ComputerStorePersist = (
  config: StateCreator<ComputerState>,
  options: PersistOptions<ComputerState>
) => StateCreator<ComputerState>;

const createAppStore = () => {
  return create<ComputerState>()(
    devtools(
      (persist as ComputerStorePersist)(
        (
          set: (state: Partial<ComputerState>) => void,
          get: () => ComputerState
        ) => ({
          // State
          ...initComputerState,

          // Actions
          setKeystore: (keystore: Keystore) => {
            set({ keystore });
            return MixinApi({ keystore });
          },

          getMixinClient: () => {
            const { keystore } = get();
            return MixinApi({ keystore });
          },

          getMe: async () => {
            const { keystore } = get();
            if (!keystore) return;
            const mc = MixinApi({ keystore });
            try {
              const user = await mc.user.profile();
              const mix = buildMixAddress({
                version: 2,
                xinMembers: [],
                uuidMembers: [user.user_id],
                threshold: 1,
              });
              // const account = await computerClient.fetchUser(mix);
              // if (account)
              //   set({
              //     user,
              //     account,
              //     register: true,
              //     connected: true,
              //   });
              // if (account.chain_address !== get().publicKey) {
              //   set({ publicKey: new PublicKey(account.chain_address) });
              // } else set({ user, connected: true, register: false });
              set({ user, connected: true, register: true });
            } catch (e) {
              console.error("getMe error:", e);
            }
          },

          getUserMix: () => {
            const { user } = get();
            if (!user) return "";
            return buildMixAddress({
              version: 2,
              xinMembers: [],
              uuidMembers: [user.user_id],
              threshold: 1,
            });
          },

          updateBalances: async (as: ComputerAssetResponse[]) => {
            const { user, getMixinClient } = get();
            if (!user) return;
            const client = getMixinClient();
            const members = [user.user_id];
            let offset = 0;
            let total: SafeUtxoOutput[] = [];
            while (true) {
              const outputs = await client.utxo.safeOutputs({
                limit: 500,
                members,
                threshold: 1,
                state: "unspent",
                offset,
              });
              total = [...total, ...outputs];
              if (outputs.length < 500) {
                break;
              }
              offset = outputs[outputs.length - 1].sequence + 1;
            }
            const bm = total.reduce((prev, cur) => {
              const key = cur.asset_id;
              if (prev[key]) {
                prev[key].outputs = [...prev[key].outputs, cur];
                prev[key].total_amount = add(
                  prev[key].total_amount,
                  cur.amount
                ).toString();
              } else {
                const address = as.find(
                  (a) => a.asset_id === cur.asset_id
                )?.address;
                prev[key] = {
                  asset_id: cur.asset_id,
                  total_amount: cur.amount,
                  outputs: [cur],
                  address,
                };
              }
              return prev;
            }, {} as Record<string, UserAssetBalanceWithoutAsset>);
            const assets = await client.safe.fetchAssets(Object.keys(bm));

            const fbm = assets.reduce((prev, cur) => {
              const b = bm[cur.asset_id];
              const v: UserAssetBalance = { ...b, asset: cur };
              // if (cur.chain_id === SOL_ASSET_ID) v.address = cur.asset_key;
              prev[cur.asset_id] = v;
              return prev;
            }, {} as Record<string, UserAssetBalance>);

            const bs = Object.values(fbm).filter((b) => b.address);
            // const am = Object.fromEntries(bs.map((b) => [b.address, b])) as Record<string, UserAssetBalance>;
            // 转换地址
            const convertedBs = bs.map((b) => ({
              ...b,
              // address:
              //   b.address === SYSTEM_PROGRAM_ID.toString()
              //     ? NATIVE_MINT.toString()
              //     : b.address === NATIVE_MINT.toString()
              //     ? SYSTEM_PROGRAM_ID.toString()
              //   : b.address,
            }));
            const am = Object.fromEntries(
              convertedBs.map((b) => [b.address, b])
            ) as Record<string, UserAssetBalance>;

            set({ balances: fbm, balanceAddressMap: am });
          },

          getComputerInfo: async () => {
            // const info = await computerClient.fetchInfo();
            // if (info) set({ info });
          },

          getComputerAccount: async () => {
            // const { user, getUserMix } = get();
            // if (!user) return;
            // const account = await computerClient.fetchUser(getUserMix());
            // if (account)
            //   set({
            //     account,
            //     connected: true,
            //     register: true,
            //   });
            // if (account.chain_address !== get().publicKey) {
            //   set({ publicKey: new PublicKey(account.chain_address) });
            // } else set({ connected: true, register: false });
          },

          getComputerRecipient: () => {
            const { info } = get();
            if (!info) return "";
            return buildMixAddress({
              version: 2,
              xinMembers: [],
              uuidMembers: info.members.members,
              threshold: info.members.threshold,
            });
          },

          clear: () => {
            set({
              user: undefined,
              keystore: undefined,
              balances: {},
              balanceAddressMap: {},
              info: undefined,
              account: undefined,
              connected: false,
              register: false,
              // publicKey: PublicKey.default,
              selectedAssets: [],
              totalSelectedValue: 0,
            });
          },

          // Asset selection actions
          toggleAssetSelection: (asset: UserAssetBalance) => {
            const { selectedAssets } = get();
            const isSelected = selectedAssets.some(
              (a) => a.asset_id === asset.asset_id
            );

            if (isSelected) {
              // Remove from selection
              const newSelected = selectedAssets.filter(
                (a) => a.asset_id !== asset.asset_id
              );
              const newTotalValue = newSelected.reduce((total, a) => {
                const amount = parseFloat(a.total_amount);
                const price = parseFloat(a.asset?.price_usd || "0");
                return total + amount * price;
              }, 0);

              set({
                selectedAssets: newSelected,
                totalSelectedValue: newTotalValue,
              });
            } else {
              // Add to selection
              const amount = parseFloat(asset.total_amount);
              const price = parseFloat(asset.asset?.price_usd || "0");
              const assetValue = amount * price;

              // Check if asset value is less than $10
              if (assetValue < 10) {
                const newSelected = [...selectedAssets, asset];
                const newTotalValue =
                  selectedAssets.reduce((total, a) => {
                    const aAmount = parseFloat(a.total_amount);
                    const aPrice = parseFloat(a.asset?.price_usd || "0");
                    return total + aAmount * aPrice;
                  }, 0) + assetValue;

                set({
                  selectedAssets: newSelected,
                  totalSelectedValue: newTotalValue,
                });
              }
            }
          },

          clearSelection: () => {
            set({
              selectedAssets: [],
              totalSelectedValue: 0,
            });
          },

          // Computed getters
          getPublicKey: () => {
            // const { publicKey } = get();
            // // 如果 publicKey 是字符串（从 localStorage 恢复的），转换为 PublicKey 对象
            // if (typeof publicKey === "string") {
            //   try {
            //     return new PublicKey(publicKey);
            //   } catch (error) {
            //     return PublicKey.default;
            //   }
            // }
            // // 如果已经是 PublicKey 对象，直接返回
            // if (publicKey instanceof PublicKey) {
            //   return publicKey;
            // }
            // return PublicKey.default;
          },

          // Actions
          getComputerAssets: async () => {
            // console.log("🚀 getComputerAssets");
            // const assets = await computerClient.fetchAssets();
            // assets.push({
            //   asset_id: "64692c23-8971-4cf4-84a7-4dd1271dd887",
            //   address: "So11111111111111111111111111111111111111112",
            //   uri: "https://mixin-images.zeromesh.net/eTzm8_cWke8NqJ3zbQcx7RkvbcTytD_NgBpdwIAgKJRpOoo0S0AQ3IQ-YeBJgUKmpsMPUHcZFzfuWowv3801cF5HXfya5MQ9fTA9HQ=s128",
            //   decimals: 9,
            // });
            // const { computerAssets: current } = get();
            // if (assets.length > current.length) {
            //   const ids = assets.map((a: ComputerAssetResponse) => a.asset_id);
            //   const mp = assets.reduce<Record<string, number>>(
            //     (prev, cur, index) => {
            //       prev[cur.asset_id] = index;
            //       return prev;
            //     },
            //     {}
            //   );
            //   const mixinClient = get().getMixinClient();
            //   let mas: SafeAsset[] = [];
            //   try {
            //     mas = await mixinClient.safe.fetchAssets(ids);
            //   } catch (e) {}
            //   const fas = mas.map((a: any) => ({
            //     ...assets[mp[a.asset_id]],
            //     asset: a,
            //   }));
            //   const addressMap = fas.reduce<Record<string, ComputerAsset>>(
            //     (prev, cur) => {
            //       prev[cur.address] = cur;
            //       return prev;
            //     },
            //     {}
            //   );
            //   const idMap = fas.reduce<Record<string, ComputerAsset>>(
            //     (prev, cur) => {
            //       prev[cur.asset_id] = cur;
            //       return prev;
            //     },
            //     {}
            //   );
            //   set({
            //     computerAssets: fas,
            //     computerAssetAddressMap: addressMap,
            //     computerAssetIdMap: idMap,
            //   });
            // }
          },
        }),

        {
          name: "miniStore",
        }
      )
    )
  );
};

const useAppStore = createAppStore();

export { useAppStore };
export type { ComputerState };
