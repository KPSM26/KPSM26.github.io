import type { Task } from "@/lib/types";
import type { TimeBlock as LegacyTimeBlock } from "@/lib/timeblock-types";
import type { AppData } from "@/types";
import type { AppSettings } from "@/hooks/useSettings";

export const STORAGE_KEYS = {
  appData: "daydock.appdata.v1",
  tasks: "daydock.tasks.v1",
  taskMeta: "daydock.meta.v1",
  settings: "daydock.settings.v1",
  legacyBlocks: "daydock.blocks.v1",
  standupCleanup: "daydock.tasks.migration.standup-cleanup.v1",
  syncMeta: "daydock.sync-meta.v1",
} as const;

export const DAYDOCK_STORAGE_EVENT = "daydock:storage-change";

type SyncMeta = {
  updatedAt: string;
};

export type SharedAppSettings = Omit<
  AppSettings,
  "cloudSyncEnabled" | "supabaseUrl" | "supabaseAnonKey" | "syncCode"
>;

export type DayDockSnapshot = {
  version: 1;
  updatedAt: string;
  appData: AppData;
  tasks: Task[];
  taskMeta: Record<string, unknown>;
  legacyBlocks: LegacyTimeBlock[];
  settings: SharedAppSettings;
};

export function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function touchSyncMeta(updatedAt = new Date().toISOString()) {
  try {
    localStorage.setItem(STORAGE_KEYS.syncMeta, JSON.stringify({ updatedAt } satisfies SyncMeta));
  } catch {}
}

export function emitStorageChange(key: string) {
  window.dispatchEvent(new CustomEvent(DAYDOCK_STORAGE_EVENT, { detail: { key } }));
}

export function writeJSON<T>(key: string, value: T, options?: { emit?: boolean; touch?: boolean }) {
  const { emit = true, touch = true } = options ?? {};
  try {
    localStorage.setItem(key, JSON.stringify(value));
    if (touch) touchSyncMeta();
    if (emit) emitStorageChange(key);
  } catch (err) {
    console.error(`Failed to write local storage key: ${key}`, err);
  }
}

export function getLocalUpdatedAt(): string {
  const meta = readJSON<SyncMeta | null>(STORAGE_KEYS.syncMeta, null);
  return meta?.updatedAt ?? new Date(0).toISOString();
}

export function pickSharedSettings(settings: AppSettings): SharedAppSettings {
  const {
    cloudSyncEnabled: _cloudSyncEnabled,
    supabaseUrl: _supabaseUrl,
    supabaseAnonKey: _supabaseAnonKey,
    syncCode: _syncCode,
    ...shared
  } = settings;
  return shared;
}

export function buildSnapshotFromLocal(getSettings: () => AppSettings): DayDockSnapshot {
  return {
    version: 1,
    updatedAt: getLocalUpdatedAt(),
    appData: readJSON<AppData>(STORAGE_KEYS.appData, { blocks: [], categories: [] }),
    tasks: readJSON<Task[]>(STORAGE_KEYS.tasks, []),
    taskMeta: readJSON<Record<string, unknown>>(STORAGE_KEYS.taskMeta, {}),
    legacyBlocks: readJSON<LegacyTimeBlock[]>(STORAGE_KEYS.legacyBlocks, []),
    settings: pickSharedSettings(getSettings()),
  };
}

export function applySnapshotToLocal(snapshot: DayDockSnapshot, getSettings: () => AppSettings) {
  const mergedSettings: AppSettings = {
    ...getSettings(),
    ...snapshot.settings,
  };

  writeJSON(STORAGE_KEYS.appData, snapshot.appData, { emit: false, touch: false });
  writeJSON(STORAGE_KEYS.tasks, snapshot.tasks, { emit: false, touch: false });
  writeJSON(STORAGE_KEYS.taskMeta, snapshot.taskMeta, { emit: false, touch: false });
  writeJSON(STORAGE_KEYS.legacyBlocks, snapshot.legacyBlocks, { emit: false, touch: false });
  writeJSON(STORAGE_KEYS.settings, mergedSettings, { emit: false, touch: false });

  touchSyncMeta(snapshot.updatedAt);
  emitStorageChange("*");
  window.dispatchEvent(new CustomEvent("daydock:settings-change"));
}
