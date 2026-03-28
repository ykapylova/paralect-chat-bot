import { jsonWithPrincipal, resolveChatPrincipal } from "@/server/auth/chat-principal";
import { chatService } from "@/server/services/chat.service";

type RouteContext = {
  params: Promise<{ chatId: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const principal = await resolveChatPrincipal(request);
  const { chatId } = await context.params;
  const messages = await chatService.listMessages(chatId, principal.userId);

  if (!messages) {
    return jsonWithPrincipal({ error: "Chat not found" }, principal, { status: 404 });
  }

  return jsonWithPrincipal({ data: messages }, principal);
}

export async function POST(request: Request, context: RouteContext) {
  const principal = await resolveChatPrincipal(request);
  const { chatId } = await context.params;

  try {
    const body = await request.json();
    const message = await chatService.addMessage(chatId, principal.userId, body);

    if (!message) {
      return jsonWithPrincipal({ error: "Chat not found" }, principal, { status: 404 });
    }

    return jsonWithPrincipal({ data: message }, principal, { status: 201 });
  } catch {
    return jsonWithPrincipal({ error: "Invalid request payload" }, principal, { status: 400 });
  }
}
