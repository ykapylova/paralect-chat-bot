"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
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

type Role = "user" | "assistant";

type Message = {
  id: string;
  role: Role;
  text: string;
  createdAt: string;
};

type Chat = {
  id: string;
  title: string;
  preview: string;
  updatedAt: string;
  messages: Message[];
};

const initialChats: Chat[] = [
  {
    id: "chat-1",
    title: "New product strategy",
    preview: "Can you make a launch plan?",
    updatedAt: "2 min ago",
    messages: [
      {
        id: "m1",
        role: "user",
        text: "Can you make a launch plan for our AI chatbot MVP?",
        createdAt: "16:11",
      },
      {
        id: "m2",
        role: "assistant",
        text: "Sure. Start with audience definition, core flows, and one measurable success metric per week.",
        createdAt: "16:11",
      },
    ],
  },
  {
    id: "chat-2",
    title: "Marketing ideas",
    preview: "Need ad copies for social media",
    updatedAt: "1 h ago",
    messages: [
      {
        id: "m3",
        role: "user",
        text: "Write 3 short ad copies for an AI assistant.",
        createdAt: "14:52",
      },
      {
        id: "m4",
        role: "assistant",
        text: "1) Work faster with smart AI replies. 2) Turn ideas into drafts in seconds. 3) One assistant for notes, docs, and chats.",
        createdAt: "14:53",
      },
    ],
  },
];

export function ChatShell() {
  const [chats, setChats] = useState<Chat[]>(initialChats);
  const [activeChatId, setActiveChatId] = useState(initialChats[0].id);
  const [draft, setDraft] = useState("");
  const [showSidebar, setShowSidebar] = useState(true);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const activeChat = useMemo(
    () => chats.find((chat) => chat.id === activeChatId) ?? chats[0],
    [activeChatId, chats],
  );

  const handleCreateChat = () => {
    const newChat: Chat = {
      id: crypto.randomUUID(),
      title: "Untitled chat",
      preview: "Start typing your first question",
      updatedAt: "now",
      messages: [],
    };

    setChats((prev) => [newChat, ...prev]);
    setActiveChatId(newChat.id);
  };

  const handleSend = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = draft.trim();
    const hasAttachments = Boolean(selectedFile || selectedImage);

    if ((!text && !hasAttachments) || !activeChat) return;

    const attachmentSuffix = [selectedFile?.name, selectedImage?.name]
      .filter(Boolean)
      .join(", ");
    const textWithAttachments =
      text.length > 0
        ? attachmentSuffix
          ? `${text}\n\nAttached: ${attachmentSuffix}`
          : text
        : `Attached: ${attachmentSuffix}`;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      text: textWithAttachments,
      createdAt: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };

    const assistantMessage: Message = {
      id: crypto.randomUUID(),
      role: "assistant",
      text: "Streaming response placeholder... Connect this block to your `/api/chats/:chatId/stream` endpoint.",
      createdAt: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };

    setChats((prev) =>
      prev.map((chat) =>
        chat.id === activeChat.id
          ? {
              ...chat,
              title:
                chat.messages.length === 0
                  ? textWithAttachments.slice(0, 26)
                  : chat.title,
              preview: textWithAttachments,
              updatedAt: "now",
              messages: [...chat.messages, userMessage, assistantMessage],
            }
          : chat,
      ),
    );

    setDraft("");
    setSelectedFile(null);
    setSelectedImage(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (imageInputRef.current) imageInputRef.current.value = "";
  };

  const handleFilePick = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setSelectedFile(file);
  };

  const handleImagePick = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setSelectedImage(file);
  };

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = "0px";
    const nextHeight = Math.min(textarea.scrollHeight, 220);
    textarea.style.height = `${nextHeight}px`;
    textarea.style.overflowY = textarea.scrollHeight > 220 ? "auto" : "hidden";
  }, [draft]);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[var(--background)] text-[var(--foreground)]">
      {showSidebar ? (
        <aside className="hidden w-[280px] shrink-0 border-r border-[var(--border)] bg-[var(--panel-soft)] p-3 md:block">
          <button
            className="mb-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--panel)] px-3 py-2 text-sm font-medium transition hover:bg-[#f9fafb]"
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
            {chats.map((chat) => {
              const isActive = chat.id === activeChatId;
              return (
                <button
                  key={chat.id}
                  className={`w-full rounded-lg px-2 py-2 text-left transition ${
                    isActive ? "bg-[#e8ecf2]" : "hover:bg-[#eceff3]"
                  }`}
                  onClick={() => setActiveChatId(chat.id)}
                  type="button"
                >
                  <p className="truncate text-sm">{chat.title}</p>
                  <p className="truncate text-xs text-[var(--muted)]">{chat.preview}</p>
                </button>
              );
            })}
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
            <span className="text-sm font-medium">Chatbot</span>
          </div>
          <span className="text-xs text-[var(--muted)]">GPT-4.1 mini</span>
        </header>

        <section className="flex-1 overflow-y-auto px-4 pb-32 pt-6">
          {!activeChat || activeChat.messages.length === 0 ? (
            <div className="mx-auto mt-20 flex max-w-3xl flex-col items-center text-center">
              <h1 className="text-3xl font-medium tracking-tight md:text-4xl">
                What are you working on?
              </h1>
              <p className="mt-3 text-sm text-[var(--muted)]">
                Ask anything. Upload docs and images to enrich context.
              </p>
            </div>
          ) : (
            <div className="mx-auto flex max-w-3xl flex-col gap-6">
              {activeChat.messages.map((message) => (
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
                  </div>
                  <div
                    className={`rounded-2xl border px-4 py-3 text-[15px] leading-7 ${
                      message.role === "assistant"
                        ? "border-[var(--border)] bg-[var(--panel)]"
                        : "border-transparent bg-[#eceff3]"
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{message.text}</p>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <footer className="sticky bottom-0 mt-auto bg-gradient-to-t from-[var(--background)] via-[var(--background)] to-transparent px-4 pb-5 pt-6">
          <form className="mx-auto w-full max-w-3xl" onSubmit={handleSend}>
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
                  className="min-h-[44px] w-full resize-none bg-transparent px-3 py-2 text-[15px] leading-6 outline-none placeholder:text-[var(--muted)]"
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder="Ask anything"
                  ref={textareaRef}
                  rows={1}
                  value={draft}
                />
                <button
                  className="row-span-2 mt-1 inline-flex h-10 w-10 items-center justify-center self-center rounded-full bg-black text-white transition hover:scale-[1.02] hover:opacity-90 disabled:cursor-not-allowed disabled:scale-100 disabled:bg-[#d1d5db]"
                  disabled={draft.trim().length === 0 && !selectedFile && !selectedImage}
                  type="submit"
                >
                  <SendHorizontal className="h-4 w-4" />
                </button>
                <div className="flex items-center gap-1 px-1 pb-1">
                  <button
                    className="rounded-full p-2 text-[var(--muted)] transition hover:bg-[var(--panel-soft)] hover:text-[var(--foreground)]"
                    onClick={() => fileInputRef.current?.click()}
                    type="button"
                  >
                    <Paperclip className="h-4 w-4" />
                  </button>
                  <button
                    className="rounded-full p-2 text-[var(--muted)] transition hover:bg-[var(--panel-soft)] hover:text-[var(--foreground)]"
                    onClick={() => imageInputRef.current?.click()}
                    type="button"
                  >
                    <ImageIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <input
                className="hidden"
                onChange={handleFilePick}
                ref={fileInputRef}
                type="file"
              />
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
