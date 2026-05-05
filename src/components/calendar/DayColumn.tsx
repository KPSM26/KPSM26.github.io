import { useEffect, useMemo, useRef, useState } from "react";
import { TimeBlockView } from "./TimeBlock";
import { BufferNotePopover } from "./BufferNotePopover";
import { DAY_PX, DAY_MINUTES, HOUR_PX, SLOT_MINUTES } from "./constants";
import type { TimeBlock, Category } from "@/types";
import { cn } from "@/lib/utils";
import { useDroppable } from "@dnd-kit/core";
import { useSettings } from "@/hooks/useSettings";

type Props = {
  date: string;
  isToday: boolean;
  blocks: TimeBlock[];
  categoriesById: Map<string, Category>;
  onBlockClick: (block: TimeBlock) => void;
  onBlockResize: (block: TimeBlock, durationMinutes: number) => void;
  onCreate: (date: string, startMinute: number, durationMinutes: number) => void;
  onTaskDrop?: (taskId: string, minute: number, date: string) => void;
};

type DragState = { anchor: number; current: number };

const snap = (minutes: number) =>
  Math.max(0, Math.min(DAY_MINUTES - SLOT_MINUTES, Math.round(minutes / SLOT_MINUTES) * SLOT_MINUTES));

export const DayColumn = ({
  date, isToday, blocks, categoriesById, onBlockClick, onBlockResize, onCreate, onTaskDrop,
}: Props) => {
  const ref = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const { settings } = useSettings();

  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: date });

  const bufferGaps = useMemo(() => {
    if (!settings.bufferEnabled || settings.bufferStyle !== "dot") return [];
    const sorted = [...blocks].sort((a, b) => a.startMinute - b.startMinute);
    const gaps: { start: number; end: number }[] = [];
    for (let i = 0; i < sorted.length - 1; i++) {
      const end = sorted[i].startMinute + sorted[i].durationMinutes;
      const nextStart = sorted[i + 1].startMinute;
      const gap = nextStart - end;
      if (gap > 0 && gap <= settings.bufferDurationMin) {
        gaps.push({ start: end, end: nextStart });
      }
    }
    return gaps;
  }, [blocks, settings.bufferEnabled, settings.bufferStyle, settings.bufferDurationMin]);

  const setRefs = (el: HTMLDivElement | null) => {
    (ref as React.MutableRefObject<HTMLDivElement | null>).current = el;
    setDropRef(el);
  };

  const minuteFromClientY = (clientY: number): number => {
    if (!ref.current) return 0;
    const rect = ref.current.getBoundingClientRect();
    const y = clientY - rect.top;
    return snap((y / HOUR_PX) * 60);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest("[data-block]")) return;
    const m = minuteFromClientY(e.clientY);
    setDrag({ anchor: m, current: m });
  };

  useEffect(() => {
    if (!drag) return;
    const onMove = (e: MouseEvent) => {
      setDrag(d => (d ? { ...d, current: minuteFromClientY(e.clientY) } : d));
    };
    const onUp = () => {
      setDrag(null);
      const start = Math.min(drag.anchor, drag.current);
      const end = Math.max(drag.anchor, drag.current);
      const rawDuration = end - start;
      const duration = rawDuration < SLOT_MINUTES ? 30 : rawDuration;
      const finalStart = rawDuration < SLOT_MINUTES ? drag.anchor : start;
      onCreate(date, finalStart, duration);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [drag, date, onCreate]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData("task-id");
    if (!taskId || !onTaskDrop) return;
    const minute = minuteFromClientY(e.clientY);
    onTaskDrop(taskId, minute, date);
  };

  return (
    <div
      ref={setRefs}
      onMouseDown={handleMouseDown}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className={cn(
        "relative border-r border-border/40 last:border-r-0 select-none bg-[linear-gradient(180deg,hsl(var(--background)/0.18),transparent_40%)]",
        isToday && "bg-[linear-gradient(180deg,hsl(var(--primary)/0.08),transparent_38%)]",
        isOver && "bg-[linear-gradient(180deg,hsl(var(--primary)/0.12),transparent_38%)]"
      )}
      style={{ height: DAY_PX }}
      data-date={date}
    >
      {Array.from({ length: 24 }, (_, h) => (
        <div
          key={h}
          className="absolute left-0 right-0 border-b border-border/30"
          style={{ top: h * HOUR_PX, height: HOUR_PX }}
        />
      ))}

      {blocks.map(b => (
        <TimeBlockView
          key={`${b.id}-${b.date}`}
          block={b}
          category={categoriesById.get(b.categoryId)}
          onClick={() => onBlockClick(b)}
          onResize={onBlockResize}
        />
      ))}

      {bufferGaps.map(g => {
        const top = (g.start / 60) * HOUR_PX;
        const height = ((g.end - g.start) / 60) * HOUR_PX;
        return (
          <BufferNotePopover
            key={`buf-${date}-${g.start}`}
            date={date}
            gapStartMinute={g.start}
            top={top}
            height={height}
          />
        );
      })}

    </div>
  );
};
