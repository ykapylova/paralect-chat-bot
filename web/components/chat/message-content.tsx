import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type MessageContentProps = {
  text: string;
};

export function MessageContent({ text }: MessageContentProps) {
  const components: Components = {
    p: ({ children }) => <p className="whitespace-pre-wrap">{children}</p>,
    a: ({ href, children }) => (
      <a
        className="inline-flex cursor-pointer items-center gap-1 font-medium text-[#2563eb] underline decoration-[#2563eb]/40 underline-offset-2 hover:decoration-[#2563eb]"
        href={href}
        rel="noopener noreferrer"
        target="_blank"
      >
        {children}
      </a>
    ),
    img: ({ src, alt }) => (
      <a
        className="block w-fit max-w-full"
        href={typeof src === "string" ? src : "#"}
        rel="noopener noreferrer"
        target="_blank"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- remote signed URLs */}
        <img
          alt={alt || "Image attachment"}
          className="max-h-72 max-w-full rounded-lg border border-[var(--border)] object-contain"
          loading="lazy"
          src={typeof src === "string" ? src : undefined}
        />
      </a>
    ),
    code: ({ className, children }) => {
      const raw = String(children);
      const isBlock = Boolean(className?.includes("language-")) || raw.includes("\n");
      return isBlock ? (
        <code className="block overflow-x-auto whitespace-pre rounded-lg bg-[var(--panel-soft)] p-3 text-[0.92em]">
          {children}
        </code>
      ) : (
        <code className="rounded bg-[var(--panel-soft)] px-1 py-0.5 text-[0.9em]">{children}</code>
      );
    },
    pre: ({ children }) => <>{children}</>,
    ul: ({ children }) => <ul className="list-disc space-y-1 pl-6">{children}</ul>,
    ol: ({ children }) => <ol className="list-decimal space-y-1 pl-6">{children}</ol>,
    blockquote: ({ children }) => (
      <blockquote className="border-l-2 border-[var(--border)] pl-3 text-[var(--muted)]">{children}</blockquote>
    ),
  };

  return (
    <div className="flex flex-col gap-3">
      <ReactMarkdown components={components} remarkPlugins={[remarkGfm]}>
        {text}
      </ReactMarkdown>
    </div>
  );
}
