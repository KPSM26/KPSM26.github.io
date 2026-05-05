import { useCallback, useMemo } from "react";
import { v4 as uuid } from "uuid";
import type { Category, RecurrenceRule, TimeBlock } from "@/types";
import { useStorage } from "@/hooks/useStorage";
import { loadSettings } from "@/hooks/useSettings";
import { DAY_MINUTES } from "@/components/calendar/constants";

const MS_PER_DAY = 86_400_000;

function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseISO(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function matchesRule(rule: RecurrenceRule, anchor: Date, target: Date): boolean {
  if (rule.endDate && target > parseISO(rule.endDate)) return false;
  if (target < anchor) return false;
  if (rule.frequency === "daily") return true;
  const dow = target.getDay();
  return (rule.daysOfWeek ?? [anchor.getDay()]).includes(dow);
}

export function useBlocks() {
  const { data, update, loaded } = useStorage();

  const addBlock = useCallback((b: Omit<TimeBlock, "id">) => {
    const settings = loadSettings();
    const id = uuid();
    update(prev => {
      let startMinute = b.startMinute;
      if (settings.bufferEnabled) {
        let changed = true;
        while (changed) {
          changed = false;
          for (const existing of prev.blocks) {
            if (existing.date !== b.date) continue;
            const existingEnd = existing.startMinute + existing.durationMinutes;
            if (existingEnd === startMinute) {
              const shifted = startMinute + settings.bufferDurationMin;
              if (shifted + b.durationMinutes > DAY_MINUTES) break;
              startMinute = shifted;
              changed = true;
              break;
            }
          }
        }
      }
      return { ...prev, blocks: [...prev.blocks, { ...b, startMinute, id }] };
    });
    return id;
  }, [update]);

  const updateBlock = useCallback((id: string, patch: Partial<TimeBlock>) => {
    update(prev => ({
      ...prev,
      blocks: prev.blocks.map(b => (b.id === id ? { ...b, ...patch } : b)),
    }));
  }, [update]);

  const deleteBlock = useCallback((id: string) => {
    update(prev => ({ ...prev, blocks: prev.blocks.filter(b => b.id !== id) }));
  }, [update]);

  const addCategory = useCallback((c: Omit<Category, "id">) => {
    const id = uuid();
    update(prev => ({ ...prev, categories: [...prev.categories, { ...c, id }] }));
    return id;
  }, [update]);

  const updateCategory = useCallback((id: string, patch: Partial<Category>) => {
    update(prev => ({
      ...prev,
      categories: prev.categories.map(c => (c.id === id ? { ...c, ...patch } : c)),
    }));
  }, [update]);

  const deleteCategory = useCallback((id: string) => {
    update(prev => ({ ...prev, categories: prev.categories.filter(c => c.id !== id) }));
  }, [update]);

  const setIntention = useCallback((text: string, date: string) => {
    update(prev => ({ ...prev, intention: { text, date } }));
  }, [update]);

  const clearIntention = useCallback(() => {
    update(prev => {
      const { intention: _omit, ...rest } = prev;
      return rest as typeof prev;
    });
  }, [update]);

  const categoriesById = useMemo(() => {
    const m = new Map<string, Category>();
    data.categories.forEach(c => m.set(c.id, c));
    return m;
  }, [data.categories]);

  const expandBlocksInRange = useCallback((rangeStartISO: string, rangeEndISO: string): TimeBlock[] => {
    const start = parseISO(rangeStartISO);
    const end = parseISO(rangeEndISO);
    const out: TimeBlock[] = [];
    for (const b of data.blocks) {
      if (!b.recurrence) {
        const d = parseISO(b.date);
        if (d >= start && d <= end) out.push(b);
        continue;
      }
      const anchor = parseISO(b.date);
      for (let t = start.getTime(); t <= end.getTime(); t += MS_PER_DAY) {
        const day = new Date(t);
        if (matchesRule(b.recurrence, anchor, day)) {
          out.push({ ...b, date: toISO(day) });
        }
      }
    }
    return out;
  }, [data.blocks]);

  return {
    loaded,
    blocks: data.blocks,
    categories: data.categories,
    categoriesById,
    intention: data.intention,
    setIntention,
    clearIntention,
    addBlock,
    updateBlock,
    deleteBlock,
    addCategory,
    updateCategory,
    deleteCategory,
    expandBlocksInRange,
  };
}
