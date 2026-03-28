import { z } from "zod";
import { DEFAULT_CHAT_TITLE } from "@/lib/chat-defaults";
import { ANON_USER_PREFIX } from "../auth/chat-principal";
import { FUTURE_ASSISTANT_ANSWER } from "../constants/assistant-placeholder";
import { chatRepository } from "../repositories/chat.repository";
import { ChatMessage, ChatRole } from "../types/chat";

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

  async sendTurnWithPlaceholder(
    chatId: string,
    userId: string,
    input: unknown,
  ): Promise<{
    userMessage: ChatMessage;
    assistantMessage: ChatMessage;
    title: string;
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

    const assistantMessage = await chatRepository.addMessage(
      chatId,
      "assistant",
      FUTURE_ASSISTANT_ANSWER,
    );
    if (!assistantMessage) return null;

    return { userMessage, assistantMessage, title };
  },
};
