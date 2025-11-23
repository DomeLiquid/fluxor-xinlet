# 运行 Mixin Swap 示例

## ✅ 测试成功

已验证可以正常工作!刚才的测试结果:

```
🚀 Mixin Swap Demo

📋 Step 1: Fetching supported tokens...
✅ Found 138 supported tokens

First 5 tokens:
  - BTC      Bitcoin
  - ETH      Ether
  - SOL      Solana
  - XRP      Ripple
  - UNI      Uniswap

💱 Step 2: Getting swap quote...
   Input: 1 XIN
   Output: USDT

✅ Quote received:
   You pay: 1 XIN
   You receive: 63.667264 USDT
   Rate: 1 XIN ≈ 63.667264 USDT
```

## 🚀 运行方式

### 方式 1: 命令行运行 (推荐测试)

```bash
# 设置环境变量并运行
MIXIN_CLIENT_ID=your-app-id \
MIXIN_SESSION_ID=your-session-id \
MIXIN_SERVER_PUBLIC_KEY=your-server-public-key \
MIXIN_SESSION_PRIVATE_KEY=your-session-private-key \
npx tsx examples/swap-demo.ts
```

或者使用 npm script:

```bash
# 先设置环境变量
export MIXIN_CLIENT_ID=your-app-id
export MIXIN_SESSION_ID=your-session-id
export MIXIN_SERVER_PUBLIC_KEY=your-server-public-key
export MIXIN_SESSION_PRIVATE_KEY=your-session-private-key

# 运行
npm run swap-demo
```

### 方式 2: Next.js API Route (推荐生产环境)

1. **设置环境变量**

创建 `.env.local`:

```bash
MIXIN_CLIENT_ID=your-app-id
MIXIN_SESSION_ID=your-session-id
MIXIN_SERVER_PUBLIC_KEY=your-server-public-key
MIXIN_SESSION_PRIVATE_KEY=your-session-private-key
```

2. **启动开发服务器**

```bash
npm run dev
```

3. **访问测试 API**

打开浏览器访问: http://localhost:3000/api/test-swap

你会看到 JSON 响应:

```json
{
  "success": true,
  "data": {
    "totalTokens": 138,
    "firstFiveTokens": [...],
    "quote": {
      "input": "1 XIN",
      "output": "63.667264 USDT",
      "rate": "1 XIN ≈ 63.667264 USDT"
    }
  },
  "message": "Mixin Swap 测试成功!"
}
```

### 方式 3: React 组件集成

在你的 React 组件中使用:

```typescript
'use client'

import { useMixinSwap } from '@/hooks/useMixinSwap'
import type { AppKeystore } from '@mixin.dev/mixin-node-sdk'

export default function SwapPage() {
  const keystore: AppKeystore = {
    app_id: process.env.NEXT_PUBLIC_MIXIN_CLIENT_ID!,
    session_id: process.env.NEXT_PUBLIC_MIXIN_SESSION_ID!,
    server_public_key: process.env.NEXT_PUBLIC_MIXIN_SERVER_PUBLIC_KEY!,
    session_private_key: process.env.NEXT_PUBLIC_MIXIN_SESSION_PRIVATE_KEY!
  }

  const { tokens, quote, getQuote, executeSwap, loading, error } = useMixinSwap({
    keystore,
    autoLoadTokens: true
  })

  const handleSwap = async () => {
    const result = await executeSwap({
      payerUserId: 'your-user-id',
      inputAssetId: 'c94ac88f-4671-3976-b60a-09064f1811e8', // XIN
      outputAssetId: '4d8c508b-91c5-375b-92b0-ee702ed2dac5', // USDT
      inputAmount: '1'
    })

    // 跳转到 Mixin 支付
    window.location.href = result.swap.tx
  }

  return (
    <div>
      {loading && <p>加载中...</p>}
      {error && <p>错误: {error}</p>}
      <p>支持 {tokens.length} 个代币</p>
      <button onClick={handleSwap}>兑换</button>
    </div>
  )
}
```

## 📝 API 使用示例

### 获取支持的代币

