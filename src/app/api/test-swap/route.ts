/**
 * Mixin Swap 测试 API
 *
 * 访问: http://localhost:3000/api/test-swap
 */

import { NextResponse } from 'next/server'
import { createMixinSwapService } from '@/services/mixin-swap'
import type { AppKeystore } from '@mixin.dev/mixin-node-sdk'

export async function GET() {
  try {
    // 从环境变量获取 keystore
    const keystore: AppKeystore = {
      app_id: process.env.MIXIN_CLIENT_ID || process.env.NEXT_PUBLIC_MIXIN_CLIENT_ID!,
      session_id: process.env.MIXIN_SESSION_ID || process.env.NEXT_PUBLIC_MIXIN_SESSION_ID!,
      server_public_key: process.env.MIXIN_SERVER_PUBLIC_KEY || process.env.NEXT_PUBLIC_MIXIN_SERVER_PUBLIC_KEY!,
      session_private_key: process.env.MIXIN_SESSION_PRIVATE_KEY || process.env.NEXT_PUBLIC_MIXIN_SESSION_PRIVATE_KEY!
    }

    // 验证配置
    if (!keystore.app_id || !keystore.session_id) {
      return NextResponse.json({
        error: '缺少 Mixin 配置',
        message: '请在 .env.local 中设置 MIXIN_CLIENT_ID, MIXIN_SESSION_ID, MIXIN_SERVER_PUBLIC_KEY, MIXIN_SESSION_PRIVATE_KEY'
      }, { status: 500 })
    }

    // 创建 swap service
    const swapService = createMixinSwapService(keystore)

    console.log('📋 获取支持的代币...')
    const tokens = await swapService.getSupportedTokens()

    console.log(`✅ 找到 ${tokens.length} 个代币`)

    // 获取一个兑换报价
    const XIN = 'c94ac88f-4671-3976-b60a-09064f1811e8'
    const USDT = '4d8c508b-91c5-375b-92b0-ee702ed2dac5'

    console.log('💱 获取 XIN -> USDT 报价...')
    const quote = await swapService.getSwapQuote(XIN, USDT, '1')

    console.log(`✅ 报价: 1 XIN = ${quote.outAmount} USDT`)

    return NextResponse.json({
      success: true,
      data: {
        totalTokens: tokens.length,
        firstFiveTokens: tokens.slice(0, 5).map(t => ({
          symbol: t.symbol,
          name: t.name,
          icon: t.icon
        })),
        quote: {
          input: '1 XIN',
          output: `${quote.outAmount} USDT`,
          rate: `1 XIN ≈ ${quote.outAmount} USDT`
        }
      },
      message: 'Mixin Swap 测试成功!'
    })

  } catch (error: any) {
    console.error('❌ 错误:', error)

    return NextResponse.json({
      error: error.message || '未知错误',
      code: error.code,
      range: error.range,
      stack: error.stack
    }, { status: 500 })
  }
}
