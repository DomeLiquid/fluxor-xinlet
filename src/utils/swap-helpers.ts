/**
 * Helper utilities for Mixin Swap operations
 */

import type { TokenView, QuoteRespView } from '@/types/mixin-route.types'

/**
 * Calculate the exchange rate from a quote
 */
export function calculateExchangeRate(quote: QuoteRespView): number {
  const input = parseFloat(quote.inAmount)
  const output = parseFloat(quote.outAmount)

  if (input === 0) return 0
  return output / input
}

/**
 * Calculate price impact percentage
 * Note: Requires spot price data which is not provided by the quote API
 */
export function calculatePriceImpact(
  quote: QuoteRespView,
  spotRate: number
): number {
  const executionRate = calculateExchangeRate(quote)
  return ((executionRate - spotRate) / spotRate) * 100
}

/**
 * Format token amount with proper decimals
 */
export function formatTokenAmount(
  amount: string | number,
  decimals: number = 8,
  maxDecimals: number = 8
): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount

  if (isNaN(num)) return '0'

  // For very small numbers, use exponential notation
  if (num !== 0 && Math.abs(num) < Math.pow(10, -maxDecimals)) {
    return num.toExponential(2)
  }

  // Format with appropriate decimal places
  const formatted = num.toFixed(maxDecimals)

  // Remove trailing zeros
  return formatted.replace(/\.?0+$/, '')
}

/**
 * Parse user input to valid amount string
 */
export function parseAmountInput(input: string, decimals: number = 8): string {
  // Remove any non-numeric characters except decimal point
  let cleaned = input.replace(/[^\d.]/g, '')

  // Only allow one decimal point
  const parts = cleaned.split('.')
  if (parts.length > 2) {
    cleaned = parts[0] + '.' + parts.slice(1).join('')
  }

  // Limit decimal places
  if (parts.length === 2 && parts[1].length > decimals) {
    cleaned = parts[0] + '.' + parts[1].substring(0, decimals)
  }

  return cleaned
}

/**
 * Validate if amount is within valid range
 */
export function isAmountValid(
  amount: string,
  min?: string,
  max?: string
): { valid: boolean; error?: string } {
  const num = parseFloat(amount)

  if (isNaN(num) || num <= 0) {
    return { valid: false, error: 'Amount must be greater than 0' }
  }

  if (min && num < parseFloat(min)) {
    return { valid: false, error: `Minimum amount is ${min}` }
  }

  if (max && num > parseFloat(max)) {
    return { valid: false, error: `Maximum amount is ${max}` }
  }

  return { valid: true }
}

/**
 * Find token by various criteria
 */
export function findToken(
  tokens: TokenView[],
  criteria: {
    assetId?: string
    symbol?: string
    name?: string
  }
): TokenView | undefined {
  if (criteria.assetId) {
    return tokens.find((t) => t.assetId === criteria.assetId)
  }

  if (criteria.symbol) {
    return tokens.find(
      (t) => t.symbol.toLowerCase() === criteria.symbol!.toLowerCase()
    )
  }

  if (criteria.name) {
    return tokens.find(
      (t) => t.name.toLowerCase() === criteria.name!.toLowerCase()
    )
  }

  return undefined
}

/**
 * Filter tokens by chain
 */
export function filterTokensByChain(
  tokens: TokenView[],
  chainSymbol: string
): TokenView[] {
  return tokens.filter(
    (t) => t.chain.symbol.toLowerCase() === chainSymbol.toLowerCase()
  )
}

/**
 * Search tokens by keyword
 */
export function searchTokens(
  tokens: TokenView[],
  keyword: string
): TokenView[] {
  const lowerKeyword = keyword.toLowerCase()

  return tokens.filter(
    (t) =>
      t.symbol.toLowerCase().includes(lowerKeyword) ||
      t.name.toLowerCase().includes(lowerKeyword) ||
      t.assetId.toLowerCase().includes(lowerKeyword)
  )
}

/**
 * Sort tokens by various criteria
 */
