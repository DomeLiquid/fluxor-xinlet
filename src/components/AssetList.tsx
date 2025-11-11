"use client";

import { useEffect } from "react";
import { useAppStore } from "@/store";
import { useTokenStore } from "@/store/useTokenStore";
import AssetItem from "./AssetItem";

export default function AssetList() {
  const { balances } = useAppStore();
  const chainIconMap = useTokenStore((s) => s.chainIconMap);

  // Convert balances to assets array for display and sort by value_usd descending
  const assets = Object.values(balances)
    .map((balance) => ({
      asset_id: balance.asset_id,
      symbol: balance.asset?.symbol || "Unknown",
      name: balance.asset?.name || "Unknown Asset",
      icon_url: balance.asset?.icon_url || "",
      // 使用链图标映射表获取chain_icon_url，通过chain_id查找对应的链图标
      chain_icon_url: balance.asset?.chain_id
        ? chainIconMap[balance.asset.chain_id] || ""
        : "",
      balance: balance.total_amount,
      price_usd: balance.asset?.price_usd || "0",
      value_usd:
        parseFloat(balance.total_amount) *
        parseFloat(balance.asset?.price_usd || "0"),
    }))
    .sort((a, b) => b.value_usd - a.value_usd);

  const isLoading = false; // Assets are now loaded via useMixin hook

  if (isLoading) {
    return (
      <div className="card p-6">
        <h2 className="text-xl font-semibold mb-4">Your Assets</h2>
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="flex items-center space-x-3 p-3 animate-pulse"
            >
              <div className="w-10 h-10 bg-gray-200 rounded-full"></div>
              <div className="flex-1">
                <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-1/3"></div>
              </div>
              <div className="text-right">
                <div className="h-4 bg-gray-200 rounded w-16 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-12"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="card p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">您的资产</h2>
        <span className="text-sm text-gray-500">{assets.length} 个资产</span>
      </div>

      {assets.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <p>暂无资产</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {assets.map((asset) => (
            <AssetItem key={asset.asset_id} asset={asset} />
          ))}
        </div>
      )}

      <div className="mt-4 pt-4 border-t border-gray-200 space-y-2">
        <p className="text-sm text-gray-600">
          💡 仅支持价值小于 $10 的资产兑换 XIN
        </p>
        <p className="text-sm text-amber-600">
          ⚠️ 当前版本无法自动识别铭文资产，除 MAO 外的其他铭文资产将自动退回
        </p>
      </div>
    </div>
  );
}
