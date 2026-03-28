import { Plus, Search } from "lucide-react";
import type { Chat as ApiChat } from "@/server/types/chat";
import { formatChatSubtitle } from "./chat-format";

type ChatSidebarProps = {
  chats: ApiChat[];
  activeChatId: string | null;
  isBootLoading: boolean;
  createPending: boolean;
  onNewChat: () => void;
  onSelectChat: (id: string) => void;
};

export function ChatSidebar({
  chats,
  activeChatId,
  isBootLoading,
  createPending,
  onNewChat,
  onSelectChat,
}: ChatSidebarProps) {
  return (
    <aside className="hidden w-[280px] shrink-0 border-r border-[var(--border)] bg-[var(--panel-soft)] p-3 md:block">
      <button
        className="mb-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--panel)] px-3 py-2 text-sm font-medium transition hover:bg-[#f9fafb] disabled:opacity-50"
        disabled={createPending}
        onClick={onNewChat}
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
        ) : chats.length === 0 ? (
          <p className="px-2 text-sm text-[var(--muted)]">No chats yet. Create one to start.</p>
        ) : (
          chats.map((chat) => {
            const isActive = chat.id === activeChatId;
            return (
              <button
                key={chat.id}
                className={`w-full rounded-lg px-2 py-2 text-left transition ${
                  isActive ? "bg-[#e8ecf2]" : "hover:bg-[#eceff3]"
                }`}
                onClick={() => onSelectChat(chat.id)}
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
  );
}
