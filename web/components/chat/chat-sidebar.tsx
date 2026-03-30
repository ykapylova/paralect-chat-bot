"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { MoreVertical, Pin, Plus, Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Chat as ApiChat } from "server/types/chat";
import { CHAT_AUTO_TITLE_MAX_LENGTH } from "lib/chat-ui-constants";
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
      <button
        className="mb-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--panel)] px-3 py-2 text-sm font-medium transition hover:bg-[#f9fafb] disabled:opacity-50"
        disabled={createPending}
        onClick={onNewChat}
        type="button"
      >
        <Plus className="h-4 w-4" />
        New chat
      </button>

      <div className="relative mb-3 rounded-xl border border-[var(--border)] bg-[var(--panel)] shadow-[0_2px_14px_rgba(0,0,0,0.04)] transition focus-within:border-[#c9d0dd] focus-within:shadow-[0_6px_24px_rgba(0,0,0,0.08)]">
        <Search
          aria-hidden
          className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[var(--muted)] opacity-80"
        />
        <input
          aria-label="Search chats"
          className={`w-full rounded-xl border-0 bg-transparent py-2.5 pl-10 text-[15px] leading-5 text-[var(--foreground)] outline-none ring-0 placeholder:text-[var(--muted)] placeholder:opacity-90 [&::-webkit-search-cancel-button]:appearance-none ${searchQuery ? "pr-11" : "pr-3"}`}
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
          <button
            aria-label="Clear search"
            className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-[var(--muted)] transition hover:bg-[#eceff3] hover:text-[var(--foreground)]"
            onClick={() => setSearchQuery("")}
            type="button"
          >
            <X className="h-3.5 w-3.5" strokeWidth={2.25} />
          </button>
        ) : null}
      </div>

      <p className="px-2 pb-2 text-xs font-medium text-[var(--muted)]">
        {searchQuery.trim() ? "Matching chats" : "Your chats"}
      </p>
      <div className="space-y-1">
        {isBootLoading ? (
          <p className="px-2 text-sm text-[var(--muted)]">Loading chats…</p>
        ) : chats.length === 0 ? (
          <p className="px-2 text-sm text-[var(--muted)]">No chats yet. Create one to start.</p>
        ) : filteredChats.length === 0 ? (
          <p className="px-2 text-sm text-[var(--muted)]">No chats match &ldquo;{searchQuery.trim()}&rdquo;.</p>
        ) : (
          filteredChats.map((chat) => {
            const isActive = chat.id === activeChatId;
            const isRenaming = renamingChatId === chat.id;

            return (
              <div
                key={chat.id}
                className={`group relative flex w-full items-stretch gap-0.5 rounded-lg transition ${
                  isActive ? "bg-[#e8ecf2]" : "hover:bg-[#eceff3]"
                }`}
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
                      className="min-w-0 flex-1 px-2 py-2 text-left"
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
                    <div className="flex shrink-0 items-start pt-1 pr-1 opacity-0 transition group-hover:opacity-100 has-[[data-state=open]]:opacity-100">
                      <DropdownMenu.Root>
                        <DropdownMenu.Trigger asChild>
                          <button
                            aria-label="Chat actions"
                            className="rounded-md p-1.5 text-[var(--muted)] transition hover:bg-[#dfe4eb] hover:text-[var(--foreground)] disabled:pointer-events-none disabled:opacity-40"
                            disabled={menuBusy}
                            onClick={(e) => e.stopPropagation()}
                            type="button"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </button>
                        </DropdownMenu.Trigger>
                        <DropdownMenu.Portal>
                          <DropdownMenu.Content
                            align="end"
                            className="z-[100] min-w-[168px] rounded-lg border border-[var(--border)] bg-[var(--panel)] p-1 text-sm shadow-[0_12px_40px_rgba(0,0,0,0.12)]"
                            sideOffset={4}
                          >
                            <DropdownMenu.Item
                              className="cursor-pointer rounded-md px-2.5 py-2 outline-none data-[highlighted]:bg-[#eceff3]"
                              disabled={menuBusy}
                              onSelect={() => {
                                onRenamingChatIdChange(chat.id);
                                setRenameDraft(chat.title);
                              }}
                            >
                              Rename
                            </DropdownMenu.Item>
                            <DropdownMenu.Item
                              className="cursor-pointer rounded-md px-2.5 py-2 outline-none data-[highlighted]:bg-[#eceff3]"
                              disabled={menuBusy}
                              onSelect={() => onPatchChat({ chatId: chat.id, pinned: !chat.pinned })}
                            >
                              {chat.pinned ? "Unpin chat" : "Pin chat"}
                            </DropdownMenu.Item>
                            <DropdownMenu.Separator className="my-1 h-px bg-[var(--border)]" />
                            <DropdownMenu.Item
                              className="cursor-pointer rounded-md px-2.5 py-2 text-red-600 outline-none data-[highlighted]:bg-red-50"
                              disabled={menuBusy}
                              onSelect={() => onDeleteChat(chat.id)}
                            >
                              Delete chat
                            </DropdownMenu.Item>
                          </DropdownMenu.Content>
                        </DropdownMenu.Portal>
                      </DropdownMenu.Root>
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
