import { NextResponse } from "next/server";

import {
  jsonErrWithPrincipal,
  jsonOkWithPrincipal,
  resolveChatPrincipal,
} from "server/auth/chat-principal";
import { UploadValidationError, uploadService } from "server/services/upload.service";

export async function handleChatFileUpload(
  request: Request,
  kind: "image" | "document",
): Promise<NextResponse> {
  const principal = await resolveChatPrincipal(request);

  if (!uploadService.isConfigured()) {
    return jsonErrWithPrincipal(principal, "File storage is not configured.", 503, {
      code: "STORAGE_UNAVAILABLE",
    });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return jsonErrWithPrincipal(principal, "Expected multipart form data", 400);
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return jsonErrWithPrincipal(principal, "Missing file field", 400);
  }

  try {
    const data =
      kind === "image"
        ? await uploadService.storeImage(file, principal.userId)
        : await uploadService.storeDocument(file, principal.userId);
    return jsonOkWithPrincipal(principal, data, { status: 201 });
  } catch (err) {
    if (err instanceof UploadValidationError) {
      return jsonErrWithPrincipal(principal, err.message, 400, { code: err.code });
    }
    const msg = err instanceof Error ? err.message : "Upload failed";
    return jsonErrWithPrincipal(principal, msg, 500);
  }
}
