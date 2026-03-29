export const QUERY_USAGE_ANON_SCOPE = "__anon__";

export function usageQueryKey(
  userId: string | null | undefined,
): readonly ["usage", string] {
  return ["usage", userId ?? QUERY_USAGE_ANON_SCOPE];
}

export const queryKeys = {
  chats: {
    all: ["chats"] as const,
  },
  chat: {
    detail: (chatId: string | null) => ["chat", chatId] as const,
  },
  usage: {
    scope: usageQueryKey,
    anonymous: ["usage", QUERY_USAGE_ANON_SCOPE] as const,
    all: ["usage"] as const,
  },
} as const;
