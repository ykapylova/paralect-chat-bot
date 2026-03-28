import {
  jsonErrWithPrincipal,
  jsonOkWithPrincipal,
  resolveChatPrincipal,
} from "server/auth/chat-principal";
import { notifyChatsSync } from "server/realtime/notify-chats-sync";
import { chatService } from "server/services/chat.service";
import { usageService } from "server/services/usage.service";

type RouteContext = {
  params: Promise<{ chatId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const principal = await resolveChatPrincipal(request);

  if (principal.anonSessionId) {
    const allowed = await usageService.hasAnonymousQuota(principal.anonSessionId);
    if (!allowed) {
      await chatService.deleteAllChatsForAnonymousUser(principal.userId);
      void notifyChatsSync(principal.userId);
      return jsonErrWithPrincipal(
        principal,
        "You have used all free questions. Sign in to continue chatting.",
        429,
        { code: "FREE_LIMIT_EXCEEDED" },
      );
    }
  }

  const { chatId } = await context.params;

  try {
    const body = await request.json();
    const result = await chatService.sendTurnWithPlaceholder(chatId, principal.userId, body);

    if (!result) {
      return jsonErrWithPrincipal(principal, "Chat not found", 404);
    }

    if (principal.anonSessionId) {
      const usage = await usageService.incrementQuestion(principal.anonSessionId);
      const anonymousQuotaExhausted = usage.remainingQuestions === 0;
      if (anonymousQuotaExhausted) {
        await chatService.deleteAllChatsForAnonymousUser(principal.userId);
      }
      void notifyChatsSync(principal.userId);
      return jsonOkWithPrincipal(principal, { ...result, anonymousQuotaExhausted });
    }

    void notifyChatsSync(principal.userId);
    return jsonOkWithPrincipal(principal, result);
  } catch {
    return jsonErrWithPrincipal(principal, "Invalid request payload", 400);
  }
}
