import { createClient } from "@supabase/supabase-js";
import type { AppSettings } from "@/hooks/useSettings";

export const DAYDOCK_SNAPSHOT_TABLE = "daydock_snapshots";

export type SupabaseConfig = {
  url: string;
  anonKey: string;
};

export function resolveSupabaseConfig(settings: Pick<AppSettings, "supabaseUrl" | "supabaseAnonKey">): SupabaseConfig {
  return {
    url: settings.supabaseUrl.trim() || import.meta.env.VITE_SUPABASE_URL?.trim() || "",
    anonKey: settings.supabaseAnonKey.trim() || import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() || "",
  };
}

export function hasSupabaseConfig(config: SupabaseConfig) {
  return Boolean(config.url && config.anonKey);
}

export function createDayDockSupabaseClient(config: SupabaseConfig) {
  return createClient(config.url, config.anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: {
        "X-DayDock-Client": "pwa-sync",
      },
    },
  });
}
