import { asc, desc, eq } from "drizzle-orm";
import { getDb } from "../db/client";
import { chatsTable, messagesTable } from "../db/schema";
import { Chat, ChatMessage, ChatWithMessages } from "../types/chat";

export const chatRepository = {
  async listByUser(userId: string): Promise<Chat[]> {
    const db = getDb();
    const rows = await db
      .select()
      .from(chatsTable)
      .where(eq(chatsTable.userId, userId))
      .orderBy(desc(chatsTable.updatedAt));

    return rows.map((row) => ({
      id: row.id,
      userId: row.userId,
      title: row.title,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));
  },

  async create(userId: string, title: string): Promise<Chat> {
    const db = getDb();
    const [inserted] = await db
      .insert(chatsTable)
      .values({ userId, title })
      .returning();

    return {
      id: inserted.id,
      userId: inserted.userId,
      title: inserted.title,
      createdAt: inserted.createdAt,
      updatedAt: inserted.updatedAt,
    };
  },

  async findById(chatId: string): Promise<ChatWithMessages | null> {
    const db = getDb();
    const [chat] = await db
      .select()
      .from(chatsTable)
      .where(eq(chatsTable.id, chatId))
      .limit(1);

    if (!chat) return null;

    const messages = await this.listMessages(chatId);

    return {
      id: chat.id,
      userId: chat.userId,
      title: chat.title,
      createdAt: chat.createdAt,
      updatedAt: chat.updatedAt,
      messages,
    };
  },

  async updateTitle(chatId: string, title: string): Promise<Chat | null> {
    const db = getDb();
    const [updated] = await db
      .update(chatsTable)
      .set({ title, updatedAt: new Date().toISOString() })
      .where(eq(chatsTable.id, chatId))
      .returning();

    if (!updated) return null;

    return {
      id: updated.id,
      userId: updated.userId,
      title: updated.title,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };
  },

  async delete(chatId: string): Promise<boolean> {
    const db = getDb();
    const deleted = await db
      .delete(chatsTable)
      .where(eq(chatsTable.id, chatId))
      .returning({ id: chatsTable.id });

    return deleted.length > 0;
  },

  async listMessages(chatId: string): Promise<ChatMessage[]> {
    const db = getDb();
    const rows = await db
      .select()
      .from(messagesTable)
      .where(eq(messagesTable.chatId, chatId))
      .orderBy(asc(messagesTable.createdAt));

    return rows.map((row) => ({
      id: row.id,
      chatId: row.chatId,
      role: row.role,
      content: row.content,
      createdAt: row.createdAt,
    }));
  },

  async addMessage(
    chatId: string,
    role: ChatMessage["role"],
    content: string,
  ): Promise<ChatMessage | null> {
    const db = getDb();
    return db.transaction(async (tx) => {
      const [chat] = await tx
        .select({ id: chatsTable.id })
        .from(chatsTable)
        .where(eq(chatsTable.id, chatId))
        .limit(1);

      if (!chat) return null;

      const [message] = await tx
        .insert(messagesTable)
        .values({ chatId, role, content })
        .returning();

      await tx
        .update(chatsTable)
        .set({ updatedAt: new Date().toISOString() })
        .where(eq(chatsTable.id, chat.id));

      return {
        id: message.id,
        chatId: message.chatId,
        role: message.role,
        content: message.content,
        createdAt: message.createdAt,
      };
    });
  },
};
