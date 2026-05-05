import { useMemo, useState, useRef, useEffect, useCallback, type ReactNode } from "react";
import type { Task } from "@/lib/types";
import { todayISO } from "@/lib/task-utils";
import { Trash2, CheckCircle2, Plus, Pencil, CalendarPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTasksCtx } from "@/hooks/useTasksCtx";

const priorityDot: Record<Task["priority"], string> = {
  high: "bg-red-400",
  med: "bg-amber-400",
  low: "bg-slate-400",
};

type Props = {
  tasks: Task[];
  weekStartISO: string;
  weekEndISO: string;
  onOpenTask: (task: Task) => void;
  scheduledTaskIds?: Set<string>;
  scheduledMinutesByTask?: Map<string, number>;
};

export const TaskSidebar = ({
  tasks,
  weekStartISO,
  weekEndISO,
  onOpenTask,
  scheduledTaskIds,
  scheduledMinutesByTask,
}: Props) => {
  const { addTask, updateTask, deleteTask } = useTasksCtx();
  const today = todayISO();

  const [adding, setAdding] = useState(false);
  const [addInput, setAddInput] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editInput, setEditInput] = useState("");
  const [pendingDelete, setPendingDelete] = useState<Task | null>(null);
  const deleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const addInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (adding && addInputRef.current) addInputRef.current.focus();
  }, [adding]);

  const commitAdd = useCallback(() => {
    const title = addInput.trim();
    if (title) {
      addTask({ title, date: today, priority: "med", repeatDaily: false });
    }
    setAddInput("");
    setAdding(false);
  }, [addInput, addTask, today]);

  const commitEdit = useCallback(() => {
    if (!editingId) return;
    const title = editInput.trim();
    if (title) updateTask(editingId, { title });
    setEditingId(null);
    setEditInput("");
  }, [editingId, editInput, updateTask]);

  const handleDeleteTask = useCallback((task: Task) => {
    if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current);
    if (pendingDelete) deleteTask(pendingDelete.id);
    setPendingDelete(task);
    deleteTimerRef.current = setTimeout(() => {
      deleteTask(task.id);
      setPendingDelete(null);
    }, 5000);
  }, [pendingDelete, deleteTask]);

  const handleUndoDelete = useCallback(() => {
    if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current);
    setPendingDelete(null);
  }, []);

  useEffect(() => () => { if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current); }, []);

  const { unscheduled, thisWeek, scheduled } = useMemo(() => {
    const unscheduled: Task[] = [];
    const thisWeek: Task[] = [];
    const scheduled: Task[] = [];

    for (const t of tasks) {
      if (t.completed) continue;
      if (pendingDelete?.id === t.id) continue;
      if (scheduledTaskIds?.has(t.id) || t.blockId) {
        scheduled.push(t);
      } else if (t.date >= weekStartISO && t.date <= weekEndISO) {
        thisWeek.push(t);
      } else {
        unscheduled.push(t);
      }
    }

    thisWeek.sort((a, b) => a.date.localeCompare(b.date));
    unscheduled.sort((a, b) => a.date.localeCompare(b.date));

    return { unscheduled, thisWeek, scheduled };
  }, [tasks, weekStartISO, weekEndISO, pendingDelete, scheduledTaskIds]);

  const isEmpty = unscheduled.length === 0 && thisWeek.length === 0 && scheduled.length === 0;

  return (
    <div className="flex w-[280px] shrink-0 flex-col bg-transparent">
      {/* Header */}
      <div className="border-b border-border/60 px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Task Library
            </p>
            <p className="mt-1 text-[14px] font-medium tracking-[-0.02em] text-foreground">
              Keep tasks close by.
            </p>
            <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground/70">
              Drag a task onto the calendar when you want to schedule it.
            </p>
          </div>
          <button
            onClick={() => { setAdding(v => !v); setAddInput(""); }}
            className={cn(
              "grid h-9 w-9 shrink-0 place-items-center rounded-full border border-border/70 transition-colors",
              adding
                ? "bg-primary text-primary-foreground"
                : "bg-background/70 text-muted-foreground hover:bg-background hover:text-foreground"
            )}
            title="Add task (N)"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          <SummaryPill label="Backlog" value={unscheduled.length} />
          <SummaryPill label="This Week" value={thisWeek.length} />
          <SummaryPill label="Scheduled" value={scheduled.length} />
        </div>
      </div>

      {/* Inline add input */}
      {adding && (
        <div className="border-b border-border/60 px-4 py-3">
          <div className="surface-card px-3 py-2.5">
            <input
              ref={addInputRef}
              value={addInput}
              onChange={e => setAddInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter") { e.preventDefault(); commitAdd(); }
                if (e.key === "Escape") { setAdding(false); setAddInput(""); }
              }}
              onBlur={commitAdd}
              placeholder="Task name…"
              className="w-full bg-transparent text-[13px] text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
            />
          </div>
        </div>
      )}

      {/* Task list */}
      <div className="scrollbar-thin flex-1 overflow-y-auto px-3 py-2.5">
        {thisWeek.length > 0 && (
          <TaskSection label="This week">
            {thisWeek.map(t => (
              <SidebarTask
                key={t.id}
                task={t}
                onOpenTask={onOpenTask}
                isEditing={editingId === t.id}
                editInput={editInput}
                onEditInputChange={setEditInput}
                onStartEdit={() => { setEditingId(t.id); setEditInput(t.title); }}
                onCommitEdit={commitEdit}
                onCancelEdit={() => { setEditingId(null); setEditInput(""); }}
                onDelete={() => handleDeleteTask(t)}
                scheduledMinutes={scheduledMinutesByTask?.get(t.id)}
              />
            ))}
          </TaskSection>
        )}

        {unscheduled.length > 0 && (
          <TaskSection label="Backlog">
            {unscheduled.map(t => (
              <SidebarTask
                key={t.id}
                task={t}
                onOpenTask={onOpenTask}
                isEditing={editingId === t.id}
                editInput={editInput}
                onEditInputChange={setEditInput}
                onStartEdit={() => { setEditingId(t.id); setEditInput(t.title); }}
                onCommitEdit={commitEdit}
                onCancelEdit={() => { setEditingId(null); setEditInput(""); }}
                onDelete={() => handleDeleteTask(t)}
              />
            ))}
          </TaskSection>
        )}

        {scheduled.length > 0 && (
          <TaskSection label="Scheduled">
            {scheduled.map(t => (
              <SidebarTask
                key={t.id}
                task={t}
                onOpenTask={onOpenTask}
                scheduled
                isEditing={false}
                editInput=""
                onEditInputChange={() => {}}
                onStartEdit={() => {}}
                onCommitEdit={() => {}}
                onCancelEdit={() => {}}
                onDelete={() => handleDeleteTask(t)}
                scheduledMinutes={scheduledMinutesByTask?.get(t.id)}
              />
            ))}
          </TaskSection>
        )}

        {isEmpty && !adding && (
          <div className="surface-card mt-10 flex flex-col items-center px-4 py-8 text-center">
            <CheckCircle2 className="mb-3 h-7 w-7 text-muted-foreground/30" />
            <p className="text-[13px] font-medium text-foreground">No tasks yet</p>
            <p className="mt-1 max-w-[22ch] text-[11px] leading-relaxed text-muted-foreground/70">
              Start with a small backlog and then pull tasks into your day.
            </p>
            <button
              onClick={() => setAdding(true)}
              className="mt-3 rounded-full bg-primary px-3 py-1.5 text-[11px] font-medium text-primary-foreground"
            >
              Add your first task
            </button>
          </div>
        )}
      </div>

      {/* Undo delete bar */}
      {pendingDelete && (
        <div className="border-t border-border/60 px-4 py-3">
          <div className="surface-card flex items-center justify-between px-3 py-2">
            <span className="text-[11px] text-muted-foreground">Task deleted</span>
            <button
              onClick={handleUndoDelete}
              className="text-[11px] font-medium text-primary hover:text-primary/80"
            >
              Undo
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const SummaryPill = ({ label, value }: { label: string; value: number }) => (
  <div className="rounded-2xl border border-border/60 bg-background/65 px-3 py-2">
    <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/70">
      {label}
    </p>
    <p className="mt-1 text-[16px] font-semibold tracking-[-0.03em] text-foreground">
      {value}
    </p>
  </div>
);

const TaskSection = ({ label, children }: { label: string; children: ReactNode }) => (
  <section className="mb-4">
    <p className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/65">
      {label}
    </p>
    <div className="space-y-2">{children}</div>
  </section>
);

type SidebarTaskProps = {
  task: Task;
  onOpenTask: (t: Task) => void;
  scheduled?: boolean;
  isEditing: boolean;
  editInput: string;
  onEditInputChange: (v: string) => void;
  onStartEdit: () => void;
  onCommitEdit: () => void;
  onCancelEdit: () => void;
  onDelete: () => void;
  scheduledMinutes?: number;
};

const SidebarTask = ({
  task,
  onOpenTask,
  scheduled,
  isEditing,
  editInput,
  onEditInputChange,
  onStartEdit,
  onCommitEdit,
  onCancelEdit,
  onDelete,
  scheduledMinutes,
}: SidebarTaskProps) => {
  const editRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && editRef.current) editRef.current.focus();
  }, [isEditing]);

  if (isEditing) {
    return (
      <div className="surface-card flex items-center gap-2 px-3 py-3">
        <span className={cn("h-2 w-2 shrink-0 rounded-full", priorityDot[task.priority])} />
        <input
          ref={editRef}
          value={editInput}
          onChange={e => onEditInputChange(e.target.value)}
          onKeyDown={e => {
            if (e.key === "Enter") { e.preventDefault(); onCommitEdit(); }
            if (e.key === "Escape") onCancelEdit();
          }}
          onBlur={onCommitEdit}
          className="min-w-0 flex-1 bg-transparent text-[13px] leading-snug text-foreground focus:outline-none"
        />
      </div>
    );
  }

  const isTodayTask = task.date === todayISO();

  return (
    <div
      draggable={!scheduled}
      onDragStart={e => {
        if (scheduled) return;
        e.dataTransfer.effectAllowed = "copy";
        e.dataTransfer.setData("task-id", task.id);
      }}
      onClick={scheduled ? () => onOpenTask(task) : undefined}
      className={cn(
        "surface-card group flex items-start gap-3 px-3 py-3 transition-all",
        !scheduled && "cursor-grab active:cursor-grabbing hover:-translate-y-px hover:bg-card/95",
        scheduled && "cursor-pointer"
      )}
      title={scheduled ? "Open scheduled block" : "Drag onto calendar to create a time block"}
    >
      <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", priorityDot[task.priority])} />

      <div className="min-w-0 flex-1">
        <div
          className="truncate text-[13px] font-medium leading-snug text-foreground"
          onDoubleClick={scheduled ? () => onOpenTask(task) : onStartEdit}
        >
          {task.title}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-secondary-foreground">
            {task.priority === "high" ? "High" : task.priority === "med" ? "Medium" : "Low"}
          </span>
          {isTodayTask && (
            <span className="rounded-full bg-accent/20 px-2 py-0.5 text-[10px] font-medium text-accent-foreground">
              Today
            </span>
          )}
          {scheduled && typeof scheduledMinutes === "number" && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
              {scheduledMinutes}m scheduled
            </span>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-0.5 opacity-60 transition-opacity group-hover:opacity-100">
        {scheduled ? (
          <button
            onClick={e => { e.stopPropagation(); onOpenTask(task); }}
            className="grid h-7 w-7 place-items-center rounded-full text-muted-foreground/50 hover:bg-foreground/5 hover:text-foreground"
            title="Open scheduled block"
          >
            <Pencil className="h-3 w-3" />
          </button>
        ) : (
          <>
          <button
            onClick={e => { e.stopPropagation(); onStartEdit(); }}
            className="grid h-7 w-7 place-items-center rounded-full text-muted-foreground/50 hover:bg-foreground/5 hover:text-foreground"
            title="Edit task"
          >
            <Pencil className="h-3 w-3" />
          </button>
          <button
            onClick={e => { e.stopPropagation(); onDelete(); }}
            className="grid h-7 w-7 place-items-center rounded-full text-muted-foreground/50 hover:bg-red-500/10 hover:text-red-500"
            title="Delete task"
          >
            <Trash2 className="h-3 w-3" />
          </button>
          <button
            onClick={e => { e.stopPropagation(); onOpenTask(task); }}
            className="grid h-7 w-7 place-items-center rounded-full text-muted-foreground/50 hover:bg-foreground/5 hover:text-foreground"
            title="Schedule to calendar"
          >
            <CalendarPlus className="h-3 w-3" />
          </button>
          </>
        )}
      </div>
    </div>
  );
};
