import { useEffect, useState, useCallback } from "react";

const SETTINGS_KEY = "daydock.settings.v1";

export type Theme = "system" | "light" | "dark";
export type BufferStyle = "gap" | "dot";

export interface AppSettings {
  theme: Theme;
  notifications: boolean;
  widgetEnabled: boolean;
  bufferEnabled: boolean;
  bufferStyle: BufferStyle;
  bufferDurationMin: number;
  bufferNotes: Record<string, string>;
}

export const defaultSettings: AppSettings = {
  theme: "system",
  notifications: false,
  widgetEnabled: true,
  bufferEnabled: false,
  bufferStyle: "gap",
  bufferDurationMin: 5,
  bufferNotes: {},
};

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return { ...defaultSettings, ...JSON.parse(raw) };
  } catch {}
  return defaultSettings;
}

export function saveSettings(s: AppSettings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
    window.dispatchEvent(new CustomEvent("daydock:settings-change"));
  } catch {}
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
