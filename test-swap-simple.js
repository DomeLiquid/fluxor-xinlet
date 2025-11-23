/**
 * Mixin Swap 简单测试
 *
 * 使用方法:
 * MIXIN_CLIENT_ID=xxx MIXIN_SESSION_ID=xxx MIXIN_SERVER_PUBLIC_KEY=xxx MIXIN_SESSION_PRIVATE_KEY=xxx node test-swap-simple.js
 */

// 直接使用编译后的代码
async function main() {
  console.log('🚀 Mixin Swap 测试\n')

  // 验证环境变量
  const requiredEnvs = ['MIXIN_CLIENT_ID', 'MIXIN_SESSION_ID', 'MIXIN_SERVER_PUBLIC_KEY', 'MIXIN_SESSION_PRIVATE_KEY']
  const missing = requiredEnvs.filter(env => !process.env[env])

  if (missing.length > 0) {
    console.error('❌ 缺少环境变量:', missing.join(', '))
    console.error('\n使用方法:')
    console.error('MIXIN_CLIENT_ID=xxx MIXIN_SESSION_ID=xxx MIXIN_SERVER_PUBLIC_KEY=xxx MIXIN_SESSION_PRIVATE_KEY=xxx node test-swap-simple.js')
    process.exit(1)
  }

  console.log('✅ 环境变量配置正确')
  console.log(`App ID: ${process.env.MIXIN_CLIENT_ID}\n`)

  try {
    // 动态导入编译后的模块
    const { createMixinSwapService } = await import('./src/services/mixin-swap.ts')

    const keystore = {
      app_id: process.env.MIXIN_CLIENT_ID,
      session_id: process.env.MIXIN_SESSION_ID,
      server_public_key: process.env.MIXIN_SERVER_PUBLIC_KEY,
      session_private_key: process.env.MIXIN_SESSION_PRIVATE_KEY
    }

    const swapService = createMixinSwapService(keystore)

    // 测试获取代币列表
    console.log('📋 获取支持的代币列表...')
    const tokens = await swapService.getSupportedTokens()
    console.log(`✅ 找到 ${tokens.length} 个代币\n`)

    // 显示前5个
    console.log('前 5 个代币:')
    tokens.slice(0, 5).forEach(token => {
      console.log(`  - ${token.symbol.padEnd(10)} ${token.name}`)
    })

    console.log('\n✅ 测试成功!')

  } catch (error) {
    console.error('❌ 错误:', error.message)
    console.error('\n详细信息:', error)
    process.exit(1)
  }
}

main()
