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
