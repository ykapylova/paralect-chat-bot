import { z } from "zod";
import { FUTURE_ASSISTANT_ANSWER } from "../constants/assistant-placeholder";
import { chatRepository } from "../repositories/chat.repository";
import { ChatMessage, ChatRole } from "../types/chat";

const createChatBodySchema = z.object({
  title: z.string().min(1).max(120).optional(),
});

const renameChatSchema = z.object({
  title: z.string().min(1).max(120),
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
    const { title } = createChatBodySchema.parse(input ?? {});
    return chatRepository.create(userId, title ?? "Untitled chat");
  },

  async getChatForUser(chatId: string, userId: string) {
    const chat = await chatRepository.findById(chatId);
    if (!chat || chat.userId !== userId) {
      return null;
    }
    return chat;
  },

  async renameChat(chatId: string, userId: string, input: unknown) {
    const chat = await this.getChatForUser(chatId, userId);
    if (!chat) return null;

    const { title } = renameChatSchema.parse(input);
    return chatRepository.updateTitle(chatId, title);
  },

  async deleteChat(chatId: string, userId: string) {
    const chat = await this.getChatForUser(chatId, userId);
    if (!chat) return false;

    return chatRepository.delete(chatId);
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

  /**
   * One round-trip from the client: user message, optional rename, placeholder assistant reply.
   */
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
      const updated = await chatRepository.updateTitle(chatId, renameTitle);
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
