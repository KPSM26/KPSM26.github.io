import { useEffect, useState } from "react";
import { Task, Priority, RepeatRule } from "@/lib/types";
import { todayISO } from "@/lib/task-utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { DEFAULT_SESSION_DURATION, DEFAULT_TASK_DURATION } from "@/lib/scheduling";

const DOW_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: Task | null;
  onSave: (data: Omit<Task, "id" | "createdAt" | "completed">) => void;
  onUpdate: (id: string, patch: Partial<Task>) => void;
}

const priorities: { value: Priority; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "med", label: "Medium" },
  { value: "high", label: "High" },
];

const durationOptions = [30, 45, 60, 90, 120, 180];
const sessionOptions = [30, 45, 60, 90];

type RepeatMode = "none" | "daily" | "weekly";

const quickDates = () => {
  const today = new Date();
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return [
    { label: "Today", value: fmt(today) },
    { label: "Tomorrow", value: fmt(tomorrow) },
  ];
};

function taskToRepeatMode(task: Task | null | undefined): RepeatMode {
  if (!task) return "none";
  if (task.repeatRule?.frequency === "weekly") return "weekly";
  if (task.repeatRule?.frequency === "daily" || task.repeatDaily) return "daily";
  return "none";
}

export const TaskDialog = ({ open, onOpenChange, initial, onSave, onUpdate }: Props) => {
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [date, setDate] = useState(todayISO());
  const [time, setTime] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(DEFAULT_TASK_DURATION);
  const [sessionMinutes, setSessionMinutes] = useState(DEFAULT_SESSION_DURATION);
  const [priority, setPriority] = useState<Priority>("med");
  const [repeatMode, setRepeatMode] = useState<RepeatMode>("none");
  const [repeatDays, setRepeatDays] = useState<number[]>([]);

  useEffect(() => {
    if (open) {
      setTitle(initial?.title ?? "");
      setNotes(initial?.notes ?? "");
      setDate(initial?.date ?? todayISO());
      setTime(initial?.time ?? "");
      setDurationMinutes(initial?.durationMinutes ?? DEFAULT_TASK_DURATION);
      setSessionMinutes(initial?.sessionMinutes ?? initial?.durationMinutes ?? DEFAULT_SESSION_DURATION);
      setPriority(initial?.priority ?? "med");
      const mode = taskToRepeatMode(initial);
      setRepeatMode(mode);
      setRepeatDays(initial?.repeatRule?.daysOfWeek ?? []);
    }
  }, [open, initial]);

  const toggleDay = (dow: number) => {
    setRepeatDays(prev =>
      prev.includes(dow) ? prev.filter(d => d !== dow) : [...prev, dow]
    );
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    let repeatRule: RepeatRule | undefined;
    let repeatDaily = false;
    if (repeatMode === "daily") {
      repeatRule = { frequency: "daily" };
      repeatDaily = true;
    } else if (repeatMode === "weekly") {
      const days = repeatDays.length > 0 ? repeatDays : [new Date(date + "T00:00:00").getDay()];
      repeatRule = { frequency: "weekly", daysOfWeek: days };
    }

    const payload: Omit<Task, "id" | "createdAt" | "completed"> = {
      title: title.trim(),
      notes: notes.trim() || undefined,
      date,
      time: time || undefined,
      durationMinutes,
      sessionMinutes: Math.min(sessionMinutes, durationMinutes),
      priority,
      repeatDaily,
      repeatRule,
    };
    if (initial) onUpdate(initial.id, payload);
    else onSave(payload);
    onOpenChange(false);
  };

  const presets = quickDates();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm gap-0 rounded-xl border border-border bg-card p-0 shadow-soft">
        <DialogHeader className="space-y-0 px-5 pb-3 pt-5">
          <DialogTitle className="text-base font-semibold tracking-tight">
            {initial ? "Edit task" : "New task"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4 px-5 pb-5">
          <Input
            autoFocus
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="What needs doing?"
            className="h-10 rounded-md border-border bg-background text-sm"
          />
          <Textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Notes (optional)"
            rows={2}
            className="resize-none rounded-md border-border bg-background text-sm"
          />

          <div className="space-y-1.5">
            <Label className="text-[11px] font-medium text-muted-foreground">When</Label>
            <div className="flex flex-wrap items-center gap-1.5">
              {presets.map(p => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setDate(p.value)}
                  className={cn(
                    "rounded-md border px-2.5 py-1 text-xs transition-colors",
                    date === p.value
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border bg-background text-muted-foreground hover:text-foreground"
                  )}
                >
                  {p.label}
                </button>
              ))}
              <Input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="h-7 w-[140px] rounded-md border-border bg-background px-2 text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[11px] font-medium text-muted-foreground">Time (optional)</Label>
              <Input
                type="time"
                value={time}
                onChange={e => setTime(e.target.value)}
                className="h-9 rounded-md border-border bg-background text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] font-medium text-muted-foreground">Priority</Label>
              <div className="flex h-9 items-center gap-1 rounded-md border border-border bg-background p-0.5">
                {priorities.map(p => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setPriority(p.value)}
                    className={cn(
                      "flex-1 rounded text-xs transition-colors",
                      priority === p.value
                        ? "bg-foreground/[0.06] text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[11px] font-medium text-muted-foreground">Total effort</Label>
              <div className="flex flex-wrap gap-1 rounded-md border border-border bg-background p-1">
                {durationOptions.map(option => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => {
                      setDurationMinutes(option);
                      setSessionMinutes(prev => Math.min(prev, option));
                    }}
                    className={cn(
                      "rounded px-2 py-1 text-[11px] transition-colors",
                      durationMinutes === option
                        ? "bg-foreground/[0.06] text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {option < 60 ? `${option}m` : option % 60 === 0 ? `${option / 60}h` : `${Math.floor(option / 60)}h ${option % 60}m`}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] font-medium text-muted-foreground">Session size</Label>
              <div className="flex flex-wrap gap-1 rounded-md border border-border bg-background p-1">
                {sessionOptions.filter(option => option <= durationMinutes).map(option => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setSessionMinutes(option)}
                    className={cn(
                      "rounded px-2 py-1 text-[11px] transition-colors",
                      sessionMinutes === option
                        ? "bg-foreground/[0.06] text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {option < 60 ? `${option}m` : option % 60 === 0 ? `${option / 60}h` : `${Math.floor(option / 60)}h ${option % 60}m`}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Repeat */}
          <div className="space-y-2 rounded-md border border-border bg-background px-3 py-2">
            <div className="flex items-center justify-between">
              <Label className="text-[13px]">Repeat</Label>
              <div className="flex gap-1 rounded bg-muted/60 p-0.5">
                {(["none", "daily", "weekly"] as RepeatMode[]).map(m => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setRepeatMode(m)}
                    className={cn(
                      "rounded px-2 py-0.5 text-[11px] font-medium capitalize transition-colors",
                      repeatMode === m
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {m === "none" ? "Off" : m}
                  </button>
                ))}
              </div>
            </div>

            {repeatMode === "weekly" && (
              <div className="flex gap-1 pt-1">
                {DOW_LABELS.map((label, dow) => (
                  <button
                    key={dow}
                    type="button"
                    onClick={() => toggleDay(dow)}
                    className={cn(
                      "flex h-6 w-6 items-center justify-center rounded text-[10px] font-medium transition-colors",
                      repeatDays.includes(dow)
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}

            {repeatMode !== "none" && (
              <p className="text-[11px] text-muted-foreground/60">
                {repeatMode === "daily"
                  ? "Recreates each morning"
                  : "Recreates on selected days"}
              </p>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} className="h-9 rounded-md">
              Cancel
            </Button>
            <Button
              type="submit"
              className="h-9 rounded-md bg-primary px-4 text-primary-foreground hover:bg-primary/90"
            >
              {initial ? "Save" : "Add task"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
