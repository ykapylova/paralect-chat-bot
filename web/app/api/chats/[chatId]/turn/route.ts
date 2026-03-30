import {
  jsonErrWithPrincipal,
  resolveChatPrincipal,
} from "server/auth/chat-principal";
import { notifyChatsSync } from "server/realtime/notify-chats-sync";
import { chatRepository } from "server/repositories/chat.repository";
import { chatService } from "server/services/chat.service";
import { createChatCompletionStream } from "server/services/openai-chat.service";
import { deleteOpenAiFile } from "server/services/openai-document-upload.service";
import { isOpenAiConfigured } from "server/env";
import { usageService } from "server/services/usage.service";

type RouteContext = {
  params: Promise<{ chatId: string }>;
};

function sseLine(obj: unknown): string {
  return `data: ${JSON.stringify(obj)}\n\n`;
}

export async function POST(request: Request, context: RouteContext) {
  const principal = await resolveChatPrincipal(request);
  const { chatId } = await context.params;

  if (principal.anonSessionId) {
    const allowed = await usageService.hasAnonymousQuota(principal.anonSessionId);
    if (!allowed) {
      await chatService.deleteAllChatsForAnonymousUser(principal.userId);
      void notifyChatsSync(principal.userId, { chatId });
      return jsonErrWithPrincipal(
        principal,
        "You have used all free questions. Sign in to continue chatting.",
        429,
        { code: "FREE_LIMIT_EXCEEDED" },
      );
    }
  }

  if (!isOpenAiConfigured()) {
    return jsonErrWithPrincipal(principal, "Chat model is not configured.", 503, {
      code: "LLM_UNAVAILABLE",
    });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonErrWithPrincipal(principal, "Invalid request payload", 400);
  }

  let prepared;
  try {
    prepared = await chatService.beginStreamTurn(chatId, principal.userId, body);
  } catch {
    return jsonErrWithPrincipal(principal, "Invalid request payload", 400);
  }

  if (!prepared) {
    return jsonErrWithPrincipal(principal, "Chat not found", 404);
  }

  const { userMessage, assistantMessage, title, openaiMessages, ephemeralOpenAiFileIds } = prepared;
  const assistantId = assistantMessage.id;
  const encoder = new TextEncoder();

  const cleanupOpenAiFiles = async () => {
    await Promise.all(ephemeralOpenAiFileIds.map((id) => deleteOpenAiFile(id)));
  };

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (payload: unknown) => {
        controller.enqueue(encoder.encode(sseLine(payload)));
      };

      try {
        send({ type: "start", userMessage, assistantMessage, title });

        let completionStream;
        try {
          completionStream = await createChatCompletionStream(openaiMessages);
        } catch (err) {
          await cleanupOpenAiFiles();
          const msg = err instanceof Error ? err.message : "Model request failed";
          await chatRepository.updateMessageContent(
            assistantId,
            chatId,
            `Sorry, something went wrong: ${msg}`,
          );
          send({ type: "error", message: msg });
          void notifyChatsSync(principal.userId, { chatId });
          return;
        }

        let full = "";
        try {
          for await (const chunk of completionStream) {
            const piece = chunk.choices[0]?.delta?.content ?? "";
            if (piece) {
              full += piece;
              send({ type: "delta", text: piece });
            }
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Stream interrupted";
          const fallback = full.trim()
            ? `${full.trim()}\n\n_(Stream ended: ${msg})_`
            : `Sorry, something went wrong: ${msg}`;
          await chatRepository.updateMessageContent(assistantId, chatId, fallback);
          send({ type: "error", message: msg });
          void notifyChatsSync(principal.userId, { chatId });
          return;
        } finally {
          await cleanupOpenAiFiles();
        }

        const normalized = full.trim() || "(No response)";
        const finalAssistant = await chatRepository.updateMessageContent(
          assistantId,
          chatId,
          normalized,
        );

        let anonymousQuotaExhausted = false;
        if (principal.anonSessionId) {
          const usage = await usageService.incrementQuestion(principal.anonSessionId);
          anonymousQuotaExhausted = usage.remainingQuestions === 0;
          if (anonymousQuotaExhausted) {
            await chatService.deleteAllChatsForAnonymousUser(principal.userId);
          }
        }

        void notifyChatsSync(principal.userId, { chatId });

        if (finalAssistant) {
          send({
            type: "done",
            assistantMessage: finalAssistant,
            title,
            anonymousQuotaExhausted,
          });
        } else {
          send({ type: "error", message: "Failed to save assistant message" });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unexpected error";
        await chatRepository.updateMessageContent(
          assistantId,
          chatId,
          `Sorry, something went wrong: ${msg}`,
        );
        send({ type: "error", message: msg });
        void notifyChatsSync(principal.userId, { chatId });
      } finally {
        controller.close();
      }
    },
  });

  const headers = new Headers({
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  if (principal.setCookie) {
    headers.append("Set-Cookie", principal.setCookie);
  }

  return new Response(stream, { headers });
}
