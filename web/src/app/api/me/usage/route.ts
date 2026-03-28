import { NextResponse } from "next/server";
import { usageService } from "@/server/services/usage.service";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const sessionId = url.searchParams.get("sessionId");

  if (!sessionId) {
    return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
  }

  return NextResponse.json({ data: usageService.getUsage(sessionId) });
}
