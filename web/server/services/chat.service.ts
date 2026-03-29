import type {
  ChatCompletionContentPart,
  ChatCompletionMessageParam,
} from "openai/resources/chat/completions";
import { z } from "zod";
import { DEFAULT_CHAT_TITLE } from "lib/chat-defaults";
import { ANON_USER_PREFIX } from "../auth/chat-principal";
import { CHAT_MAX_OPENAI_FILES } from "../limits";
import { env } from "../env";
import { chatRepository } from "../repositories/chat.repository";
import { ChatMessage, ChatRole } from "../types/chat";
import {
  deleteOpenAiFile,
  isTrustedSupabaseStorageUrl,
  looksLikeChatDocumentUrl,
  uploadChatDocumentFromUrl,
} from "./openai-document-upload.service";

const createChatBodySchema = z.object({
  title: z.string().min(1).max(120).optional(),
});

const patchChatSchema = z
  .object({
    title: z.string().min(1).max(120).optional(),
    pinned: z.boolean().optional(),
  })
  .refine((b) => b.title !== undefined || b.pinned !== undefined, {
    message: "Provide title and/or pinned",
  });

const createMessageSchema = z.object({
  role: z.enum(["user", "assistant", "system"] satisfies [ChatRole, ...ChatRole[]]),
  content: z.string().min(1),
});

const sendTurnSchema = z.object({
  content: z.string().min(1),
  renameTitle: z.string().min(1).max(120).optional(),
});

type ContentHit =
  | { kind: "image"; start: number; end: number; alt: string; url: string }
  | { kind: "doc"; start: number; end: number; label: string; url: string };

function isPublicHttpUrl(s: string): boolean {
  try {
    const u = new URL(s.trim());
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

function collectContentHits(content: string): ContentHit[] {
  const hits: ContentHit[] = [];
  const imgRe = /!\[([^\]]*)\]\(([^)]+)\)/g;
  let m: RegExpExecArray | null;
  while ((m = imgRe.exec(content)) !== null) {
    hits.push({
      kind: "image",
      start: m.index,
      end: m.index + m[0].length,
      alt: m[1],
      url: m[2].trim(),
    });
  }
  const linkRe = /\[([^\]]+)\]\((https?:[^)]+)\)/g;
  while ((m = linkRe.exec(content)) !== null) {
    if (m.index > 0 && content[m.index - 1] === "!") continue;
    hits.push({
      kind: "doc",
      start: m.index,
      end: m.index + m[0].length,
      label: m[1],
      url: m[2].trim(),
    });
  }
  hits.sort((a, b) => a.start - b.start);
  const deduped: ContentHit[] = [];
  let lastEnd = -1;
  for (const h of hits) {
    if (h.start < lastEnd) continue;
    deduped.push(h);
    lastEnd = h.end;
  }
  return deduped;
}

function finalizeUserContentParts(
  parts: ChatCompletionContentPart[],
  fallbackPlain: string,
): string | ChatCompletionContentPart[] {
  if (parts.length === 0) {
    return fallbackPlain;
  }
  if (parts.length === 1 && parts[0].type === "text") {
    return parts[0].text;
  }
  return parts;
}

function indexOfLastUserMessage(rows: ChatMessage[]): number {
  for (let i = rows.length - 1; i >= 0; i--) {
    if (rows[i].role === "user") return i;
  }
  return -1;
}

/**
 * Builds OpenAI user `content` (text, image_url, file) from stored markdown.
 * When `uploadDocuments` is true, chat document links are uploaded to OpenAI (`user_data`) and sent as `file_id`.
 */
