# Mixin Swap Integration Guide

A complete JavaScript/TypeScript implementation of the Mixin Route API client, equivalent to the [Go mixin-kit](https://github.com/DomeLiquid/mixin-kit-go).

## 📦 What's Included

### Core Files

1. **`src/types/mixin-route.types.ts`** - TypeScript type definitions
   - `TokenView`, `QuoteRespView`, `SwapRequest`, `SwapRespView`
   - Error types and enums
   - Matches the API documentation exactly

2. **`src/lib/mixin-route-client.ts`** - Low-level Web3 client
   - HMAC-SHA256 request signing (same as Go implementation)
   - X25519 key exchange for shared secret
   - Direct API methods: `getTokens()`, `getQuote()`, `swap()`
   - Automatic retry logic and error handling

3. **`src/services/mixin-swap.ts`** - High-level swap service
   - User-friendly API wrapper
   - Enhanced error messages
   - `getSupportedTokens()`, `getSwapQuote()`, `createSwap()`, `executeSwap()`

4. **`src/hooks/useMixinSwap.ts`** - React hook
   - State management for swaps
   - Loading and error states
   - Auto-load tokens on mount
   - Token search utilities

### Examples

5. **`src/examples/swap-example.tsx`** - Basic React component
6. **`src/examples/swap-with-hook.tsx`** - Using the React hook (recommended)

### Documentation

7. **`src/lib/README.md`** - Comprehensive API documentation
8. **`src/lib/__tests__/mixin-route-client.test.ts`** - Test examples

## 🚀 Quick Start

### 1. Install Dependencies (Already Done)

```bash
npm install @mixin.dev/mixin-node-sdk @noble/hashes @noble/curves
```

### 2. Basic Usage

```typescript
import { createMixinSwapService } from '@/services/mixin-swap'
import type { AppKeystore } from '@mixin.dev/mixin-node-sdk'

// Your Mixin keystore
const keystore: AppKeystore = {
  app_id: process.env.NEXT_PUBLIC_MIXIN_CLIENT_ID!,
  session_id: process.env.NEXT_PUBLIC_MIXIN_SESSION_ID!,
  server_public_key: process.env.NEXT_PUBLIC_MIXIN_SERVER_PUBLIC_KEY!,
  session_private_key: process.env.NEXT_PUBLIC_MIXIN_SESSION_PRIVATE_KEY!
}

const swapService = createMixinSwapService(keystore)

// Get supported tokens
const tokens = await swapService.getSupportedTokens()

// Get quote
const quote = await swapService.getSwapQuote(
  'c94ac88f-4671-3976-b60a-09064f1811e8', // XIN
  '4d8c508b-91c5-375b-92b0-ee702ed2dac5', // USDT
  '10'
)

// Execute swap
const result = await swapService.executeSwap({
  payerUserId: 'your-user-id',
  inputAssetId: 'c94ac88f-4671-3976-b60a-09064f1811e8',
  outputAssetId: '4d8c508b-91c5-375b-92b0-ee702ed2dac5',
  inputAmount: '10'
})

// Redirect to payment
window.location.href = result.swap.tx
```

### 3. Using React Hook (Recommended)

```typescript
import { useMixinSwap } from '@/hooks/useMixinSwap'

function SwapComponent() {
  const { tokens, quote, loading, error, getQuote, executeSwap } = useMixinSwap({
    keystore,
    autoLoadTokens: true
  })

  // tokens are automatically loaded
  // Use getQuote() and executeSwap() as needed
}
```

See `src/examples/swap-with-hook.tsx` for a complete example.

## 🔐 How It Works

### Request Signing (Same as Go Implementation)

```
1. Generate shared key using X25519 key exchange
   ├─ Convert Ed25519 keys to Curve25519
   └─ Perform ECDH key exchange

2. Build data to sign
   └─ Format: timestamp + method + uri + body

3. Create HMAC-SHA256 signature
   └─ HMAC(sharedKey, data)

4. Encode signature
   └─ Base64 URL-safe encoding

5. Add headers to request
   ├─ MR-ACCESS-TIMESTAMP: Unix timestamp
   └─ MR-ACCESS-SIGN: Signature
```

### Architecture

```
┌────────────────────────────┐
│   React Components         │
│   (Your UI)                │
└─────────────┬──────────────┘
              │
              ▼
┌────────────────────────────┐
│   useMixinSwap Hook        │  ← Recommended entry point
│   (State management)       │
└─────────────┬──────────────┘
              │
              ▼
┌────────────────────────────┐
│   MixinSwapService         │  ← High-level API
│   (Business logic)         │
└─────────────┬──────────────┘
              │
              ▼
┌────────────────────────────┐
│   Web3Client               │  ← Low-level client
│   (Request signing)        │
└─────────────┬──────────────┘
              │
              ▼
┌────────────────────────────┐
│   Mixin Route API          │
│   api.route.mixin.one      │
└────────────────────────────┘
```

## 📚 API Reference

### High-Level Service (Recommended)

```typescript
class MixinSwapService {
  getSupportedTokens(): Promise<TokenView[]>
  getSwapQuote(inputAssetId, outputAssetId, amount): Promise<QuoteRespView>
  createSwap(params): Promise<SwapRespView>
  executeSwap(params): Promise<{quote, swap}>
}
```

### Low-Level Client

```typescript
class Web3Client {
  get<T>(path, query?): Promise<T>
  post<T>(path, body?): Promise<T>
  getTokens(): Promise<TokenView[]>
  getQuote(inputMint, outputMint, amount): Promise<QuoteRespView>
  swap(request): Promise<SwapRespView>
}
```

### React Hook

```typescript
function useMixinSwap(options: {
  keystore: AppKeystore | NetworkUserKeystore
  autoLoadTokens?: boolean
}): {
  // State
  tokens: TokenView[]
  quote: QuoteRespView | null
  loading: boolean
  error: string | null

  // Actions
  loadTokens(): Promise<TokenView[]>
  getQuote(params): Promise<QuoteRespView>
  executeSwap(params): Promise<{quote, swap}>
  createSwap(params): Promise<SwapRespView>
  clearError(): void
  clearQuote(): void

  // Utilities
  findToken(assetId): TokenView | undefined
  findTokenBySymbol(symbol): TokenView | undefined
}
```

## 🎯 Common Use Cases

### 1. Display Available Tokens

```typescript
const { tokens } = useMixinSwap({ keystore })

return (
  <select>
    {tokens.map(token => (
      <option key={token.assetId} value={token.assetId}>
        {token.symbol} - {token.name}
      </option>
    ))}
  </select>
)
```

### 2. Get Real-Time Quote

```typescript
const { getQuote, quote } = useMixinSwap({ keystore })

const handleAmountChange = async (amount: string) => {
  if (amount && inputAsset && outputAsset) {
    await getQuote({ inputAssetId: inputAsset, outputAssetId: outputAsset, amount })
  }
}

// Display quote.outAmount to user
```

### 3. Complete Swap Flow

```typescript
const { executeSwap } = useMixinSwap({ keystore })

const handleSwap = async () => {
  const result = await executeSwap({
    payerUserId: user.id,
    inputAssetId: 'asset-1',
    outputAssetId: 'asset-2',
    inputAmount: '10'
  })

  // Redirect to Mixin for payment
  window.location.href = result.swap.tx
}
```

### 4. Error Handling

```typescript
const { error, clearError } = useMixinSwap({ keystore })

if (error) {
  return (
    <div className="error">
      {error}
      <button onClick={clearError}>Dismiss</button>
    </div>
  )
}
```

## ⚠️ Error Codes

| Code  | Description | Handling |
|-------|-------------|----------|
| 10611 | Invalid swap | Check asset IDs are valid |
| 10614 | Amount out of range | Use `error.range.min` and `error.range.max` |
| 10615 | No quote available | Swap pair not supported |

## 🔧 Configuration

### Custom API Endpoint

```typescript
const client = createWeb3Client(keystore, {
  baseURL: 'https://custom-api.example.com'
})
```

### Retry Settings

```typescript
const client = createWeb3Client(keystore, {
  retryCount: 3,
  retryDelay: 1000, // ms
  timeout: 15000 // ms
})
```

## 🧪 Testing

See `src/lib/__tests__/mixin-route-client.test.ts` for test examples.

```bash
npm test
```

## 📖 References

- [Mixin Route API Docs (CN)](https://github.com/MixinNetwork/route-docs/blob/main/mixin_swap_api_cn.md)
- [Go Implementation](https://github.com/DomeLiquid/mixin-kit-go)
- [Mixin Node SDK](https://github.com/MixinNetwork/bot-api-nodejs-client)

## 🆚 Comparison with Go

| Feature | Go | JavaScript | Status |
|---------|-----|-----------|--------|
| Request Signing | HMAC-SHA256 | HMAC-SHA256 | ✅ Identical |
| Key Exchange | X25519 | X25519 | ✅ Identical |
| Error Handling | Custom Error | MixinRouteAPIError | ✅ Equivalent |
| Retry Logic | Resty | Custom | ✅ Equivalent |
| Type Safety | Structs | TypeScript | ✅ Equivalent |
| All Endpoints | ✅ | ✅ | ✅ Complete |

## 💡 Tips

1. **Use the React Hook** - It handles state management automatically
2. **Cache tokens** - Load once, use the `tokens` state
3. **Show quote first** - Let users confirm before executing swap
4. **Handle errors gracefully** - Display user-friendly messages
5. **Test with small amounts** - Verify integration before production

## 📝 Next Steps

1. Set up your Mixin keystore in environment variables
2. Try the example in `src/examples/swap-with-hook.tsx`
3. Integrate into your existing components
4. Add custom UI/UX around the swap flow
5. Test thoroughly with various token pairs

## 🤝 Support

For issues or questions:
- Check the comprehensive docs in `src/lib/README.md`
- Review example components in `src/examples/`
- Refer to the Go implementation for comparison
- Check the Mixin Route API documentation

---

**Built with ❤️ using TypeScript, React, and the Mixin SDK**
