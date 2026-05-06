import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { buildSnapshotFromLocal, DAYDOCK_STORAGE_EVENT, type DayDockSnapshot, applySnapshotToLocal } from "@/lib/local-store";
import { createDayDockSupabaseClient, DAYDOCK_SNAPSHOT_TABLE, hasSupabaseConfig, resolveSupabaseConfig } from "@/lib/supabase";
import { loadSettings, useSettings } from "@/hooks/useSettings";

type SyncStatus = "disabled" | "needs-setup" | "syncing" | "ready" | "error";

type CloudSyncContextValue = {
  status: SyncStatus;
  message: string;
  lastSyncedAt?: string;
  isStandalone: boolean;
  canInstall: boolean;
  syncNow: () => Promise<void>;
  installApp: () => Promise<void>;
};

type SnapshotRow = {
  sync_code: string;
  payload: DayDockSnapshot;
  updated_at: string;
};

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

const CloudSyncContext = createContext<CloudSyncContextValue | null>(null);

function getSnapshotTimestamp(snapshot?: DayDockSnapshot | null, updatedAt?: string | null) {
  return new Date(updatedAt || snapshot?.updatedAt || 0).getTime();
}

export function CloudSyncProvider({ children }: { children: ReactNode }) {
  const { settings } = useSettings();
  const [status, setStatus] = useState<SyncStatus>("disabled");
  const [message, setMessage] = useState("Cloud sync is off.");
  const [lastSyncedAt, setLastSyncedAt] = useState<string>();
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const uploadTimerRef = useRef<number | null>(null);
  const applyingRemoteRef = useRef(false);
  const config = useMemo(
    () => resolveSupabaseConfig(settings),
    [settings.supabaseUrl, settings.supabaseAnonKey]
  );

  const isStandalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone);

  useEffect(() => {
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
  }, []);

  const pushSnapshot = useCallback(async () => {
    if (!settings.cloudSyncEnabled) return;
    if (!hasSupabaseConfig(config) || !settings.syncCode.trim()) return;

    const client = createDayDockSupabaseClient(config);
    const payload = buildSnapshotFromLocal(loadSettings);
    const { error } = await client.from(DAYDOCK_SNAPSHOT_TABLE).upsert(
      {
        sync_code: settings.syncCode.trim(),
        payload,
        updated_at: payload.updatedAt,
      },
      { onConflict: "sync_code" }
    );

    if (error) throw error;

    setLastSyncedAt(payload.updatedAt);
    setStatus("ready");
    setMessage("DayDock is syncing through Supabase.");
  }, [config, settings.cloudSyncEnabled, settings.syncCode]);

  const syncNow = useCallback(async () => {
    try {
      setStatus("syncing");
      setMessage("Syncing your latest schedule…");
      await pushSnapshot();
    } catch (error) {
      const nextMessage = error instanceof Error ? error.message : "Sync failed.";
      setStatus("error");
      setMessage(nextMessage);
      throw error;
    }
  }, [pushSnapshot]);

  const installApp = useCallback(async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  }, [installPrompt]);

  useEffect(() => {
    if (!settings.cloudSyncEnabled) {
      setStatus("disabled");
      setMessage("Cloud sync is off.");
      return;
    }

    if (!hasSupabaseConfig(config) || !settings.syncCode.trim()) {
      setStatus("needs-setup");
      setMessage("Add your Supabase URL, anon key, and a shared sync code to link devices.");
      return;
    }

    const client = createDayDockSupabaseClient(config);
    let disposed = false;

    const queueUpload = () => {
      if (applyingRemoteRef.current) return;
      if (uploadTimerRef.current) window.clearTimeout(uploadTimerRef.current);
      uploadTimerRef.current = window.setTimeout(() => {
        void pushSnapshot().catch((error) => {
          if (disposed) return;
          const nextMessage = error instanceof Error ? error.message : "Sync failed.";
          setStatus("error");
          setMessage(nextMessage);
        });
      }, 700);
    };

    const bootstrap = async () => {
      try {
        setStatus("syncing");
        setMessage("Connecting DayDock to Supabase…");

        const { data, error } = await client
          .from(DAYDOCK_SNAPSHOT_TABLE)
          .select("sync_code,payload,updated_at")
          .eq("sync_code", settings.syncCode.trim())
          .maybeSingle<SnapshotRow>();

        if (error) throw error;

        const localSnapshot = buildSnapshotFromLocal(loadSettings);
        const remoteSnapshot = data?.payload;
        const remoteTimestamp = getSnapshotTimestamp(remoteSnapshot, data?.updated_at);
        const localTimestamp = getSnapshotTimestamp(localSnapshot);

        if (remoteSnapshot && remoteTimestamp > localTimestamp) {
          applyingRemoteRef.current = true;
          applySnapshotToLocal(remoteSnapshot, loadSettings);
          applyingRemoteRef.current = false;
          setLastSyncedAt(data?.updated_at || remoteSnapshot.updatedAt);
          setStatus("ready");
          setMessage("Supabase data restored on this device.");
        } else {
          await pushSnapshot();
        }
      } catch (error) {
        if (disposed) return;
        const nextMessage = error instanceof Error ? error.message : "Cloud sync could not start.";
        setStatus("error");
        setMessage(nextMessage);
      }
    };

    const onLocalChange = () => queueUpload();
    const onReconnect = () => queueUpload();

    void bootstrap();

    window.addEventListener(DAYDOCK_STORAGE_EVENT, onLocalChange);
    window.addEventListener("online", onReconnect);

    return () => {
      disposed = true;
      if (uploadTimerRef.current) window.clearTimeout(uploadTimerRef.current);
      window.removeEventListener(DAYDOCK_STORAGE_EVENT, onLocalChange);
      window.removeEventListener("online", onReconnect);
    };
  }, [config, pushSnapshot, settings.cloudSyncEnabled, settings.syncCode]);

  const value = useMemo<CloudSyncContextValue>(
    () => ({
      status,
      message,
      lastSyncedAt,
      isStandalone,
      canInstall: Boolean(installPrompt) && !isStandalone,
      syncNow,
      installApp,
    }),
    [installApp, installPrompt, isStandalone, lastSyncedAt, message, status, syncNow]
  );

  return <CloudSyncContext.Provider value={value}>{children}</CloudSyncContext.Provider>;
}

export function useCloudSync() {
  const value = useContext(CloudSyncContext);
  if (!value) {
    return {
      status: "disabled" as const,
      message: "Cloud sync is off.",
      lastSyncedAt: undefined,
      isStandalone: false,
      canInstall: false,
      syncNow: async () => undefined,
      installApp: async () => undefined,
    };
  }
  return value;
}
