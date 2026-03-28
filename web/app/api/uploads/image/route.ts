import { NextResponse } from "next/server";

import { requireUserId } from "server/auth/require-user";
import { jsonErr, jsonOk } from "server/http/json-api";
import { uploadService } from "server/services/upload.service";

export async function POST(request: Request) {
  const authResult = await requireUserId();
  if (authResult instanceof NextResponse) return authResult;

  try {
    const body = await request.json();
    const image = uploadService.registerImage(body);
    return jsonOk(image, { status: 201 });
  } catch {
    return jsonErr("Invalid request payload", 400);
  }
}
