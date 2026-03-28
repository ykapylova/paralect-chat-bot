"use client";

import { useAuth } from "@clerk/nextjs";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChangeEvent,
  FormEvent,
  KeyboardEvent,
  type SetStateAction,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Chat as ApiChat, ChatMessage as ApiMessage, ChatWithMessages } from "server/types/chat";
import { ApiError, apiDelete, apiGet, apiPatch, apiPost } from "lib/api-client";
import { DEFAULT_CHAT_TITLE } from "lib/chat-defaults";
import type { ChatTurnData, MeUsageData } from "lib/api-types/chat";
import { ChatComposer } from "./chat-composer";
import { mapApiMessage } from "./chat-format";
import { ChatHeader } from "./chat-header";
import { ChatMessageThread } from "./chat-message-thread";
import { ChatSidebar } from "./chat-sidebar";
import { ChatUsageBanner } from "./chat-usage-banner";

function sortChatsForSidebar(a: ApiChat, b: ApiChat): number {
  const ap = Boolean(a.pinned);
  const bp = Boolean(b.pinned);
  if (ap !== bp) return ap ? -1 : 1;
  return a.createdAt < b.createdAt ? 1 : -1;
}

export function ChatShell() {
  const queryClient = useQueryClient();
  const { isLoaded, userId } = useAuth();
  const isGuestMode = isLoaded && !userId;

  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [sidebarRenamingChatId, setSidebarRenamingChatId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [showSidebar, setShowSidebar] = useState(true);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useLayoutEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const sync = () => {
      if (mq.matches) setShowSidebar(false);
    };
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const updateSelectedChatId = useCallback((value: SetStateAction<string | null>) => {
    setSidebarRenamingChatId(null);
    setSelectedChatId(value);
  }, []);

  const closeMobileSidebar = useCallback(() => {
    if (typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches) {
      setShowSidebar(false);
    }
  }, []);

  const handleSidebarSelectChat = useCallback(
    (id: string) => {
      updateSelectedChatId(id);
      closeMobileSidebar();
    },
    [updateSelectedChatId, closeMobileSidebar],
  );

  const chatsQuery = useQuery({
    queryKey: ["chats"],
    queryFn: () => apiGet<ApiChat[]>("/api/chats"),
  });

  const usageQuery = useQuery({
    queryKey: ["usage"],
    queryFn: () => apiGet<MeUsageData>("/api/me/usage"),
  });

  const chatsForSidebar = chatsQuery.data ?? [];

  const activeChatId = useMemo(() => {
    if (!isGuestMode) return selectedChatId;
    if (!chatsQuery.isSuccess) return selectedChatId;
    const list = chatsQuery.data ?? [];
    if (list.length === 0) return selectedChatId;
    if (selectedChatId && list.some((c) => c.id === selectedChatId)) return selectedChatId;
    return list[0].id;
  }, [isGuestMode, chatsQuery.isSuccess, chatsQuery.data, selectedChatId]);

  const chatDetailQuery = useQuery({
    queryKey: ["chat", activeChatId],
    queryFn: () => apiGet<ChatWithMessages>(`/api/chats/${activeChatId}`),
    enabled: Boolean(activeChatId),
  });

  const activeMessages = useMemo(() => {
    const rows = chatDetailQuery.data?.messages ?? [];
    return rows.map(mapApiMessage);
  }, [chatDetailQuery.data?.messages]);

  const activeTitle = chatDetailQuery.data?.title ?? "Chat";

  const createChatMutation = useMutation({
    mutationFn: () => apiPost<ApiChat>("/api/chats", {}),
    onSuccess: (chat) => {
      const row: ApiChat = { ...chat, pinned: Boolean(chat.pinned) };
      queryClient.setQueryData<ChatWithMessages>(["chat", row.id], {
        ...row,
        messages: [],
      });
      queryClient.setQueryData<ApiChat[]>(["chats"], (previous) => {
        const without = previous?.filter((c) => c.id !== row.id) ?? [];
        return [...without, row].sort(sortChatsForSidebar);
      });
      void queryClient.invalidateQueries({ queryKey: ["chats"] });
      updateSelectedChatId(row.id);
      closeMobileSidebar();
    },
  });

  const patchChatMutation = useMutation({
    mutationFn: ({ chatId, ...body }: { chatId: string; title?: string; pinned?: boolean }) =>
      apiPatch<ApiChat>(`/api/chats/${chatId}`, body),
    onSuccess: (chat) => {
      queryClient.setQueryData<ChatWithMessages>(["chat", chat.id], (previous) =>
        previous ? { ...previous, title: chat.title, pinned: chat.pinned, updatedAt: chat.updatedAt } : previous,
      );
      queryClient.setQueryData<ApiChat[]>(["chats"], (previous) => {
        if (!previous) return previous;
        const next = previous.map((c) => (c.id === chat.id ? chat : c));
        return [...next].sort(sortChatsForSidebar);
      });
      void queryClient.invalidateQueries({ queryKey: ["chats"] });
    },
  });

  const deleteChatMutation = useMutation({
    mutationFn: (chatId: string) => apiDelete(`/api/chats/${chatId}`),
    onSuccess: (_, chatId) => {
      queryClient.removeQueries({ queryKey: ["chat", chatId] });
      queryClient.setQueryData<ApiChat[]>(["chats"], (previous) => {
        const next = previous?.filter((c) => c.id !== chatId) ?? [];
        return [...next].sort(sortChatsForSidebar);
      });
      updateSelectedChatId((current) => {
        if (current !== chatId) return current;
        const list = queryClient.getQueryData<ApiChat[]>(["chats"]) ?? [];
        return list[0]?.id ?? null;
      });
      void queryClient.invalidateQueries({ queryKey: ["chats"] });
    },
  });

  const sendMutation = useMutation({
    mutationFn: async ({
      chatId,
      content,
      shouldRename,
      nextTitle,
    }: {
      chatId: string;
      content: string;
      shouldRename: boolean;
      nextTitle: string;
    }) => {
      return apiPost<ChatTurnData>(`/api/chats/${chatId}/turn`, {
        content,
        ...(shouldRename ? { renameTitle: nextTitle } : {}),
      });
    },
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: ["chat", variables.chatId] });

      const previousChat = queryClient.getQueryData<ChatWithMessages>(["chat", variables.chatId]);
      const optimisticId = `optimistic-${crypto.randomUUID()}`;
      const optimisticMessage: ApiMessage = {
        id: optimisticId,
        chatId: variables.chatId,
        role: "user",
        content: variables.content,
        createdAt: new Date().toISOString(),
      };

      if (previousChat) {
        queryClient.setQueryData<ChatWithMessages>(["chat", variables.chatId], {
          ...previousChat,
          ...(variables.shouldRename ? { title: variables.nextTitle } : {}),
          messages: [...previousChat.messages, optimisticMessage],
        });
      }

      return { previousChat, optimisticId };
    },
    onError: (error, variables, context) => {
      if (error instanceof ApiError && error.code === "FREE_LIMIT_EXCEEDED") {
        queryClient.setQueryData<ApiChat[]>(["chats"], []);
        queryClient.removeQueries({ queryKey: ["chat", variables.chatId] });
        updateSelectedChatId(null);
        void queryClient.invalidateQueries({ queryKey: ["usage"] });
        setDraft(variables.content);
        return;
      }
      if (context?.previousChat !== undefined) {
        queryClient.setQueryData(["chat", variables.chatId], context.previousChat);
      } else {
        void queryClient.invalidateQueries({ queryKey: ["chat", variables.chatId] });
      }
      setDraft(variables.content);
    },
    onSuccess: (data, variables, context) => {
      queryClient.setQueryData<ChatWithMessages>(["chat", variables.chatId], (previous) => {
        if (!previous) return previous;
        const withoutOptimistic = previous.messages.filter((m) => m.id !== context?.optimisticId);
        return {
          ...previous,
          title: data.title,
          updatedAt: data.assistantMessage.createdAt,
          messages: [...withoutOptimistic, data.userMessage, data.assistantMessage],
        };
      });

      if (data.anonymousQuotaExhausted) {
        queryClient.setQueryData<ApiChat[]>(["chats"], []);
      } else {
        queryClient.setQueryData<ApiChat[]>(["chats"], (previous) => {
          if (!previous) return previous;
          const next = previous.map((chat) =>
            chat.id === variables.chatId
              ? {
                  ...chat,
                  title: data.title,
                  updatedAt: data.assistantMessage.createdAt,
                }
              : chat,
          );
          return [...next].sort(sortChatsForSidebar);
        });
      }
      void queryClient.invalidateQueries({ queryKey: ["usage"] });
    },
  });

  const usage = usageQuery.data;
  const anonFreeLimitReached = Boolean(
    usage?.isAnonymous &&
      usage.remainingQuestions !== null &&
      usage.remainingQuestions <= 0,
  );

  const handleComposerFocus = () => {
    if (anonFreeLimitReached) return;
    if (isGuestMode && (chatsQuery.data?.length ?? 0) > 0) return;
    if (selectedChatId !== null || createChatMutation.isPending) return;
    createChatMutation.mutate();
  };

  const handleSend = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (sendMutation.isPending || createChatMutation.isPending) return;
    if (anonFreeLimitReached) return;

    const text = draft.trim();
    const hasAttachments = Boolean(selectedFile || selectedImage);
    if (!text && !hasAttachments) return;

    let chatId = selectedChatId;
    if (!chatId) {
      if (isGuestMode) {
        const list = chatsQuery.data ?? [];
        if (list.length > 0) {
          chatId = list[0].id;
          updateSelectedChatId(chatId);
        } else {
          try {
            const chat = await createChatMutation.mutateAsync();
            chatId = chat.id;
          } catch {
            return;
          }
        }
      } else {
        try {
          const chat = await createChatMutation.mutateAsync();
          chatId = chat.id;
        } catch {
          return;
        }
      }
    }

    const attachmentSuffix = [selectedFile?.name, selectedImage?.name].filter(Boolean).join(", ");
    const content =
      text.length > 0
        ? attachmentSuffix
          ? `${text}\n\nAttached: ${attachmentSuffix}`
          : text
        : `Attached: ${attachmentSuffix}`;

    const detail =
      queryClient.getQueryData<ChatWithMessages>(["chat", chatId]) ?? chatDetailQuery.data;
    const wasEmpty = (detail?.messages.length ?? 0) === 0;
    const currentTitle = detail?.title ?? "";
    const shouldRename = wasEmpty && (currentTitle === DEFAULT_CHAT_TITLE || currentTitle.length === 0);
    const nextTitle = content.slice(0, 120);

    setDraft("");
    setSelectedFile(null);
    setSelectedImage(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (imageInputRef.current) imageInputRef.current.value = "";

    sendMutation.mutate({ chatId, content, shouldRename, nextTitle });
  };

  const openAttachmentPicker = async (kind: "file" | "image") => {
    if (sendMutation.isPending || anonFreeLimitReached) return;
    if (!selectedChatId) {
      if (isGuestMode) {
        const list = chatsQuery.data ?? [];
        if (list.length > 0) {
          updateSelectedChatId(list[0].id);
        } else if (createChatMutation.isPending) {
          return;
        } else {
          try {
            await createChatMutation.mutateAsync();
          } catch {
            return;
          }
        }
      } else if (createChatMutation.isPending) {
        return;
      } else {
        try {
          await createChatMutation.mutateAsync();
        } catch {
          return;
        }
      }
    }
    if (kind === "file") {
      fileInputRef.current?.click();
    } else {
      imageInputRef.current?.click();
    }
  };

  const handleFilePick = (event: ChangeEvent<HTMLInputElement>) => {
    setSelectedFile(event.target.files?.[0] ?? null);
  };

  const handleImagePick = (event: ChangeEvent<HTMLInputElement>) => {
    setSelectedImage(event.target.files?.[0] ?? null);
  };

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = "0px";
    const nextHeight = Math.min(textarea.scrollHeight, 220);
    textarea.style.height = `${nextHeight}px`;
    textarea.style.overflowY = textarea.scrollHeight > 220 ? "auto" : "hidden";
  }, [draft]);

  const loadError = chatsQuery.error?.message ?? chatDetailQuery.error?.message ?? sendMutation.error?.message;
  const isBootLoading = chatsQuery.isLoading;
  const isChatLoading = Boolean(activeChatId) && chatDetailQuery.isLoading;
  const sendDisabled =
    sendMutation.isPending ||
    createChatMutation.isPending ||
    anonFreeLimitReached ||
    (!draft.trim() && !selectedFile && !selectedImage);

  const attachmentDisabled =
    sendMutation.isPending ||
    (selectedChatId === null && createChatMutation.isPending) ||
    anonFreeLimitReached;
  const textareaDisabled = sendMutation.isPending || anonFreeLimitReached;

  const handleComposerKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.nativeEvent.isComposing) return;
    if (event.key !== "Enter" || event.shiftKey) return;
    event.preventDefault();
    if (sendDisabled) return;
    formRef.current?.requestSubmit();
  };

  const removeFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeImage = () => {
    setSelectedImage(null);
    if (imageInputRef.current) imageInputRef.current.value = "";
  };

  useEffect(() => {
    if (isGuestMode || !showSidebar) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") setShowSidebar(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showSidebar, isGuestMode]);

  useEffect(() => {
    if (isGuestMode || !showSidebar) return;
    const mq = window.matchMedia("(max-width: 767px)");
    if (!mq.matches) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [showSidebar, isGuestMode]);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[var(--background)] text-[var(--foreground)]">
      {!isGuestMode ? (
        <ChatSidebar
          activeChatId={activeChatId}
          chats={chatsForSidebar}
          createPending={createChatMutation.isPending}
          deletePending={deleteChatMutation.isPending}
          isBootLoading={isBootLoading}
          onDeleteChat={(chatId) => {
            if (!window.confirm("Delete this chat? This cannot be undone.")) return;
            deleteChatMutation.mutate(chatId);
          }}
          onNewChat={() => createChatMutation.mutate()}
          onPatchChat={(input) => patchChatMutation.mutate(input)}
          onRenamingChatIdChange={setSidebarRenamingChatId}
          onSelectChat={handleSidebarSelectChat}
          open={showSidebar}
          patchPending={patchChatMutation.isPending}
          renamingChatId={sidebarRenamingChatId}
        />
      ) : null}

      <main className="flex min-w-0 flex-1 flex-col">
        <ChatHeader
          activeChatId={activeChatId}
          activeTitle={activeTitle}
          isGuestMode={isGuestMode}
          menuOpen={showSidebar}
          onToggleSidebar={() => setShowSidebar((prev) => !prev)}
          showMenu={!isGuestMode}
        />

        <ChatUsageBanner usage={usage} />

        {loadError ? (
          <div className="mx-auto max-w-3xl px-4 py-3 text-center text-sm text-red-600">{loadError}</div>
        ) : null}

        <ChatMessageThread
          activeChatId={activeChatId}
          anonFreeLimitReached={anonFreeLimitReached}
          isBootLoading={isBootLoading}
          isChatLoading={isChatLoading}
          isGuestMode={isGuestMode}
          messages={activeMessages}
        />

        <ChatComposer
          anonFreeLimitReached={anonFreeLimitReached}
          attachmentDisabled={attachmentDisabled}
          textareaDisabled={textareaDisabled}
          draft={draft}
          fileInputRef={fileInputRef}
          formRef={formRef}
          imageInputRef={imageInputRef}
          onComposerFocus={handleComposerFocus}
          onComposerKeyDown={handleComposerKeyDown}
          onDraftChange={setDraft}
          onOpenAttachmentPicker={openAttachmentPicker}
          onPickFile={handleFilePick}
          onPickImage={handleImagePick}
          onRemoveFile={removeFile}
          onRemoveImage={removeImage}
          onSubmit={handleSend}
          selectedFile={selectedFile}
          selectedImage={selectedImage}
          sendDisabled={sendDisabled}
          textareaRef={textareaRef}
        />
      </main>

      {!isGuestMode && showSidebar ? (
        <button
          aria-label="Close menu"
          className="fixed bottom-0 left-0 right-0 top-14 z-[40] bg-black/40 backdrop-blur-[2px] md:hidden"
          onClick={() => setShowSidebar(false)}
          type="button"
        />
      ) : null}
    </div>
  );
}
