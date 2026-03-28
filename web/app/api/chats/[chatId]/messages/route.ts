import {
  jsonErrWithPrincipal,
  jsonOkWithPrincipal,
  resolveChatPrincipal,
} from "server/auth/chat-principal";
import { chatService } from "server/services/chat.service";

type RouteContext = {
  params: Promise<{ chatId: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const principal = await resolveChatPrincipal(request);
  const { chatId } = await context.params;
  const messages = await chatService.listMessages(chatId, principal.userId);

  if (!messages) {
    return jsonErrWithPrincipal(principal, "Chat not found", 404);
  }

  return jsonOkWithPrincipal(principal, messages);
}

export async function POST(request: Request, context: RouteContext) {
  const principal = await resolveChatPrincipal(request);
  const { chatId } = await context.params;

  try {
    const body = await request.json();
    const message = await chatService.addMessage(chatId, principal.userId, body);

    if (!message) {
      return jsonErrWithPrincipal(principal, "Chat not found", 404);
    }

    return jsonOkWithPrincipal(principal, message, { status: 201 });
  } catch {
    return jsonErrWithPrincipal(principal, "Invalid request payload", 400);
  }
}
