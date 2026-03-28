/** Broadcast event name — must match server + client. */
export const CHATS_SYNC_EVENT = "chats-changed";

/**
 * Stable Realtime channel id from API principal.userId (Clerk id or `anon:<uuid>`).
 */
export function chatsSyncChannelName(principalUserId: string): string {
  const safe = principalUserId.replace(/[^a-zA-Z0-9_-]/g, "_");
  return `chats-sync-${safe}`;
}

export function principalUserIdFromAnonSession(sessionId: string): string {
  return `anon:${sessionId}`;
}
