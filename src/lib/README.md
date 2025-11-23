# Mixin Route API Client

This is a JavaScript/TypeScript client for the Mixin Route API, implementing the same functionality as the [Go mixin-kit](https://github.com/DomeLiquid/mixin-kit-go).

## Overview

The client provides access to the Mixin Swap API with proper request signing using HMAC-SHA256, mirroring the Go implementation.

## Features

- ✅ HMAC-SHA256 request signing with X25519 key exchange
- ✅ TypeScript support with full type definitions
- ✅ Automatic retry logic
- ✅ Error handling with detailed error codes
- ✅ Support for all Mixin Swap API endpoints

## Installation

Required dependencies (already installed):

```bash
npm install @mixin.dev/mixin-node-sdk @noble/hashes @noble/curves
```

## Usage

### Basic Setup

```typescript
import { createMixinSwapService } from '@/services/mixin-swap'
import type { AppKeystore } from '@mixin.dev/mixin-node-sdk'

// Your Mixin bot keystore
const keystore: AppKeystore = {
  app_id: 'your-app-id',
  session_id: 'your-session-id',
  server_public_key: 'your-server-public-key',
  session_private_key: 'your-session-private-key'
}

// Create swap service
const swapService = createMixinSwapService(keystore)
```

### Get Supported Tokens

```typescript
const tokens = await swapService.getSupportedTokens()
console.log(tokens)
// [
//   {
//     assetId: 'c94ac88f-4671-3976-b60a-09064f1811e8',
//     name: 'Mixin',
//     symbol: 'XIN',
//     icon: 'https://...',
//     chain: {
//       chainId: '...',
//       symbol: 'ETH',
//       name: 'Ethereum',
//       icon: 'https://...',
//       decimals: 18
//     }
//   },
//   ...
// ]
```

### Get Swap Quote

```typescript
const quote = await swapService.getSwapQuote(
  'c94ac88f-4671-3976-b60a-09064f1811e8', // Input: XIN
  '4d8c508b-91c5-375b-92b0-ee702ed2dac5', // Output: USDT
  '10.5' // Amount
)

console.log(quote)
// {
//   inputMint: 'c94ac88f-4671-3976-b60a-09064f1811e8',
//   inAmount: '10.5',
//   outputMint: '4d8c508b-91c5-375b-92b0-ee702ed2dac5',
//   outAmount: '2450.123456',
//   payload: 'base64-encoded-route-data'
// }
```

### Execute Swap (Quote + Transaction)

```typescript
try {
  const result = await swapService.executeSwap({
    payerUserId: 'user-mixin-id',
    inputAssetId: 'c94ac88f-4671-3976-b60a-09064f1811e8',
    outputAssetId: '4d8c508b-91c5-375b-92b0-ee702ed2dac5',
    inputAmount: '10.5',
    referralUserId: 'optional-referral-id' // Optional
  })

  console.log(result.quote) // Quote details
  console.log(result.swap.tx) // Mixin payment URL: mixin://pay?recipient=...
} catch (error) {
  console.error('Swap failed:', error)
}
```

### Create Swap Transaction Only

```typescript
const swap = await swapService.createSwap({
  payerUserId: 'user-mixin-id',
  inputAssetId: 'c94ac88f-4671-3976-b60a-09064f1811e8',
  outputAssetId: '4d8c508b-91c5-375b-92b0-ee702ed2dac5',
  inputAmount: '10.5',
  payload: quote.payload, // From previous quote
  referralUserId: 'optional-referral-id'
})

// Use the payment URL
window.location.href = swap.tx // Redirect to Mixin payment
```

### Low-Level Client Usage

```typescript
import { createWeb3Client } from '@/lib/mixin-route-client'

const client = createWeb3Client(keystore, {
  baseURL: 'https://api.route.mixin.one', // Optional, default shown
  timeout: 10000, // Optional, 10 seconds
  retryCount: 3, // Optional, number of retries
  retryDelay: 1000 // Optional, delay between retries in ms
})

// Direct API calls
const tokens = await client.getTokens()
const quote = await client.getQuote(inputMint, outputMint, amount)
const swap = await client.swap(swapRequest)
```

## Error Handling

The client provides detailed error information:

```typescript
import type { MixinRouteAPIError } from '@/types/mixin-route.types'

try {
  const quote = await swapService.getSwapQuote(inputAssetId, outputAssetId, amount)
} catch (error) {
  const routeError = error as MixinRouteAPIError

  switch (routeError.code) {
    case 10611:
      console.error('Invalid swap configuration')
      break
    case 10614:
      console.error('Amount out of range')
      console.log('Min:', routeError.range?.min)
      console.log('Max:', routeError.range?.max)
      break
    case 10615:
      console.error('No available quote found')
      break
    default:
      console.error('Error:', routeError.description)
  }
}
```

## API Reference

### MixinSwapService

High-level service for swap operations.

#### Methods

- `getSupportedTokens(): Promise<TokenView[]>` - Get all supported tokens
- `getSwapQuote(inputAssetId, outputAssetId, amount): Promise<QuoteRespView>` - Get swap quote
- `createSwap(params): Promise<SwapRespView>` - Create swap transaction
- `executeSwap(params): Promise<{quote, swap}>` - Complete swap flow (quote + transaction)

### Web3Client

Low-level API client with request signing.

#### Methods

- `get<T>(path, query?): Promise<T>` - Make GET request
- `post<T>(path, body?): Promise<T>` - Make POST request
- `getTokens(): Promise<TokenView[]>` - GET /web3/tokens
- `getQuote(inputMint, outputMint, amount): Promise<QuoteRespView>` - GET /web3/quote
- `swap(request): Promise<SwapRespView>` - POST /web3/swap

## Implementation Details

### Request Signing

The client implements HMAC-SHA256 signing identical to the Go implementation:

1. Generate shared key using X25519 key exchange (Ed25519 → Curve25519)
2. Build signing data: `timestamp + method + uri + body`
3. Create HMAC-SHA256 signature with shared key
4. Encode signature as base64 URL-safe string
5. Add headers:
   - `MR-ACCESS-TIMESTAMP`: Unix timestamp
   - `MR-ACCESS-SIGN`: Base64-encoded signature

### Architecture

```
┌─────────────────────────────────────┐
│   Frontend Components               │
│   (React, Vue, etc.)                │
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│   MixinSwapService                  │
│   (High-level API)                  │
│   - getSupportedTokens()            │
│   - getSwapQuote()                  │
│   - createSwap()                    │
│   - executeSwap()                   │
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│   Web3Client                        │
│   (Request signing & HTTP)          │
│   - signRequest()                   │
│   - doRequest()                     │
│   - get() / post()                  │
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│   Mixin Route API                   │
│   https://api.route.mixin.one       │
└─────────────────────────────────────┘
```

## Comparison with Go Implementation

This JavaScript client mirrors the Go implementation from [mixin-kit-go](https://github.com/DomeLiquid/mixin-kit-go):

| Feature | Go | JavaScript |
|---------|----|-----------|
| Request Signing | ✅ HMAC-SHA256 | ✅ HMAC-SHA256 |
| Key Exchange | ✅ X25519 | ✅ X25519 |
| Error Handling | ✅ Custom Error Type | ✅ MixinRouteAPIError |
| Retry Logic | ✅ resty client | ✅ Custom implementation |
| Type Safety | ✅ Go structs | ✅ TypeScript interfaces |
| API Methods | ✅ All endpoints | ✅ All endpoints |

## References

- [Mixin Route API Documentation (CN)](https://github.com/MixinNetwork/route-docs/blob/main/mixin_swap_api_cn.md)
- [Go Implementation](https://github.com/DomeLiquid/mixin-kit-go/blob/master/web3_client.go)
- [Mixin Node SDK](https://github.com/MixinNetwork/bot-api-nodejs-client)

## License

Same as the main project.
