/**
 * Mixin Swap Demo Script
 *
 * This is a standalone example showing how to use the Mixin Route client.
 *
 * To run:
 * 1. Set up your keystore in .env.local
 * 2. Run: npx tsx examples/swap-demo.ts
 *
 * Or integrate this code into your React components using the useMixinSwap hook.
 */

import { createMixinSwapService } from "../src/services/mixin-swap";
import type { AppKeystore } from "@mixin.dev/mixin-node-sdk";

// Example keystore - Replace with your actual credentials
const keystore: AppKeystore = {
  app_id: process.env.MIXIN_CLIENT_ID || "your-app-id",
  session_id: process.env.MIXIN_SESSION_ID || "your-session-id",
  server_public_key:
    process.env.MIXIN_SERVER_PUBLIC_KEY || "your-server-public-key",
  session_private_key:
    process.env.MIXIN_SESSION_PRIVATE_KEY || "your-session-private-key",
};

//  Common Mixin asset IDs for testing
const ASSETS = {
  XIN: "c94ac88f-4671-3976-b60a-09064f1811e8",
  USDT: "4d8c508b-91c5-375b-92b0-ee702ed2dac5",
  USDC: "9b180ab6-6abe-3dc0-a13f-04169eb34bfa",
  BTC: "c6d0c728-2624-429b-8e0d-d9d19b6592fa",
  ETH: "43d61dcd-e413-450d-80b8-101d5e903357",
};

async function main() {
  console.log("🚀 Mixin Swap Demo\n");

  // Create swap service
  const swapService = createMixinSwapService(keystore);

  try {
    // 1. Get supported tokens
    console.log("📋 Step 1: Fetching supported tokens...");
    const tokens = await swapService.getSupportedTokens();
    console.log(`✅ Found ${tokens.length} supported tokens\n`);

    // Show first 5 tokens
    console.log("First 5 tokens:");
    tokens.slice(0, 5).forEach((token) => {
      console.log(`  - ${token.symbol.padEnd(8)} ${token.name}`);
    });
    console.log();

    // 2. Get swap quote
    console.log("💱 Step 2: Getting swap quote...");
    console.log(`   Input: 1 XIN`);
    console.log(`   Output: USDT\n`);

    const quote = await swapService.getSwapQuote(
      ASSETS.XIN, // Input: XIN
      ASSETS.USDT, // Output: USDT
      "1" // Amount: 1 XIN
    );

    console.log("✅ Quote received:");
    console.log(`   You pay: ${quote.inAmount} XIN`);
    console.log(`   You receive: ${quote.outAmount} USDT`);
    console.log(`   Rate: 1 XIN ≈ ${quote.outAmount} USDT\n`);

    // 3. Create swap (commented out to avoid actual transaction)

    console.log("🔄 Step 3: Creating swap transaction...");

    const swap = await swapService.createSwap({
      payerUserId: keystore.app_id, // Replace with actual user ID
      inputAssetId: ASSETS.XIN,
      outputAssetId: ASSETS.USDT,
      inputAmount: "1",
      payload: quote.payload,
      
    });

    console.log("✅ Swap created!");
    console.log(`   Payment URL: ${swap.tx}`);
    console.log(`   (Open this URL in Mixin to complete payment)\n`);

    // 4. Or use executeSwap for one-step quote + create
    console.log("🎯 Alternative: Use executeSwap for one-step process");
    console.log("   (Commented out to avoid actual transaction)\n");

    /*
    const result = await swapService.executeSwap({
      payerUserId: 'your-mixin-user-id',
      inputAssetId: ASSETS.XIN,
      outputAssetId: ASSETS.USDT,
      inputAmount: '1'
    })

    console.log('Quote:', result.quote)
    console.log('Payment URL:', result.swap.tx)
    */

    console.log("✅ Demo completed successfully!");
    console.log("\n📚 Next steps:");
    console.log("  1. Set up your Mixin keystore in .env.local");
    console.log("  2. Uncomment the swap creation code above");
    console.log('  3. Replace "your-mixin-user-id" with actual user ID');
    console.log("  4. Run this script to create a real swap");
    console.log("\n  See QUICK_START_SWAP.md for React integration examples");
  } catch (error: any) {
    console.error("❌ Error:", error.message);

    if (error.code) {
      console.error(`   Error code: ${error.code}`);
    }

    if (error.range) {
      console.error(`   Valid range: ${error.range.min} - ${error.range.max}`);
    }

    process.exit(1);
  }
}

// Run the demo
main();
