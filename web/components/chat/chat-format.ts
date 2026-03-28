import type { ChatMessage as ApiMessage } from "server/types/chat";
import type { UiMessage, UiRole } from "./chat-types";

export function formatMessageTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return iso;
  }
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function formatChatSubtitle(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return "";
  }
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function mapApiMessage(row: ApiMessage): UiMessage {
  const role: UiRole = row.role === "assistant" || row.role === "system" ? "assistant" : "user";
  const isPending = row.id.startsWith("optimistic-");
  return {
    id: row.id,
    role,
    text: row.content,
    createdAt: formatMessageTime(row.createdAt),
    isPending,
  };
}
