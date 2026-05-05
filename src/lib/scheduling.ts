import type { Task } from "@/lib/types";
import type { TimeBlock } from "@/types";
import { DAY_MINUTES, SLOT_MINUTES } from "@/components/calendar/constants";

export const DEFAULT_TASK_DURATION = 30;
export const DEFAULT_SESSION_DURATION = 30;
export const PLANNING_START_MINUTE = 8 * 60;
export const PLANNING_END_MINUTE = 18 * 60;

export const minuteToTaskTime = (minute: number) => {
  const hours = String(Math.floor(minute / 60)).padStart(2, "0");
  const mins = String(minute % 60).padStart(2, "0");
  return `${hours}:${mins}`;
};

export const getTaskDuration = (task: Task) => task.durationMinutes ?? DEFAULT_TASK_DURATION;

export const getTaskSessionMinutes = (task: Task) =>
  Math.min(getTaskDuration(task), task.sessionMinutes ?? DEFAULT_SESSION_DURATION);

export const getTaskScheduledMinutes = (blocks: TimeBlock[], taskId: string) =>
  blocks
    .filter(block => block.taskId === taskId)
    .reduce((sum, block) => sum + block.durationMinutes, 0);

type Slot = {
  date: string;
  startMinute: number;
  endMinute: number;
};

export type PlannedTaskBlock = {
  taskId: string;
  title: string;
  date: string;
  startMinute: number;
  durationMinutes: number;
};

const clampToSlot = (minute: number) =>
  Math.max(PLANNING_START_MINUTE, Math.min(PLANNING_END_MINUTE, minute));

const snap = (minutes: number) =>
  Math.max(0, Math.min(DAY_MINUTES, Math.round(minutes / SLOT_MINUTES) * SLOT_MINUTES));

const compareTasks = (a: Task, b: Task) => {
  const priorityRank = { high: 0, med: 1, low: 2 } as const;
  if (priorityRank[a.priority] !== priorityRank[b.priority]) {
    return priorityRank[a.priority] - priorityRank[b.priority];
  }
  if (a.date !== b.date) return a.date.localeCompare(b.date);
  return a.createdAt - b.createdAt;
};

export const buildOpenSlots = (dates: string[], blocks: TimeBlock[]) => {
  const slots: Slot[] = [];

  for (const date of dates) {
    const dayBlocks = blocks
      .filter(block => block.date === date)
      .sort((a, b) => a.startMinute - b.startMinute);

    let cursor = PLANNING_START_MINUTE;
    for (const block of dayBlocks) {
      const blockStart = clampToSlot(block.startMinute);
      const blockEnd = clampToSlot(block.startMinute + block.durationMinutes);
      if (blockStart > cursor) {
        slots.push({ date, startMinute: cursor, endMinute: blockStart });
      }
      cursor = Math.max(cursor, blockEnd);
    }
    if (cursor < PLANNING_END_MINUTE) {
      slots.push({ date, startMinute: cursor, endMinute: PLANNING_END_MINUTE });
    }
  }

  return slots;
};

export const autoPlanTasks = (tasks: Task[], blocks: TimeBlock[], dates: string[]) => {
  const openSlots = buildOpenSlots(dates, blocks);
  const plan: PlannedTaskBlock[] = [];
  const sortedTasks = [...tasks].sort(compareTasks);

  for (const task of sortedTasks) {
    const dueDate = task.date;
    let remaining = getTaskDuration(task);
    const preferredSession = getTaskSessionMinutes(task);

    for (const slot of openSlots) {
      if (remaining <= 0) break;
      if (slot.date > dueDate) break;
      if (slot.endMinute - slot.startMinute < SLOT_MINUTES) continue;

      const available = slot.endMinute - slot.startMinute;
      const chunk = Math.min(remaining, preferredSession, available);
      const durationMinutes = snap(chunk);

      if (durationMinutes < SLOT_MINUTES) continue;

      plan.push({
        taskId: task.id,
        title: task.title,
        date: slot.date,
        startMinute: slot.startMinute,
        durationMinutes,
      });

      slot.startMinute += durationMinutes;
      remaining -= durationMinutes;
    }
  }

  return plan;
};

export const workloadStatus = (scheduledMinutes: number, unscheduledMinutes: number) => {
  const total = scheduledMinutes + unscheduledMinutes;
  if (total > 8 * 60) return "overloaded";
  if (unscheduledMinutes > 2 * 60) return "tight";
  return "realistic";
};
