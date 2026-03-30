import { UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { Menu } from "lucide-react";
import { Button, buttonVariants } from "components/ui/button";
import { cn } from "lib/utils";

type ChatHeaderProps = {
  isGuestMode: boolean;
  showMenu: boolean;
  menuOpen: boolean;
  onToggleSidebar: () => void;
  activeChatId: string | null;
  activeTitle: string;
};

const chatModelLabel =
  process.env.NEXT_PUBLIC_CHAT_MODEL_LABEL?.trim() ||
  process.env.NEXT_PUBLIC_OPENAI_CHAT_MODEL?.trim() ||
  "gpt-4o-mini";

export function ChatHeader({
  isGuestMode,
  showMenu,
  menuOpen,
  onToggleSidebar,
  activeChatId,
  activeTitle,
}: ChatHeaderProps) {
  return (
    <header className="relative z-[50] flex h-14 shrink-0 items-center justify-between border-b border-[var(--border)] bg-[var(--background)] px-4 md:border-b-0">
      <div className="flex items-center gap-2">
        {showMenu ? (
          <Button
            aria-expanded={menuOpen}
            aria-label={menuOpen ? "Close sidebar" : "Open sidebar"}
            className="shrink-0 cursor-pointer rounded-lg"
            onClick={onToggleSidebar}
            size="icon"
            variant="ghost"
          >
            <Menu className="h-5 w-5" strokeWidth={2} />
          </Button>
        ) : null}
        <span className="text-sm font-medium">
          {isGuestMode ? (activeChatId ? activeTitle : "Chat") : activeChatId ? activeTitle : "Chatbot"}
        </span>
      </div>
      <div className="flex items-center gap-2 sm:gap-3">
        <span className="hidden text-xs text-[var(--muted)] sm:inline">{chatModelLabel}</span>
        {isGuestMode ? (
          <Link
            className={cn(buttonVariants({ variant: "outline" }), "cursor-pointer rounded-full px-3 py-1.5")}
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
