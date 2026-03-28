import type { ChatMessage } from "@/server/types/chat";

/** `GET /api/me/usage` → `data` */
export type MeUsageData = {
  sessionId: string | null;
  freeLimit: number | null;
  usedQuestions: number | null;
  remainingQuestions: number | null;
  isAnonymous: boolean;
};

/** `POST /api/chats/:id/turn` → `data` */
export type ChatTurnData = {
  userMessage: ChatMessage;
  assistantMessage: ChatMessage;
  title: string;
  anonymousQuotaExhausted?: boolean;
};
