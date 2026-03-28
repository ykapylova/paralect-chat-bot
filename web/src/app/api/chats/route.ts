import { NextResponse } from "next/server";
import { chatService } from "@/server/services/chat.service";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const userId = url.searchParams.get("userId");

  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  const chats = await chatService.listChats(userId);
  return NextResponse.json({ data: chats });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const chat = await chatService.createChat(body);
    return NextResponse.json({ data: chat }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Invalid request payload" }, { status: 400 });
  }
}
