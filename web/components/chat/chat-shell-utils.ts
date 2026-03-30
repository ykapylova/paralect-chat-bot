import type { ClipboardEvent } from "react";

import type { Chat as ApiChat } from "server/types/chat";
import { extensionForPastedImageMime } from "lib/file-upload-config";

export function sortChatsForSidebar(a: ApiChat, b: ApiChat): number {
  const ap = Boolean(a.pinned);
  const bp = Boolean(b.pinned);
  if (ap !== bp) return ap ? -1 : 1;
  return a.createdAt < b.createdAt ? 1 : -1;
}

export function imageFileFromComposerPaste(event: ClipboardEvent<HTMLTextAreaElement>): File | null {
  const cd = event.clipboardData;
  if (!cd) return null;

  let imageFile: File | null = null;
  for (const item of cd.items) {
    if (item.kind === "file" && item.type.startsWith("image/")) {
      imageFile = item.getAsFile();
      break;
    }
  }
  if (!imageFile && cd.files?.length) {
    const f = cd.files[0];
    if (f?.type.startsWith("image/")) {
      imageFile = f;
    }
  }
  if (!imageFile) return null;

  const ext = extensionForPastedImageMime(imageFile.type);
  const fallbackName = `pasted-${Date.now()}.${ext}`;
  const name =
    imageFile.name && !/^image\.(png|jpe?g|gif|webp)$/i.test(imageFile.name)
      ? imageFile.name
      : fallbackName;
  return name === imageFile.name ? imageFile : new File([imageFile], name, { type: imageFile.type });
}
