import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cachedClient: SupabaseClient | null = null;

function getServiceClient(): SupabaseClient {
  if (cachedClient) return cachedClient;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    throw new Error("Supabase storage is not configured");
  }
  cachedClient = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cachedClient;
}

export function getStorageBucketName(): string {
  return process.env.SUPABASE_STORAGE_BUCKET?.trim() || "chat-uploads";
}

export function isChatStorageConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim(),
  );
}

export function signedUrlTtlSec(): number {
  const raw = process.env.SUPABASE_STORAGE_SIGNED_URL_TTL_SEC?.trim();
  if (!raw) return 60 * 60 * 24 * 7;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= 60 ? n : 60 * 60 * 24 * 7;
}

export async function uploadBytesToChatBucket(
  objectPath: string,
  bytes: Buffer,
  contentType: string,
): Promise<{ path: string }> {
  const supabase = getServiceClient();
  const bucket = getStorageBucketName();
  const { data, error } = await supabase.storage.from(bucket).upload(objectPath, bytes, {
    contentType,
    upsert: false,
  });
  if (error) {
    console.error("[supabase storage upload]", error);
    throw new Error(error.message || "Storage upload failed");
  }
  return { path: data.path };
}

export async function getSignedUrlForPath(objectPath: string, expiresInSec: number): Promise<string> {
  const supabase = getServiceClient();
  const bucket = getStorageBucketName();
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(objectPath, expiresInSec);
  if (error || !data?.signedUrl) {
    console.error("[supabase storage signed url]", error);
    throw new Error("Could not create signed URL");
  }
  return data.signedUrl;
}
