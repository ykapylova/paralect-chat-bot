import { handleChatFileUpload } from "server/http/handle-chat-upload";

export async function POST(request: Request) {
  return handleChatFileUpload(request, "image");
}
