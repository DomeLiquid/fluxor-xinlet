/**
 * Mixin Swap Service
 * High-level API for frontend swap operations
 */

import type {
  AppKeystore,
  NetworkUserKeystore,
} from "@mixin.dev/mixin-node-sdk";
import {
  createWeb3Client,
  type Web3ClientOptions,
} from "@/lib/mixin-route-client-v2";
import type {
  TokenView,
  QuoteRespView,
  SwapRequest,
  SwapRespView,
  SwapOrder,
  MixinRouteAPIError,
  MarketAssetInfo,
  HistoricalPrice,
  HistoryPriceType,
} from "@/types/mixin-route.types";

export class MixinSwapService {
  private client: ReturnType<typeof createWeb3Client>;

  constructor(
    keystore: AppKeystore | NetworkUserKeystore,
    options?: Web3ClientOptions
  ) {
    this.client = createWeb3Client(keystore, options);
  }

  /**
   * Get all supported tokens for swapping
   */
  async getSupportedTokens(): Promise<TokenView[]> {
    try {
      return await this.client.getTokens();
    } catch (error) {
      console.error("Failed to get supported tokens:", error);
      throw error;
    }
  }

  /**
   * Get swap quote
   * @param inputAssetId - Input token asset ID
   * @param outputAssetId - Output token asset ID
   * @param amount - Input amount as string
   * @returns Quote information including expected output amount and payload
   */
  async getSwapQuote(
    inputAssetId: string,
    outputAssetId: string,
    amount: string
  ): Promise<QuoteRespView> {
    try {
      return await this.client.getQuote(inputAssetId, outputAssetId, amount);
    } catch (error) {
      const routeError = error as MixinRouteAPIError;

      // Handle specific error codes
      if (routeError.code === 10614) {
        // Invalid quote amount - has min/max range
        throw new Error(
          `Amount out of range. Min: ${routeError.range?.min}, Max: ${routeError.range?.max}`
        );
      } else if (routeError.code === 10615) {
        throw new Error("No available quote found for this swap pair");
      } else if (routeError.code === 10611) {
        throw new Error("Invalid swap configuration");
      }

      console.error("Failed to get swap quote:", error);
      throw error;
    }
  }

  /**
   * Create swap transaction
   * @param params - Swap parameters
   * @returns Swap response with Mixin payment link
   */
  async createSwap(params: {
    payerUserId: string;
    inputAssetId: string;
    outputAssetId: string;
    inputAmount: string;
    payload: string;
    referralUserId?: string;
  }): Promise<SwapRespView> {
    const request: SwapRequest = {
      payer: params.payerUserId,
      inputMint: params.inputAssetId,
      outputMint: params.outputAssetId,
      inputAmount: params.inputAmount,
      payload: params.payload,
      referral: params.referralUserId,
    };

    try {
      return await this.client.swap(request);
    } catch (error) {
      console.error("Failed to create swap:", error);
      throw error;
    }
  }

  /**
   * Get complete swap flow: quote + create transaction
   * @returns Both quote and transaction information
   */
  async executeSwap(params: {
    payerUserId: string;
    inputAssetId: string;
    outputAssetId: string;
    inputAmount: string;
    referralUserId?: string;
  }): Promise<{
    quote: QuoteRespView;
    swap: SwapRespView;
  }> {
    // First get quote
    const quote = await this.getSwapQuote(
      params.inputAssetId,
      params.outputAssetId,
      params.inputAmount
    );

    // Then create swap with the payload from quote
    const swap = await this.createSwap({
      payerUserId: params.payerUserId,
      inputAssetId: params.inputAssetId,
      outputAssetId: params.outputAssetId,
      inputAmount: params.inputAmount,
      payload: quote.payload,
      referralUserId: params.referralUserId,
    });

    return { quote, swap };
  }
  /**
   * Get swap order details
   * @param params.orderId - Swap order ID
   * @returns Swap order details
   */
  async getSwapOrder(params: { orderId: string }): Promise<SwapOrder> {
    try {
      return await this.client.getSwapOrder(params.orderId);
    } catch (error) {
      console.error("Failed to get swap order:", error);
      throw error;
    }
  }

  /**
   * Get asset market information
   * @param params.assetId - Asset ID (coin_id from GET /markets, or mixin asset id)
   * @returns Market asset information including price, market cap, volume, etc.
   */
  async getAssetInfo(params: { assetId: string }): Promise<MarketAssetInfo> {
    try {
      return await this.client.getAssetInfo(params.assetId);
    } catch (error) {
      console.error("Failed to get asset info:", error);
      throw error;
    }
  }

  /**
   * Get asset price history
   * @param params.assetId - Asset ID (coin_id from GET /markets, or mixin asset id)
   * @param params.type - History type (1D, 1W, 1M, YTD, ALL)
   * @returns Historical price data
   */
  async getPriceHistory(params: {
    assetId: string;
    type: HistoryPriceType;
  }): Promise<HistoricalPrice> {
    try {
      return await this.client.getPriceHistory(params.assetId, params.type);
    } catch (error) {
      console.error("Failed to get price history:", error);
      throw error;
    }
  }
}

/**
 * Create a new MixinSwapService instance
 */
export function createMixinSwapService(
  keystore: AppKeystore | NetworkUserKeystore,
  options?: Web3ClientOptions
): MixinSwapService {
  return new MixinSwapService(keystore, options);
}
