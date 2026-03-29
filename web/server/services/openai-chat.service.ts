import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

export function getOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey?.trim()) {
    throw new Error("OPENAI_API_KEY is not configured");
  }
  return new OpenAI({ apiKey });
}

export function defaultChatModel(): string {
  return process.env.OPENAI_CHAT_MODEL?.trim() || "gpt-4o-mini";
}

export async function createChatCompletionStream(messages: ChatCompletionMessageParam[]) {
  const client = getOpenAIClient();
  return client.chat.completions.create({
    model: defaultChatModel(),
    messages,
    stream: true,
  });
}
