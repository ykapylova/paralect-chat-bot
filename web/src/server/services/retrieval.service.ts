import { z } from "zod";

const retrievalInputSchema = z.object({
  query: z.string().min(1),
  chatId: z.string().optional(),
  limit: z.number().int().positive().max(10).default(5),
});

export const retrievalService = {
  findContext(input: unknown) {
    const { query, chatId, limit } = retrievalInputSchema.parse(input);

    return {
      query,
      chatId: chatId ?? null,
      chunks: Array.from({ length: limit }).map((_, idx) => ({
        id: `chunk-${idx + 1}`,
        score: Number((0.95 - idx * 0.08).toFixed(2)),
        text: `Relevant context snippet ${idx + 1} for query "${query}".`,
      })),
    };
  },
};
