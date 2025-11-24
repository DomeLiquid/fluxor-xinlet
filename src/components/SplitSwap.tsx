"use client";

import { useState, useMemo, useEffect } from "react";
import { useAppStore } from "@/store";
import { createMixinSwapService } from "@/services/mixin-swap";
import { formatUSD, formatBalance } from "@/utils/format";
import { decodeSwapTx } from "@/types/mixin-route.types";
import type { TokenView } from "@/types/mixin-route.types";
import { toast } from "react-hot-toast";
import { AppKeystore } from "@mixin.dev/mixin-node-sdk";
import TokenSelectorModal from "./TokenSelectorModal";

interface BuyToken {
  token: TokenView;
  percentage: number;
  price: number;
}

interface SwapOrder {
  targetAssetId: string;
  targetSymbol: string;
  targetIcon: string;
  inputAmount: string;
  outputAmount: string;
  payUrl: string;
  orderId: string;
  traceId: string;
  isPaid: boolean;
}

export default function SplitSwap() {
  const { user, keystore, balances, getMixinClient, updateBalances } = useAppStore();
  const { computerAssets } = useAppStore();
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [sellPercentage, setSellPercentage] = useState(100);
  const [buyTokens, setBuyTokens] = useState<BuyToken[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isCalculating, setIsCalculating] = useState(false);
  const [swapOrders, setSwapOrders] = useState<SwapOrder[]>([]);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showTokenSelector, setShowTokenSelector] = useState(false);
  const [supportedTokens, setSupportedTokens] = useState<TokenView[]>([]);
  const [isLoadingTokens, setIsLoadingTokens] = useState(true);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);

  const keystore2: AppKeystore = {
    app_id: process.env.MIXIN_CLIENT_ID || "your-app-id",
    session_id: process.env.MIXIN_SESSION_ID || "your-session-id",
    server_public_key:
      process.env.MIXIN_SERVER_PUBLIC_KEY || "your-server-public-key",
    session_private_key:
      process.env.MIXIN_SESSION_PRIVATE_KEY || "your-session-private-key",
  };

  const swapService = createMixinSwapService(keystore2);

  // Load supported tokens
  useEffect(() => {
    const loadTokens = async () => {
      if (!keystore) return;

      try {
        setIsLoadingTokens(true);
        const tokens = await swapService.getSupportedTokens();
        setSupportedTokens(tokens);
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
      // Filter out assets with value < $1
      if (value < 1) return false;

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

  // Calculate total sell value and percentages
  const swapSummary = useMemo(() => {
    if (!selectedAssetId) {
      return {
        totalSellValue: 0,
        sellAmount: 0,
        totalBuyPercentage: 0,
        estimatedBuyAmounts: [],
      };
    }

    const balance = balances[selectedAssetId];
    if (!balance) {
      return {
        totalSellValue: 0,
        sellAmount: 0,
        totalBuyPercentage: 0,
        estimatedBuyAmounts: [],
      };
    }

    const totalAmount = parseFloat(balance.total_amount);
    const sellAmount = totalAmount * (sellPercentage / 100);
    const price = parseFloat(balance.asset?.price_usd || "0");
    const totalSellValue = sellAmount * price;

    const totalBuyPercentage = buyTokens.reduce(
      (sum, bt) => sum + bt.percentage,
      0
    );

    const estimatedBuyAmounts = buyTokens.map((bt) => {
      const buyValue = (totalSellValue * bt.percentage) / 100;
      const buyAmount = bt.price > 0 ? (buyValue / bt.price) * 0.99 : 0;

      return {
        token: bt.token,
        percentage: bt.percentage,
        amount: buyAmount,
        value: buyValue,
      };
    });

    return {
      totalSellValue,
      sellAmount,
      totalBuyPercentage,
      estimatedBuyAmounts,
    };
  }, [selectedAssetId, balances, sellPercentage, buyTokens]);

  const handleAddBuyToken = async (token: TokenView) => {
    // Check if already added
    if (buyTokens.some((bt) => bt.token.assetId === token.assetId)) {
      toast.error("该代币已添加");
      return;
    }

    // Check if same as sell token
    if (selectedAssetId === token.assetId) {
      toast.error("不能兑换成相同的资产");
      return;
    }

    // Fetch token price
    try {
      const assetInfo = await swapService.getAssetInfo({ assetId: token.assetId });
      const price = parseFloat(assetInfo.current_price || "0");

      setBuyTokens((prev) => {
        const newTokens = [
          ...prev,
          {
            token,
            percentage: 0,
            price,
          },
        ];

        // Auto-distribute percentages evenly
        const totalTokens = newTokens.length;
        const equalPercentage = Math.floor(100 / totalTokens);
        const remainder = 100 - equalPercentage * totalTokens;

        return newTokens.map((bt, index) => ({
          ...bt,
          percentage: equalPercentage + (index === 0 ? remainder : 0),
        }));
      });

      toast.success(`已添加 ${token.symbol}，自动平均分配份额`);
    } catch (error) {
      console.error("Failed to fetch token price:", error);
      toast.error(`获取 ${token.symbol} 价格失败`);
    }
  };

  const handleRemoveBuyToken = (assetId: string) => {
    setBuyTokens((prev) => {
      const filtered = prev.filter((bt) => bt.token.assetId !== assetId);

      // If no tokens left, return empty array
      if (filtered.length === 0) {
        return [];
      }

      // Auto-distribute percentages evenly among remaining tokens
      const totalTokens = filtered.length;
      const equalPercentage = Math.floor(100 / totalTokens);
      const remainder = 100 - equalPercentage * totalTokens;

      return filtered.map((bt, index) => ({
        ...bt,
        percentage: equalPercentage + (index === 0 ? remainder : 0),
      }));
    });
  };

  const handleUpdatePercentage = (assetId: string, percentage: number) => {
    setBuyTokens((prev) =>
      prev.map((bt) =>
        bt.token.assetId === assetId ? { ...bt, percentage } : bt
      )
    );
  };

  const handleAutoDistribute = () => {
    if (buyTokens.length === 0) return;

    const equalPercentage = Math.floor(100 / buyTokens.length);
    const remainder = 100 - equalPercentage * buyTokens.length;

    setBuyTokens((prev) =>
      prev.map((bt, index) => ({
        ...bt,
        percentage: equalPercentage + (index === 0 ? remainder : 0),
      }))
    );
  };

  const handleCalculateSwap = async () => {
    if (!keystore || !user || !selectedAssetId || buyTokens.length === 0) return;

    if (swapSummary.totalBuyPercentage !== 100) {
      toast.error("买入代币的百分比总和必须为 100%");
      return;
    }

    setIsCalculating(true);
    setSwapOrders([]);

    try {
      const referUserId = process.env.MIXIN_REFER_USER_ID;
      const balance = balances[selectedAssetId];
      if (!balance) return;

      const totalAmount = parseFloat(balance.total_amount);
      const totalSellAmount = totalAmount * (sellPercentage / 100);

      // Create swap orders concurrently for each buy token
      const swapPromises = buyTokens.map(async (buyToken) => {
        const sellAmount = (totalSellAmount * buyToken.percentage) / 100;

        try {
          const result = await swapService.executeSwap({
            payerUserId: user.user_id,
            inputAssetId: selectedAssetId,
            outputAssetId: buyToken.token.assetId,
            inputAmount: sellAmount.toString(),
            referralUserId: referUserId,
          });

          const txInfo = decodeSwapTx(result.swap.tx);

          return {
            targetAssetId: buyToken.token.assetId,
            targetSymbol: buyToken.token.symbol,
            targetIcon: buyToken.token.icon,
            inputAmount: sellAmount.toString(),
            outputAmount: result.quote.outAmount,
            payUrl: result.swap.tx,
            orderId: txInfo.orderId,
            traceId: txInfo.trace,
            isPaid: false,
          };
        } catch (error) {
          console.error(
            `Failed to create swap for ${buyToken.token.symbol}:`,
            error
          );
          toast.error(`创建 ${buyToken.token.symbol} 兑换订单失败`);
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
        setSelectedAssetId(null);
        setBuyTokens([]);
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
      if (pollingFlags.get(order.traceId)) return;
      if (order.isPaid) return;

      pollingFlags.set(order.traceId, true);

      try {
        const mixinClient = getMixinClient();
        const transaction = await mixinClient.utxo.fetchTransaction(order.traceId);

        if (transaction && transaction.state === 'spent') {
          setSwapOrders(prev =>
            prev.map(o =>
              o.traceId === order.traceId ? { ...o, isPaid: true } : o
            )
          );

          toast.success(`${order.targetSymbol} 支付成功！`);
        }
      } catch (error: any) {
        if (error?.response?.status !== 404) {
          console.error(`Error checking payment for ${order.targetSymbol}:`, error);
        }
      } finally {
        pollingFlags.delete(order.traceId);
      }
    };

    const checkAllPayments = async () => {
      await Promise.all(swapOrders.map(order => checkPaymentStatus(order)));
    };

    checkAllPayments();
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

      updateBalances(computerAssets);

      setTimeout(() => {
        setShowPaymentModal(false);
        setSelectedAssetId(null);
        setBuyTokens([]);
        setSwapOrders([]);
      }, 3000);
    }
  }, [swapOrders, updateBalances, computerAssets]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="card p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">分散兑换</h2>
        <p className="text-gray-600 mb-4">将单个资产分散兑换为多个代币，实现投资组合多样化</p>

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
              <li>• 只能卖出价值大于 $1 的资产</li>
              <li>• 买入代币的百分比总和必须为 100%</li>
              <li>• 不能选择与卖出资产相同的代币</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Sell Percentage Slider */}
      {selectedAssetId && (
        <div className="card p-6">
          <h3 className="text-lg font-semibold mb-4">卖出比例</h3>

          {/* Asset Info */}
          <div className="bg-blue-50 rounded-lg p-4 mb-4 border border-blue-200">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <img
                  src={balances[selectedAssetId]?.asset?.icon_url}
                  alt={balances[selectedAssetId]?.asset?.symbol}
                  className="w-10 h-10 rounded-full"
                  onError={(e) => {
                    e.currentTarget.src = '/placeholder-icon.png'
                  }}
                />
                <div>
                  <div className="font-semibold text-gray-900">
                    {balances[selectedAssetId]?.asset?.symbol}
                  </div>
                  <div className="text-sm text-gray-600">
                    持有: {formatBalance(parseFloat(balances[selectedAssetId]?.total_amount || '0'), '')}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm text-gray-600">总价值</div>
                <div className="font-semibold text-gray-900">
                  {formatUSD(
                    parseFloat(balances[selectedAssetId]?.total_amount || '0') *
                    parseFloat(balances[selectedAssetId]?.asset?.price_usd || '0')
                  )}
                </div>
              </div>
            </div>

            <div className="border-t border-blue-200 pt-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-gray-600 mb-1">将要卖出</div>
                  <div className="font-bold text-lg text-blue-900">
                    {formatBalance(swapSummary.sellAmount, '')} {balances[selectedAssetId]?.asset?.symbol}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-gray-600 mb-1">卖出金额</div>
                  <div className="font-bold text-lg text-blue-900">
                    {formatUSD(swapSummary.totalSellValue)}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Slider */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">卖出百分比</span>
              <span className="text-2xl font-bold text-blue-600">
                {sellPercentage}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              step="1"
              value={sellPercentage}
              onChange={(e) => setSellPercentage(Number(e.target.value))}
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

      {/* Buy Tokens Management */}
      {selectedAssetId && (
        <div className="card p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">买入代币</h3>
            <div className="flex gap-2">
              <button
                onClick={handleAutoDistribute}
                disabled={buyTokens.length === 0}
                className="btn-secondary text-sm disabled:opacity-50"
              >
                平均分配
              </button>
              <button
                onClick={() => setShowTokenSelector(true)}
                className="btn-primary text-sm"
              >
                + 添加代币
              </button>
            </div>
          </div>

          {buyTokens.length > 0 ? (
            <div className="space-y-4">
              {buyTokens.map((buyToken) => (
                <div
                  key={buyToken.token.assetId}
                  className="p-4 bg-gray-50 rounded-lg border-2 border-gray-200"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="relative w-10 h-10 flex-shrink-0">
                      <img
                        src={buyToken.token.icon}
                        alt={buyToken.token.symbol}
                        className="w-10 h-10 rounded-full"
                        onError={(e) => {
                          e.currentTarget.src = '/placeholder-icon.png'
                        }}
                      />
                      {buyToken.token.chain?.icon && (
                        <img
                          src={buyToken.token.chain.icon}
                          alt={buyToken.token.chain.symbol}
                          className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white"
                          onError={(e) => {
                            e.currentTarget.src = '/placeholder-icon.png'
                          }}
                        />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-gray-900">
                        {buyToken.token.symbol}
                      </div>
                      <div className="text-sm text-gray-600">
                        {buyToken.token.name}
                      </div>
                    </div>
                    <button
                      onClick={() => handleRemoveBuyToken(buyToken.token.assetId)}
                      className="text-red-600 hover:text-red-800"
                    >
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm text-gray-700 font-medium">
                      分配百分比
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="1"
                        value={buyToken.percentage}
                        onChange={(e) =>
                          handleUpdatePercentage(
                            buyToken.token.assetId,
                            Math.max(0, Math.min(100, Number(e.target.value)))
                          )
                        }
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      <span className="text-lg font-bold text-gray-900">%</span>
                    </div>
                  </div>
                </div>
              ))}

              {/* Percentage Summary */}
              <div className={`p-4 rounded-lg border-2 ${
                swapSummary.totalBuyPercentage === 100
                  ? 'bg-green-50 border-green-200'
                  : 'bg-yellow-50 border-yellow-200'
              }`}>
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">
                    {swapSummary.totalBuyPercentage === 100 ? '✓' : '⚠️'} 总百分比
                  </span>
                  <span className={`text-xl font-bold ${
                    swapSummary.totalBuyPercentage === 100
                      ? 'text-green-700'
                      : 'text-yellow-700'
                  }`}>
                    {swapSummary.totalBuyPercentage}%
                  </span>
                </div>
                {swapSummary.totalBuyPercentage !== 100 && (
                  <p className="text-xs text-yellow-700 mt-1">
                    百分比总和必须为 100%
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p>还未添加买入代币</p>
              <p className="text-sm mt-1">点击"添加代币"开始</p>
            </div>
          )}
        </div>
      )}

      {/* Swap Summary */}
      {selectedAssetId && buyTokens.length > 0 && swapSummary.totalBuyPercentage === 100 && (
        <div className="card p-6 bg-blue-50 border-blue-200">
          <h3 className="text-lg font-semibold text-blue-900 mb-4">兑换预览</h3>

          {/* Total Summary */}
          <div className="bg-white rounded-lg p-3 mb-4 border-2 border-blue-300">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <img
                  src={balances[selectedAssetId]?.asset?.icon_url}
                  alt={balances[selectedAssetId]?.asset?.symbol}
                  className="w-8 h-8 rounded-full"
                  onError={(e) => {
                    e.currentTarget.src = '/placeholder-icon.png'
                  }}
                />
                <div>
                  <div className="text-xs text-gray-600">总计卖出</div>
                  <div className="font-bold text-gray-900">
                    {formatBalance(swapSummary.sellAmount, '')} {balances[selectedAssetId]?.asset?.symbol}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-bold text-gray-900">
                  {formatUSD(swapSummary.totalSellValue)}
                </div>
              </div>
            </div>
          </div>

          {/* Swap Details - Compact Version */}
          <div className="space-y-2 mb-4">
            {swapSummary.estimatedBuyAmounts.map((est) => {
              const sellAmountForThis = swapSummary.sellAmount * (est.percentage / 100);
              const sellValueForThis = swapSummary.totalSellValue * (est.percentage / 100);

              return (
                <div key={est.token.assetId} className="bg-white rounded-lg p-3 border border-gray-200">
                  {/* Percentage Badge */}
                  <div className="mb-2">
                    <span className="text-xs font-medium text-blue-600 bg-blue-100 px-2 py-1 rounded">
                      {est.percentage}%
                    </span>
                  </div>

                  {/* From */}
                  <div className="flex items-center gap-2 mb-1.5">
                    <img
                      src={balances[selectedAssetId]?.asset?.icon_url}
                      alt={balances[selectedAssetId]?.asset?.symbol}
                      className="w-6 h-6 rounded-full"
                      onError={(e) => {
                        e.currentTarget.src = '/placeholder-icon.png'
                      }}
                    />
                    <div className="text-sm">
                      <span className="font-semibold text-gray-900">
                        {formatBalance(sellAmountForThis, '')} {balances[selectedAssetId]?.asset?.symbol}
                      </span>
                      <span className="text-gray-500 ml-1">
                        {formatUSD(sellValueForThis)}
                      </span>
                    </div>
                  </div>

                  {/* Arrow */}
                  <div className="flex items-center gap-2 ml-1 mb-1.5">
                    <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                    </svg>
                    <div className="text-xs text-gray-500">兑换为</div>
                  </div>

                  {/* To */}
                  <div className="flex items-center gap-2">
                    <div className="relative w-6 h-6 flex-shrink-0">
                      <img
                        src={est.token.icon}
                        alt={est.token.symbol}
                        className="w-6 h-6 rounded-full"
                        onError={(e) => {
                          e.currentTarget.src = '/placeholder-icon.png'
                        }}
                      />
                      {est.token.chain?.icon && (
                        <img
                          src={est.token.chain.icon}
                          alt={est.token.chain.symbol}
                          className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border border-white"
                          onError={(e) => {
                            e.currentTarget.src = '/placeholder-icon.png'
                          }}
                        />
                      )}
                    </div>
                    <div className="text-sm">
                      <span className="font-semibold text-green-700">
                        ≈ {formatBalance(est.amount, '')} {est.token.symbol}
                      </span>
                      <span className="text-gray-500 ml-1">
                        {formatUSD(est.value * 0.99)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <button
            onClick={handleCalculateSwap}
            disabled={isCalculating}
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
        <h3 className="text-lg font-semibold mb-4">选择要卖出的资产</h3>
        <div className="space-y-2">
          {filteredAssets.map((balance) => {
            const value =
              parseFloat(balance.total_amount) *
              parseFloat(balance.asset?.price_usd || "0");
            const isSelected = selectedAssetId === balance.asset_id;

            return (
              <div
                key={balance.asset_id}
                onClick={() => setSelectedAssetId(balance.asset_id)}
                className={`flex items-center gap-4 p-4 rounded-lg cursor-pointer transition-colors ${
                  isSelected
                    ? "bg-blue-50 border-2 border-blue-500"
                    : "bg-gray-50 hover:bg-gray-100 border-2 border-transparent"
                }`}
              >
                <input
                  type="radio"
                  checked={isSelected}
                  onChange={() => {}}
                  className="w-5 h-5 text-blue-600"
                />
                <img
                  src={balance.asset?.icon_url}
                  alt={balance.asset?.symbol}
                  className="w-10 h-10 rounded-full"
                  onError={(e) => {
                    e.currentTarget.src = "/placeholder-icon.png";
                  }}
                />
                <div className="flex-1">
                  <div className="font-semibold text-gray-900">
                    {balance.asset?.symbol}
                  </div>
                  <div className="text-sm text-gray-600">
                    {balance.asset?.name}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-gray-900">
                    {formatBalance(parseFloat(balance.total_amount), "")}
                  </div>
                  <div className="text-sm text-gray-600">
                    {formatUSD(value)}
                  </div>
                </div>
              </div>
            );
          })}

          {filteredAssets.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <p>没有可卖出的资产</p>
              <p className="text-sm mt-1">需要资产价值大于 $1</p>
            </div>
          )}
        </div>
      </div>

      {/* Token Selector Modal */}
      {showTokenSelector && (
        <TokenSelectorModal
          tokens={supportedTokens.filter(
            (t) =>
              t.assetId !== selectedAssetId &&
              !buyTokens.some((bt) => bt.token.assetId === t.assetId)
          )}
          selectedTokenId={null}
          onSelect={(token) => handleAddBuyToken(token)}
          onClose={() => setShowTokenSelector(false)}
        />
      )}

      {/* Payment Modal */}
      {showPaymentModal && swapOrders.length > 0 && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-auto p-6">
            <h3 className="text-xl font-bold mb-4">支付订单</h3>

            <div className="space-y-3 mb-6">
              {swapOrders.map((order, index) => (
                <div key={index} className={`border rounded-lg p-4 transition-all ${
                  order.isPaid ? 'bg-green-50 border-green-200' : 'bg-white'
                }`}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="relative w-8 h-8 flex-shrink-0">
                      <img
                        src={order.targetIcon}
                        alt={order.targetSymbol}
                        className="w-8 h-8 rounded-full"
                      />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{order.targetSymbol}</span>
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
                        预计获得 {formatBalance(parseFloat(order.outputAmount), "")} {order.targetSymbol}
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
