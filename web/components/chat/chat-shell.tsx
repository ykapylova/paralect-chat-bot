"use client";

import { useAuth } from "@clerk/nextjs";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChangeEvent,
  ClipboardEvent,
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
import {
  ApiError,
  createChat,
  deleteChat,
  getChatWithMessages,
  getChats,
  getMeUsage,
  patchChat,
  postChatTurn,
  uploadChatImage,
  uploadChatUserPickedFile,
} from "lib/api-client";
import { DEFAULT_CHAT_TITLE } from "lib/chat-defaults";
import type { ChatTurnStreamEvent } from "lib/api-types/chat";
import type { ChatUploadResult } from "lib/api-types/upload";
import { consumeSseJsonStream } from "lib/chat-turn-stream";
import { extensionForPastedImageMime } from "lib/file-upload-config";
import { queryKeys } from "lib/query-keys";
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
  const [attachmentUploadPending, setAttachmentUploadPending] = useState(false);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
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
    queryKey: queryKeys.chat.detail(activeChatId),
    queryFn: () => getChatWithMessages(activeChatId!),
    enabled: Boolean(activeChatId),
  });

  const activeMessages = useMemo(() => {
    const rows = chatDetailQuery.data?.messages ?? [];
    return rows.map(mapApiMessage);
  }, [chatDetailQuery.data?.messages]);

  const activeTitle = chatDetailQuery.data?.title ?? "Chat";

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
    mutationFn: async (variables: {
      chatId: string;
      content: string;
      shouldRename: boolean;
      nextTitle: string;
      optimisticId: string;
    }) => {
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
    onMutate: async (variables) => {
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

  const usage = usageQuery.data;
  const anonFreeLimitReached = Boolean(
    isGuestMode &&
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
    if (sendMutation.isPending || createChatMutation.isPending || attachmentUploadPending) return;
    if (anonFreeLimitReached) return;

    const text = draft.trim();
    const hasAttachments = Boolean(selectedFile || selectedImage);
    if (!text && !hasAttachments) return;

    setAttachmentError(null);

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

    const uploaded: ChatUploadResult[] = [];
    if (hasAttachments) {
      setAttachmentUploadPending(true);
      try {
        if (selectedImage) {
          uploaded.push(await uploadChatImage(selectedImage));
        }
        if (selectedFile) {
          uploaded.push(await uploadChatUserPickedFile(selectedFile));
        }
      } catch (err) {
        const msg = err instanceof ApiError ? err.message : "Upload failed";
        setAttachmentError(msg);
        setAttachmentUploadPending(false);
        return;
      }
      setAttachmentUploadPending(false);
    }

    const attachmentLines = uploaded.map((u) =>
      u.type === "image"
        ? `![${u.filename}](${u.signedUrl})`
        : `[${u.filename}](${u.signedUrl})`,
    );
    const content =
      text.length > 0
        ? attachmentLines.length > 0
          ? `${text}\n\n${attachmentLines.join("\n")}`
          : text
        : attachmentLines.join("\n");

    const detail =
      queryClient.getQueryData<ChatWithMessages>(queryKeys.chat.detail(chatId)) ?? chatDetailQuery.data;
    const wasEmpty = (detail?.messages.length ?? 0) === 0;
    const currentTitle = detail?.title ?? "";
    const shouldRename = wasEmpty && (currentTitle === DEFAULT_CHAT_TITLE || currentTitle.length === 0);
    const nextTitle = content.slice(0, 120);

    setDraft("");
    setSelectedFile(null);
    setSelectedImage(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (imageInputRef.current) imageInputRef.current.value = "";

    sendMutation.mutate({
      chatId,
      content,
      shouldRename,
      nextTitle,
      optimisticId: `optimistic-${crypto.randomUUID()}`,
    });
  };

  const ensureChatReadyForAttachment = async (): Promise<boolean> => {
    if (sendMutation.isPending || attachmentUploadPending || anonFreeLimitReached) {
      return false;
    }
    if (selectedChatId !== null) {
      return true;
    }
    if (isGuestMode) {
      const list = chatsQuery.data ?? [];
      if (list.length > 0) {
        updateSelectedChatId(list[0].id);
        return true;
      }
      if (createChatMutation.isPending) {
        return false;
      }
      try {
        await createChatMutation.mutateAsync();
        return true;
      } catch {
        return false;
      }
    }
    if (createChatMutation.isPending) {
      return false;
    }
    try {
      await createChatMutation.mutateAsync();
      return true;
    } catch {
      return false;
    }
  };

  const openAttachmentPicker = async (kind: "file" | "image") => {
    setAttachmentError(null);
    const ok = await ensureChatReadyForAttachment();
    if (!ok) return;
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

  const handleComposerPaste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    if (attachmentDisabled || textareaDisabled) return;
    const cd = event.clipboardData;
    if (!cd) return;

    let imageFile: File | null = null;
    for (const item of cd.items) {
      if (item.kind === "file" && item.type.startsWith("image/")) {
        imageFile = item.getAsFile();
        break;
      }
    }
    if (!imageFile && cd.files?.length) {
      const f = cd.files[0];
      if (f?.type.startsWith("image/")) {
        imageFile = f;
      }
    }
    if (!imageFile) return;

    event.preventDefault();
    setAttachmentError(null);
    const ext = extensionForPastedImageMime(imageFile.type);
    const fallbackName = `pasted-${Date.now()}.${ext}`;
    const name =
      imageFile.name && !/^image\.(png|jpe?g|gif|webp)$/i.test(imageFile.name)
        ? imageFile.name
        : fallbackName;
    const file = name === imageFile.name ? imageFile : new File([imageFile], name, { type: imageFile.type });

    void (async () => {
      const ok = await ensureChatReadyForAttachment();
      if (!ok) return;
      setSelectedImage(file);
    })();
  };

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = "0px";
    const nextHeight = Math.min(textarea.scrollHeight, 220);
    textarea.style.height = `${nextHeight}px`;
    textarea.style.overflowY = textarea.scrollHeight > 220 ? "auto" : "hidden";
  }, [draft]);

  const loadError =
    chatsQuery.error?.message ?? chatDetailQuery.error?.message ?? sendMutation.error?.message;
  const bannerError = loadError ?? attachmentError;
  const isBootLoading = chatsQuery.isLoading;
  const isChatLoading = Boolean(activeChatId) && chatDetailQuery.isLoading;
  const sendDisabled =
    sendMutation.isPending ||
    createChatMutation.isPending ||
    attachmentUploadPending ||
    anonFreeLimitReached ||
    (!draft.trim() && !selectedFile && !selectedImage);

  const attachmentDisabled =
    sendMutation.isPending ||
    attachmentUploadPending ||
    (selectedChatId === null && createChatMutation.isPending) ||
    anonFreeLimitReached;
  const textareaDisabled = sendMutation.isPending || attachmentUploadPending || anonFreeLimitReached;

  const handleComposerKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.nativeEvent.isComposing) return;
    if (event.key !== "Enter" || event.shiftKey) return;
    event.preventDefault();
    if (sendDisabled) return;
    formRef.current?.requestSubmit();
  };

  const removeFile = () => {
    setSelectedFile(null);
    setAttachmentError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeImage = () => {
    setSelectedImage(null);
    setAttachmentError(null);
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

        {bannerError ? (
          <div className="mx-auto max-w-3xl px-4 py-3 text-center text-sm text-red-600">{bannerError}</div>
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
          onComposerPaste={handleComposerPaste}
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
