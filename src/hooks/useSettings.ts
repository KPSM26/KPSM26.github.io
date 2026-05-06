import { useEffect, useState, useCallback } from "react";
import { readJSON, STORAGE_KEYS, writeJSON } from "@/lib/local-store";

const SETTINGS_KEY = STORAGE_KEYS.settings;

export type Theme = "system" | "light" | "dark";
export type BufferStyle = "gap" | "dot";

export interface AppSettings {
  theme: Theme;
  notifications: boolean;
  widgetEnabled: boolean;
  planningStatusVisible: boolean;
  bufferEnabled: boolean;
  bufferStyle: BufferStyle;
  bufferDurationMin: number;
  bufferNotes: Record<string, string>;
  cloudSyncEnabled: boolean;
  supabaseUrl: string;
  supabaseAnonKey: string;
  syncCode: string;
}

export const defaultSettings: AppSettings = {
  theme: "system",
  notifications: false,
  widgetEnabled: true,
  planningStatusVisible: true,
  bufferEnabled: false,
  bufferStyle: "gap",
  bufferDurationMin: 5,
  bufferNotes: {},
  cloudSyncEnabled: false,
  supabaseUrl: "",
  supabaseAnonKey: "",
  syncCode: import.meta.env.VITE_DAYDOCK_SYNC_CODE?.trim() || "",
};

export function loadSettings(): AppSettings {
  return { ...defaultSettings, ...readJSON<Partial<AppSettings>>(SETTINGS_KEY, {}) };
}

export function saveSettings(s: AppSettings) {
  writeJSON(SETTINGS_KEY, s);
  window.dispatchEvent(new CustomEvent("daydock:settings-change"));
}

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(loadSettings);

  useEffect(() => {
    const handler = () => setSettings(loadSettings());
    window.addEventListener("daydock:settings-change", handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener("daydock:settings-change", handler);
      window.removeEventListener("storage", handler);
    };
  }, []);

  const update = useCallback((patch: Partial<AppSettings>) => {
    setSettings(prev => {
      const next = { ...prev, ...patch };
      saveSettings(next);
      return next;
    });
  }, []);

  return { settings, update };
}
