import { NextResponse } from "next/server";
import { chatService } from "@/server/services/chat.service";

type RouteContext = {
  params: Promise<{ chatId: string }>;
};

export async function GET(_: Request, context: RouteContext) {
  const { chatId } = await context.params;
  const chat = await chatService.getChat(chatId);

  if (!chat) {
    return NextResponse.json({ error: "Chat not found" }, { status: 404 });
  }

  return NextResponse.json({ data: await chatService.listMessages(chatId) });
}

export async function POST(request: Request, context: RouteContext) {
  const { chatId } = await context.params;
  const chat = await chatService.getChat(chatId);

  if (!chat) {
    return NextResponse.json({ error: "Chat not found" }, { status: 404 });
  }

  try {
    const body = await request.json();
    const message = await chatService.addMessage(chatId, body);

    if (!message) {
      return NextResponse.json({ error: "Unable to add message" }, { status: 400 });
    }

    return NextResponse.json({ data: message }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Invalid request payload" }, { status: 400 });
  }
}
