import { NextResponse } from "next/server";
import { uploadService } from "@/server/services/upload.service";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const image = uploadService.registerImage(body);
    return NextResponse.json({ data: image }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Invalid request payload" }, { status: 400 });
  }
}
