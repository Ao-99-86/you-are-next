import process from "node:process";
import {
  isAzureConfigured,
  generateMonsterReply,
  generateBotChatMessage,
} from "../party/azureChat.ts";
import {
  pickDeterministicBotMessage,
  resolveBotChatMessage,
} from "../party/aiPlayers.ts";

function log(msg) {
  console.log(`[phase5-azure] ${msg}`);
}

function fail(msg) {
  console.error(`[phase5-azure] FAIL: ${msg}`);
  process.exitCode = 1;
}

let failures = 0;

function assert(condition, label) {
  if (!condition) {
    fail(label);
    failures += 1;
  } else {
    log(`  PASS: ${label}`);
  }
}

async function main() {
  log("Running Azure chat fallback checks...");

  // 1. isAzureConfigured returns false with no env vars
  const wasConfigured = isAzureConfigured();
  assert(!wasConfigured, "isAzureConfigured() → false with no env vars");

  // 2. generateMonsterReply returns null with no env vars
  const monsterReply = await generateMonsterReply(0, "test message", 3);
  assert(monsterReply === null, "generateMonsterReply() → null with no env vars");

  // 3. resolveBotChatMessage with null generator returns deterministic fallback
  const fallbackMsg = await resolveBotChatMessage(0, async () => null);
  assert(
    typeof fallbackMsg === "string" && fallbackMsg.length > 0,
    "resolveBotChatMessage(..., () => null) → non-empty deterministic fallback"
  );

  // 4. pickDeterministicBotMessage returns non-empty for i=0,1,2
  for (let i = 0; i < 3; i += 1) {
    const msg = pickDeterministicBotMessage(i);
    assert(
      typeof msg === "string" && msg.length > 0,
      `pickDeterministicBotMessage(${i}) → non-empty`
    );
  }

  // 5. Live Azure call if env vars are set
  if (
    process.env.AZURE_OPENAI_ENDPOINT &&
    process.env.AZURE_OPENAI_API_KEY &&
    process.env.AZURE_OPENAI_DEPLOYMENT_NAME
  ) {
    log("Azure env vars detected — running live call...");
    assert(isAzureConfigured(), "isAzureConfigured() → true with env vars set");

    const liveReply = await generateBotChatMessage(0);
    assert(
      typeof liveReply === "string" && liveReply.length > 0,
      "generateBotChatMessage(0) → non-null live response"
    );
  } else {
    log("Azure env vars not set — skipping live call test.");
  }

  if (failures > 0) {
    fail(`${failures} check(s) failed.`);
    process.exit(1);
  }

  log("All Azure fallback checks passed.");
  process.exit(0);
}

main().catch((err) => {
  fail(String(err));
  process.exit(1);
});
