"use client";

import { UserButton } from "@clerk/nextjs";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChangeEvent,
  FormEvent,
  KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Paperclip,
  Bot,
  X,
  ImageIcon,
  Menu,
  MessageCircle,
  Plus,
  Search,
  SendHorizontal,
  User,
} from "lucide-react";
import type { Chat as ApiChat, ChatMessage as ApiMessage, ChatWithMessages } from "@/server/types/chat";
import { apiGet, apiPost } from "@/lib/api-client";

type TurnResponse = {
  userMessage: ApiMessage;
  assistantMessage: ApiMessage;
  title: string;
};

type UiRole = "user" | "assistant";

type UiMessage = {
  id: string;
  role: UiRole;
  text: string;
  createdAt: string;
  isPending?: boolean;
};

function formatMessageTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return iso;
  }
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatChatSubtitle(iso: string): string {
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

function mapApiMessage(row: ApiMessage): UiMessage {
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

export function ChatShell() {
  const queryClient = useQueryClient();
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [showSidebar, setShowSidebar] = useState(true);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const chatsQuery = useQuery({
    queryKey: ["chats"],
    queryFn: () => apiGet<ApiChat[]>("/api/chats"),
  });

  const chatsForSidebar = chatsQuery.data ?? [];
  const activeChatId = selectedChatId;

  const chatDetailQuery = useQuery({
    queryKey: ["chat", activeChatId],
    queryFn: () => apiGet<ChatWithMessages>(`/api/chats/${activeChatId}`),
    enabled: Boolean(activeChatId),
  });

  const activeMessages: UiMessage[] = useMemo(() => {
    const rows = chatDetailQuery.data?.messages ?? [];
    return rows.map(mapApiMessage);
  }, [chatDetailQuery.data?.messages]);

  const activeTitle = chatDetailQuery.data?.title ?? "Chat";

  const createChatMutation = useMutation({
    mutationFn: () => apiPost<ApiChat>("/api/chats", {}),
    onSuccess: (chat) => {
      queryClient.setQueryData<ChatWithMessages>(["chat", chat.id], {
        ...chat,
        messages: [],
      });
      void queryClient.invalidateQueries({ queryKey: ["chats"] });
      setSelectedChatId(chat.id);
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
      return apiPost<TurnResponse>(`/api/chats/${chatId}/turn`, {
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
    onError: (_error, variables, context) => {
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
        return [...next].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
      });
    },
  });

  const handleCreateChat = () => {
    createChatMutation.mutate();
  };

  const handleComposerFocus = () => {
    if (selectedChatId !== null || createChatMutation.isPending) return;
    createChatMutation.mutate();
  };

  const handleSend = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (sendMutation.isPending || createChatMutation.isPending) return;

    const text = draft.trim();
    const hasAttachments = Boolean(selectedFile || selectedImage);
    if (!text && !hasAttachments) return;

    let chatId = selectedChatId;
    if (!chatId) {
      try {
        const chat = await createChatMutation.mutateAsync();
        chatId = chat.id;
      } catch {
        return;
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
    const shouldRename = wasEmpty && (currentTitle === "Untitled chat" || currentTitle.length === 0);
    const nextTitle = content.slice(0, 120);

    setDraft("");
    setSelectedFile(null);
    setSelectedImage(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (imageInputRef.current) imageInputRef.current.value = "";

    sendMutation.mutate({ chatId, content, shouldRename, nextTitle });
  };

  const openAttachmentPicker = async (kind: "file" | "image") => {
    if (sendMutation.isPending) return;
    if (!selectedChatId) {
      if (createChatMutation.isPending) return;
      try {
        await createChatMutation.mutateAsync();
      } catch {
        return;
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
    (!draft.trim() && !selectedFile && !selectedImage);

  const composerBusy = sendMutation.isPending || (selectedChatId === null && createChatMutation.isPending);

  const handleComposerKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.nativeEvent.isComposing) return;
    if (event.key !== "Enter" || event.shiftKey) return;
    event.preventDefault();
    if (sendDisabled) return;
    formRef.current?.requestSubmit();
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[var(--background)] text-[var(--foreground)]">
      {showSidebar ? (
        <aside className="hidden w-[280px] shrink-0 border-r border-[var(--border)] bg-[var(--panel-soft)] p-3 md:block">
          <button
            className="mb-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--panel)] px-3 py-2 text-sm font-medium transition hover:bg-[#f9fafb] disabled:opacity-50"
            disabled={createChatMutation.isPending}
            onClick={handleCreateChat}
            type="button"
          >
            <Plus className="h-4 w-4" />
            New chat
          </button>

          <div className="mb-3 space-y-1">
            <button className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm hover:bg-[#eceff3]" type="button">
              <Search className="h-4 w-4 text-[var(--muted)]" />
              Search chats
            </button>
          </div>

          <p className="px-2 pb-2 text-xs font-medium text-[var(--muted)]">Your chats</p>
          <div className="space-y-1">
            {isBootLoading ? (
              <p className="px-2 text-sm text-[var(--muted)]">Loading chats…</p>
            ) : chatsForSidebar.length === 0 ? (
              <p className="px-2 text-sm text-[var(--muted)]">No chats yet. Create one to start.</p>
            ) : (
              chatsForSidebar.map((chat) => {
                const isActive = chat.id === activeChatId;
                return (
                  <button
                    key={chat.id}
                    className={`w-full rounded-lg px-2 py-2 text-left transition ${
                      isActive ? "bg-[#e8ecf2]" : "hover:bg-[#eceff3]"
                    }`}
                    onClick={() => setSelectedChatId(chat.id)}
                    type="button"
                  >
                    <p className="truncate text-sm">{chat.title}</p>
                    <p className="truncate text-xs text-[var(--muted)]">{formatChatSubtitle(chat.updatedAt)}</p>
                  </button>
                );
              })
            )}
          </div>
        </aside>
      ) : null}

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <button
              className="rounded-lg p-2 text-[var(--muted)] transition hover:bg-[#eceff3] hover:text-[var(--foreground)]"
              onClick={() => setShowSidebar((prev) => !prev)}
              type="button"
            >
              <Menu className="h-5 w-5" />
            </button>
            <span className="text-sm font-medium">{activeChatId ? activeTitle : "Chatbot"}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-xs text-[var(--muted)] sm:inline">GPT-4.1 mini</span>
            <UserButton />
          </div>
        </header>

        {loadError ? (
          <div className="mx-auto max-w-3xl px-4 py-3 text-center text-sm text-red-600">{loadError}</div>
        ) : null}

        <section className="flex-1 overflow-y-auto px-4 pb-32 pt-6">
          {!activeChatId ? (
            <div className="mx-auto mt-20 flex max-w-3xl flex-col items-center text-center">
              <h1 className="text-3xl font-medium tracking-tight md:text-4xl">What are you working on?</h1>
              <p className="mt-3 text-sm text-[var(--muted)]">
                Ask anything. Click the box below to start — a new chat is created automatically.
              </p>
            </div>
          ) : isChatLoading ? (
            <div className="mx-auto max-w-3xl px-2 text-sm text-[var(--muted)]">Loading messages…</div>
          ) : activeMessages.length === 0 ? (
            <div className="mx-auto mt-20 flex max-w-3xl flex-col items-center text-center">
              <h1 className="text-3xl font-medium tracking-tight md:text-4xl">What are you working on?</h1>
              <p className="mt-3 text-sm text-[var(--muted)]">
                Ask anything. Upload docs and images to enrich context.
              </p>
            </div>
          ) : (
            <div className="mx-auto flex max-w-3xl flex-col gap-6">
              {activeMessages.map((message) => (
                <article key={message.id} className="group">
                  <div className="mb-2 flex items-center gap-2 text-xs text-[var(--muted)]">
                    {message.role === "assistant" ? (
                      <Bot className="h-4 w-4" />
                    ) : (
                      <User className="h-4 w-4" />
                    )}
                    <span>{message.role === "assistant" ? "Assistant" : "You"}</span>
                    <span>·</span>
                    <span>{message.createdAt}</span>
                    {message.isPending ? (
                      <>
                        <span>·</span>
                        <span className="text-[var(--muted)]">Waiting for response…</span>
                      </>
                    ) : null}
                  </div>
                  <div
                    className={`rounded-2xl border px-4 py-3 text-[15px] leading-7 ${
                      message.role === "assistant"
                        ? "border-[var(--border)] bg-[var(--panel)]"
                        : "border-transparent bg-[#eceff3]"
                    } ${message.isPending ? "opacity-80" : ""}`}
                  >
                    <p className="whitespace-pre-wrap">{message.text}</p>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <footer className="sticky bottom-0 mt-auto bg-gradient-to-t from-[var(--background)] via-[var(--background)] to-transparent px-4 pb-5 pt-6">
          <form className="mx-auto w-full max-w-3xl" onSubmit={handleSend} ref={formRef}>
            <div className="rounded-[28px] border border-[var(--border)] bg-[var(--panel)] p-3.5 shadow-[0_8px_30px_rgba(0,0,0,0.06)] transition focus-within:border-[#c9d0dd] focus-within:shadow-[0_10px_34px_rgba(0,0,0,0.1)]">
              {(selectedFile || selectedImage) && (
                <div className="flex flex-wrap gap-2 px-2 pb-2 pt-1">
                  {selectedFile && (
                    <span className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--panel-soft)] px-3 py-1 text-xs text-[var(--foreground)]">
                      <span className="max-w-[260px] truncate">File: {selectedFile.name}</span>
                      <button
                        aria-label="Remove file"
                        className="rounded-full p-0.5 text-[var(--muted)] transition hover:bg-white hover:text-[var(--foreground)]"
                        onClick={() => {
                          setSelectedFile(null);
                          if (fileInputRef.current) fileInputRef.current.value = "";
                        }}
                        type="button"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  )}
                  {selectedImage && (
                    <span className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--panel-soft)] px-3 py-1 text-xs text-[var(--foreground)]">
                      <span className="max-w-[260px] truncate">Image: {selectedImage.name}</span>
                      <button
                        aria-label="Remove image"
                        className="rounded-full p-0.5 text-[var(--muted)] transition hover:bg-white hover:text-[var(--foreground)]"
                        onClick={() => {
                          setSelectedImage(null);
                          if (imageInputRef.current) imageInputRef.current.value = "";
                        }}
                        type="button"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  )}
                </div>
              )}
              <div className="grid grid-cols-[1fr_auto] gap-x-2.5 px-0.5">
                <textarea
                  className="min-h-[44px] w-full resize-none bg-transparent px-3 py-2 text-[15px] leading-6 outline-none placeholder:text-[var(--muted)] disabled:opacity-50"
                  disabled={composerBusy}
                  onChange={(event) => setDraft(event.target.value)}
                  onFocus={handleComposerFocus}
                  onKeyDown={handleComposerKeyDown}
                  placeholder="Ask anything"
                  ref={textareaRef}
                  rows={1}
                  value={draft}
                />
                <button
                  className="row-span-2 mt-1 inline-flex h-10 w-10 items-center justify-center self-center rounded-full bg-black text-white transition hover:scale-[1.02] hover:opacity-90 disabled:cursor-not-allowed disabled:scale-100 disabled:bg-[#d1d5db]"
                  disabled={sendDisabled}
                  type="submit"
                >
                  <SendHorizontal className="h-4 w-4" />
                </button>
                <div className="flex items-center gap-1 px-1 pb-1">
                  <button
                    className="rounded-full p-2 text-[var(--muted)] transition hover:bg-[var(--panel-soft)] hover:text-[var(--foreground)] disabled:opacity-40"
                    disabled={composerBusy}
                    onClick={() => void openAttachmentPicker("file")}
                    type="button"
                  >
                    <Paperclip className="h-4 w-4" />
                  </button>
                  <button
                    className="rounded-full p-2 text-[var(--muted)] transition hover:bg-[var(--panel-soft)] hover:text-[var(--foreground)] disabled:opacity-40"
                    disabled={composerBusy}
                    onClick={() => void openAttachmentPicker("image")}
                    type="button"
                  >
                    <ImageIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <input className="hidden" onChange={handleFilePick} ref={fileInputRef} type="file" />
              <input
                accept="image/*"
                className="hidden"
                onChange={handleImagePick}
                ref={imageInputRef}
                type="file"
              />
              <div className="flex items-center gap-2 px-2 pb-1 pt-1 text-[11px] text-[var(--muted)]">
                <MessageCircle className="h-3.5 w-3.5" />
                <span>Messages are generated by AI and may be inaccurate.</span>
              </div>
            </div>
          </form>
        </footer>
      </main>
    </div>
  );
}
