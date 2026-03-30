import type { Chat as ApiChat, ChatWithMessages } from "server/types/chat";
import type { MeUsageData } from "lib/api-types/chat";
import type { ChatUploadResult } from "lib/api-types/upload";
import { shouldTreatUserFileAsImage } from "./file-upload-config";
import { apiPaths } from "./api-paths";

const jsonHeaders = { "Content-Type": "application/json" };

export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

export async function readApiError(res: Response): Promise<ApiError> {
  const json: unknown = await res.json().catch(() => ({}));
  return new ApiError(await parseError(res, json), res.status, readErrorCode(json));
}

async function parseError(res: Response, json: unknown): Promise<string> {
  if (json && typeof json === "object" && "error" in json && typeof (json as { error: string }).error === "string") {
    return (json as { error: string }).error;
  }
  return `Request failed (${res.status})`;
}

function readErrorCode(json: unknown): string | undefined {
  if (!json || typeof json !== "object") return undefined;
  if ("code" in json && typeof (json as { code: unknown }).code === "string") {
    return (json as { code: string }).code;
  }
  return undefined;
}

async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(path, { credentials: "include" });
  const json: unknown = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(await parseError(res, json), res.status, readErrorCode(json));
  }
  if (!json || typeof json !== "object" || !("data" in json)) {
    throw new Error("Invalid API response");
  }
  return (json as { data: T }).data;
}

async function apiUploadFile<T>(path: string, file: File): Promise<T> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(path, {
    method: "POST",
    body: formData,
    credentials: "include",
  });
  const json: unknown = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(await parseError(res, json), res.status, readErrorCode(json));
  }
  if (!json || typeof json !== "object" || !("data" in json)) {
    throw new Error("Invalid API response");
  }
  return (json as { data: T }).data;
}

async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    credentials: "include",
    headers: jsonHeaders,
    body: JSON.stringify(body),
  });
  const json: unknown = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(await parseError(res, json), res.status, readErrorCode(json));
  }
  if (!json || typeof json !== "object" || !("data" in json)) {
    throw new Error("Invalid API response");
  }
  return (json as { data: T }).data;
}

async function apiPatch<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: "PATCH",
    credentials: "include",
    headers: jsonHeaders,
    body: JSON.stringify(body),
  });
  const json: unknown = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(await parseError(res, json), res.status, readErrorCode(json));
  }
  if (!json || typeof json !== "object" || !("data" in json)) {
    throw new Error("Invalid API response");
  }
  return (json as { data: T }).data;
}

async function apiDelete(path: string): Promise<void> {
  const res = await fetch(path, { method: "DELETE", credentials: "include" });
  const json: unknown = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(await parseError(res, json), res.status, readErrorCode(json));
  }
  if (
    !json ||
    typeof json !== "object" ||
    !("success" in json) ||
    (json as { success: unknown }).success !== true
  ) {
    throw new Error("Invalid API response");
  }
}

export async function getChats(): Promise<ApiChat[]> {
  return apiGet<ApiChat[]>(apiPaths.chats());
}

export async function getMeUsage(): Promise<MeUsageData> {
  return apiGet<MeUsageData>(apiPaths.meUsage());
}

export async function getChatWithMessages(chatId: string): Promise<ChatWithMessages> {
  return apiGet<ChatWithMessages>(apiPaths.chat(chatId));
}

export async function createChat(): Promise<ApiChat> {
  return apiPost<ApiChat>(apiPaths.chats(), {});
}

export async function patchChat(
  chatId: string,
  body: { title?: string; pinned?: boolean },
): Promise<ApiChat> {
  return apiPatch<ApiChat>(apiPaths.chat(chatId), body);
}

export async function deleteChat(chatId: string): Promise<void> {
  return apiDelete(apiPaths.chat(chatId));
}

export type PostChatTurnBody = {
  content: string;
  renameTitle?: string;
};

export async function postChatTurn(chatId: string, body: PostChatTurnBody): Promise<Response> {
  const res = await fetch(apiPaths.chatTurn(chatId), {
    method: "POST",
    credentials: "include",
    headers: jsonHeaders,
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw await readApiError(res);
  }
  return res;
}

export async function uploadChatImage(file: File): Promise<ChatUploadResult> {
  return apiUploadFile<ChatUploadResult>(apiPaths.uploadImage(), file);
}

export async function uploadChatDocument(file: File): Promise<ChatUploadResult> {
  return apiUploadFile<ChatUploadResult>(apiPaths.uploadDocument(), file);
}

export async function uploadChatUserPickedFile(file: File): Promise<ChatUploadResult> {
  return shouldTreatUserFileAsImage(file) ? uploadChatImage(file) : uploadChatDocument(file);
}
