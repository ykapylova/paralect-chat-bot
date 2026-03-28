import { NextResponse } from "next/server";
import { requireUserId } from "@/server/auth/require-user";
import { chatService } from "@/server/services/chat.service";

type RouteContext = {
  params: Promise<{ chatId: string }>;
};

export async function GET(_: Request, context: RouteContext) {
  const authResult = await requireUserId();
  if (authResult instanceof NextResponse) return authResult;

  const { chatId } = await context.params;
  const messages = await chatService.listMessages(chatId, authResult.userId);

  if (!messages) {
    return NextResponse.json({ error: "Chat not found" }, { status: 404 });
  }

  return NextResponse.json({ data: messages });
}

export async function POST(request: Request, context: RouteContext) {
  const authResult = await requireUserId();
  if (authResult instanceof NextResponse) return authResult;

  const { chatId } = await context.params;

  try {
    const body = await request.json();
    const message = await chatService.addMessage(chatId, authResult.userId, body);

    if (!message) {
      return NextResponse.json({ error: "Chat not found" }, { status: 404 });
    }

    return NextResponse.json({ data: message }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Invalid request payload" }, { status: 400 });
  }
}
