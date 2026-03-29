import type { ChatMessage } from "server/types/chat";

/** `GET /api/me/usage` → `data` */
export type MeUsageData = {
  sessionId: string | null;
  freeLimit: number | null;
  usedQuestions: number | null;
  remainingQuestions: number | null;
  isAnonymous: boolean;
};

export type ChatTurnStreamEvent =
  | {
      type: "start";
      userMessage: ChatMessage;
      assistantMessage: ChatMessage;
      title: string;
    }
  | { type: "delta"; text: string }
  | {
      type: "done";
      assistantMessage: ChatMessage;
      title: string;
      anonymousQuotaExhausted?: boolean;
    }
  | { type: "error"; message: string };
