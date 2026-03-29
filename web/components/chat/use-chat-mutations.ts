"use client";

import type { QueryClient } from "@tanstack/react-query";
import { useMutation } from "@tanstack/react-query";
import type { SetStateAction } from "react";

import type { Chat as ApiChat, ChatMessage as ApiMessage, ChatWithMessages } from "server/types/chat";
import {
  ApiError,
  createChat,
  deleteChat,
  patchChat,
  postChatTurn,
} from "lib/api-client";
import type { ChatTurnStreamEvent } from "lib/api-types/chat";
import { consumeSseJsonStream } from "lib/chat-turn-stream";
import { queryKeys } from "lib/query-keys";

import { sortChatsForSidebar } from "./chat-shell-utils";

type SendTurnVariables = {
  chatId: string;
  content: string;
  shouldRename: boolean;
  nextTitle: string;
  optimisticId: string;
};

type ChatMutationsDeps = {
  queryClient: QueryClient;
  updateSelectedChatId: (value: SetStateAction<string | null>) => void;
  closeMobileSidebar: () => void;
  setDraft: (value: string) => void;
  setAttachmentError: (value: string | null) => void;
};

export function useChatMutations({
  queryClient,
  updateSelectedChatId,
  closeMobileSidebar,
  setDraft,
  setAttachmentError,
}: ChatMutationsDeps) {
  const createChatMutation = useMutation({
    mutationFn: () => createChat(),
    onSuccess: (chat) => {
      const row: ApiChat = { ...chat, pinned: Boolean(chat.pinned) };
      queryClient.setQueryData<ChatWithMessages>(queryKeys.chat.detail(row.id), {
        ...row,
        messages: [],
      });
      queryClient.setQueryData<ApiChat[]>(queryKeys.chats.all, (previous) => {
        const without = previous?.filter((c) => c.id !== row.id) ?? [];
        return [...without, row].sort(sortChatsForSidebar);
      });
      void queryClient.invalidateQueries({ queryKey: queryKeys.chats.all });
      updateSelectedChatId(row.id);
      closeMobileSidebar();
    },
  });

  const patchChatMutation = useMutation({
    mutationFn: ({ chatId, ...body }: { chatId: string; title?: string; pinned?: boolean }) =>
      patchChat(chatId, body),
    onSuccess: (chat) => {
      queryClient.setQueryData<ChatWithMessages>(queryKeys.chat.detail(chat.id), (previous) =>
        previous ? { ...previous, title: chat.title, pinned: chat.pinned, updatedAt: chat.updatedAt } : previous,
      );
      queryClient.setQueryData<ApiChat[]>(queryKeys.chats.all, (previous) => {
        if (!previous) return previous;
        const next = previous.map((c) => (c.id === chat.id ? chat : c));
        return [...next].sort(sortChatsForSidebar);
      });
      void queryClient.invalidateQueries({ queryKey: queryKeys.chats.all });
    },
  });

  const deleteChatMutation = useMutation({
    mutationFn: (chatId: string) => deleteChat(chatId),
    onSuccess: (_, chatId) => {
      queryClient.removeQueries({ queryKey: queryKeys.chat.detail(chatId) });
      queryClient.setQueryData<ApiChat[]>(queryKeys.chats.all, (previous) => {
        const next = previous?.filter((c) => c.id !== chatId) ?? [];
        return [...next].sort(sortChatsForSidebar);
      });
      updateSelectedChatId((current) => {
        if (current !== chatId) return current;
        const list = queryClient.getQueryData<ApiChat[]>(queryKeys.chats.all) ?? [];
        return list[0]?.id ?? null;
      });
      void queryClient.invalidateQueries({ queryKey: queryKeys.chats.all });
    },
  });

  const sendMutation = useMutation({
    mutationFn: async (variables: SendTurnVariables) => {
      const res = await postChatTurn(variables.chatId, {
        content: variables.content,
        ...(variables.shouldRename ? { renameTitle: variables.nextTitle } : {}),
      });

      const ct = res.headers.get("content-type") ?? "";
      if (!ct.includes("text/event-stream")) {
        throw new Error("Expected streamed chat response");
      }

      let assistantMessageId = "";
      let accumulated = "";
      let rafId: number | null = null;

      const flushContent = () => {
        rafId = null;
        const text = accumulated;
        if (!assistantMessageId) return;
        queryClient.setQueryData<ChatWithMessages>(queryKeys.chat.detail(variables.chatId), (prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            messages: prev.messages.map((m) =>
              m.id === assistantMessageId ? { ...m, content: text } : m,
            ),
          };
        });
      };

      const scheduleFlush = () => {
        if (rafId != null) return;
        rafId = requestAnimationFrame(flushContent);
      };

      let sawTerminalEvent = false;
      await consumeSseJsonStream<ChatTurnStreamEvent>(res, (evt) => {
        switch (evt.type) {
          case "start": {
            assistantMessageId = evt.assistantMessage.id;
            accumulated = "";
            queryClient.setQueryData<ChatWithMessages>(queryKeys.chat.detail(variables.chatId), (previous) => {
              if (!previous) return previous;
              const withoutOptimistic = previous.messages.filter(
                (m) => m.id !== variables.optimisticId,
              );
              return {
                ...previous,
                title: evt.title,
                messages: [...withoutOptimistic, evt.userMessage, evt.assistantMessage],
              };
            });
            break;
          }
          case "delta": {
            accumulated += evt.text;
            scheduleFlush();
            break;
          }
          case "done": {
            sawTerminalEvent = true;
            setAttachmentError(null);
            if (rafId != null) {
              cancelAnimationFrame(rafId);
              rafId = null;
            }
            queryClient.setQueryData<ChatWithMessages>(queryKeys.chat.detail(variables.chatId), (previous) => {
              if (!previous) return previous;
              return {
                ...previous,
                title: evt.title,
                updatedAt: evt.assistantMessage.createdAt,
                messages: previous.messages.map((m) =>
                  m.id === evt.assistantMessage.id ? evt.assistantMessage : m,
                ),
              };
            });

            if (evt.anonymousQuotaExhausted) {
              queryClient.setQueryData<ApiChat[]>(queryKeys.chats.all, []);
            } else {
              queryClient.setQueryData<ApiChat[]>(queryKeys.chats.all, (previous) => {
                if (!previous) return previous;
                const next = previous.map((chat) =>
                  chat.id === variables.chatId
                    ? {
                        ...chat,
                        title: evt.title,
                        updatedAt: evt.assistantMessage.createdAt,
                      }
                    : chat,
                );
                return [...next].sort(sortChatsForSidebar);
              });
            }
            void queryClient.invalidateQueries({ queryKey: queryKeys.usage.all });
            break;
          }
          case "error": {
            sawTerminalEvent = true;
            if (rafId != null) {
              cancelAnimationFrame(rafId);
              rafId = null;
            }
            void queryClient.invalidateQueries({ queryKey: queryKeys.chat.detail(variables.chatId) });
            void queryClient.invalidateQueries({ queryKey: queryKeys.chats.all });
            break;
          }
          default:
            break;
        }
      });

      if (!sawTerminalEvent) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.chat.detail(variables.chatId) });
      }
    },
    onMutate: async (variables: SendTurnVariables) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.chat.detail(variables.chatId) });

      const previousChat = queryClient.getQueryData<ChatWithMessages>(queryKeys.chat.detail(variables.chatId));
      const optimisticMessage: ApiMessage = {
        id: variables.optimisticId,
        chatId: variables.chatId,
        role: "user",
        content: variables.content,
        createdAt: new Date().toISOString(),
      };

      if (previousChat) {
        queryClient.setQueryData<ChatWithMessages>(queryKeys.chat.detail(variables.chatId), {
          ...previousChat,
          ...(variables.shouldRename ? { title: variables.nextTitle } : {}),
          messages: [...previousChat.messages, optimisticMessage],
        });
      }

      return { previousChat };
    },
    onError: (error, variables, context) => {
      if (error instanceof ApiError && error.code === "FREE_LIMIT_EXCEEDED") {
        queryClient.setQueryData<ApiChat[]>(queryKeys.chats.all, []);
        queryClient.removeQueries({ queryKey: queryKeys.chat.detail(variables.chatId) });
        updateSelectedChatId(null);
        void queryClient.invalidateQueries({ queryKey: queryKeys.usage.all });
        setDraft(variables.content);
        return;
      }
      if (context?.previousChat !== undefined) {
        queryClient.setQueryData(queryKeys.chat.detail(variables.chatId), context.previousChat);
      } else {
        void queryClient.invalidateQueries({ queryKey: queryKeys.chat.detail(variables.chatId) });
      }
      setDraft(variables.content);
    },
  });

  return {
    createChatMutation,
    patchChatMutation,
    deleteChatMutation,
    sendMutation,
  };
}
