import { z } from "zod";

const uploadInputSchema = z.object({
  filename: z.string().min(1),
  mimeType: z.string().min(1),
  size: z.number().int().positive(),
});

export const uploadService = {
  registerImage(input: unknown) {
    const payload = uploadInputSchema.parse(input);
    return {
      id: crypto.randomUUID(),
      type: "image" as const,
      ...payload,
      url: `/uploads/images/${payload.filename}`,
    };
  },

  registerDocument(input: unknown) {
    const payload = uploadInputSchema.parse(input);
    return {
      id: crypto.randomUUID(),
      type: "document" as const,
      ...payload,
      url: `/uploads/documents/${payload.filename}`,
      status: "queued" as const,
    };
  },
};
