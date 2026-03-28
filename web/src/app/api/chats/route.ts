import { jsonWithPrincipal, resolveChatPrincipal } from "@/server/auth/chat-principal";
import { chatService } from "@/server/services/chat.service";

export async function GET(request: Request) {
  const principal = await resolveChatPrincipal(request);
  const chats = await chatService.listChats(principal.userId);
  return jsonWithPrincipal({ data: chats }, principal);
}

export async function POST(request: Request) {
  const principal = await resolveChatPrincipal(request);

  try {
    const body = await request.json();
    const chat = await chatService.createChat(principal.userId, body);
    return jsonWithPrincipal({ data: chat }, principal, { status: 201 });
  } catch {
    return jsonWithPrincipal({ error: "Invalid request payload" }, principal, { status: 400 });
  }
}
