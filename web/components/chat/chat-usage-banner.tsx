import Link from "next/link";
import type { MeUsageData } from "lib/api-types/chat";

type ChatUsageBannerProps = {
  usage: MeUsageData | undefined;
};

export function ChatUsageBanner({ usage }: ChatUsageBannerProps) {
  if (!usage?.isAnonymous || usage.freeLimit == null) return null;

  return (
    <div className="border-b border-[var(--border)] bg-[var(--panel-soft)] px-4 py-2 text-center text-sm text-[var(--foreground)]">
      {usage.remainingQuestions != null && usage.remainingQuestions > 0 ? (
        <span>
          {usage.remainingQuestions} free {usage.remainingQuestions === 1 ? "question" : "questions"} left ·{" "}
          <Link className="font-medium underline underline-offset-2" href="/sign-in">
            Sign in
          </Link>{" "}
          for unlimited access
        </span>
      ) : (
        <span>
          You&apos;ve used all {usage.freeLimit} free questions.{" "}
          <Link className="font-medium underline underline-offset-2" href="/sign-in">
            Sign in
          </Link>{" "}
          to continue chatting.
        </span>
      )}
    </div>
  );
}