export function sortTokens(
  tokens: TokenView[],
  by: 'symbol' | 'name' | 'chain'
): TokenView[] {
  return [...tokens].sort((a, b) => {
    switch (by) {
      case 'symbol':
        return a.symbol.localeCompare(b.symbol)
      case 'name':
        return a.name.localeCompare(b.name)
      case 'chain':
        return a.chain.symbol.localeCompare(b.chain.symbol)
      default:
        return 0
    }
  })
}

/**
 * Group tokens by chain
 */
export function groupTokensByChain(
  tokens: TokenView[]
): Record<string, TokenView[]> {
  return tokens.reduce((acc, token) => {
    const chain = token.chain.symbol
    if (!acc[chain]) {
      acc[chain] = []
    }
    acc[chain].push(token)
    return acc
  }, {} as Record<string, TokenView[]>)
}

/**
 * Calculate estimated USD value (if price data available)
 */
export function calculateUSDValue(
  amount: string,
  priceUSD: number
): number {
  return parseFloat(amount) * priceUSD
}

/**
 * Format USD value
 */
export function formatUSDValue(value: number): string {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(2)}M`
  }
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(2)}K`
  }
  return `$${value.toFixed(2)}`
}

/**
 * Validate Mixin payment URL
 */
export function isMixinPaymentURL(url: string): boolean {
  return url.startsWith('mixin://pay?') || url.startsWith('https://mixin.one/pay?')
}

/**
 * Parse Mixin payment URL
 */
export function parseMixinPaymentURL(url: string): {
  recipient?: string
  asset?: string
  amount?: string
  trace?: string
  memo?: string
} | null {
  try {
    const urlObj = new URL(url)
    const params = urlObj.searchParams

    return {
      recipient: params.get('recipient') || undefined,
      asset: params.get('asset') || undefined,
      amount: params.get('amount') || undefined,
      trace: params.get('trace') || undefined,
      memo: params.get('memo') || undefined
    }
  } catch {
    return null
  }
}

/**
 * Debounce function for quote fetching
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null

  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null
      func(...args)
    }

    if (timeout) {
      clearTimeout(timeout)
    }
    timeout = setTimeout(later, wait)
  }
}

/**
 * Create a debounced quote fetcher
 */
export function createDebouncedQuoteFetcher(
  fetchQuote: (inputAssetId: string, outputAssetId: string, amount: string) => Promise<QuoteRespView>,
  delay: number = 500
) {
  return debounce(fetchQuote, delay)
}

/**
 * Estimate slippage (approximate)
 */
export function estimateSlippage(
  inputAmount: number,
  outputAmount: number,
  marketRate: number
): number {
  const expectedOutput = inputAmount * marketRate
  const actualOutput = outputAmount
  return ((expectedOutput - actualOutput) / expectedOutput) * 100
}

/**
 * Common token asset IDs (Mixin mainnet)
 */
export const COMMON_TOKENS = {
  XIN: 'c94ac88f-4671-3976-b60a-09064f1811e8',
  USDT: '4d8c508b-91c5-375b-92b0-ee702ed2dac5',
  USDC: '9b180ab6-6abe-3dc0-a13f-04169eb34bfa',
  BTC: 'c6d0c728-2624-429b-8e0d-d9d19b6592fa',
  ETH: '43d61dcd-e413-450d-80b8-101d5e903357',
  BOX: 'f5ef6b5d-cc5a-3d90-b2c0-a2fd386e7a3c',
  MOB: 'eea900a8-b327-488c-8d8d-1428702fe240'
} as const

/**
 * Check if two tokens can be swapped
 */
export function canSwap(
  inputToken?: TokenView,
  outputToken?: TokenView
): boolean {
  if (!inputToken || !outputToken) return false
  if (inputToken.assetId === outputToken.assetId) return false
  return true
}

/**
 * Format swap summary
 */
export function formatSwapSummary(quote: QuoteRespView): string {
  const rate = calculateExchangeRate(quote)
  return `Swap ${quote.inAmount} for ${quote.outAmount} (Rate: ${rate.toFixed(6)})`
}
