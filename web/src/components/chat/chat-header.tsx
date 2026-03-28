import { UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { Menu } from "lucide-react";

type ChatHeaderProps = {
  isGuestMode: boolean;
  showMenu: boolean;
  onToggleSidebar: () => void;
  activeChatId: string | null;
  activeTitle: string;
};

export function ChatHeader({
  isGuestMode,
  showMenu,
  onToggleSidebar,
  activeChatId,
  activeTitle,
}: ChatHeaderProps) {
  return (
    <header className="flex h-14 items-center justify-between px-4">
      <div className="flex items-center gap-2">
        {showMenu ? (
          <button
            className="rounded-lg p-2 text-[var(--muted)] transition hover:bg-[#eceff3] hover:text-[var(--foreground)]"
            onClick={onToggleSidebar}
            type="button"
          >
            <Menu className="h-5 w-5" />
          </button>
        ) : null}
        <span className="text-sm font-medium">
          {isGuestMode ? (activeChatId ? activeTitle : "Chat") : activeChatId ? activeTitle : "Chatbot"}
        </span>
      </div>
      <div className="flex items-center gap-2 sm:gap-3">
        <span className="hidden text-xs text-[var(--muted)] sm:inline">GPT-4.1 mini</span>
        {isGuestMode ? (
          <Link
            className="rounded-full border border-[var(--border)] bg-[var(--panel)] px-3 py-1.5 text-sm font-medium text-[var(--foreground)] transition hover:bg-[#eceff3]"
            href="/sign-in"
          >
            Sign in
          </Link>
        ) : null}
        <UserButton />
      </div>
    </header>
  );
}
