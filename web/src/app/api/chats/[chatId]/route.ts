import { jsonWithPrincipal, resolveChatPrincipal } from "@/server/auth/chat-principal";
import { notifyChatsSync } from "@/server/realtime/notify-chats-sync";
import { chatService } from "@/server/services/chat.service";

type RouteContext = {
  params: Promise<{ chatId: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const principal = await resolveChatPrincipal(request);
  const { chatId } = await context.params;
  const chat = await chatService.getChatForUser(chatId, principal.userId);

  if (!chat) {
    return jsonWithPrincipal({ error: "Chat not found" }, principal, { status: 404 });
  }

  return jsonWithPrincipal({ data: chat }, principal);
}

export async function PATCH(request: Request, context: RouteContext) {
  const principal = await resolveChatPrincipal(request);
  const { chatId } = await context.params;

  try {
    const body = await request.json();
    const chat = await chatService.renameChat(chatId, principal.userId, body);

    if (!chat) {
      return jsonWithPrincipal({ error: "Chat not found" }, principal, { status: 404 });
    }

    void notifyChatsSync(principal.userId);
    return jsonWithPrincipal({ data: chat }, principal);
  } catch {
    return jsonWithPrincipal({ error: "Invalid request payload" }, principal, { status: 400 });
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const principal = await resolveChatPrincipal(request);
  const { chatId } = await context.params;
  const deleted = await chatService.deleteChat(chatId, principal.userId);

  if (!deleted) {
    return jsonWithPrincipal({ error: "Chat not found" }, principal, { status: 404 });
  }

  void notifyChatsSync(principal.userId);
  return jsonWithPrincipal({ success: true }, principal);
}
