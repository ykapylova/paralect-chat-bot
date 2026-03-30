import { toFile } from "openai";

import { env } from "../env";
import { DOCUMENT_FETCH_MAX_BYTES } from "../limits";
import { getOpenAIClient } from "./openai-chat.service";

function supabaseProjectHost(): string | null {
  const base = env.supabaseUrl;
  if (!base) return null;
  try {
    return new URL(base).hostname;
  } catch {
    return null;
  }
}

export function isTrustedSupabaseStorageUrl(url: string): boolean {
  const host = supabaseProjectHost();
  if (!host) return false;
  try {
    const u = new URL(url.trim());
    if (u.hostname !== host) return false;
    return u.pathname.includes("/storage/v1/object");
  } catch {
    return false;
  }
}

const DOC_EXT = /\.(pdf|docx?|txt)$/i;

export function looksLikeChatDocumentUrl(label: string, url: string): boolean {
  const path = (() => {
    try {
      return new URL(url).pathname;
    } catch {
      return url;
    }
  })();
  if (path.includes("/documents/")) return true;
  return DOC_EXT.test(label) || DOC_EXT.test(path);
}

function safeUploadFilename(label: string): string {
  const base = label.trim().replace(/[/\\]/g, "_").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
  return base || "document";
}

function defaultMimeForName(name: string): string {
  const lower = name.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".docx")) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (lower.endsWith(".doc")) return "application/msword";
  if (lower.endsWith(".txt")) return "text/plain";
  return "application/octet-stream";
}

export async function fetchStorageFileSignedUrl(
  url: string,
): Promise<{ buffer: Buffer; contentType: string; filenameHint: string }> {
  const maxBytes = DOCUMENT_FETCH_MAX_BYTES;
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 60_000);
  try {
    const res = await fetch(url, { signal: controller.signal, redirect: "follow" });
    if (!res.ok) {
      throw new Error(`Fetch failed ${res.status}`);
    }
    const len = res.headers.get("content-length");
    if (len && Number(len) > maxBytes) {
      throw new Error("File too large");
    }
    const ab = await res.arrayBuffer();
    if (ab.byteLength > maxBytes) {
      throw new Error("File too large");
    }
    const rawCt = res.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase();
    const path = new URL(url).pathname;
    const nameFromPath = path.split("/").pop() ?? "file";
    const contentType = rawCt && rawCt !== "application/octet-stream" ? rawCt : defaultMimeForName(nameFromPath);
    return { buffer: Buffer.from(ab), contentType, filenameHint: nameFromPath };
  } finally {
    clearTimeout(t);
  }
}

export async function uploadBufferToOpenAiUserData(
  buffer: Buffer,
  filename: string,
  mimeType: string,
): Promise<string> {
  const client = getOpenAIClient();
  const file = await toFile(buffer, filename, { type: mimeType });
  const created = await client.files.create({ file, purpose: "user_data" });
  return created.id;
}

export async function deleteOpenAiFile(fileId: string): Promise<void> {
  try {
    await getOpenAIClient().files.delete(fileId);
  } catch {
    // ignore
  }
}

export async function uploadChatDocumentFromUrl(
  url: string,
  label: string,
): Promise<{ fileId: string }> {
  if (!isTrustedSupabaseStorageUrl(url) || !looksLikeChatDocumentUrl(label, url)) {
    throw new Error("Not a trusted chat document URL");
  }
  const { buffer, contentType, filenameHint } = await fetchStorageFileSignedUrl(url);
  const filename = safeUploadFilename(filenameHint || label);
  const fileId = await uploadBufferToOpenAiUserData(buffer, filename, contentType);
  return { fileId };
}
