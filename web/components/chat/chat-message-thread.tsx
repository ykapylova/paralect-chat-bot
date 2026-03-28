import { Bot, User } from "lucide-react";
import type { UiMessage } from "./chat-types";

type ChatMessageThreadProps = {
  activeChatId: string | null;
  isGuestMode: boolean;
  isBootLoading: boolean;
  isChatLoading: boolean;
  messages: UiMessage[];
  anonFreeLimitReached: boolean;
};

export function ChatMessageThread({
  activeChatId,
  isGuestMode,
  isBootLoading,
  isChatLoading,
  messages,
  anonFreeLimitReached,
}: ChatMessageThreadProps) {
  return (
    <section className="flex-1 overflow-y-auto px-4 pb-32 pt-6">
      {!activeChatId ? (
        isGuestMode && isBootLoading ? (
          <div className="mx-auto max-w-3xl px-2 pt-10 text-sm text-[var(--muted)]">Loading…</div>
        ) : (
          <div className="mx-auto mt-20 flex max-w-3xl flex-col items-center text-center">
            <h1 className="text-3xl font-medium tracking-tight md:text-4xl">What are you working on?</h1>
            <p className="mt-3 text-sm text-[var(--muted)]">
              {anonFreeLimitReached
                ? "You've used your free questions. Sign in from the header to keep chatting."
                : "Ask anything in this chat — sign in later for history and more chats."}
            </p>
          </div>
        )
      ) : isChatLoading ? (
        <div className="mx-auto max-w-3xl px-2 text-sm text-[var(--muted)]">Loading messages…</div>
      ) : messages.length === 0 ? (
        <div className="mx-auto mt-20 flex max-w-3xl flex-col items-center text-center">
          <h1 className="text-3xl font-medium tracking-tight md:text-4xl">What are you working on?</h1>
          <p className="mt-3 text-sm text-[var(--muted)]">
            {anonFreeLimitReached
              ? "You've used your free questions. Sign in to send more messages."
              : "Ask anything. Upload docs and images to enrich context."}
          </p>
        </div>
      ) : (
        <div className="mx-auto flex max-w-3xl flex-col gap-6">
          {messages.map((message) => (
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
  );
}
