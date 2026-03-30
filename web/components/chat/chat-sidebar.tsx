"use client";

import { Inbox, MoreVertical, Pin, Plus, Search, SearchX, X } from "lucide-react";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "components/ui/dropdown-menu";
import { Input } from "components/ui/input";
import type { Chat as ApiChat } from "server/types/chat";
import { CHAT_AUTO_TITLE_MAX_LENGTH } from "lib/chat-ui-constants";
import logoImage from "../../app/logo.png";
import { formatChatSubtitle } from "./chat-format";

type PatchChatInput = { chatId: string; title?: string; pinned?: boolean };

type ChatSidebarProps = {
  open: boolean;
  chats: ApiChat[];
  activeChatId: string | null;
  renamingChatId: string | null;
  onRenamingChatIdChange: (id: string | null) => void;
  isBootLoading: boolean;
  createPending: boolean;
  patchPending: boolean;
  deletePending: boolean;
  onNewChat: () => void;
  onSelectChat: (id: string) => void;
  onPatchChat: (input: PatchChatInput) => Promise<void>;
  onDeleteChat: (chatId: string) => void;
};

export function ChatSidebar({
  open,
  chats,
  activeChatId,
  renamingChatId,
  onRenamingChatIdChange,
  isBootLoading,
  createPending,
  patchPending,
  deletePending,
  onNewChat,
  onSelectChat,
  onPatchChat,
  onDeleteChat,
}: ChatSidebarProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [renameDraft, setRenameDraft] = useState("");
  const [renameError, setRenameError] = useState<string | null>(null);
  const [renameSubmitting, setRenameSubmitting] = useState(false);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const menuBusy = patchPending || deletePending;

  const filteredChats = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return chats;
    return chats.filter((c) => c.title.toLowerCase().includes(q));
  }, [chats, searchQuery]);

  useEffect(() => {
    if (!renamingChatId || !renameInputRef.current) return;
    renameInputRef.current.focus();
    renameInputRef.current.select();
  }, [renamingChatId]);

  const commitRename = async (chat: ApiChat) => {
    if (renameSubmitting) return;
    if (!renamingChatId || renamingChatId !== chat.id) return;
    const trimmed = renameDraft.trim();
    setRenameError(null);
    if (!trimmed) {
      onRenamingChatIdChange(null);
      setRenameDraft(chat.title);
      return;
    }
    if (trimmed === chat.title) {
      onRenamingChatIdChange(null);
      return;
    }
    if (trimmed.length > CHAT_AUTO_TITLE_MAX_LENGTH) {
      setRenameError(`Title is too long (max ${CHAT_AUTO_TITLE_MAX_LENGTH} characters)`);
      return;
    }
    setRenameSubmitting(true);
    try {
      await onPatchChat({ chatId: chat.id, title: trimmed });
      setRenameError(null);
      onRenamingChatIdChange(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not rename chat";
      setRenameError(message);
    } finally {
      setRenameSubmitting(false);
    }
  };

  const cancelRename = (chat: ApiChat) => {
    onRenamingChatIdChange(null);
    setRenameDraft(chat.title);
    setRenameError(null);
  };

  return (
    <aside
      aria-hidden={!open}
      className={`flex w-[min(280px,100vw)] shrink-0 flex-col border-r border-[var(--border)] bg-[var(--panel-soft)] p-3 max-md:fixed max-md:bottom-0 max-md:left-0 max-md:top-14 max-md:z-[45] max-md:overflow-y-auto max-md:transition-transform max-md:duration-200 max-md:ease-out max-md:shadow-[4px_0_28px_rgba(0,0,0,0.12)] md:relative md:top-auto md:z-auto md:h-screen md:max-h-none md:translate-x-0 md:overflow-y-auto md:shadow-none ${open ? "max-md:translate-x-0" : "max-md:pointer-events-none max-md:-translate-x-full"} ${open ? "md:flex" : "md:hidden"}`}
    >
      <div className="mb-3 flex items-center gap-2 px-1">
        <Image alt="AI Assistant logo" className="h-7 w-7 rounded-md" priority src={logoImage} />
        <p className="text-sm font-semibold tracking-tight">AI Assistant</p>
      </div>

      <Button
        className="mb-3 w-full cursor-pointer justify-center gap-2 rounded-xl py-2 hover:bg-[#f9fafb] hover:shadow-[0_4px_16px_rgba(0,0,0,0.06)] active:scale-[0.99]"
        disabled={createPending}
        onClick={onNewChat}
        variant="outline"
      >
        <Plus className="h-4 w-4" />
        New chat
      </Button>

      <div className="relative mb-3 rounded-xl border border-[var(--border)] bg-[var(--panel)] shadow-[0_2px_14px_rgba(0,0,0,0.04)] transition focus-within:border-[#c9d0dd] focus-within:shadow-[0_6px_24px_rgba(0,0,0,0.08)]">
        <Search
          aria-hidden
          className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[var(--muted)] opacity-80"
        />
        <Input
          aria-label="Search chats"
          className={`rounded-xl border-0 bg-transparent py-2.5 pl-10 text-[15px] leading-5 text-[var(--foreground)] shadow-none focus:border-0 focus-visible:border-0 [&::-webkit-search-cancel-button]:appearance-none ${searchQuery ? "pr-11" : "pr-3"}`}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setSearchQuery("");
              (e.target as HTMLInputElement).blur();
            }
          }}
          placeholder="Search chats…"
          type="search"
          value={searchQuery}
        />
        {searchQuery ? (
          <Button
            aria-label="Clear search"
            className="absolute right-2 top-1/2 h-7 w-7 -translate-y-1/2 cursor-pointer rounded-full p-0"
            onClick={() => setSearchQuery("")}
            size="icon"
            variant="ghost"
          >
            <X className="h-3.5 w-3.5" strokeWidth={2.25} />
          </Button>
        ) : null}
      </div>

      <div className="px-2 pb-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
          {searchQuery.trim() ? "Matching chats" : "Your chats"}
        </p>
      </div>
      <div className="space-y-1">
        {isBootLoading ? (
          <div className="mx-0.5 flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--border)] bg-[var(--panel)]/40 px-4 py-10">
            <p className="text-sm font-medium text-[var(--foreground)]/80">Loading chats</p>
            <p className="mt-2 text-[13px] leading-relaxed text-[var(--muted)] animate-chat-pulse-soft">
              One moment…
            </p>
          </div>
        ) : chats.length === 0 ? (
          <div className="mx-0.5 flex flex-col items-center rounded-2xl border border-dashed border-[var(--border)] bg-[var(--panel)]/50 px-4 py-8 text-center">
            <Inbox aria-hidden className="mb-3 h-9 w-9 text-[var(--muted)] opacity-70" strokeWidth={1.35} />
            <p className="text-[15px] font-semibold tracking-tight text-[var(--foreground)]">No chats yet</p>
            <p className="mt-2 max-w-[220px] text-[13px] leading-snug text-[var(--muted)]">
              Start a conversation with{" "}
              <span className="font-medium text-[var(--foreground)]/85">New chat</span> above.
            </p>
          </div>
        ) : filteredChats.length === 0 ? (
          <div className="mx-0.5 flex flex-col items-center rounded-2xl border border-dashed border-[var(--border)] bg-[var(--panel)]/50 px-4 py-8 text-center">
            <SearchX aria-hidden className="mb-3 h-9 w-9 text-[var(--muted)] opacity-70" strokeWidth={1.35} />
            <p className="text-[15px] font-semibold tracking-tight text-[var(--foreground)]">No matches</p>
            <p className="mt-2 max-w-[240px] text-[13px] leading-snug text-[var(--muted)]">
              Nothing for &ldquo;
              <span className="font-medium text-[var(--foreground)]/80">{searchQuery.trim()}</span>
              &rdquo;. Try different words.
            </p>
          </div>
        ) : (
          filteredChats.map((chat) => {
            const isActive = chat.id === activeChatId;
            const isRenaming = renamingChatId === chat.id;

            return (
              <div
                key={chat.id}
                className={`group relative flex w-full items-stretch gap-0.5 rounded-lg transition duration-200 animate-chat-fade-up ${
                  isActive ? "bg-[#e8ecf2]" : "hover:bg-[#eceff3]"
                }`}
                style={{ animationDelay: `${Math.min(180, (chat.id.charCodeAt(0) % 8) * 18)}ms` }}
              >
                {isRenaming ? (
                  <div className="mx-1 my-1 min-w-0 flex-1">
                    <input
                      className="w-full rounded-md border border-[var(--border)] bg-[var(--panel)] px-2 py-1.5 text-sm outline-none ring-0 focus:border-[#c9d0dd]"
                      disabled={renameSubmitting}
                      onBlur={() => void commitRename(chat)}
                      onChange={(e) => {
                        setRenameDraft(e.target.value);
                        if (renameError) setRenameError(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          void commitRename(chat);
                        }
                        if (e.key === "Escape") {
                          e.preventDefault();
                          cancelRename(chat);
                        }
                      }}
                      ref={renameInputRef}
                      value={renameDraft}
                    />
                    {renameError ? (
                      <p className="mt-1 rounded-md border border-red-200 bg-red-50/70 px-2 py-1 text-xs leading-4 text-red-700">
                        {renameError}
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <>
                    <button
                      className="min-w-0 flex-1 cursor-pointer px-2 py-2 text-left"
                      onClick={() => onSelectChat(chat.id)}
                      type="button"
                    >
                      <div className="flex items-center gap-1.5">
                        {chat.pinned ? (
                          <Pin aria-hidden className="h-3.5 w-3.5 shrink-0 fill-current text-[var(--muted)]" />
                        ) : null}
                        <p className="truncate text-sm">{chat.title}</p>
                      </div>
                      <p className="truncate pl-0.5 text-xs text-[var(--muted)]">
                        {formatChatSubtitle(chat.createdAt)}
                      </p>
                    </button>
                    <div className="flex shrink-0 items-center self-stretch pr-1 opacity-0 transition group-hover:opacity-100 has-[[data-state=open]]:opacity-100">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            aria-label="Chat actions"
                            className="inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-[var(--muted)] hover:bg-[#dfe4eb] hover:text-[var(--foreground)] disabled:pointer-events-none disabled:opacity-40"
                            disabled={menuBusy}
                            onClick={(e) => e.stopPropagation()}
                            type="button"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuPortal>
                          <DropdownMenuContent
                            align="end"
                            sideOffset={4}
                          >
                            <DropdownMenuItem
                              disabled={menuBusy}
                              onSelect={() => {
                                onRenamingChatIdChange(chat.id);
                                setRenameDraft(chat.title);
                              }}
                            >
                              Rename
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              disabled={menuBusy}
                              onSelect={() => onPatchChat({ chatId: chat.id, pinned: !chat.pinned })}
                            >
                              {chat.pinned ? "Unpin chat" : "Pin chat"}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="cursor-pointer rounded-md px-2.5 py-2 text-red-600 outline-none data-[highlighted]:bg-red-50"
                              disabled={menuBusy}
                              onSelect={() => onDeleteChat(chat.id)}
                            >
                              Delete chat
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenuPortal>
                      </DropdownMenu>
                    </div>
                  </>
                )}
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
}
