import { jsonOkWithPrincipal, resolveChatPrincipal } from "@/server/auth/chat-principal";
import { usageService } from "@/server/services/usage.service";

export async function GET(request: Request) {
  const principal = await resolveChatPrincipal(request);

  if (principal.anonSessionId) {
    const usage = await usageService.getUsage(principal.anonSessionId);
    return jsonOkWithPrincipal(principal, {
      ...usage,
      isAnonymous: true,
    });
  }

  return jsonOkWithPrincipal(principal, {
    sessionId: null,
    freeLimit: null,
    usedQuestions: null,
    remainingQuestions: null,
    isAnonymous: false,
  });
}
