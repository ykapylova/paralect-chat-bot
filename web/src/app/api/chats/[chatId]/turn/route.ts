import { NextResponse } from "next/server";
import { requireUserId } from "@/server/auth/require-user";
import { chatService } from "@/server/services/chat.service";

type RouteContext = {
  params: Promise<{ chatId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const authResult = await requireUserId();
  if (authResult instanceof NextResponse) return authResult;

  const { chatId } = await context.params;

  try {
    const body = await request.json();
    const result = await chatService.sendTurnWithPlaceholder(chatId, authResult.userId, body);

    if (!result) {
      return NextResponse.json({ error: "Chat not found" }, { status: 404 });
    }

    return NextResponse.json({ data: result });
  } catch {
    return NextResponse.json({ error: "Invalid request payload" }, { status: 400 });
  }
}
