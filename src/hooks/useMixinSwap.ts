/**
 * React Hook for Mixin Swap Operations
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import type { AppKeystore, NetworkUserKeystore } from '@mixin.dev/mixin-node-sdk'
import { createMixinSwapService } from '@/services/mixin-swap'
import type { TokenView, QuoteRespView, MixinRouteAPIError } from '@/types/mixin-route.types'

export interface UseMixinSwapOptions {
  keystore: AppKeystore | NetworkUserKeystore
  autoLoadTokens?: boolean
}

export interface SwapQuoteParams {
  inputAssetId: string
  outputAssetId: string
  amount: string
}

export interface SwapExecuteParams extends SwapQuoteParams {
  payerUserId: string
  referralUserId?: string
}

export function useMixinSwap(options: UseMixinSwapOptions) {
  const { keystore, autoLoadTokens = true } = options

  const [tokens, setTokens] = useState<TokenView[]>([])
  const [quote, setQuote] = useState<QuoteRespView | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Memoize swap service
  const swapService = useMemo(
    () => createMixinSwapService(keystore),
    [keystore]
  )

  // Load supported tokens
  const loadTokens = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const supportedTokens = await swapService.getSupportedTokens()
      setTokens(supportedTokens)
      return supportedTokens
    } catch (err) {
      const errorMsg = 'Failed to load tokens: ' + (err as Error).message
      setError(errorMsg)
      throw err
    } finally {
      setLoading(false)
    }
  }, [swapService])

  // Get swap quote
  const getQuote = useCallback(
    async (params: SwapQuoteParams) => {
      try {
        setLoading(true)
        setError(null)
        const quoteResult = await swapService.getSwapQuote(
          params.inputAssetId,
          params.outputAssetId,
          params.amount
        )
        setQuote(quoteResult)
        return quoteResult
      } catch (err) {
        const routeError = err as MixinRouteAPIError
        let errorMsg = 'Failed to get quote: '

        if (routeError.code === 10614) {
          errorMsg += `Amount out of range. Min: ${routeError.range?.min}, Max: ${routeError.range?.max}`
        } else if (routeError.code === 10615) {
          errorMsg += 'No available quote found for this swap pair'
        } else if (routeError.code === 10611) {
          errorMsg += 'Invalid swap configuration'
        } else {
          errorMsg += routeError.message
        }

        setError(errorMsg)
        setQuote(null)
        throw err
      } finally {
        setLoading(false)
      }
    },
    [swapService]
  )

  // Execute swap (quote + create transaction)
  const executeSwap = useCallback(
    async (params: SwapExecuteParams) => {
      try {
        setLoading(true)
        setError(null)

        const result = await swapService.executeSwap({
          payerUserId: params.payerUserId,
          inputAssetId: params.inputAssetId,
          outputAssetId: params.outputAssetId,
          inputAmount: params.amount,
          referralUserId: params.referralUserId
        })

        setQuote(result.quote)
        return result
      } catch (err) {
        const errorMsg = 'Failed to execute swap: ' + (err as Error).message
        setError(errorMsg)
        throw err
      } finally {
        setLoading(false)
      }
    },
    [swapService]
  )

  // Create swap with existing quote
  const createSwap = useCallback(
    async (params: SwapExecuteParams & { payload: string }) => {
      try {
        setLoading(true)
        setError(null)

        const result = await swapService.createSwap({
          payerUserId: params.payerUserId,
          inputAssetId: params.inputAssetId,
          outputAssetId: params.outputAssetId,
          inputAmount: params.amount,
          payload: params.payload,
          referralUserId: params.referralUserId
        })

        return result
      } catch (err) {
        const errorMsg = 'Failed to create swap: ' + (err as Error).message
        setError(errorMsg)
        throw err
      } finally {
        setLoading(false)
      }
    },
    [swapService]
  )

  // Clear error
  const clearError = useCallback(() => {
    setError(null)
  }, [])

  // Clear quote
  const clearQuote = useCallback(() => {
    setQuote(null)
  }, [])

  // Auto-load tokens on mount
  useEffect(() => {
    if (autoLoadTokens) {
      loadTokens()
    }
  }, [autoLoadTokens, loadTokens])

  return {
    // State
    tokens,
    quote,
    loading,
    error,

    // Actions
    loadTokens,
    getQuote,
    executeSwap,
    createSwap,
    clearError,
    clearQuote,

    // Utilities
    findToken: useCallback(
      (assetId: string) => tokens.find((t) => t.assetId === assetId),
      [tokens]
    ),
    findTokenBySymbol: useCallback(
      (symbol: string) => tokens.find((t) => t.symbol.toLowerCase() === symbol.toLowerCase()),
      [tokens]
    )
  }
}
