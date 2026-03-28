import { NextResponse } from "next/server";
import { requireUserId } from "@/server/auth/require-user";
import { retrievalService } from "@/server/services/retrieval.service";

export async function POST(request: Request) {
  const authResult = await requireUserId();
  if (authResult instanceof NextResponse) return authResult;

  try {
    const body = await request.json();
    const context = retrievalService.findContext(body);
    return NextResponse.json({ data: context });
  } catch {
    return NextResponse.json({ error: "Invalid request payload" }, { status: 400 });
  }
}
