import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

import { env } from "../env";

export function getOpenAIClient(): OpenAI {
  const apiKey = env.openaiApiKey;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }
  return new OpenAI({ apiKey });
}

export function defaultChatModel(): string {
  return env.openaiChatModel;
}

export async function createChatCompletionStream(messages: ChatCompletionMessageParam[]) {
  const client = getOpenAIClient();
  return client.chat.completions.create({
    model: defaultChatModel(),
    messages,
    stream: true,
  });
}