```typescript
import { createMixinSwapService } from '@/services/mixin-swap'

const swapService = createMixinSwapService(keystore)
const tokens = await swapService.getSupportedTokens()

console.log(`找到 ${tokens.length} 个代币`)
tokens.forEach(token => {
  console.log(`${token.symbol} - ${token.name}`)
})
```

### 获取兑换报价

```typescript
const quote = await swapService.getSwapQuote(
  'c94ac88f-4671-3976-b60a-09064f1811e8', // XIN
  '4d8c508b-91c5-375b-92b0-ee702ed2dac5', // USDT
  '1' // 数量
)

console.log(`1 XIN = ${quote.outAmount} USDT`)
```

### 创建兑换交易

```typescript
const swap = await swapService.createSwap({
  payerUserId: 'user-mixin-id',
  inputAssetId: 'c94ac88f-4671-3976-b60a-09064f1811e8', // XIN
  outputAssetId: '4d8c508b-91c5-375b-92b0-ee702ed2dac5', // USDT
  inputAmount: '1',
  payload: quote.payload
})

// 跳转到 Mixin 支付
window.location.href = swap.tx
```

### 一步执行 (报价 + 创建交易)

```typescript
const result = await swapService.executeSwap({
  payerUserId: 'user-mixin-id',
  inputAssetId: 'c94ac88f-4671-3976-b60a-09064f1811e8',
  outputAssetId: '4d8c508b-91c5-375b-92b0-ee702ed2dac5',
  inputAmount: '1'
})

console.log('报价:', result.quote)
console.log('支付链接:', result.swap.tx)
```

## 🔐 安全提示

⚠️ **重要**: 不要在客户端暴露 Mixin 密钥!

- ✅ **推荐**: 在 Next.js API Route 中使用 (服务端)
- ✅ **推荐**: 使用不带 `NEXT_PUBLIC_` 前缀的环境变量
- ❌ **避免**: 在浏览器中直接使用密钥
- ❌ **避免**: 提交 `.env.local` 到 Git

## 🎯 常用资产 ID

```typescript
const ASSETS = {
  XIN: 'c94ac88f-4671-3976-b60a-09064f1811e8',
  USDT: '4d8c508b-91c5-375b-92b0-ee702ed2dac5',
  USDC: '9b180ab6-6abe-3dc0-a13f-04169eb34bfa',
  BTC: 'c6d0c728-2624-429b-8e0d-d9d19b6592fa',
  ETH: '43d61dcd-e413-450d-80b8-101d5e903357',
  SOL: '64692c23-8971-4cf4-84a7-4dd1271dd887',
  DOGE: '6770a1e5-6086-44d5-b60f-545f9d9e8ffd'
}
```

## 🐛 故障排除

### 错误: "Failed to load tokens"

检查:
1. Keystore 配置是否正确
2. 网络连接是否正常
3. App ID 和 Session ID 是否匹配

### 错误: "Invalid amount range"

- 数量太小或太大
- 查看错误消息中的 `range.min` 和 `range.max`

### 错误: "No quote available"

- 该兑换对可能不支持
- 尝试其他代币组合

## 📚 更多文档

- [快速开始](./QUICK_START_SWAP.md) - 5分钟入门
- [集成指南](./MIXIN_SWAP_INTEGRATION.md) - 完整集成文档
- [API 参考](./src/lib/README.md) - 详细 API 说明
- [实现总结](./IMPLEMENTATION_COMPLETE.md) - 技术细节

## 🎉 现在就试试吧!

```bash
# 使用你的凭据运行
MIXIN_CLIENT_ID=30aad5a5-e5f3-4824-9409-c2ff4152724e \
MIXIN_SESSION_ID=30e0b835-9036-45a9-b669-855bb047dd27 \
MIXIN_SERVER_PUBLIC_KEY=fc43f269332543886280cd0beeaf6aa5aece8c9c1f0da77a38e749585b3bb930 \
MIXIN_SESSION_PRIVATE_KEY=b9a49adc1622c1b180e36c7356239534c73ef2ce81e08821243ff2063f434f9a \
npx tsx examples/swap-demo.ts
```

成功! 🚀
