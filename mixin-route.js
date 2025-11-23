import { createMixinSwapService } from "@/services/mixin-swap";
import { AppKeystore } from "@mixin.dev/mixin-node-sdk";

async function main() {
  const keystore = {
    app_id: "30aad5a5-e5f3-4824-9409-c2ff4152724e",
    session_id: "30e0b835-9036-45a9-b669-855bb047dd27",
    server_public_key:
      "fc43f269332543886280cd0beeaf6aa5aece8c9c1f0da77a38e749585b3bb930",
    session_private_key:
      "b9a49adc1622c1b180e36c7356239534c73ef2ce81e08821243ff2063f434f9a",
  };
  const mixinRoute = createMixinSwapService(keystore);
  const tokens = await mixinRoute.getSupportedTokens();
  console.log(tokens);
}

main();
