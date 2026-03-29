import type { ReactNode } from "react";

type Segment =
  | { type: "text"; value: string }
  | { type: "image"; alt: string; url: string }
  | { type: "link"; label: string; url: string };

/**
 * Parses `![alt](url)` and `[label](url)` (not preceded by `!`) into segments.
 * Plain text stays as-is so assistant replies still render normally.
 */
function parseMessageSegments(raw: string): Segment[] {
  const hits: { start: number; end: number; seg: Segment }[] = [];

  const imgRe = /!\[([^\]]*)\]\(([^)]+)\)/g;
  let m: RegExpExecArray | null;
  while ((m = imgRe.exec(raw)) !== null) {
    hits.push({
      start: m.index,
      end: m.index + m[0].length,
      seg: { type: "image", alt: m[1], url: m[2] },
    });
  }

  const linkRe = /\[([^\]]+)\]\(([^)]+)\)/g;
  while ((m = linkRe.exec(raw)) !== null) {
    if (m.index > 0 && raw[m.index - 1] === "!") continue;
    hits.push({
      start: m.index,
      end: m.index + m[0].length,
      seg: { type: "link", label: m[1], url: m[2] },
    });
  }

  hits.sort((a, b) => a.start - b.start);

  const segments: Segment[] = [];
  let cursor = 0;
  for (const hit of hits) {
    if (hit.start < cursor) continue;
    if (hit.start > cursor) {
      segments.push({ type: "text", value: raw.slice(cursor, hit.start) });
    }
    segments.push(hit.seg);
    cursor = hit.end;
  }
  if (cursor < raw.length) {
    segments.push({ type: "text", value: raw.slice(cursor) });
  }

  return segments;
}

type MessageContentProps = {
  text: string;
};

export function MessageContent({ text }: MessageContentProps) {
  const segments = parseMessageSegments(text);
  const hasRich = segments.some((s) => s.type !== "text");

  if (!hasRich) {
    return <p className="whitespace-pre-wrap">{text}</p>;
  }

  const nodes: ReactNode[] = [];
  segments.forEach((s, i) => {
    if (s.type === "text") {
      if (s.value) {
        nodes.push(
          <span key={i} className="whitespace-pre-wrap">
            {s.value}
          </span>,
        );
      }
      return;
    }
    if (s.type === "image") {
      nodes.push(
        <a
          key={i}
          className="block w-fit max-w-full"
          href={s.url}
          rel="noopener noreferrer"
          target="_blank"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- remote signed URLs */}
          <img
            alt={s.alt || "Image attachment"}
            className="max-h-72 max-w-full rounded-lg border border-[var(--border)] object-contain"
            loading="lazy"
            src={s.url}
          />
        </a>,
      );
      return;
    }
    nodes.push(
      <a
        key={i}
        className="inline-flex items-center gap-1 font-medium text-[#2563eb] underline decoration-[#2563eb]/40 underline-offset-2 hover:decoration-[#2563eb]"
        href={s.url}
        rel="noopener noreferrer"
        target="_blank"
      >
        {s.label}
      </a>,
    );
  });

  return <div className="flex flex-col gap-3">{nodes}</div>;
}
