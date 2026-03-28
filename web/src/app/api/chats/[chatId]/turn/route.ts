import { jsonWithPrincipal, resolveChatPrincipal } from "@/server/auth/chat-principal";
import { chatService } from "@/server/services/chat.service";
import { usageService } from "@/server/services/usage.service";

type RouteContext = {
  params: Promise<{ chatId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const principal = await resolveChatPrincipal(request);

  if (principal.anonSessionId) {
    const allowed = await usageService.hasAnonymousQuota(principal.anonSessionId);
    if (!allowed) {
      await chatService.deleteAllChatsForAnonymousUser(principal.userId);
      return jsonWithPrincipal(
        {
          error: "You have used all free questions. Sign in to continue chatting.",
          code: "FREE_LIMIT_EXCEEDED",
        },
        principal,
        { status: 429 },
      );
    }
  }

  const { chatId } = await context.params;

  try {
    const body = await request.json();
    const result = await chatService.sendTurnWithPlaceholder(chatId, principal.userId, body);

    if (!result) {
      return jsonWithPrincipal({ error: "Chat not found" }, principal, { status: 404 });
    }

    if (principal.anonSessionId) {
      const usage = await usageService.incrementQuestion(principal.anonSessionId);
      const anonymousQuotaExhausted = usage.remainingQuestions === 0;
      if (anonymousQuotaExhausted) {
        await chatService.deleteAllChatsForAnonymousUser(principal.userId);
      }
      return jsonWithPrincipal(
        { data: { ...result, anonymousQuotaExhausted } },
        principal,
      );
    }

    return jsonWithPrincipal({ data: result }, principal);
  } catch {
    return jsonWithPrincipal({ error: "Invalid request payload" }, principal, { status: 400 });
  }
}
