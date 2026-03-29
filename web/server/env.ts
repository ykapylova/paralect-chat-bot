import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.string().optional(),
  DATABASE_URL: z.string().optional(),

  OPENAI_API_KEY: z.string().optional(),
  OPENAI_CHAT_MODEL: z.string().optional(),
  OPENAI_SYSTEM_PROMPT: z.string().optional(),

  NEXT_PUBLIC_SUPABASE_URL: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  SUPABASE_STORAGE_BUCKET: z.string().optional(),
  SUPABASE_STORAGE_SIGNED_URL_TTL_SEC: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error("[server/env] Invalid environment shape", parsed.error.flatten());
  throw new Error("Invalid server environment variables");
}

function trimOrUndefined(value: string | undefined): string | undefined {
  const t = value?.trim();
  return t || undefined;
}

function parseSignedUrlTtlSec(raw: string | undefined): number {
  const trimmed = trimOrUndefined(raw);
  if (!trimmed) return 60 * 60 * 24 * 7;
  const n = Number.parseInt(trimmed, 10);
  return Number.isFinite(n) && n >= 60 ? n : 60 * 60 * 24 * 7;
}

const p = parsed.data;

const nodeEnvRaw = p.NODE_ENV;
const nodeEnv =
  nodeEnvRaw === "production" || nodeEnvRaw === "test" ? nodeEnvRaw : "development";

export const env = {
  nodeEnv,

  databaseUrl: trimOrUndefined(p.DATABASE_URL),

  openaiApiKey: trimOrUndefined(p.OPENAI_API_KEY),
  openaiChatModel: trimOrUndefined(p.OPENAI_CHAT_MODEL) ?? "gpt-4o-mini",
  openaiSystemPrompt: trimOrUndefined(p.OPENAI_SYSTEM_PROMPT),

  supabaseUrl: trimOrUndefined(p.NEXT_PUBLIC_SUPABASE_URL),
  supabaseServiceRoleKey: trimOrUndefined(p.SUPABASE_SERVICE_ROLE_KEY),
  supabaseStorageBucket: trimOrUndefined(p.SUPABASE_STORAGE_BUCKET) ?? "chat-uploads",
  supabaseSignedUrlTtlSec: parseSignedUrlTtlSec(p.SUPABASE_STORAGE_SIGNED_URL_TTL_SEC),
} as const;

export type env = typeof env;

export function isOpenAiConfigured(): boolean {
  return Boolean(env.openaiApiKey);
}
