import { NextResponse } from "next/server";
import { retrievalService } from "@/server/services/retrieval.service";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const context = retrievalService.findContext(body);
    return NextResponse.json({ data: context });
  } catch {
    return NextResponse.json({ error: "Invalid request payload" }, { status: 400 });
  }
}
