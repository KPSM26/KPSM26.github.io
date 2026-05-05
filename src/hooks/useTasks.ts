import { useEffect, useState } from "react";
import { Task } from "@/lib/types";
import { sampleTasks, todayISO, uid } from "@/lib/task-utils";

const STORAGE_KEY = "daydock.tasks.v1";
const META_KEY = "daydock.meta.v1";
const STANDUP_CLEANUP_KEY = "daydock.tasks.migration.standup-cleanup.v1";

export function useTasks() {
  const [tasks, setTasks] = useState<Task[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        let parsed: Task[] = JSON.parse(raw);
        if (!localStorage.getItem(STANDUP_CLEANUP_KEY)) {
          parsed = parsed.filter(t => t.title.trim().toLowerCase() !== "morning standup");
          localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
          localStorage.setItem(STANDUP_CLEANUP_KEY, "1");
        }
        return parsed;
      }
    } catch {}
    const seeded = sampleTasks();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
    localStorage.setItem(STANDUP_CLEANUP_KEY, "1");
    return seeded;
  });

  // Daily/weekly repeat rollover
  useEffect(() => {
    const today = todayISO();
    const todayDate = new Date(today + "T00:00:00");
    const todayDow = todayDate.getDay(); // 0=Sun...6=Sat

    let meta: { lastRoll?: string } = {};
    try { meta = JSON.parse(localStorage.getItem(META_KEY) || "{}"); } catch {}
    if (meta.lastRoll === today) return;

    setTasks(prev => {
      const existingTitlesToday = new Set(
        prev.filter(t => t.date === today).map(t => t.title.toLowerCase())
      );

      const shouldRepeatToday = (t: Task): boolean => {
        if (t.date >= today || t.completed) return false;
        if (existingTitlesToday.has(t.title.toLowerCase())) return false;
        // repeatRule takes priority over legacy repeatDaily
        if (t.repeatRule) {
          if (t.repeatRule.frequency === "daily") return true;
          if (t.repeatRule.frequency === "weekly") {
            const days = t.repeatRule.daysOfWeek ?? [new Date(t.date + "T00:00:00").getDay()];
            return days.includes(todayDow);
          }
        }
        return t.repeatDaily;
      };

      const clones: Task[] = prev
        .filter(shouldRepeatToday)
        .map(t => ({ ...t, id: uid(), date: today, completed: false, blockId: undefined, createdAt: Date.now() }));
      return clones.length ? [...prev, ...clones] : prev;
    });

    localStorage.setItem(META_KEY, JSON.stringify({ lastRoll: today }));
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  }, [tasks]);

  // Sync state when the other Tauri window writes to localStorage
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        try { setTasks(JSON.parse(e.newValue)); } catch {}
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const addTask = (t: Omit<Task, "id" | "createdAt" | "completed">) =>
    setTasks(prev => [...prev, { ...t, id: uid(), completed: false, createdAt: Date.now() }]);

  const updateTask = (id: string, patch: Partial<Task>) =>
    setTasks(prev => prev.map(t => (t.id === id ? { ...t, ...patch } : t)));

  const toggleTask = (id: string) =>
    setTasks(prev => prev.map(t => (t.id === id ? { ...t, completed: !t.completed } : t)));

  const deleteTask = (id: string) => setTasks(prev => prev.filter(t => t.id !== id));

  const clearCompleted = () => setTasks(prev => prev.filter(t => !t.completed));

  return { tasks, addTask, updateTask, toggleTask, deleteTask, clearCompleted };
}
