import {
  jsonAckWithPrincipal,
  jsonErrWithPrincipal,
  jsonOkWithPrincipal,
  resolveChatPrincipal,
} from "@/server/auth/chat-principal";
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
    return jsonErrWithPrincipal(principal, "Chat not found", 404);
  }

  return jsonOkWithPrincipal(principal, chat);
}

export async function PATCH(request: Request, context: RouteContext) {
  const principal = await resolveChatPrincipal(request);
  const { chatId } = await context.params;

  try {
    const body = await request.json();
    const chat = await chatService.patchChat(chatId, principal.userId, body);

    if (!chat) {
      return jsonErrWithPrincipal(principal, "Chat not found", 404);
    }

    void notifyChatsSync(principal.userId);
    return jsonOkWithPrincipal(principal, chat);
  } catch {
    return jsonErrWithPrincipal(principal, "Invalid request payload", 400);
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const principal = await resolveChatPrincipal(request);
  const { chatId } = await context.params;
  const deleted = await chatService.deleteChat(chatId, principal.userId);

  if (!deleted) {
    return jsonErrWithPrincipal(principal, "Chat not found", 404);
  }

  void notifyChatsSync(principal.userId);
  return jsonAckWithPrincipal(principal);
}
