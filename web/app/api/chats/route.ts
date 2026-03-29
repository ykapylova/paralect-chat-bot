import {
  jsonErrWithPrincipal,
  jsonOkWithPrincipal,
  resolveChatPrincipal,
} from "server/auth/chat-principal";
import { notifyChatsSync } from "server/realtime/notify-chats-sync";
import { chatService } from "server/services/chat.service";

export async function GET(request: Request) {
  const principal = await resolveChatPrincipal(request);
  const chats = await chatService.listChats(principal.userId);
  return jsonOkWithPrincipal(principal, chats);
}

export async function POST(request: Request) {
  const principal = await resolveChatPrincipal(request);

  try {
    const body = await request.json();
    const chat = await chatService.createChat(principal.userId, body);
    void notifyChatsSync(principal.userId, { chatId: chat.id });
    return jsonOkWithPrincipal(principal, chat, { status: 201 });
  } catch {
    return jsonErrWithPrincipal(principal, "Invalid request payload", 400);
  }
}
