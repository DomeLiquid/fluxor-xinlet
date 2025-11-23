# Mixin Swap Examples

This directory contains standalone examples for the Mixin Route API client.

## Quick Start

### 1. Setup Environment

Create `.env.local` in the project root:

```bash
MIXIN_CLIENT_ID=your-app-id
MIXIN_SESSION_ID=your-session-id
MIXIN_SERVER_PUBLIC_KEY=your-server-public-key
MIXIN_SESSION_PRIVATE_KEY=your-session-private-key
```

### 2. Install tsx (if needed)

```bash
npm install -g tsx
```

###  3. Run the Demo

```bash
npx tsx examples/swap-demo.ts
```

## Example Output

```
🚀 Mixin Swap Demo

📋 Step 1: Fetching supported tokens...
✅ Found 150 supported tokens

First 5 tokens:
  - XIN      Mixin
  - USDT     Tether USD
  - USDC     USD Coin
  - BTC      Bitcoin
  - ETH      Ethereum

💱 Step 2: Getting swap quote...
   Input: 1 XIN
   Output: USDT

✅ Quote received:
   You pay: 1 XIN
   You receive: 245.123456 USDT
   Rate: 1 XIN ≈ 245.123456 USDT

✅ Demo completed successfully!
```

## For React Components

See the integration examples in the main documentation:

- `/QUICK_START_SWAP.md` - 5-minute quick start
- `/MIXIN_SWAP_INTEGRATION.md` - Complete guide
- `/src/lib/README.md` - API reference

### React Hook Example

```typescript
import { useMixinSwap } from '@/hooks/useMixinSwap'

function SwapComponent() {
  const { tokens, getQuote, executeSwap } = useMixinSwap({
    keystore: yourKeystore,
    autoLoadTokens: true
  })

  // Use tokens, getQuote, executeSwap in your UI
}
```

## Common Asset IDs

For quick testing:

```typescript
const ASSETS = {
  XIN: 'c94ac88f-4671-3976-b60a-09064f1811e8',
  USDT: '4d8c508b-91c5-375b-92b0-ee702ed2dac5',
  USDC: '9b180ab6-6abe-3dc0-a13f-04169eb34bfa',
  BTC: 'c6d0c728-2624-429b-8e0d-d9d19b6592fa',
  ETH: '43d61dcd-e413-450d-80b8-101d5e903357'
}
```

## Troubleshooting

### Error: "Failed to load tokens"
- Check your keystore credentials in `.env.local`
- Ensure you're using `app_id` not `client_id`
- Verify network connection

### Error: "Invalid amount range"
- Amount is too small or too large
- Check the error message for min/max values

### Error: "No quote available"
- Swap pair may not be supported
- Try different token pairs

## Next Steps

1. Run the demo script to see it in action
2. Modify `swap-demo.ts` to test different swaps
3. Integrate into your React app using `useMixinSwap` hook
4. See main documentation for production deployment

## Documentation

- [Quick Start](/QUICK_START_SWAP.md)
- [Integration Guide](/MIXIN_SWAP_INTEGRATION.md)
- [API Reference](/src/lib/README.md)
- [Implementation Summary](/IMPLEMENTATION_COMPLETE.md)
