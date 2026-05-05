import { useEffect, useMemo, useRef, useState } from "react";
import { useTasksCtx } from "@/hooks/useTasksCtx";
import { Task, FilterMode } from "@/lib/types";
import { formatDateLabel, isOverdue, todayISO } from "@/lib/task-utils";
import { TaskItem } from "./TaskItem";
import { TaskDialog } from "./TaskDialog";
import { SettingsPanel } from "@/components/settings/SettingsPanel";
import { Plus, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

const filters: { id: FilterMode; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "upcoming", label: "Upcoming" },
  { id: "all", label: "All" },
];

const priorityOrder = { high: 0, med: 1, low: 2 } as const;
const AUTO_HIDE_MS = 180_000;

export const DayDockWidget = () => {
  const { tasks, addTask, updateTask, toggleTask, deleteTask } = useTasksCtx();
  const [filter, setFilter] = useState<FilterMode>("today");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [collapsed, setCollapsed] = useState(true);
  const [quickTitle, setQuickTitle] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const quickRef = useRef<HTMLInputElement>(null);
  const widgetRef = useRef<HTMLDivElement>(null);
  const idleTimer = useRef<number | null>(null);

  const today = todayISO();
  const todaysTasks = tasks.filter(t => t.date === today);
  const todayActive = todaysTasks.filter(t => !t.completed);
  const todayCompleted = todaysTasks.filter(t => t.completed);
  const progress = todaysTasks.length === 0 ? 0 : Math.round((todayCompleted.length / todaysTasks.length) * 100);

  const top3 = useMemo(
    () =>
      [...todayActive]
        .sort((a, b) => {
          if (priorityOrder[a.priority] !== priorityOrder[b.priority])
            return priorityOrder[a.priority] - priorityOrder[b.priority];
          return (a.time ?? "99:99").localeCompare(b.time ?? "99:99");
        })
        .slice(0, 3),
    [todayActive]
  );
  const top3Ids = new Set(top3.map(t => t.id));
  const restToday = todayActive.filter(t => !top3Ids.has(t.id));

  const sortFn = (a: Task, b: Task) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    const at = a.time ?? "99:99";
    const bt = b.time ?? "99:99";
    if (at !== bt) return at.localeCompare(bt);
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  };

  const upcoming = useMemo(
    () => tasks.filter(t => t.date > today && !t.completed).sort(sortFn),
    [tasks, today]
  );
  const allTasks = useMemo(() => [...tasks].sort(sortFn), [tasks]);

  const openNew = () => { setEditing(null); setDialogOpen(true); };
  const openEdit = (t: Task) => { setEditing(t); setDialogOpen(true); };

  // Auto-hide after idle
  const resetIdle = () => {
    if (idleTimer.current) window.clearTimeout(idleTimer.current);
    idleTimer.current = window.setTimeout(() => setCollapsed(true), AUTO_HIDE_MS);
  };
  useEffect(() => {
    if (collapsed || dialogOpen) {
      if (idleTimer.current) window.clearTimeout(idleTimer.current);
      return;
    }
    resetIdle();
    return () => { if (idleTimer.current) window.clearTimeout(idleTimer.current); };
  }, [collapsed, dialogOpen, tasks.length]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const inField = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable;
      if (e.key === "/" && !inField && !dialogOpen) {
        e.preventDefault();
        setCollapsed(false);
        setTimeout(() => quickRef.current?.focus(), 50);
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        if (selectedId) { e.preventDefault(); toggleTask(selectedId); }
        return;
      }
      if (e.key === "Escape" && !inField && !dialogOpen) {
        setCollapsed(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectedId, dialogOpen, toggleTask]);

  const handleQuickSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const title = quickTitle.trim();
    if (!title) return;
    addTask({ title, date: today, priority: "med", repeatDaily: false });
    setQuickTitle("");
    resetIdle();
  };

  const todayLabel = new Date().toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });

  // Collapsed pill — centered at top of screen
  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        className="fixed left-1/2 top-6 z-40 flex -translate-x-1/2 cursor-pointer items-center gap-3 rounded-full bg-card px-4 py-1.5 text-[12px] shadow-soft transition-transform animate-in-fade hover:translate-y-0.5"
        aria-label="Open DayBlock"
        title="Click to open DayBlock"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-primary" />
        <span className="font-medium tracking-tight">DayBlock</span>
        <span className="font-mono text-[11px] text-muted-foreground">
          {todayActive.length} left{progress > 0 ? ` · ${progress}%` : ""}
        </span>
        <span className="relative h-1 w-16 overflow-hidden rounded-full bg-muted/70">
          <span
            className="absolute inset-y-0 left-0 rounded-full bg-primary transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </span>
        <ChevronDown className="h-3 w-3 text-muted-foreground" />
      </button>
    );
  }

  return (
    <>
      <div
        ref={widgetRef}
        onMouseMove={resetIdle}
        onMouseEnter={resetIdle}
        onClick={resetIdle}
        className="fixed left-0 right-0 top-6 z-40 flex justify-center px-4"
      >
        <div className="w-[560px] max-w-full animate-in-fade overflow-hidden rounded-xl bg-card shadow-soft">

          {/* Header */}
          <div className="flex items-center justify-between gap-4 px-5 pb-3 pt-4">
            <h2 className="truncate text-[18px] font-semibold leading-none tracking-tight">{todayLabel}</h2>
            <div className="flex items-center gap-1.5">
              <div className="inline-flex items-center gap-0.5 rounded-md bg-muted/60 p-0.5">
                {filters.map(f => (
                  <button
                    key={f.id}
                    onClick={() => setFilter(f.id)}
                    className={cn(
                      "rounded px-2 py-0.5 text-[11px] font-medium transition-colors",
                      filter === f.id
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              <SettingsPanel />

              <button
                onClick={() => setCollapsed(true)}
                className="grid h-6 w-6 place-items-center rounded text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground"
                aria-label="Collapse DayBlock"
                title="Collapse (Esc)"
              >
                <ChevronUp className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Quick add */}
          <form onSubmit={handleQuickSubmit} className="px-4 pb-2">
            <div className="group flex items-center gap-2.5 rounded-md bg-muted/40 px-3 py-1.5 transition-colors focus-within:bg-muted/70">
              <Plus className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={2.5} />
              <input
                ref={quickRef}
                value={quickTitle}
                onChange={e => setQuickTitle(e.target.value)}
                placeholder="Add a task and press Enter…"
                className="flex-1 bg-transparent text-[13px] outline-none placeholder:text-muted-foreground/70"
              />
              <span className="kbd hidden group-focus-within:inline-flex">↵</span>
            </div>
          </form>

          {/* Task list */}
          <div className="scrollbar-thin max-h-[440px] overflow-y-auto pb-1">
            {filter === "today" ? (
              todaysTasks.length === 0 ? (
                <EmptyState message="Nothing scheduled. Press / to add." />
              ) : (
                <>
                  {top3.length > 0 && (
                    <section>
                      <div className="section-title">Top 3 Today</div>
                      <div>
                        {top3.map((t, i) => (
                          <TaskItem key={t.id} task={t} rank={i + 1} selected={selectedId === t.id}
                            onSelect={setSelectedId} onToggle={toggleTask} onEdit={openEdit} onDelete={deleteTask} />
                        ))}
                      </div>
                    </section>
                  )}
                  {restToday.length > 0 && (
                    <section className={cn(top3.length > 0 && "pt-1")}>
                      {top3.length > 0 && <div className="section-title">More</div>}
                      <div>
                        {restToday.map(t => (
                          <TaskItem key={t.id} task={t} selected={selectedId === t.id}
                            onSelect={setSelectedId} onToggle={toggleTask} onEdit={openEdit} onDelete={deleteTask} />
                        ))}
                      </div>
                    </section>
                  )}
                  {todayCompleted.length > 0 && (
                    <section className="mt-2 pt-2">
                      <div className="mx-4 mb-1 h-px bg-border/60" />
                      {todayCompleted.map(t => (
                        <TaskItem key={t.id} task={t} selected={selectedId === t.id}
                          onSelect={setSelectedId} onToggle={toggleTask} onEdit={openEdit} onDelete={deleteTask} />
                      ))}
                    </section>
                  )}
                </>
              )
            ) : filter === "upcoming" ? (
              upcoming.length === 0 ? (
                <EmptyState message="No upcoming tasks." />
              ) : (
                groupByDate(upcoming).map(g => (
                  <section key={g.key}>
                    <div className="section-title">{formatDateLabel(g.key)}</div>
                    <div>
                      {g.items.map(t => (
                        <TaskItem key={t.id} task={t} selected={selectedId === t.id}
                          onSelect={setSelectedId} onToggle={toggleTask} onEdit={openEdit} onDelete={deleteTask} />
                      ))}
                    </div>
                  </section>
                ))
              )
            ) : allTasks.length === 0 ? (
              <EmptyState message="All clear." />
            ) : (
              groupByDate(allTasks).map(g => (
                <section key={g.key}>
                  <div className="section-title">{formatDateLabel(g.key)}</div>
                  <div>
                    {g.items.map(t => (
                      <TaskItem key={t.id} task={t} selected={selectedId === t.id}
                        onSelect={setSelectedId} onToggle={toggleTask} onEdit={openEdit} onDelete={deleteTask} />
                    ))}
                  </div>
                </section>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-4 py-2 text-[10px] text-muted-foreground/80">
            <div className="flex items-center gap-1.5">
              <span className="kbd">/</span>
              <span>focus</span>
              <span className="mx-1 opacity-40">·</span>
              <span className="kbd">⌘↵</span>
              <span>complete</span>
            </div>
            <button
              onClick={openNew}
              className="text-[10.5px] uppercase tracking-wider transition-colors hover:text-foreground"
            >
              + Detailed
            </button>
          </div>
        </div>
      </div>

      {/* FAB */}
      <button
        onClick={openNew}
        className="fixed bottom-8 left-1/2 z-50 grid h-12 w-12 -translate-x-1/2 place-items-center rounded-full bg-primary text-primary-foreground shadow-fab transition-all duration-200 hover:bg-primary/90 active:scale-95"
        aria-label="Add new task"
      >
        <Plus className="h-5 w-5" strokeWidth={2.5} />
      </button>

      <TaskDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initial={editing}
        onSave={addTask}
        onUpdate={updateTask}
      />
    </>
  );
};

const EmptyState = ({ message }: { message: string }) => (
  <div className="px-6 py-8 text-center text-[12px] text-muted-foreground">{message}</div>
);

function groupByDate(items: Task[]) {
  const map = new Map<string, Task[]>();
  items.forEach(t => {
    const arr = map.get(t.date) ?? [];
    arr.push(t);
    map.set(t.date, arr);
  });
  return Array.from(map.entries()).map(([key, items]) => ({ key, items }));
}
