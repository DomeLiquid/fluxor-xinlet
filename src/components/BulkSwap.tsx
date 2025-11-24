"use client";

import { useState, useMemo, useEffect } from "react";
import { useAppStore } from "@/store";
import { createMixinSwapService } from "@/services/mixin-swap";
import { formatUSD, formatBalance } from "@/utils/format";
import { decodeSwapTx } from "@/types/mixin-route.types";
import type { SwapRespView, TokenView } from "@/types/mixin-route.types";
import { toast } from "react-hot-toast";
import { AppKeystore } from "@mixin.dev/mixin-node-sdk";
import TokenSelectorModal from "./TokenSelectorModal";

// XIN Asset ID
const XIN_ASSET_ID = "c94ac88f-4671-3976-b60a-09064f1811e8";

interface SwapOrder {
  assetId: string;
  symbol: string;
  icon: string;
  inputAmount: string;
  outputAmount: string;
  payUrl: string;
  orderId: string;
  traceId: string;
  isPaid: boolean;
}

export default function BulkSwap() {
  const { user, keystore, balances, getMixinClient, updateBalances } = useAppStore();
  const { computerAssets } = useAppStore();
  const [selectedAssetIds, setSelectedAssetIds] = useState<Set<string>>(
    new Set()
  );
  const [swapPercentage, setSwapPercentage] = useState(100);
  const [searchQuery, setSearchQuery] = useState("");
  const [outputToken, setOutputToken] = useState<TokenView | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [swapOrders, setSwapOrders] = useState<SwapOrder[]>([]);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showTokenSelector, setShowTokenSelector] = useState(false);
  const [supportedTokens, setSupportedTokens] = useState<TokenView[]>([]);
  const [isLoadingTokens, setIsLoadingTokens] = useState(true);
  const [outputTokenPrice, setOutputTokenPrice] = useState<number>(0);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);

  const keystore2: AppKeystore = {
    app_id: process.env.MIXIN_CLIENT_ID || "your-app-id",
    session_id: process.env.MIXIN_SESSION_ID || "your-session-id",
    server_public_key:
      process.env.MIXIN_SERVER_PUBLIC_KEY || "your-server-public-key",
    session_private_key:
      process.env.MIXIN_SESSION_PRIVATE_KEY || "your-session-private-key",
  };

  console.log("keystore2", { keystore: keystore2 });
  const swapService = createMixinSwapService(keystore2);

  // Load supported tokens
  useEffect(() => {
    const loadTokens = async () => {
      if (!keystore) return;

      try {
        setIsLoadingTokens(true);
        const tokens = await swapService.getSupportedTokens();
        setSupportedTokens(tokens);

        // Set default output token to XIN
        const xinToken = tokens.find(t => t.assetId === XIN_ASSET_ID);
        if (xinToken) {
          setOutputToken(xinToken);
        } else if (tokens.length > 0) {
          setOutputToken(tokens[0]);
        }
      } catch (error) {
        console.error("Failed to load supported tokens:", error);
        toast.error("加载支持的代币失败");
      } finally {
        setIsLoadingTokens(false);
      }
    };

    loadTokens();
  }, [keystore]);

  // Filter and sort assets
  const filteredAssets = useMemo(() => {
    const assetList = Object.values(balances).filter((balance) => {
      const value =
        parseFloat(balance.total_amount) *
        parseFloat(balance.asset?.price_usd || "0");
      // Filter out assets with value < $0.1 (still show for display)
      if (value < 0.1) return false;

      // Filter by search query
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          balance.asset?.symbol.toLowerCase().includes(query) ||
          balance.asset?.name.toLowerCase().includes(query)
        );
      }

      return true;
    });

    // Sort by USD value (descending)
    return assetList.sort((a, b) => {
      const aValue =
        parseFloat(a.total_amount) * parseFloat(a.asset?.price_usd || "0");
      const bValue =
        parseFloat(b.total_amount) * parseFloat(b.asset?.price_usd || "0");
      return bValue - aValue;
    });
  }, [balances, searchQuery]);

  // Calculate total selected value and estimated output
  const swapSummary = useMemo(() => {
    let totalInputValue = 0;
    let estimatedOutputAmount = 0;

    const selectedAssetDetails = Array.from(selectedAssetIds).map((assetId) => {
      const balance = balances[assetId];
      if (!balance) return null;

      const totalAmount = parseFloat(balance.total_amount);
      const inputAmount = totalAmount * (swapPercentage / 100);
      const price = parseFloat(balance.asset?.price_usd || "0");
      const inputValue = inputAmount * price;

      totalInputValue += inputValue;

      return {
        assetId,
        symbol: balance.asset?.symbol || "",
        icon: balance.asset?.icon_url || "",
        totalAmount,
        inputAmount,
        inputValue,
      };
    }).filter(Boolean);

    // Calculate estimated output amount: totalValue / outputPrice * 0.99
    if (outputToken && totalInputValue > 0 && outputTokenPrice > 0) {
      estimatedOutputAmount = (totalInputValue / outputTokenPrice) * 0.99;
    }

    return {
      totalInputValue,
      estimatedOutputAmount,
      selectedAssetDetails: selectedAssetDetails as NonNullable<typeof selectedAssetDetails[0]>[],
    };
  }, [selectedAssetIds, balances, swapPercentage, outputToken, outputTokenPrice]);

  const handleToggleAsset = (assetId: string) => {
    const balance = balances[assetId];
    if (!balance) return;

    // Check minimum value
    const value = parseFloat(balance.total_amount) * parseFloat(balance.asset?.price_usd || "0");
    if (value < 1) {
      toast.error('资产价值需要大于 $1 才能兑换');
      return;
    }

    // Don't allow selecting the same asset as output token
    if (outputToken && assetId === outputToken.assetId) {
      toast.error('不能兑换成相同的资产');
      return;
    }

    const newSet = new Set(selectedAssetIds);
    if (newSet.has(assetId)) {
      newSet.delete(assetId);
    } else {
      newSet.add(assetId);
    }
    setSelectedAssetIds(newSet);
  };

  // Auto-deselect assets when they become the output token
  useEffect(() => {
    if (outputToken && selectedAssetIds.has(outputToken.assetId)) {
      const newSet = new Set(selectedAssetIds);
      newSet.delete(outputToken.assetId);
      setSelectedAssetIds(newSet);
      toast.success(`已自动取消选择 ${outputToken.symbol}，不能兑换成相同的资产`);
    }
  }, [outputToken?.assetId]);

  // Fetch output token price when it changes
  useEffect(() => {
    const fetchOutputTokenPrice = async () => {
      if (!outputToken) {
        setOutputTokenPrice(0);
        return;
      }

      try {
        const assetInfo = await swapService.getAssetInfo({ assetId: outputToken.assetId });
        const price = parseFloat(assetInfo.current_price || "0");
        setOutputTokenPrice(price);
      } catch (error) {
        console.error("Failed to fetch output token price:", error);
        toast.error(`获取 ${outputToken.symbol} 价格失败，预估可能不准确`);
        setOutputTokenPrice(0);
      }
    };

    fetchOutputTokenPrice();
  }, [outputToken?.assetId]);

  const handleCalculateSwap = async () => {
    if (!keystore || !user || selectedAssetIds.size === 0 || !outputToken) return;

    setIsCalculating(true);
    setSwapOrders([]);

    try {
      const referUserId = process.env.MIXIN_REFER_USER_ID;

      // Create swap orders concurrently
      const swapPromises = Array.from(selectedAssetIds).map(async (assetId) => {
        const balance = balances[assetId];
        if (!balance) return null;

        const totalAmount = parseFloat(balance.total_amount);
        const inputAmount = ((totalAmount * swapPercentage) / 100).toString();

        try {
          const result = await swapService.executeSwap({
            payerUserId: user.user_id,
            inputAssetId: assetId,
            outputAssetId: outputToken.assetId,
            inputAmount: inputAmount,
            referralUserId: referUserId,
          });

          const txInfo = decodeSwapTx(result.swap.tx);

          return {
            assetId,
            symbol: balance.asset?.symbol || "",
            icon: balance.asset?.icon_url || "",
            inputAmount,
            outputAmount: result.quote.outAmount,
            payUrl: result.swap.tx,
            orderId: txInfo.orderId,
            traceId: txInfo.trace,
            isPaid: false,
          };
        } catch (error) {
          console.error(
            `Failed to create swap for ${balance.asset?.symbol}:`,
            error
          );
          toast.error(`创建 ${balance.asset?.symbol} 兑换订单失败`);
          return null;
        }
      });

      const results = await Promise.all(swapPromises);
      const validOrders = results.filter(
        (order): order is SwapOrder => order !== null
      );

      if (validOrders.length > 0) {
        setSwapOrders(validOrders);
        setShowPaymentModal(true);
      } else {
        toast.error("所有订单创建失败");
      }
    } catch (error) {
      console.error("Failed to calculate swap:", error);
      toast.error("计算兑换失败");
    } finally {
      setIsCalculating(false);
    }
  };

  const handleCheckOrderStatus = async (orderId: string) => {
    if (!keystore) return;

    try {
      const order = await swapService.getSwapOrder({ orderId });

      // Update order status
      setSwapOrders((prev) =>
        prev.map((o) =>
          o.orderId === orderId
            ? { ...o, isPaid: order.state === "success" }
            : o
        )
      );

      if (order.state === "success") {
        toast.success("支付成功！");
      }

      return order;
    } catch (error) {
      console.error("Failed to check order status:", error);
      return null;
    }
  };

  const handleCheckAllOrders = async () => {
    setIsCheckingStatus(true);
    try {
      const results = await Promise.all(
        swapOrders.map((order) => handleCheckOrderStatus(order.orderId))
      );

      const allPaid = results.every((result) => result?.state === "success");

      if (allPaid) {
        toast.success("所有订单已支付完成！");
        setShowPaymentModal(false);
        setSelectedAssetIds(new Set());
        setSwapOrders([]);
      }
    } finally {
      setIsCheckingStatus(false);
    }
  };

  // Auto-check payment status using traceId
  useEffect(() => {
    if (!showPaymentModal || swapOrders.length === 0) return;

    let pollingInterval: NodeJS.Timeout | null = null;
    const pollingFlags = new Map<string, boolean>();

    const checkPaymentStatus = async (order: SwapOrder) => {
      // Prevent concurrent polling for the same order
      if (pollingFlags.get(order.traceId)) return;
      if (order.isPaid) return;

      pollingFlags.set(order.traceId, true);

      try {
        const mixinClient = getMixinClient();
        const transaction = await mixinClient.utxo.fetchTransaction(order.traceId);

        // If transaction exists and state is "spent", payment is completed
        if (transaction && transaction.state === 'spent') {
          // Update order status
          setSwapOrders(prev =>
            prev.map(o =>
              o.traceId === order.traceId ? { ...o, isPaid: true } : o
            )
          );

          // Show success toast
          toast.success(`${order.symbol} 支付成功！`);
        }
      } catch (error: any) {
        // 404 means transaction not created yet, continue polling
        if (error?.response?.status !== 404) {
          console.error(`Error checking payment for ${order.symbol}:`, error);
        }
      } finally {
        pollingFlags.delete(order.traceId);
      }
    };

    const checkAllPayments = async () => {
      await Promise.all(swapOrders.map(order => checkPaymentStatus(order)));
    };

    // Initial check
    checkAllPayments();

    // Poll every 5 seconds
    pollingInterval = setInterval(checkAllPayments, 5000);

    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
      pollingFlags.clear();
    };
  }, [showPaymentModal, swapOrders, getMixinClient]);

  // Auto-close modal when all orders are paid
  useEffect(() => {
    if (swapOrders.length > 0 && swapOrders.every(order => order.isPaid)) {
      toast.success("所有订单已支付完成！");

      // Update balances
      updateBalances(computerAssets);

      // Close modal after 3 seconds
      setTimeout(() => {
        setShowPaymentModal(false);
        setSelectedAssetIds(new Set());
        setSwapOrders([]);
      }, 3000);
    }
  }, [swapOrders, updateBalances, computerAssets]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="card p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">批量兑换</h2>
        <p className="text-gray-600 mb-4">选择要兑换的资产，一键兑换为其他代币</p>

        {/* Mixin Route Info */}
        <div className="mt-4 space-y-3">
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
            <p className="font-medium mb-2">💡 支付说明</p>
            <ul className="space-y-1 text-xs">
              <li>• 您的资产直接与 <a
                href="https://route.mixin.one"
                target="_blank"
                rel="noopener noreferrer"
                className="underline font-medium"
              >
                Mixin Route
              </a> 交易，无中间方</li>
              <li>• Mixin Route 无法交易的资产对无法兑换，请确保您选择的资产对在 Mixin Route 上可交易</li>
              <li>• 本机器人通过推荐机制获得收益，感谢您的使用</li>
            </ul>
          </div>

          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
            <p className="font-medium mb-2">⚠️ 兑换限制说明</p>
            <ul className="space-y-1 text-xs">
              <li>• 只能兑换价值大于 $1 的资产</li>
              <li>• 不能选择与兑换目标相同的资产</li>
              <li>• 灰色资产表示不可兑换</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Output Token Selection */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold mb-4">兑换目标</h3>
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            兑换为
          </label>

          {isLoadingTokens ? (
            <div className="w-full px-4 py-4 border border-gray-300 rounded-lg bg-gray-50 flex items-center justify-center">
              <div className="flex items-center gap-2 text-gray-500">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                <span>加载代币列表...</span>
              </div>
            </div>
          ) : outputToken ? (
            <button
              onClick={() => setShowTokenSelector(true)}
              className="w-full px-4 py-4 border-2 border-gray-300 rounded-lg hover:border-blue-500 transition-colors bg-white flex items-center gap-4"
            >
              {/* Token Icon with Chain Badge */}
              <div className="relative w-12 h-12 flex-shrink-0">
                <img
                  src={outputToken.icon}
                  alt={outputToken.symbol}
                  className="w-12 h-12 rounded-full"
                  onError={(e) => {
                    e.currentTarget.src = '/placeholder-icon.png'
                  }}
                />
                {/* Chain Icon Badge */}
                {outputToken.chain?.icon && (
                  <img
                    src={outputToken.chain.icon}
                    alt={outputToken.chain.symbol}
                    className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-white"
                    onError={(e) => {
                      e.currentTarget.src = '/placeholder-icon.png'
                    }}
                  />
                )}
              </div>

              {/* Token Info */}
              <div className="flex-1 text-left min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-900 text-lg">
                    {outputToken.symbol}
                  </span>
                  {outputToken.chain && (
                    <span className="text-xs text-gray-500 bg-gray-200 px-2 py-0.5 rounded">
                      {outputToken.chain.symbol}
                    </span>
                  )}
                </div>
                <div className="text-sm text-gray-600 truncate">
                  {outputToken.name}
                </div>
              </div>

              {/* Change Icon */}
              <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
            </button>
          ) : (
            <button
              onClick={() => setShowTokenSelector(true)}
              className="w-full px-4 py-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 transition-colors bg-white text-gray-500"
            >
              点击选择兑换目标代币
            </button>
          )}
        </div>
      </div>

      {/* Percentage Slider */}
      {selectedAssetIds.size > 0 && (
        <div className="card p-6">
          <h3 className="text-lg font-semibold mb-4">兑换比例</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">兑换百分比</span>
              <span className="text-2xl font-bold text-blue-600">
                {swapPercentage}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              step="1"
              value={swapPercentage}
              onChange={(e) => setSwapPercentage(Number(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
            />
            <div className="flex justify-between text-xs text-gray-500">
              <span>0%</span>
              <span>25%</span>
              <span>50%</span>
              <span>75%</span>
              <span>100%</span>
            </div>
          </div>
        </div>
      )}

      {/* Selected Summary */}
      {selectedAssetIds.size > 0 && (
        <div className="card p-6 bg-blue-50 border-blue-200">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-blue-900">
              已选择 {selectedAssetIds.size} 个资产
            </h3>
            <span className="text-xl font-bold text-blue-900">
              {formatUSD(swapSummary.totalInputValue)}
            </span>
          </div>

          {/* Selected Assets Detail */}
          <div className="space-y-3 mb-4">
            <div className="bg-white rounded-lg p-4">
              <div className="text-sm font-medium text-gray-700 mb-3">兑换资产明细</div>
              <div className="space-y-2">
                {swapSummary.selectedAssetDetails.map((detail) => (
                  <div key={detail.assetId} className="flex items-center justify-between gap-2 text-sm">
                    <div className="flex items-center gap-2 min-w-0 flex-shrink">
                      <img
                        src={detail.icon}
                        alt={detail.symbol}
                        className="w-6 h-6 rounded-full flex-shrink-0"
                        onError={(e) => {
                          e.currentTarget.src = '/placeholder-icon.png'
                        }}
                      />
                      <span className="text-gray-700 font-medium truncate">{detail.symbol}</span>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-gray-900 font-medium">
                        {formatBalance(detail.inputAmount, '')}
                      </div>
                      <div className="text-xs text-gray-600">
                        {formatUSD(detail.inputValue)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Estimated Output */}
            {outputToken && swapSummary.estimatedOutputAmount > 0 && (
              <div className="bg-white rounded-lg p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <div className="relative w-8 h-8 flex-shrink-0">
                      <img
                        src={outputToken.icon}
                        alt={outputToken.symbol}
                        className="w-8 h-8 rounded-full"
                        onError={(e) => {
                          e.currentTarget.src = '/placeholder-icon.png'
                        }}
                      />
                      {outputToken.chain?.icon && (
                        <img
                          src={outputToken.chain.icon}
                          alt={outputToken.chain.symbol}
                          className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border border-white"
                          onError={(e) => {
                            e.currentTarget.src = '/placeholder-icon.png'
                          }}
                        />
                      )}
                    </div>
                    <div>
                      <div className="text-xs text-gray-600">预计获得: </div>
                      <div className="text-base font-bold text-blue-900">
                        ≈ {formatBalance(swapSummary.estimatedOutputAmount, '')} {outputToken.symbol}
                        <span className="text-sm font-normal text-gray-600 ml-1">
                          ({formatUSD(swapSummary.totalInputValue * 0.99)})
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <button
            onClick={handleCalculateSwap}
            disabled={isCalculating || !outputToken}
            className="btn-primary w-full disabled:opacity-50"
          >
            {isCalculating ? "计算中..." : "生成兑换订单"}
          </button>
        </div>
      )}

      {/* Search */}
      <div className="card p-4">
        <input
          type="text"
          placeholder="搜索代币..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* Asset List */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold mb-4">可兑换资产</h3>
        <div className="space-y-2">
          {filteredAssets.map((balance) => {
            const value =
              parseFloat(balance.total_amount) *
              parseFloat(balance.asset?.price_usd || "0");
            const isSelected = selectedAssetIds.has(balance.asset_id);
            const isSameAsOutput = outputToken && balance.asset_id === outputToken.assetId;
            const isBelowMinimum = value < 1;
            const isDisabled = isSameAsOutput || isBelowMinimum;

            return (
              <div
                key={balance.asset_id}
                onClick={() => !isDisabled && handleToggleAsset(balance.asset_id)}
                className={`flex items-center gap-4 p-4 rounded-lg transition-colors ${
                  isDisabled
                    ? "bg-gray-100 border-2 border-gray-300 cursor-not-allowed opacity-60"
                    : isSelected
                    ? "bg-blue-50 border-2 border-blue-500 cursor-pointer"
                    : "bg-gray-50 hover:bg-gray-100 border-2 border-transparent cursor-pointer"
                }`}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  disabled={isDisabled}
                  onChange={() => {}}
                  className="w-5 h-5 text-blue-600 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <img
                  src={balance.asset?.icon_url}
                  alt={balance.asset?.symbol}
                  className={`w-10 h-10 rounded-full ${isDisabled ? 'opacity-50' : ''}`}
                  onError={(e) => {
                    e.currentTarget.src = "/placeholder-icon.png";
                  }}
                />
                <div className="flex-1">
                  <div className={`font-semibold ${isDisabled ? 'text-gray-500' : 'text-gray-900'}`}>
                    {balance.asset?.symbol}
                    {isSameAsOutput && (
                      <span className="ml-2 text-xs bg-gray-300 text-gray-600 px-2 py-0.5 rounded">
                        当前兑换目标
                      </span>
                    )}
                    {isBelowMinimum && !isSameAsOutput && (
                      <span className="ml-2 text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded">
                        金额太小
                      </span>
                    )}
                  </div>
                  <div className={`text-sm ${isDisabled ? 'text-gray-400' : 'text-gray-600'}`}>
                    {balance.asset?.name}
                  </div>
                </div>
                <div className="text-right">
                  <div className={`font-semibold ${isDisabled ? 'text-gray-500' : 'text-gray-900'}`}>
                    {formatBalance(parseFloat(balance.total_amount), "")}
                  </div>
                  <div className={`text-sm ${isDisabled ? 'text-gray-400' : 'text-gray-600'}`}>
                    {formatUSD(value)}
                  </div>
                </div>
              </div>
            );
          })}

          {filteredAssets.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <p>没有可兑换的资产</p>
              <p className="text-sm mt-1">需要资产价值大于 $1</p>
            </div>
          )}
        </div>
      </div>

      {/* Token Selector Modal */}
      {showTokenSelector && (
        <TokenSelectorModal
          tokens={supportedTokens}
          selectedTokenId={outputToken?.assetId || null}
          onSelect={(token) => setOutputToken(token)}
          onClose={() => setShowTokenSelector(false)}
        />
      )}

      {/* Payment Modal */}
      {showPaymentModal && swapOrders.length > 0 && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-auto p-6">
            <h3 className="text-xl font-bold mb-4">支付订单</h3>

            {/* Total Summary */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-gray-600 mb-1">总计兑换</div>
                  <div className="font-semibold text-gray-900">
                    {swapOrders.length} 个资产
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-gray-600 mb-1">预计获得</div>
                  <div className="font-semibold text-blue-900">
                    {formatBalance(
                      swapOrders.reduce((sum, order) => sum + parseFloat(order.outputAmount), 0),
                      ''
                    )} {outputToken?.symbol || ''}
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-3 mb-6">
              {swapOrders.map((order, index) => (
                <div key={index} className={`border rounded-lg p-4 transition-all ${
                  order.isPaid ? 'bg-green-50 border-green-200' : 'bg-white'
                }`}>
                  <div className="flex items-center gap-3 mb-3">
                    <img
                      src={order.icon}
                      alt={order.symbol}
                      className="w-8 h-8 rounded-full"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{order.symbol}</span>
                        {isCheckingStatus ? (
                          <span className="inline-flex items-center gap-1 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                            <div className="w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                            检查中...
                          </span>
                        ) : order.isPaid ? (
                          <span className="inline-flex items-center gap-1 text-xs bg-green-200 text-green-800 px-2 py-0.5 rounded-full font-medium">
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            已支付
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">
                            <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
                            待支付
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-gray-600 mt-1">
                        {formatBalance(parseFloat(order.inputAmount), "")} → {formatBalance(parseFloat(order.outputAmount), "")} {outputToken?.symbol || ''}
                      </div>
                    </div>
                  </div>
                  {order.isPaid ? (
                    <button
                      disabled
                      className="w-full py-2 px-4 bg-gray-300 text-gray-600 rounded-lg cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      已支付
                    </button>
                  ) : (
                    <a
                      href={order.payUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-primary w-full text-center block"
                    >
                      立即支付
                    </a>
                  )}
                </div>
              ))}
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleCheckAllOrders}
                disabled={isCheckingStatus}
                className="btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isCheckingStatus ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>检查中...</span>
                  </>
                ) : (
                  '检查支付状态'
                )}
              </button>
              <button
                onClick={() => setShowPaymentModal(false)}
                className="btn-secondary flex-1"
              >
                关闭
              </button>
            </div>

            <div className="mt-4 p-4 bg-blue-50 rounded-lg text-sm text-blue-800">
              <p>💡 支付完成后，点击"检查支付状态"确认支付，或等待自动检测（每5秒自动检查）</p>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          width: 20px;
          height: 20px;
          background: #3b82f6;
          cursor: pointer;
          border-radius: 50%;
        }

        .slider::-moz-range-thumb {
          width: 20px;
          height: 20px;
          background: #3b82f6;
          cursor: pointer;
          border-radius: 50%;
          border: none;
        }
      `}</style>
    </div>
  );
}
