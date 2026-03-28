import { sql } from "drizzle-orm";
import { eq } from "drizzle-orm";
import { getDb } from "../db/client";
import { anonymousUsageTable } from "../db/schema";

export const usageRepository = {
  async getQuestionCount(sessionId: string): Promise<number> {
    const db = getDb();
    const rows = await db
      .select({ questionCount: anonymousUsageTable.questionCount })
      .from(anonymousUsageTable)
      .where(eq(anonymousUsageTable.sessionId, sessionId))
      .limit(1);

    return rows[0]?.questionCount ?? 0;
  },

  async incrementQuestionCount(sessionId: string): Promise<void> {
    const db = getDb();
    await db
      .insert(anonymousUsageTable)
      .values({
        sessionId,
        questionCount: 1,
        updatedAt: new Date().toISOString(),
      })
      .onConflictDoUpdate({
        target: anonymousUsageTable.sessionId,
        set: {
          questionCount: sql`${anonymousUsageTable.questionCount} + 1`,
          updatedAt: new Date().toISOString(),
        },
      });
  },
};
