/**
 * Mixin Swap 测试脚本
 *
 * 运行方式:
 * MIXIN_CLIENT_ID=xxx MIXIN_SESSION_ID=xxx MIXIN_SERVER_PUBLIC_KEY=xxx MIXIN_SESSION_PRIVATE_KEY=xxx node test-swap.mjs
 */

import { createMixinSwapService } from './src/services/mixin-swap.js'

// 从环境变量读取 keystore
const keystore = {
  app_id: process.env.MIXIN_CLIENT_ID,
  session_id: process.env.MIXIN_SESSION_ID,
  server_public_key: process.env.MIXIN_SERVER_PUBLIC_KEY,
  session_private_key: process.env.MIXIN_SESSION_PRIVATE_KEY
}

// 验证配置
if (!keystore.app_id || !keystore.session_id || !keystore.server_public_key || !keystore.session_private_key) {
  console.error('❌ 错误: 缺少必要的环境变量')
  console.error('请设置: MIXIN_CLIENT_ID, MIXIN_SESSION_ID, MIXIN_SERVER_PUBLIC_KEY, MIXIN_SESSION_PRIVATE_KEY')
  process.exit(1)
}

// 常用资产 ID
const ASSETS = {
  XIN: 'c94ac88f-4671-3976-b60a-09064f1811e8',
  USDT: '4d8c508b-91c5-375b-92b0-ee702ed2dac5',
  USDC: '9b180ab6-6abe-3dc0-a13f-04169eb34bfa',
  BTC: 'c6d0c728-2624-429b-8e0d-d9d19b6592fa',
  ETH: '43d61dcd-e413-450d-80b8-101d5e903357'
}

async function main() {
  console.log('🚀 Mixin Swap 测试\n')
  console.log(`App ID: ${keystore.app_id}\n`)

  try {
    // 创建 swap service
    const swapService = createMixinSwapService(keystore)

    // 1. 获取支持的代币
    console.log('📋 步骤 1: 获取支持的代币列表...')
    const tokens = await swapService.getSupportedTokens()
    console.log(`✅ 找到 ${tokens.length} 个支持的代币\n`)

    // 显示前 5 个代币
    console.log('前 5 个代币:')
    tokens.slice(0, 5).forEach(token => {
      console.log(`  - ${token.symbol.padEnd(8)} ${token.name}`)
    })
    console.log()

    // 2. 获取兑换报价
    console.log('💱 步骤 2: 获取兑换报价...')
    console.log(`   输入: 1 XIN`)
    console.log(`   输出: USDT\n`)

    const quote = await swapService.getSwapQuote(
      ASSETS.XIN,   // 输入: XIN
      ASSETS.USDT,  // 输出: USDT
      '1'           // 数量: 1 XIN
    )

    console.log('✅ 获取到报价:')
    console.log(`   你支付: ${quote.inAmount} XIN`)
    console.log(`   你收到: ${quote.outAmount} USDT`)
    console.log(`   汇率: 1 XIN ≈ ${quote.outAmount} USDT\n`)

    console.log('✅ 测试完成!')
    console.log('\n📚 下一步:')
    console.log('  1. 查看 QUICK_START_SWAP.md 了解如何在 React 中使用')
    console.log('  2. 使用 createSwap() 创建真实的兑换交易')
    console.log('  3. 集成到你的应用中')

  } catch (error) {
    console.error('❌ 错误:', error.message)

    if (error.code) {
      console.error(`   错误代码: ${error.code}`)
    }

    if (error.range) {
      console.error(`   有效范围: ${error.range.min} - ${error.range.max}`)
    }

    if (error.stack) {
      console.error('\n详细错误:')
      console.error(error.stack)
    }

    process.exit(1)
  }
}

main()
