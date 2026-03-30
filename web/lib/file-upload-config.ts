export const CHAT_UPLOAD_IMAGE_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/gif",
  "image/webp",
] as const;

export const CHAT_UPLOAD_IMAGE_MIME_SET = new Set<string>(CHAT_UPLOAD_IMAGE_MIME_TYPES);

export const CHAT_UPLOAD_DOCUMENT_MIME_TYPES = [
  "application/pdf",
  "text/plain",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
] as const;

export const CHAT_UPLOAD_DOCUMENT_MIME_SET = new Set<string>(CHAT_UPLOAD_DOCUMENT_MIME_TYPES);

export const CHAT_UPLOAD_IMAGE_FILENAME_EXT_REGEX = /\.(png|jpe?g|gif|webp)$/i;

export const CHAT_COMPOSER_DOCUMENT_INPUT_ACCEPT = [
  ".pdf",
  ".txt",
  ".doc",
  ".docx",
  "application/pdf",
  "text/plain",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
].join(",");

const PASTED_IMAGE_EXT_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
};

export function extensionForPastedImageMime(mime: string): string {
  return PASTED_IMAGE_EXT_BY_MIME[mime] ?? "png";
}

export function isChatImageUploadMime(baseMime: string): boolean {
  return CHAT_UPLOAD_IMAGE_MIME_SET.has(baseMime);
}

export function normalizeUploadMimeBase(raw: string | undefined): string {
  const base = raw?.split(";")[0]?.trim().toLowerCase() ?? "";
  return base || "application/octet-stream";
}

export function inferImageMimeFromFilename(name: string): string | null {
  const lower = name.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".webp")) return "image/webp";
  return null;
}

export function inferDocumentMimeFromFilename(name: string): string | null {
  const lower = name.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".txt")) return "text/plain";
  if (lower.endsWith(".docx")) {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  if (lower.endsWith(".doc")) return "application/msword";
  return null;
}

export function shouldTreatUserFileAsImage(file: File): boolean {
  const base = normalizeUploadMimeBase(file.type);
  if (isChatImageUploadMime(base)) return true;
  return CHAT_UPLOAD_IMAGE_FILENAME_EXT_REGEX.test(file.name);
}

export function isAllowedChatImageFile(file: File): boolean {
  const base = normalizeUploadMimeBase(file.type);
  if (isChatImageUploadMime(base)) return true;
  return CHAT_UPLOAD_IMAGE_FILENAME_EXT_REGEX.test(file.name);
}

export function isAllowedChatUserPickedFile(file: File): boolean {
  if (shouldTreatUserFileAsImage(file)) {
    return isAllowedChatImageFile(file);
  }
  const base = normalizeUploadMimeBase(file.type);
  if (CHAT_UPLOAD_DOCUMENT_MIME_SET.has(base)) return true;
  return inferDocumentMimeFromFilename(file.name) !== null;
}
