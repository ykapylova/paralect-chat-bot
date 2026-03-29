import { createClient } from "@supabase/supabase-js";
import {
  CHATS_SYNC_EVENT,
  type ChatsSyncPayload,
  chatsSyncChannelName,
} from "lib/realtime/chats-sync-channel";

export async function notifyChatsSync(
  principalUserId: string,
  extra?: Pick<ChatsSyncPayload, "chatId">,
): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return;

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const channel = supabase.channel(chatsSyncChannelName(principalUserId));

  const payload: ChatsSyncPayload = { at: Date.now(), ...extra };

  try {
    const result = await channel.httpSend(CHATS_SYNC_EVENT, payload);
    if (!result.success) {
      console.warn("[notifyChatsSync]", result.error);
    }
  } catch {
    // Realtime optional in dev without Supabase
  }
}