async function buildUserMessageContentParts(
  content: string,
  ephemeralOpenAiFileIds: string[],
  uploadDocuments: boolean,
): Promise<string | ChatCompletionContentPart[]> {
  const hits = collectContentHits(content);
  if (hits.length === 0) {
    return content;
  }

  const parts: ChatCompletionContentPart[] = [];
  let cursor = 0;

  for (const h of hits) {
    const before = content.slice(cursor, h.start).replace(/\s+$/u, "");
    if (before.length > 0) {
      parts.push({ type: "text", text: before });
    }
    cursor = h.end;

    if (h.kind === "image") {
      if (isPublicHttpUrl(h.url)) {
        parts.push({
          type: "image_url",
          image_url: { url: h.url, detail: "auto" },
        });
      } else {
        parts.push({ type: "text", text: content.slice(h.start, h.end) });
      }
      continue;
    }

    if (
      uploadDocuments &&
      isTrustedSupabaseStorageUrl(h.url) &&
      looksLikeChatDocumentUrl(h.label, h.url)
    ) {
      try {
        const { fileId } = await uploadChatDocumentFromUrl(h.url, h.label);
        ephemeralOpenAiFileIds.push(fileId);
        parts.push({ type: "file", file: { file_id: fileId } });
      } catch (err) {
        console.error("[chat] OpenAI document upload failed", err);
        parts.push({
          type: "text",
          text: `[Document: ${h.label}] (could not attach for the model)`,
        });
      }
    } else {
      parts.push({
        type: "text",
        text: `[Document: ${h.label}]`,
      });
    }
  }

  const tail = content.slice(cursor).replace(/^\s+/u, "");
  if (tail.length > 0) {
    parts.push({ type: "text", text: tail });
  }

  return finalizeUserContentParts(parts, content);
}

/**
 * Last user turn: re-attach every chat document from **earlier** user messages so
 * follow-ups like "who is the contractor?" still receive the same PDF/DOCX context.
 */
async function buildLastUserOpenAiContent(
  lastContent: string,
  rowsBeforeLastUser: ChatMessage[],
  ephemeralOpenAiFileIds: string[],
): Promise<string | ChatCompletionContentPart[]> {
  const uploadedUrls = new Set<string>();
  const parts: ChatCompletionContentPart[] = [];
  let filePartCount = 0;

  const tryUploadDoc = async (h: ContentHit & { kind: "doc" }): Promise<void> => {
    if (!isTrustedSupabaseStorageUrl(h.url) || !looksLikeChatDocumentUrl(h.label, h.url)) {
      return;
    }
    if (uploadedUrls.has(h.url)) return;
    if (filePartCount >= CHAT_MAX_OPENAI_FILES) {
      parts.push({
        type: "text",
        text: `[Document: ${h.label}] (attachment limit reached for this request)`,
      });
      return;
    }
    uploadedUrls.add(h.url);
    try {
      const { fileId } = await uploadChatDocumentFromUrl(h.url, h.label);
      ephemeralOpenAiFileIds.push(fileId);
      parts.push({ type: "file", file: { file_id: fileId } });
      filePartCount += 1;
    } catch (err) {
      console.error("[chat] OpenAI document upload failed", err);
      uploadedUrls.delete(h.url);
      parts.push({
        type: "text",
        text: `[Document: ${h.label}] (could not attach for the model)`,
      });
    }
  };

  for (const m of rowsBeforeLastUser) {
    if (m.role !== "user") continue;
    for (const h of collectContentHits(m.content)) {
      if (h.kind === "doc") await tryUploadDoc(h);
    }
  }

  if (filePartCount > 0) {
    parts.push({
      type: "text",
      text: "The file(s) above were shared in earlier messages in this chat; use them to answer the user’s latest question.",
    });
  }

  let cursor = 0;
  const hits = collectContentHits(lastContent);
  for (const h of hits) {
    const before = lastContent.slice(cursor, h.start).replace(/\s+$/u, "");
    if (before.length > 0) {
      parts.push({ type: "text", text: before });
    }
    cursor = h.end;

    if (h.kind === "image") {
      if (isPublicHttpUrl(h.url)) {
        parts.push({
          type: "image_url",
          image_url: { url: h.url, detail: "auto" },
        });
      } else {
        parts.push({ type: "text", text: lastContent.slice(h.start, h.end) });
      }
      continue;
    }

    if (!isTrustedSupabaseStorageUrl(h.url) || !looksLikeChatDocumentUrl(h.label, h.url)) {
      parts.push({ type: "text", text: `[Document: ${h.label}]` });
      continue;
    }
    if (uploadedUrls.has(h.url)) {
      continue;
    }
    await tryUploadDoc(h);
  }

  const tail = lastContent.slice(cursor).replace(/^\s+/u, "");
  if (tail.length > 0) {
    parts.push({ type: "text", text: tail });
  }

  return finalizeUserContentParts(parts, lastContent);
}

