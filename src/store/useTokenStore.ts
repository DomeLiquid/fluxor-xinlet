import { create } from 'zustand'
import { ComputerAsset } from '@/types/computer.types'
import { NetworkClient } from '@mixin.dev/mixin-node-sdk'

interface TokenStore {
  computerAssets: ComputerAsset[]
  assetIconMap: Record<string, string> // asset_id -> icon_url
  chainIconMap: Record<string, string> // chain_id -> icon_url
  setComputerAssets: (assets: ComputerAsset[]) => void
  loadChainIcons: () => Promise<void>
}

export const useTokenStore = create<TokenStore>((set) => ({
  computerAssets: [],
  assetIconMap: {},
  chainIconMap: {},

  setComputerAssets: (assets) => {
    // 创建资产映射表: asset_id -> icon_url
    const assetIconMap = assets.reduce((map, asset) => {
      if (asset.asset?.icon_url) {
        map[asset.asset_id] = asset.asset.icon_url
      }
      return map
    }, {} as Record<string, string>)

    set({ computerAssets: assets, assetIconMap })
  },

  loadChainIcons: async () => {
    try {
      const networkClient = NetworkClient()
      const chains = await networkClient.chains()

      // 创建链图标映射表: chain_id -> icon_url
      const chainIconMap = chains.reduce((map: Record<string, string>, chain: any) => {
        map[chain.chain_id] = chain.icon_url
        return map
      }, {} as Record<string, string>)

      set({ chainIconMap })
    } catch (error) {
      console.error('Failed to load chain icons:', error)
    }
  },
}))