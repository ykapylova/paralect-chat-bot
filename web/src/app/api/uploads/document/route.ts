import { NextResponse } from "next/server";
import { requireUserId } from "@/server/auth/require-user";
import { uploadService } from "@/server/services/upload.service";

export async function POST(request: Request) {
  const authResult = await requireUserId();
  if (authResult instanceof NextResponse) return authResult;

  try {
    const body = await request.json();
    const document = uploadService.registerDocument(body);
    return NextResponse.json({ data: document }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Invalid request payload" }, { status: 400 });
  }
}
