import { useEffect, useState } from "react";
import { TimeBlock } from "@/lib/timeblock-types";
import { uid } from "@/lib/task-utils";

const STORAGE_KEY = "daydock.blocks.v1";

export function useTimeBlocks() {
  const [blocks, setBlocks] = useState<TimeBlock[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    return [];
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(blocks));
  }, [blocks]);

  // Cross-window sync — fires when the calendar window updates blocks
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        try { setBlocks(JSON.parse(e.newValue)); } catch {}
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const addBlock = (b: Omit<TimeBlock, "id" | "createdAt" | "completed">) => {
    const id = uid();
    setBlocks(prev => [...prev, { ...b, id, completed: false, createdAt: Date.now() }]);
    return id;
  };

  const updateBlock = (id: string, patch: Partial<TimeBlock>) =>
    setBlocks(prev => prev.map(b => (b.id === id ? { ...b, ...patch } : b)));

  const toggleBlock = (id: string) =>
    setBlocks(prev => prev.map(b => (b.id === id ? { ...b, completed: !b.completed } : b)));

  const deleteBlock = (id: string) => setBlocks(prev => prev.filter(b => b.id !== id));

  const deleteBlocksByTaskId = (taskId: string) =>
    setBlocks(prev => prev.filter(b => b.taskId !== taskId));

  return { blocks, addBlock, updateBlock, toggleBlock, deleteBlock, deleteBlocksByTaskId };
}
