'use client'

import { useState, useMemo } from 'react'
import type { TokenView } from '@/types/mixin-route.types'

interface TokenSelectorModalProps {
  tokens: TokenView[]
  selectedTokenId: string | null
  onSelect: (token: TokenView) => void
  onClose: () => void
}

export default function TokenSelectorModal({
  tokens,
  selectedTokenId,
  onSelect,
  onClose,
}: TokenSelectorModalProps) {
  const [searchQuery, setSearchQuery] = useState('')

  const filteredTokens = useMemo(() => {
    if (!searchQuery) return tokens

    const query = searchQuery.toLowerCase()
    return tokens.filter(
      (token) =>
        token.symbol.toLowerCase().includes(query) ||
        token.name.toLowerCase().includes(query)
    )
  }, [tokens, searchQuery])

  const handleSelect = (token: TokenView) => {
    onSelect(token)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-bold text-gray-900">选择兑换目标</h3>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Search */}
          <input
            type="text"
            placeholder="搜索代币名称或符号..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            autoFocus
          />
        </div>

        {/* Token List */}
        <div className="flex-1 overflow-auto p-4">
          <div className="space-y-2">
            {filteredTokens.map((token) => {
              const isSelected = token.assetId === selectedTokenId

              return (
                <div
                  key={token.assetId}
                  onClick={() => handleSelect(token)}
                  className={`flex items-center gap-4 p-4 rounded-lg cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-blue-50 border-2 border-blue-500'
                      : 'bg-gray-50 hover:bg-gray-100 border-2 border-transparent'
                  }`}
                >
                  {/* Token Icon with Chain Badge */}
                  <div className="relative w-12 h-12 flex-shrink-0">
                    <img
                      src={token.icon}
                      alt={token.symbol}
                      className="w-12 h-12 rounded-full"
                      onError={(e) => {
                        e.currentTarget.src = '/placeholder-icon.png'
                      }}
                    />
                    {/* Chain Icon Badge */}
                    {token.chain?.icon && (
                      <img
                        src={token.chain.icon}
                        alt={token.chain.symbol}
                        className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-white"
                        onError={(e) => {
                          e.currentTarget.src = '/placeholder-icon.png'
                        }}
                      />
                    )}
                  </div>

                  {/* Token Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900">
                        {token.symbol}
                      </span>
                      {token.chain && (
                        <span className="text-xs text-gray-500 bg-gray-200 px-2 py-0.5 rounded">
                          {token.chain.symbol}
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-600 truncate">
                      {token.name}
                    </div>
                  </div>

                  {/* Selected Indicator */}
                  {isSelected && (
                    <div className="flex-shrink-0">
                      <svg className="w-6 h-6 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    </div>
                  )}
                </div>
              )
            })}

            {filteredTokens.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                <p>没有找到匹配的代币</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
