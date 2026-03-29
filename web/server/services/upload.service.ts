import { randomUUID } from "crypto";

import {
  CHAT_UPLOAD_DOCUMENT_MIME_SET,
  CHAT_UPLOAD_IMAGE_MIME_SET,
} from "lib/file-upload-config";
import {
  getStorageBucketName,
  getSignedUrlForPath,
  isChatStorageConfigured,
  signedUrlTtlSec,
  uploadBytesToChatBucket,
} from "./supabase-storage.service";

export class UploadValidationError extends Error {
  readonly code: string;

  constructor(message: string, code = "INVALID_UPLOAD") {
    super(message);
    this.name = "UploadValidationError";
    this.code = code;
  }
}

function normalizeMimeType(raw: string): string {
  const base = raw.split(";")[0]?.trim().toLowerCase() ?? "";
  return base || "application/octet-stream";
}

function imageMaxBytes(): number {
  const mb = Number.parseFloat(process.env.UPLOAD_IMAGE_MAX_MB ?? "8");
  return (Number.isFinite(mb) ? mb : 8) * 1024 * 1024;
}

function documentMaxBytes(): number {
  const mb = Number.parseFloat(process.env.UPLOAD_DOCUMENT_MAX_MB ?? "20");
  return (Number.isFinite(mb) ? mb : 20) * 1024 * 1024;
}

function sanitizeFilename(name: string): string {
  const trimmed = name.trim().replace(/[/\\]/g, "_");
  const base = trimmed.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 180);
  return base || "file";
}

function storageKeyPrefix(principalUserId: string): string {
  return principalUserId.replace(/[^a-zA-Z0-9_-]/g, "_");
}

export type StoredUploadRecord = {
  id: string;
  type: "image" | "document";
  filename: string;
  mimeType: string;
  size: number;
  path: string;
  bucket: string;
  signedUrl: string;
};

async function storeFile(
  file: File,
  principalUserId: string,
  kind: "image" | "document",
): Promise<StoredUploadRecord> {
  if (!isChatStorageConfigured()) {
    throw new UploadValidationError("File storage is not configured", "STORAGE_UNAVAILABLE");
  }

  const mimeType = normalizeMimeType(file.type || "application/octet-stream");
  const allowed = kind === "image" ? CHAT_UPLOAD_IMAGE_MIME_SET : CHAT_UPLOAD_DOCUMENT_MIME_SET;
  if (!allowed.has(mimeType)) {
    throw new UploadValidationError(`Unsupported file type: ${mimeType || "unknown"}`, "INVALID_MIME");
  }

  const maxBytes = kind === "image" ? imageMaxBytes() : documentMaxBytes();
  if (file.size > maxBytes) {
    throw new UploadValidationError(
      `File too large (max ${Math.round(maxBytes / 1024 / 1024)} MB)`,
      "FILE_TOO_LARGE",
    );
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const prefix = storageKeyPrefix(principalUserId);
  const safeName = sanitizeFilename(file.name);
  const objectPath = `${prefix}/${kind}s/${randomUUID()}-${safeName}`;

  await uploadBytesToChatBucket(objectPath, bytes, mimeType);
  const signedUrl = await getSignedUrlForPath(objectPath, signedUrlTtlSec());
  const bucket = getStorageBucketName();

  return {
    id: randomUUID(),
    type: kind,
    filename: file.name.slice(0, 500) || safeName,
    mimeType,
    size: file.size,
    path: objectPath,
    bucket,
    signedUrl,
  };
}

export const uploadService = {
  isConfigured: isChatStorageConfigured,

  async storeImage(file: File, principalUserId: string): Promise<StoredUploadRecord> {
    return storeFile(file, principalUserId, "image");
  },

  async storeDocument(file: File, principalUserId: string): Promise<StoredUploadRecord> {
    return storeFile(file, principalUserId, "document");
  },
};
