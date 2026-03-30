"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";

import { getChatWithMessages, getChats, getMeUsage } from "lib/api-client";
import { queryKeys } from "lib/query-keys";
import { mapApiMessage } from "./chat-format";

type UseChatQueriesArgs = {
  isLoaded: boolean;
  userId: string | null | undefined;
  isGuestMode: boolean;
  selectedChatId: string | null;
};

export function useChatQueries({ isLoaded, userId, isGuestMode, selectedChatId }: UseChatQueriesArgs) {
  const queryClient = useQueryClient();

  const chatsQuery = useQuery({
    queryKey: queryKeys.chats.all,
    queryFn: () => getChats(),
  });

  const usageQuery = useQuery({
    queryKey: queryKeys.usage.scope(userId),
    queryFn: () => getMeUsage(),
    enabled: isLoaded,
  });

  useEffect(() => {
    if (!isLoaded || !userId) return;
    queryClient.removeQueries({ queryKey: queryKeys.usage.anonymous });
  }, [isLoaded, userId, queryClient]);

  const activeChatId = useMemo(() => {
    if (!isGuestMode) return selectedChatId;
    if (!chatsQuery.isSuccess) return selectedChatId;
    const list = chatsQuery.data ?? [];
    if (list.length === 0) return selectedChatId;
    if (selectedChatId && list.some((c) => c.id === selectedChatId)) return selectedChatId;
    return list[0].id;
  }, [isGuestMode, chatsQuery.isSuccess, chatsQuery.data, selectedChatId]);

  const chatDetailQuery = useQuery({
    queryKey: queryKeys.chat.detail(activeChatId),
    queryFn: () => getChatWithMessages(activeChatId!),
    enabled: Boolean(activeChatId),
  });

  const activeMessages = useMemo(() => {
    const rows = chatDetailQuery.data?.messages ?? [];
    return rows.map(mapApiMessage);
  }, [chatDetailQuery.data?.messages]);

  const activeTitle = chatDetailQuery.data?.title ?? "Chat";
  const chatsForSidebar = chatsQuery.data ?? [];
  const usage = usageQuery.data;

  const anonFreeLimitReached = Boolean(
    isGuestMode &&
      usage?.isAnonymous &&
      usage.remainingQuestions !== null &&
      usage.remainingQuestions <= 0,
  );

  const isBootLoading = chatsQuery.isLoading;
  const isChatLoading = Boolean(activeChatId) && chatDetailQuery.isLoading;
  const queryLoadError =
    chatsQuery.error?.message ?? chatDetailQuery.error?.message ?? null;

  return {
    queryClient,
    chatsQuery,
    usageQuery,
    chatDetailQuery,
    activeChatId,
    chatsForSidebar,
    activeMessages,
    activeTitle,
    usage,
    anonFreeLimitReached,
    isBootLoading,
    isChatLoading,
    queryLoadError,
  };
}
