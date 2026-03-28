import { z } from "zod";
import { chatRepository } from "../repositories/chat.repository";
import { ChatRole } from "../types/chat";

const createChatSchema = z.object({
  userId: z.string().min(1),
  title: z.string().min(1).max(120).optional(),
});

const renameChatSchema = z.object({
  title: z.string().min(1).max(120),
});

const createMessageSchema = z.object({
  role: z.enum(["user", "assistant", "system"] satisfies [ChatRole, ...ChatRole[]]),
  content: z.string().min(1),
});

export const chatService = {
  async listChats(userId: string) {
    return chatRepository.listByUser(userId);
  },

  async createChat(input: unknown) {
    const { userId, title } = createChatSchema.parse(input);
    return chatRepository.create(userId, title ?? "Untitled chat");
  },

  async getChat(chatId: string) {
    return chatRepository.findById(chatId);
  },

  async renameChat(chatId: string, input: unknown) {
    const { title } = renameChatSchema.parse(input);
    return chatRepository.updateTitle(chatId, title);
  },

  async deleteChat(chatId: string) {
    return chatRepository.delete(chatId);
  },

  async listMessages(chatId: string) {
    return chatRepository.listMessages(chatId);
  },

  async addMessage(chatId: string, input: unknown) {
    const { role, content } = createMessageSchema.parse(input);
    return chatRepository.addMessage(chatId, role, content);
  },
};
