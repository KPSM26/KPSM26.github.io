import { useCallback, useEffect, useRef, useState } from "react";
import type { AppData } from "@/types";
import { DEFAULT_CATEGORIES } from "@/data/defaults";

const LS_KEY = "daydock.appdata.v1";

const EMPTY: AppData = { blocks: [], categories: DEFAULT_CATEGORIES };

function load(): AppData {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AppData;
      if (!parsed.categories || parsed.categories.length === 0) parsed.categories = DEFAULT_CATEGORIES;
      if (!parsed.blocks) parsed.blocks = [];
      return parsed;
    }
  } catch {}
  return EMPTY;
}

function save(data: AppData) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(data));
  } catch (err) {
    console.error("save failed", err);
  }
}

export function useStorage() {
  const [data, setData] = useState<AppData>(EMPTY);
  const [loaded, setLoaded] = useState(false);
  const skipNextSave = useRef(true);

  useEffect(() => {
    setData(load());
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }
    save(data);
  }, [data, loaded]);

  // Sync state when another tab/window writes to localStorage
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === LS_KEY && e.newValue) {
        try { setData(JSON.parse(e.newValue) as AppData); } catch {}
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const update = useCallback((patch: Partial<AppData> | ((prev: AppData) => AppData)) => {
    setData(prev => typeof patch === "function" ? patch(prev) : { ...prev, ...patch });
  }, []);

  return { data, update, loaded };
}
