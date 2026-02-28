interface AzureConfig {
  endpoint: string;
  apiKey: string;
  deploymentName: string;
}

export function getAzureConfig(): AzureConfig | null {
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const apiKey = process.env.AZURE_OPENAI_API_KEY;
  const deploymentName = process.env.AZURE_OPENAI_DEPLOYMENT_NAME;
  if (!endpoint || !apiKey || !deploymentName) return null;
  return { endpoint, apiKey, deploymentName };
}

export function isAzureConfigured(): boolean {
  return getAzureConfig() !== null;
}

export async function callAzureChat(
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number,
  temperature: number
): Promise<string | null> {
  const config = getAzureConfig();
  if (!config) return null;

  const normalizedEndpoint = config.endpoint.replace(/\/+$/, "");
  const url = `${normalizedEndpoint}/openai/v1/chat/completions`;

  const body = {
    model: config.deploymentName,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    max_tokens: maxTokens,
    temperature,
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": config.apiKey,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8_000),
    });

    if (!response.ok) {
      console.warn(
        `[azureChat] HTTP ${response.status}: ${response.statusText}`
      );
      return null;
    }

    const data = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    return data.choices?.[0]?.message?.content?.trim() ?? null;
  } catch (err) {
    console.warn(`[azureChat] Request failed: ${String(err)}`);
    return null;
  }
}

export async function generateMonsterReply(
  roundIndex: number,
  playerMessage: string,
  points: number
): Promise<string | null> {
  let tone: string;
  if (points >= 4) {
    tone = "grudgingly impressed but still threatening";
  } else if (points >= 2) {
    tone = "unimpressed and mocking";
  } else {
    tone = "contemptuous and hungry";
  }

  const systemPrompt = [
    "You are a terrifying forest monster in a horror game.",
    `Your tone is ${tone}.`,
    "Reply in 1-2 short sentences. Stay in character. Do not break the fourth wall.",
  ].join(" ");

  const userPrompt = `Round ${roundIndex + 1}. The player said: "${playerMessage}". They scored ${points} points. Reply as the monster.`;

  return callAzureChat(systemPrompt, userPrompt, 80, 0.9);
}

export async function generateBotChatMessage(
  roundIndex: number
): Promise<string | null> {
  const systemPrompt = [
    "You are an NPC in a horror game, caught by a forest monster.",
    "You must plead for your life convincingly.",
    "Use emotional keywords like: sorry, mercy, please, alive, promise, help, change, learn, friends, family, future, earn.",
    "Reply in 1-2 sentences. Stay in character.",
  ].join(" ");

  const userPrompt = `Round ${roundIndex + 1} of 3. Plead for your life to the monster.`;

  return callAzureChat(systemPrompt, userPrompt, 60, 0.8);
}
