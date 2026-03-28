"use client";

import { useAuth } from "@clerk/nextjs";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@supabase/supabase-js";
import { useEffect, useMemo } from "react";
import type { MeUsageData } from "@/lib/api-types/chat";
import { apiGet } from "@/lib/api-client";
import {
  CHATS_SYNC_EVENT,
  chatsSyncChannelName,
  principalUserIdFromAnonSession,
} from "@/lib/realtime/chats-sync-channel";

/**
 * Keeps TanStack Query `["chats"]` in sync across tabs via Supabase Realtime Broadcast.
 */
export function ChatsRealtimeSync() {
  const queryClient = useQueryClient();
  const { isLoaded, userId } = useAuth();

  const usageQuery = useQuery({
    queryKey: ["usage"],
    queryFn: () => apiGet<MeUsageData>("/api/me/usage"),
    enabled: isLoaded && !userId,
  });

  const principalUserId = useMemo(() => {
    if (userId) return userId;
    if (!isLoaded) return null;
    const u = usageQuery.data;
    if (u?.isAnonymous && u.sessionId) return principalUserIdFromAnonSession(u.sessionId);
    return null;
  }, [userId, isLoaded, usageQuery.data]);

  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anonKey || !principalUserId) return;

    const supabase = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const channel = supabase
      .channel(chatsSyncChannelName(principalUserId))
      .on("broadcast", { event: CHATS_SYNC_EVENT }, () => {
        void queryClient.invalidateQueries({ queryKey: ["chats"] });
      });

    channel.subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [principalUserId, queryClient]);

  return null;
}
