/**
 * Mixin Route API Types
 * Based on: https://github.com/MixinNetwork/route-docs/blob/main/mixin_swap_api_cn.md
 */

export interface TokenChain {
  chainId: string
  symbol: string
  name: string
  icon: string
  decimals: number
}

export interface TokenView {
  assetId: string
  name: string
  symbol: string
  icon: string
  chain: TokenChain
}

export interface QuoteRespView {
  inputMint: string
  inAmount: string
  outputMint: string
  outAmount: string
  payload: string
}

export interface SwapRequest {
  payer: string
  inputMint: string
  outputMint: string
  inputAmount: string
  payload: string
  referral?: string
}

export interface SwapRespView {
  tx: string
  quote: QuoteRespView
}

export interface QuoteRange {
  min: string
  max: string
}

export interface RouteErrorResponse {
  error: {
    code: number
    description: string
    extra?: {
      range?: QuoteRange
    }
  }
}

export enum HistoryPriceType {
  ONE_DAY = '1D',
  ONE_WEEK = '1W',
  ONE_MONTH = '1M',
  YTD = 'YTD',
  ALL = 'ALL'
}

export class MixinRouteAPIError extends Error {
  constructor(
    public statusCode: number,
    public code?: number,
    public description?: string,
    public rawBody?: string,
    public range?: QuoteRange
  ) {
    super(description || rawBody || 'Mixin Route API Error')
    this.name = 'MixinRouteAPIError'
  }
}
