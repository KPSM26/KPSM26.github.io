import { useCallback, useEffect, useRef, useState } from "react";
import type { AppData } from "@/types";
import { DEFAULT_CATEGORIES } from "@/data/defaults";
import { readJSON, STORAGE_KEYS, writeJSON } from "@/lib/local-store";

const LS_KEY = STORAGE_KEYS.appData;

const EMPTY: AppData = { blocks: [], categories: DEFAULT_CATEGORIES };

function load(): AppData {
  const parsed = readJSON<AppData>(LS_KEY, EMPTY);
  if (!parsed.categories || parsed.categories.length === 0) parsed.categories = DEFAULT_CATEGORIES;
  if (!parsed.blocks) parsed.blocks = [];
  return parsed;
}

function save(data: AppData) {
  writeJSON(LS_KEY, data);
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
