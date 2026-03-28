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

  return NextResponse.json({ data: chat });
}

export async function PATCH(request: Request, context: RouteContext) {
  const { chatId } = await context.params;

  try {
    const body = await request.json();
    const chat = await chatService.renameChat(chatId, body);

    if (!chat) {
      return NextResponse.json({ error: "Chat not found" }, { status: 404 });
    }

    return NextResponse.json({ data: chat });
  } catch {
    return NextResponse.json({ error: "Invalid request payload" }, { status: 400 });
  }
}

export async function DELETE(_: Request, context: RouteContext) {
  const { chatId } = await context.params;
  const deleted = await chatService.deleteChat(chatId);

  if (!deleted) {
    return NextResponse.json({ error: "Chat not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
