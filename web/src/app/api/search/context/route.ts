import { NextResponse } from "next/server";

import { requireUserId } from "@/server/auth/require-user";
import { jsonErr, jsonOk } from "@/server/http/json-api";
import { retrievalService } from "@/server/services/retrieval.service";

export async function POST(request: Request) {
  const authResult = await requireUserId();
  if (authResult instanceof NextResponse) return authResult;

  try {
    const body = await request.json();
    const context = retrievalService.findContext(body);
    return jsonOk(context);
  } catch {
    return jsonErr("Invalid request payload", 400);
  }
}
