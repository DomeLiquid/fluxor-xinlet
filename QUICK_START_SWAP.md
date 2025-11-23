# Mixin Swap - Quick Start Guide

Get started with Mixin Swap in 5 minutes! 🚀

## Step 1: Set Up Environment Variables

Create or update `.env.local`:

```bash
# Your Mixin Bot Credentials
NEXT_PUBLIC_MIXIN_CLIENT_ID=your-client-id
NEXT_PUBLIC_MIXIN_SESSION_ID=your-session-id
NEXT_PUBLIC_MIXIN_SERVER_PUBLIC_KEY=your-server-public-key
NEXT_PUBLIC_MIXIN_SESSION_PRIVATE_KEY=your-session-private-key
```

## Step 2: Create a Keystore Helper

Create `src/config/mixin.ts`:

```typescript
import type { AppKeystore } from '@mixin.dev/mixin-node-sdk'

export function getMixinKeystore(): AppKeystore {
  return {
    app_id: process.env.NEXT_PUBLIC_MIXIN_CLIENT_ID!,
    session_id: process.env.NEXT_PUBLIC_MIXIN_SESSION_ID!,
    server_public_key: process.env.NEXT_PUBLIC_MIXIN_SERVER_PUBLIC_KEY!,
    session_private_key: process.env.NEXT_PUBLIC_MIXIN_SESSION_PRIVATE_KEY!
  }
}
```

## Step 3: Use in Your Component

```typescript
'use client'

import { useMixinSwap } from '@/hooks/useMixinSwap'
import { getMixinKeystore } from '@/config/mixin'
import { useState } from 'react'

export default function SwapPage() {
  const keystore = getMixinKeystore()
  const { tokens, quote, loading, error, getQuote, executeSwap } = useMixinSwap({
    keystore,
    autoLoadTokens: true
  })

  const [inputAsset, setInputAsset] = useState('')
  const [outputAsset, setOutputAsset] = useState('')
  const [amount, setAmount] = useState('')

  const handleQuote = async () => {
    await getQuote({ inputAssetId: inputAsset, outputAssetId: outputAsset, amount })
  }

  const handleSwap = async () => {
    const userId = 'YOUR_USER_ID' // Get from your auth
    const result = await executeSwap({
      payerUserId: userId,
      inputAssetId: inputAsset,
      outputAssetId: outputAsset,
      amount
    })
    window.location.href = result.swap.tx
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Swap Tokens</h1>

      {error && <div className="bg-red-100 p-3 rounded mb-4">{error}</div>}

      <div className="space-y-4">
        <select value={inputAsset} onChange={e => setInputAsset(e.target.value)}>
          <option value="">Select input token</option>
          {tokens.map(t => (
            <option key={t.assetId} value={t.assetId}>{t.symbol}</option>
          ))}
        </select>

        <input
          type="number"
          value={amount}
          onChange={e => setAmount(e.target.value)}
          placeholder="Amount"
        />

        <select value={outputAsset} onChange={e => setOutputAsset(e.target.value)}>
          <option value="">Select output token</option>
          {tokens.map(t => (
            <option key={t.assetId} value={t.assetId}>{t.symbol}</option>
          ))}
        </select>

        <button onClick={handleQuote} disabled={loading}>
          Get Quote
        </button>

        {quote && (
          <div className="bg-gray-100 p-4 rounded">
            <p>You'll receive: {quote.outAmount}</p>
            <button onClick={handleSwap} disabled={loading}>
              Confirm Swap
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
```

## Step 4: Test It!

```bash
npm run dev
```

Visit `http://localhost:3000` and try swapping tokens!

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

## Need More Examples?

Check out:
- `src/examples/swap-with-hook.tsx` - Full featured example
- `src/lib/README.md` - Complete API documentation
- `MIXIN_SWAP_INTEGRATION.md` - Detailed integration guide

## Troubleshooting

### Error: "Failed to load tokens"
- Check your keystore credentials
- Verify network connection
- Check console for detailed error

### Error: "Invalid amount range"
- The amount is too small or too large
- Check `error.range.min` and `error.range.max`

### Error: "No quote available"
- Swap pair may not be supported
- Try a different token combination

## Production Checklist

- [ ] Store keystore securely (not in client-side env vars)
- [ ] Implement proper error handling UI
- [ ] Add loading states
- [ ] Test with small amounts first
- [ ] Add transaction confirmation UI
- [ ] Implement swap history tracking
- [ ] Add slippage protection
- [ ] Monitor swap success rates

## Support

For detailed docs and examples, see:
- `/MIXIN_SWAP_INTEGRATION.md`
- `/src/lib/README.md`
- `/src/examples/`

Happy swapping! 🎉
