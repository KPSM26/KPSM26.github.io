import { useState } from "react";
import { useTimeBlocksCtx } from "@/hooks/useTimeBlocksCtx";
import { TimeBlock } from "@/lib/timeblock-types";
import { todayISO } from "@/lib/task-utils";
import { ChevronDown, ChevronUp, Settings, CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";
import { SettingsPanel } from "@/components/settings/SettingsPanel";

function openCalendar() {
  if (typeof window !== "undefined") {
    window.location.hash = "#/";
  }
}

function formatHour(h: number) {
  const whole = Math.floor(h);
  const min = h - whole >= 0.5 ? "30" : "00";
  const period = whole >= 12 ? "PM" : "AM";
  const display = whole === 0 ? 12 : whole > 12 ? whole - 12 : whole;
  return `${display}:${min} ${period}`;
}

function formatDuration(d: number) {
  if (d < 1) return "30m";
  if (d === 1) return "1h";
  return Number.isInteger(d) ? `${d}h` : `${Math.floor(d)}h 30m`;
}

export const ScheduleWidget = () => {
  const { blocks, toggleBlock } = useTimeBlocksCtx();
  const [collapsed, setCollapsed] = useState(true);

  const today = todayISO();
  const todayBlocks = [...blocks.filter(b => b.date === today)]
    .sort((a, b) => a.startHour - b.startHour);

  const total = todayBlocks.length;
  const done = todayBlocks.filter(b => b.completed).length;
  const progress = total === 0 ? 0 : Math.round((done / total) * 100);

  const todayLabel = new Date().toLocaleDateString(undefined, {
    weekday: "long", month: "short", day: "numeric",
  });

  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        className="fixed left-1/2 top-6 z-40 flex -translate-x-1/2 cursor-pointer items-center gap-3 rounded-full bg-card px-4 py-1.5 text-[12px] shadow-soft transition-transform animate-in-fade hover:translate-y-0.5"
        aria-label="Open DayBlock schedule"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-primary" />
        <span className="font-medium tracking-tight">DayBlock</span>
        {total > 0 ? (
          <>
            <span className="font-mono text-[11px] text-muted-foreground">
              {done}/{total} done
            </span>
            <span className="relative h-1 w-16 overflow-hidden rounded-full bg-muted/70">
              <span
                className="absolute inset-y-0 left-0 rounded-full bg-primary transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </span>
          </>
        ) : (
          <span className="font-mono text-[11px] text-muted-foreground">No blocks today</span>
        )}
        <ChevronDown className="h-3 w-3 text-muted-foreground" />
      </button>
    );
  }

  return (
    <div className="fixed left-0 right-0 top-6 z-40 flex justify-center px-4 animate-in-fade">
      <div className="w-[480px] max-w-full overflow-hidden rounded-xl bg-card shadow-soft">

        {/* Header */}
        <div className="flex items-center justify-between px-5 pb-3 pt-4">
          <h2 className="text-[17px] font-semibold tracking-tight">{todayLabel}</h2>
          <div className="flex items-center gap-1">
            <SettingsPanel />
            <button
              onClick={() => setCollapsed(true)}
              className="grid h-6 w-6 place-items-center rounded text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground"
              aria-label="Collapse"
            >
              <ChevronUp className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Progress bar */}
        {total > 0 && (
          <div className="mx-5 mb-3 h-1 overflow-hidden rounded-full bg-muted/60">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}

        {/* Block list */}
        <div className="scrollbar-thin max-h-[400px] overflow-y-auto">
          {todayBlocks.length === 0 ? (
            <div className="px-5 py-8 text-center">
              <CalendarDays className="mx-auto mb-2 h-8 w-8 text-muted-foreground/30" />
              <p className="text-[12px] text-muted-foreground">
                No blocks scheduled for today.
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground/60">
                Open DayBlock to plan your day.
              </p>
            </div>
          ) : (
            <ul className="py-1">
              {todayBlocks.map(block => (
                <BlockRow key={block.id} block={block} onToggle={toggleBlock} />
              ))}
            </ul>
          )}
        </div>

        {/* Footer — open calendar */}
        <div className="border-t border-border/50 px-5 py-3">
          <button
            onClick={openCalendar}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-muted/40 py-2 text-[12px] font-medium text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground"
          >
            <CalendarDays className="h-3.5 w-3.5" />
            Open DayBlock to schedule your day
          </button>
        </div>
      </div>
    </div>
  );
};

const colorDot: Record<NonNullable<TimeBlock["color"]>, string> = {
  green: "bg-primary",
  amber: "bg-[hsl(var(--priority-med))]",
  red: "bg-[hsl(var(--priority-high))]",
  slate: "bg-muted-foreground/50",
};

const BlockRow = ({
  block,
  onToggle,
}: {
  block: TimeBlock;
  onToggle: (id: string) => void;
}) => {
  const color = block.color ?? "green";

  return (
    <li
      className="flex cursor-pointer items-center gap-3 px-5 py-2.5 transition-colors hover:bg-foreground/[0.03]"
      onClick={() => onToggle(block.id)}
    >
      {/* Checkbox */}
      <div
        className={cn(
          "flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full border-2 transition-all",
          block.completed
            ? "border-primary bg-primary"
            : "border-border bg-transparent"
        )}
      >
        {block.completed && (
          <svg className="h-2.5 w-2.5 text-white" viewBox="0 0 10 10" fill="none">
            <path d="M2 5l2.5 2.5L8 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>

      {/* Color dot */}
      <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", colorDot[color])} />

      {/* Time */}
      <span className="w-16 shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground">
        {formatHour(block.startHour)}
      </span>

      {/* Title */}
      <span className={cn(
        "flex-1 truncate text-[13px] font-medium",
        block.completed && "text-muted-foreground line-through"
      )}>
        {block.title}
      </span>

      {/* Duration */}
      <span className="shrink-0 text-[11px] text-muted-foreground/60">
        {formatDuration(block.duration)}
      </span>
    </li>
  );
};
