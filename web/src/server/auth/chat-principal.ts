import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const ANON_COOKIE = "anon_session";
export const ANON_USER_PREFIX = "anon:";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export type ChatPrincipal = {
  userId: string;
  anonSessionId: string | null;
  setCookie: string | null;
};

function buildAnonSessionCookie(sessionId: string): string {
  const segments = [
    `${ANON_COOKIE}=${sessionId}`,
    "Path=/",
    `Max-Age=${COOKIE_MAX_AGE}`,
    "SameSite=Lax",
    "HttpOnly",
  ];
  if (process.env.NODE_ENV === "production") {
    segments.push("Secure");
  }
  return segments.join("; ");
}

function parseCookieHeader(header: string | null): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    try {
      out[key] = decodeURIComponent(value);
    } catch {
      out[key] = value;
    }
  }
  return out;
}

/**
 * Clerk user id when signed in; otherwise stable anonymous id backed by HttpOnly cookie.
 */
export async function resolveChatPrincipal(request: Request): Promise<ChatPrincipal> {
  const { userId: clerkId } = await auth();
  if (clerkId) {
    return { userId: clerkId, anonSessionId: null, setCookie: null };
  }

  const cookies = parseCookieHeader(request.headers.get("cookie"));
  let sessionId = cookies[ANON_COOKIE]?.trim();
  let setCookie: string | null = null;

  if (!sessionId || sessionId.length < 8) {
    sessionId = crypto.randomUUID();
    setCookie = buildAnonSessionCookie(sessionId);
  }

  return {
    userId: `${ANON_USER_PREFIX}${sessionId}`,
    anonSessionId: sessionId,
    setCookie,
  };
}

export function withPrincipalCookies(
  response: NextResponse,
  principal: ChatPrincipal,
): NextResponse {
  if (principal.setCookie) {
    response.headers.append("Set-Cookie", principal.setCookie);
  }
  return response;
}

export function jsonWithPrincipal(
  body: unknown,
  principal: ChatPrincipal,
  init?: ResponseInit,
): NextResponse {
  return withPrincipalCookies(NextResponse.json(body, init), principal);
}
