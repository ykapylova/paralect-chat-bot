/** UI-only types for chat components. API DTOs: `@/lib/api-types/chat`. */
export type UiRole = "user" | "assistant";

export type UiMessage = {
  id: string;
  role: UiRole;
  text: string;
  createdAt: string;
  isPending?: boolean;
};
