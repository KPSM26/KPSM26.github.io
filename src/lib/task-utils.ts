import { Task } from "./types";

export const todayISO = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
};

export const isOverdue = (t: Task) => {
  if (t.completed) return false;
  const today = todayISO();
  if (t.date < today) return true;
  if (t.date === today && t.time) {
    const [h, m] = t.time.split(":").map(Number);
    const due = new Date();
    due.setHours(h, m, 0, 0);
    return due.getTime() < Date.now();
  }
  return false;
};

export const formatDateLabel = (iso: string) => {
  const today = todayISO();
  const t = new Date();
  const tomorrow = new Date(t);
  tomorrow.setDate(t.getDate() + 1);
  const tomorrowISO = tomorrow.toISOString().slice(0, 10);
  if (iso === today) return "Today";
  if (iso === tomorrowISO) return "Tomorrow";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
};

export const formatTime = (time?: string) => {
  if (!time) return "";
  const [h, m] = time.split(":").map(Number);
  const d = new Date();
  d.setHours(h, m);
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
};

export const uid = () => Math.random().toString(36).slice(2, 10);

export const sampleTasks = (): Task[] => {
  const today = todayISO();
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tISO = tomorrow.toISOString().slice(0, 10);
  const later = new Date();
  later.setDate(later.getDate() + 3);
  const lISO = later.toISOString().slice(0, 10);

  return [
    { id: uid(), title: "Review design system tokens", date: today, time: "11:00", durationMinutes: 90, sessionMinutes: 45, priority: "med", completed: false, repeatDaily: false, createdAt: Date.now() - 8000 },
    { id: uid(), title: "Reply to investor email", date: today, durationMinutes: 30, sessionMinutes: 30, priority: "high", completed: false, repeatDaily: false, createdAt: Date.now() - 7000 },
    { id: uid(), title: "Workout · 30 min", date: today, time: "18:00", durationMinutes: 30, sessionMinutes: 30, priority: "low", completed: true, repeatDaily: true, createdAt: Date.now() - 6000 },
    { id: uid(), title: "Draft Q2 roadmap", date: tISO, time: "10:00", durationMinutes: 180, sessionMinutes: 60, priority: "high", completed: false, repeatDaily: false, createdAt: Date.now() - 5000 },
    { id: uid(), title: "Coffee with Maya", date: tISO, time: "15:30", durationMinutes: 60, sessionMinutes: 60, priority: "med", completed: false, repeatDaily: false, createdAt: Date.now() - 4000 },
    { id: uid(), title: "Submit conference talk", date: lISO, durationMinutes: 120, sessionMinutes: 60, priority: "med", completed: false, repeatDaily: false, createdAt: Date.now() - 3000 },
  ];
};
