import { createClient } from "@supabase/supabase-js";
import { CHATS_SYNC_EVENT, chatsSyncChannelName } from "lib/realtime/chats-sync-channel";

export async function notifyChatsSync(principalUserId: string): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return;

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const channel = supabase.channel(chatsSyncChannelName(principalUserId));

  try {
    const result = await channel.httpSend(CHATS_SYNC_EVENT, { at: Date.now() });
    if (!result.success) {
      console.warn("[notifyChatsSync]", result.error);
    }
  } catch {
    // Realtime optional in dev without Supabase
  }
}
