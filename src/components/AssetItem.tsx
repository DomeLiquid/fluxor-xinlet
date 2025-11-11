'use client'

import { Asset } from '@/types'
import { useAppStore } from '@/store'
import clsx from 'clsx'

interface AssetItemProps {
  asset: Asset
}

export default function AssetItem({ asset }: AssetItemProps) {
  const { selectedAssets, toggleAssetSelection } = useAppStore()

  const isSelected = selectedAssets.some(a => a.asset_id === asset.asset_id)
  const canSelect = asset.value_usd < 10

  const handleClick = () => {
    if (canSelect) {
      toggleAssetSelection({
        asset_id: asset.asset_id,
        total_amount: asset.balance,
        outputs: [],
        address: '',
        asset: {
          asset_id: asset.asset_id,
          chain_id: '',
          asset_key: '',
          precision: 0,
          name: asset.name,
          symbol: asset.symbol,
          price_usd: asset.price_usd,
          change_usd: '0',
          icon_url: asset.icon_url,
        }
      })
    }
  }

  return (
    <div
      onClick={handleClick}
      className={clsx(
        'flex items-center justify-between p-3 rounded-lg border transition-all duration-200',
        {
          'border-blue-500 bg-blue-50 cursor-pointer': isSelected,
          'border-gray-200 hover:border-gray-300 cursor-pointer': canSelect && !isSelected,
          'border-gray-300 bg-gray-200 cursor-not-allowed opacity-60': !canSelect,
        }
      )}
    >
      <div className="flex items-center space-x-3 flex-1">
        {/* Asset icon with chain icon overlay */}
        <div className="relative">
          <img
            src={asset.icon_url}
            alt={asset.symbol}
            className={clsx('w-10 h-10 rounded-full', {
              'opacity-50': !canSelect
            })}
            onError={(e) => {
              e.currentTarget.src = '/placeholder-icon.png'
            }}
          />
          {asset.chain_icon_url && (
            <img
              src={asset.chain_icon_url}
              alt="chain"
              className={clsx('absolute -bottom-1 -right-1 w-4 h-4 rounded-full border border-white', {
                'opacity-50': !canSelect
              })}
            />
          )}
        </div>

        {/* Asset info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-2">
            <h3 className={clsx('font-medium truncate', {
              'text-gray-900': canSelect,
              'text-gray-500': !canSelect
            })}>
              {asset.symbol}
            </h3>
            {!canSelect && (
              <span className="text-xs text-gray-600 bg-gray-300 px-2 py-0.5 rounded">
                不可兑换
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500 truncate">
            {asset.name}
          </p>
          {!canSelect && (
            <p className="text-xs text-gray-500 mt-0.5">
              金额需小于 $10 才能兑换
            </p>
          )}
        </div>
      </div>

      {/* Asset value and selection indicator */}
      <div className="text-right">
        <div className={clsx('font-medium', {
          'text-gray-900': canSelect,
          'text-gray-500': !canSelect
        })}>
          ${asset.value_usd.toFixed(8)}
        </div>
        <div className="text-sm text-gray-500">
          {parseFloat(asset.balance).toFixed(8)} {asset.symbol}
        </div>
      </div>
    </div>
  )
}