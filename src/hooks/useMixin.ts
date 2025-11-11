import { useEffect } from 'react'
import { useAppStore } from '@/store'
import { useTokenStore } from '@/store/useTokenStore'

// Mock computer assets for now - in a real implementation, this would come from the Fluxor Mini backend
export const mockComputerAssets = [
  {
    asset_id: 'c94ac88f-4671-3976-b60a-09064f1811e8', // XIN
    address: '11111111111111111111111111111111',
    uri: '',
    asset: {
      asset_id: 'c94ac88f-4671-3976-b60a-09064f1811e8',
      chain_id: 'c94ac88f-4671-3976-b60a-09064f1811e8',
      asset_key: '0xA974c709cFb4566686553a20790685A47acEAA33',
      precision: 8,
      name: 'Mixin',
      symbol: 'XIN',
      price_usd: '100',
      change_usd: '0',
      icon_url: 'https://mixin-images.zeromesh.net/zVDjOxNTQvVsA8h2B4ZVxuHoCF3DJszufYKWlp9DvzIcXNUb8S4qB4fwpjGJFAhRqVrzZsvg7RgfJRmHnB9bXpjb=w128'
    }
  },
  {
    asset_id: '43d61dcd-e413-450d-80b8-101d5e903357', // ETH
    address: '22222222222222222222222222222222',
    uri: '',
    asset: {
      asset_id: '43d61dcd-e413-450d-80b8-101d5e903357',
      chain_id: '43d61dcd-e413-450d-80b8-101d5e903357',
      asset_key: '0x0000000000000000000000000000000000000000',
      precision: 18,
      name: 'Ethereum',
      symbol: 'ETH',
      price_usd: '2000',
      change_usd: '0',
      icon_url: 'https://mixin-images.zeromesh.net/zVDjOxNTQvVsA8h2B4ZVxuHoCF3DJszufYKWlp9DvzIcXNUb8S4qB4fwpjGJFAhRqVrzZsvg7RgfJRmHnB9bXpjb=w128'
    }
  }
]

export default function useMixin() {
  const { user, updateBalances } = useAppStore()
  const computerAssets = useTokenStore((s) => s.computerAssets)

  useEffect(() => {
    if (!user) return

    // Load chain icons from Mixin Network
    useTokenStore.getState().loadChainIcons()

    // For now, use mock data. In production, this would fetch from Fluxor Mini backend
    useTokenStore.getState().setComputerAssets(mockComputerAssets)

    // Update balances with the computer assets
    updateBalances(mockComputerAssets)

    // Set up interval to refresh balances every minute
    const id = window.setInterval(() => {
      updateBalances(computerAssets)
    }, 60 * 1000)

    return () => window.clearInterval(id)
  }, [user, computerAssets, updateBalances])
}