async function buildOpenAiMessages(rows: ChatMessage[]): Promise<{
  messages: ChatCompletionMessageParam[];
  ephemeralOpenAiFileIds: string[];
}> {
  const ephemeralOpenAiFileIds: string[] = [];
  try {
    const out: ChatCompletionMessageParam[] = [];
    const systemFromEnv = env.openaiSystemPrompt;
    if (systemFromEnv) {
      out.push({ role: "system", content: systemFromEnv });
    }
    const lastUserIdx = indexOfLastUserMessage(rows);
    const rowsBeforeLastUser = lastUserIdx >= 0 ? rows.slice(0, lastUserIdx) : [];

    for (let i = 0; i < rows.length; i++) {
      const m = rows[i];
      if (m.role === "assistant" && m.content.trim() === "") continue;
      if (m.role === "system") {
        out.push({ role: "system", content: m.content });
      } else if (m.role === "user") {
        const userContent =
          i === lastUserIdx
            ? await buildLastUserOpenAiContent(m.content, rowsBeforeLastUser, ephemeralOpenAiFileIds)
            : await buildUserMessageContentParts(m.content, ephemeralOpenAiFileIds, false);
        out.push({ role: "user", content: userContent });
      } else {
        out.push({ role: "assistant", content: m.content });
      }
    }
    return { messages: out, ephemeralOpenAiFileIds };
  } catch (e) {
    await Promise.all(ephemeralOpenAiFileIds.map((id) => deleteOpenAiFile(id)));
    throw e;
  }
}

export const chatService = {
  async listChats(userId: string) {
    return chatRepository.listByUser(userId);
  },

  async createChat(userId: string, input: unknown) {
    const { title: titleInput } = createChatBodySchema.parse(input ?? {});
    const resolvedTitle = titleInput ?? DEFAULT_CHAT_TITLE;

    if (resolvedTitle === DEFAULT_CHAT_TITLE) {
      const reusable = await chatRepository.findLatestEmptyChatWithTitle(userId, DEFAULT_CHAT_TITLE);
      if (reusable) return reusable;
    }

    return chatRepository.create(userId, resolvedTitle);
  },

  async getChatForUser(chatId: string, userId: string) {
    const chat = await chatRepository.findById(chatId);
    if (!chat || chat.userId !== userId) {
      return null;
    }
    return chat;
  },

  async patchChat(chatId: string, userId: string, input: unknown) {
    const chat = await this.getChatForUser(chatId, userId);
    if (!chat) return null;

    const patch = patchChatSchema.parse(input);
    return chatRepository.updateChat(chatId, patch);
  },

  async deleteChat(chatId: string, userId: string) {
    const chat = await this.getChatForUser(chatId, userId);
    if (!chat) return false;

    return chatRepository.delete(chatId);
  },

  async deleteAllChatsForAnonymousUser(userId: string): Promise<number> {
    if (!userId.startsWith(ANON_USER_PREFIX)) return 0;
    return chatRepository.deleteAllByUserId(userId);
  },

  async listMessages(chatId: string, userId: string) {
    const chat = await this.getChatForUser(chatId, userId);
    if (!chat) return null;

    return chatRepository.listMessages(chatId);
  },

  async addMessage(chatId: string, userId: string, input: unknown) {
    const chat = await this.getChatForUser(chatId, userId);
    if (!chat) return null;

    const { role, content } = createMessageSchema.parse(input);
    return chatRepository.addMessage(chatId, role, content);
  },

  async beginStreamTurn(
    chatId: string,
    userId: string,
    input: unknown,
  ): Promise<{
    userMessage: ChatMessage;
    assistantMessage: ChatMessage;
    title: string;
    openaiMessages: ChatCompletionMessageParam[];
    ephemeralOpenAiFileIds: string[];
  } | null> {
    const { content, renameTitle } = sendTurnSchema.parse(input);
    const chat = await this.getChatForUser(chatId, userId);
    if (!chat) return null;

    const userMessage = await chatRepository.addMessage(chatId, "user", content);
    if (!userMessage) return null;

    let title = chat.title;
    if (renameTitle) {
      const updated = await chatRepository.updateChat(chatId, { title: renameTitle });
      if (updated) title = updated.title;
    }

    const assistantMessage = await chatRepository.addMessage(chatId, "assistant", "");
    if (!assistantMessage) return null;

    const rows = await chatRepository.listMessages(chatId);
    const { messages: openaiMessages, ephemeralOpenAiFileIds } = await buildOpenAiMessages(rows);

    return { userMessage, assistantMessage, title, openaiMessages, ephemeralOpenAiFileIds };
  },
};
