import { NextResponse } from "next/server";
import { requireUserId } from "@/server/auth/require-user";
import { chatService } from "@/server/services/chat.service";

export async function GET() {
  const authResult = await requireUserId();
  if (authResult instanceof NextResponse) return authResult;

  const chats = await chatService.listChats(authResult.userId);
  return NextResponse.json({ data: chats });
}

export async function POST(request: Request) {
  const authResult = await requireUserId();
  if (authResult instanceof NextResponse) return authResult;

  try {
    const body = await request.json();
    const chat = await chatService.createChat(authResult.userId, body);
    return NextResponse.json({ data: chat }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Invalid request payload" }, { status: 400 });
  }
}
