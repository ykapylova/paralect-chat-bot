import { and, asc, desc, eq, notExists } from "drizzle-orm";
import { getDb } from "../db/client";
import { chatsTable, messagesTable } from "../db/schema";
import { Chat, ChatMessage, ChatWithMessages } from "../types/chat";

type ChatRow = typeof chatsTable.$inferSelect;

function toChat(row: ChatRow): Chat {
  return {
    id: row.id,
    userId: row.userId,
    title: row.title,
    pinned: row.pinned,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export const chatRepository = {
  async listByUser(userId: string): Promise<Chat[]> {
    const db = getDb();
    const rows = await db
      .select()
      .from(chatsTable)
      .where(eq(chatsTable.userId, userId))
      .orderBy(desc(chatsTable.pinned), desc(chatsTable.createdAt));

    return rows.map(toChat);
  },

  async findLatestEmptyChatWithTitle(userId: string, title: string): Promise<Chat | null> {
    const db = getDb();
    const [row] = await db
      .select()
      .from(chatsTable)
      .where(
        and(
          eq(chatsTable.userId, userId),
          eq(chatsTable.title, title),
          notExists(
            db.select().from(messagesTable).where(eq(messagesTable.chatId, chatsTable.id)),
          ),
        ),
      )
      .orderBy(desc(chatsTable.createdAt))
      .limit(1);

    return row ? toChat(row) : null;
  },

  async create(userId: string, title: string): Promise<Chat> {
    const db = getDb();
    const [inserted] = await db
      .insert(chatsTable)
      .values({ userId, title })
      .returning();

    return toChat(inserted);
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
      ...toChat(chat),
      messages,
    };
  },

  async updateChat(
    chatId: string,
    fields: { title?: string; pinned?: boolean },
  ): Promise<Chat | null> {
    if (fields.title === undefined && fields.pinned === undefined) return null;

    const db = getDb();
    const patch: Partial<Pick<ChatRow, "title" | "pinned">> & { updatedAt: string } = {
      updatedAt: new Date().toISOString(),
    };
    if (fields.title !== undefined) patch.title = fields.title;
    if (fields.pinned !== undefined) patch.pinned = fields.pinned;

    const [updated] = await db
      .update(chatsTable)
      .set(patch)
      .where(eq(chatsTable.id, chatId))
      .returning();

    return updated ? toChat(updated) : null;
  },

  async delete(chatId: string): Promise<boolean> {
    const db = getDb();
    const deleted = await db
      .delete(chatsTable)
      .where(eq(chatsTable.id, chatId))
      .returning({ id: chatsTable.id });

    return deleted.length > 0;
  },

  async deleteAllByUserId(userId: string): Promise<number> {
    const db = getDb();
    const deleted = await db
      .delete(chatsTable)
      .where(eq(chatsTable.userId, userId))
      .returning({ id: chatsTable.id });

    return deleted.length;
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
