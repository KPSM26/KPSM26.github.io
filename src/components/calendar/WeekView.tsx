import { useMemo, useRef, useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, Target, X, RotateCcw } from "lucide-react";
import { useBlocks } from "@/hooks/useBlocks";
import { useSettings } from "@/hooks/useSettings";
import { useTasksCtx } from "@/hooks/useTasksCtx";
import { useWeekPlanning } from "@/hooks/useWeekPlanning";
import { useIsMobile } from "@/hooks/use-mobile";
import { DayColumn } from "./DayColumn";
import { BlockEditor, type EditorDraft } from "./BlockEditor";
import { PlanningSummary } from "./PlanningSummary";
import { TaskSidebar } from "./TaskSidebar";
import { MobileWeekView } from "./MobileWeekView";
import { SearchDialog } from "@/components/search/SearchDialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import {
  DAY_LABELS,
  DAY_PX,
  HOUR_PX,
  formatHour,
  startOfWeekMonday,
  toISO,
} from "./constants";
import type { TimeBlock } from "@/types";
import type { Task } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";

type WeekViewProps = {
  onOpenSettings?: () => void;
};

export const WeekView = ({ onOpenSettings }: WeekViewProps) => {
  const {
    loaded,
    categories,
    categoriesById,
    expandBlocksInRange,
    addBlock,
    updateBlock,
    deleteBlock,
    intention,
    setIntention,
    clearIntention,
  } = useBlocks();

  const { tasks, updateTask } = useTasksCtx();
  const { settings } = useSettings();
  const isMobile = useIsMobile();

  const [weekStart, setWeekStart] = useState(() => startOfWeekMonday(new Date()));
  const [editor, setEditor] = useState<EditorDraft | null>(null);
  const [viewMode, setViewMode] = useState<"week" | "today">("week");
  const [toolsOpen, setToolsOpen] = useState(true);
  const [calendarOpen, setCalendarOpen] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);
  const [activeDragBlock, setActiveDragBlock] = useState<TimeBlock | null>(null);
  const [intentionEditing, setIntentionEditing] = useState(false);
  const [intentionDraft, setIntentionDraft] = useState("");
  const [movingBlockId, setMovingBlockId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastAutoScrollKeyRef = useRef<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const days = useMemo(() => {
    if (viewMode === "today") {
      return [new Date()];
    }
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, [weekStart, viewMode]);

  const weekStartISO = toISO(days[0]);
  const weekEndISO = toISO(days[days.length - 1]);

  const blocksByDate = useMemo(() => {
    if (!loaded) return new Map<string, TimeBlock[]>();
    const all = expandBlocksInRange(weekStartISO, weekEndISO);
    const m = new Map<string, TimeBlock[]>();
    for (const b of all) {
      const list = m.get(b.date) ?? [];
      list.push(b);
      m.set(b.date, list);
    }
    return m;
  }, [loaded, expandBlocksInRange, weekStartISO, weekEndISO]);

  const blocks = useMemo(() => [...blocksByDate.values()].flat(), [blocksByDate]);

  const taskById = useMemo(() => {
    const m = new Map<string, Task>();
    tasks.forEach(t => m.set(t.id, t));
    return m;
  }, [tasks]);

  const todayISO = toISO(new Date());

  const activeIntention = intention && intention.date === todayISO ? intention.text : "";

  const {
    scheduledMinutesByTask,
    scheduledTaskIds,
    todayScheduledMinutes,
    todayUnscheduledMinutes,
    todayPlanningState,
    resetDialogOpen,
    resetTargets,
    setResetDialogOpen,
    getEditorDraftForTask,
    handleBlockResize,
    handleSave,
    handleDelete,
    handleOpenReset,
    handleConfirmReset,
    handleTaskDrop,
    autoPlanScope,
    handleDragEnd,
  } = useWeekPlanning({
    tasks,
    categories,
    blocks,
    blocksByDate,
    taskById,
    days,
    todayISO,
    weekStartISO,
    addBlock,
    updateBlock,
    deleteBlock,
    updateTask,
  });

  const commitIntention = () => {
    const text = intentionDraft.trim();
    if (text) {
      setIntention(text, todayISO);
    } else if (activeIntention) {
      clearIntention();
    }
    setIntentionEditing(false);
  };

  useEffect(() => {
    if (!calendarOpen) return;
    const viewKey = `${viewMode}:${weekStartISO}:${weekEndISO}`;
    if (lastAutoScrollKeyRef.current === viewKey) return;

    const earliestVisibleMinute = blocks.reduce((minMinute, block) => {
      return Math.min(minMinute, block.startMinute);
    }, 8 * 60);
    const anchorMinute = blocks.length > 0
      ? Math.max(6 * 60, earliestVisibleMinute - 60)
      : 8 * 60;
    const scrollTo = Math.max(0, (anchorMinute / 60) * HOUR_PX - 24);
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollTo;
      lastAutoScrollKeyRef.current = viewKey;
    }
  }, [blocks, calendarOpen, viewMode, weekStartISO, weekEndISO]);

  // Cmd+K → search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(prev => !prev);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const shiftWeek = (delta: number) => {
    if (viewMode === "today") { setViewMode("week"); return; }
    const d = new Date(weekStart);
    d.setDate(d.getDate() + delta * 7);
    setWeekStart(d);
  };

  const goToToday = () => {
    setWeekStart(startOfWeekMonday(new Date()));
    setViewMode("today");
  };

  const handleCreate = useCallback(
    (date: string, startMinute: number, durationMinutes: number) => {
      setEditor({
        title: "",
        date,
        startMinute,
        durationMinutes,
        categoryId: categories[0]?.id ?? "",
      });
    },
    [categories]
  );

  const handleBlockClick = useCallback((block: TimeBlock) => {
    if (movingBlockId === block.id) {
      setMovingBlockId(null);
      return;
    }
    setEditor({
      id: block.id,
      title: block.title,
      notes: block.notes,
      date: block.date,
      startMinute: block.startMinute,
      durationMinutes: block.durationMinutes,
      categoryId: block.categoryId,
      taskId: block.taskId,
    });
  }, [movingBlockId]);

  const handleMobileMoveStart = useCallback((draft: EditorDraft) => {
    if (!draft.id) return;
    setEditor(null);
    setMovingBlockId(draft.id);
  }, []);

  const handleMobileMoveBlock = useCallback((blockId: string, date: string, startMinute: number) => {
    const block = blocks.find(candidate => candidate.id === blockId);
    if (!block) return;
    updateBlock(blockId, { date, startMinute });
    if (block.taskId) {
      updateTask(block.taskId, {
        date,
        time: `${String(Math.floor(startMinute / 60)).padStart(2, "0")}:${String(startMinute % 60).padStart(2, "0")}`,
      });
    }
    setMovingBlockId(null);
  }, [blocks, updateBlock, updateTask]);

  const monthLabel = days[Math.floor(days.length / 2)].toLocaleDateString(undefined, {
    month: "long", year: "numeric",
  });
  const gridCols = viewMode === "today"
    ? "grid-cols-[64px_1fr]"
    : "grid-cols-[64px_repeat(7,1fr)]";

  if (isMobile) {
    return (
      <>
        <MobileWeekView
          onOpenSettings={onOpenSettings}
          onOpenSearch={() => setSearchOpen(true)}
          tasks={tasks}
          categories={categories}
          categoriesById={categoriesById}
          blocks={blocks}
          blocksByDate={blocksByDate}
          scheduledTaskIds={scheduledTaskIds}
          scheduledMinutesByTask={scheduledMinutesByTask}
          todayISO={todayISO}
          onOpenEditor={setEditor}
          onResizeBlock={handleBlockResize}
          onScheduleTaskDrop={handleTaskDrop}
          onAutoPlan={autoPlanScope}
          onOpenReset={handleOpenReset}
          activeIntention={activeIntention}
          planningStatusVisible={settings.planningStatusVisible}
          todayScheduledMinutes={todayScheduledMinutes}
          todayUnscheduledMinutes={todayUnscheduledMinutes}
          todayPlanningState={todayPlanningState}
          onSetIntention={text => setIntention(text, todayISO)}
          onClearIntention={clearIntention}
          getEditorDraftForTask={getEditorDraftForTask}
          movingBlockId={movingBlockId}
          onStartMoveBlock={setMovingBlockId}
          onMoveBlock={handleMobileMoveBlock}
          onCancelMove={() => setMovingBlockId(null)}
          deleteBlock={deleteBlock}
          updateTask={updateTask}
        />

        <BlockEditor
          open={editor !== null}
          draft={editor}
          categories={categories}
          onCancel={() => setEditor(null)}
          onSave={draft => handleSave(draft, () => setEditor(null))}
          onDelete={id => handleDelete(id, () => setEditor(null))}
        />

        <SearchDialog
          open={searchOpen}
          onOpenChange={setSearchOpen}
          tasks={tasks}
          blocks={blocks}
          onSelectBlock={(block) => {
            setSearchOpen(false);
            setEditor({
              id: block.id,
              title: block.title,
              notes: block.notes,
              date: block.date,
              startMinute: block.startMinute,
              durationMinutes: block.durationMinutes,
              categoryId: block.categoryId,
              taskId: block.taskId,
            });
          }}
          onSelectTask={(task) => {
            setSearchOpen(false);
            setEditor(getEditorDraftForTask(task));
          }}
        />

        <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reset remaining day?</DialogTitle>
              <DialogDescription>
                {resetTargets.length === 0
                  ? "No unfinished blocks found for today."
                  : `This will clear ${resetTargets.length} unfinished block${resetTargets.length !== 1 ? "s" : ""} and move linked tasks back to your backlog. Completed tasks stay untouched.`}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <button
                onClick={() => setResetDialogOpen(false)}
                className="rounded-md px-4 py-2 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-foreground/5"
              >
                Cancel
              </button>
              {resetTargets.length > 0 && (
                <button
                  onClick={handleConfirmReset}
                  className="rounded-md bg-destructive px-4 py-2 text-[13px] font-medium text-destructive-foreground transition-colors hover:bg-destructive/90"
                >
                  Reset Day
                </button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={e => {
        const block = (e.active.data.current as { block: TimeBlock }).block;
        setActiveDragBlock(block);
      }}
      onDragEnd={e => handleDragEnd(e, () => setActiveDragBlock(null))}
      onDragCancel={() => {
        setActiveDragBlock(null);
      }}
    >
      <div className="flex h-screen w-full flex-col bg-background px-4 pb-4 pt-4">
        <div className="surface-panel mb-3 overflow-hidden bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.1),transparent_16rem)]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 px-4 py-2.5">
            <div className="flex min-w-0 flex-wrap items-center gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-primary/70">
                  DayDock
                </p>
                <h1 className="text-[17px] font-semibold tracking-[-0.03em] text-foreground">
                  Schedule
                </h1>
              </div>
              <div className="rounded-full border border-border/60 bg-background/70 px-3 py-1 text-[12px] font-medium tracking-[-0.02em] text-foreground shadow-sm">
                {monthLabel}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={goToToday}
                className={cn(
                  "rounded-full px-4 py-2 text-[12px] font-medium transition-colors",
                  viewMode === "today"
                    ? "bg-primary text-primary-foreground"
                    : "bg-background/70 text-muted-foreground hover:bg-background hover:text-foreground"
                )}
              >
                Today
              </button>
              <button
                onClick={() => { setViewMode("week"); setWeekStart(startOfWeekMonday(new Date())); }}
                className={cn(
                  "rounded-full px-4 py-2 text-[12px] font-medium transition-colors",
                  viewMode === "week"
                    ? "bg-primary text-primary-foreground"
                    : "bg-background/70 text-muted-foreground hover:bg-background hover:text-foreground"
                )}
              >
                Week
              </button>
              <button
                onClick={() => shiftWeek(-1)}
                className="grid h-9 w-9 place-items-center rounded-full bg-background/70 text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
                aria-label="Previous week"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => shiftWeek(1)}
                className="grid h-9 w-9 place-items-center rounded-full bg-background/70 text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
                aria-label="Next week"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
              <button
                onClick={handleOpenReset}
                className="flex items-center gap-1.5 rounded-full bg-background/70 px-4 py-2 text-[12px] font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                title="Reset remaining day – clears unfinished blocks and moves tasks to backlog"
              >
                <RotateCcw className="h-3 w-3" />
                Reset Day
              </button>
              <button
                onClick={() => setSearchOpen(true)}
                className="rounded-full bg-background/70 px-4 py-2 text-[12px] font-medium text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
                title="Search (⌘K)"
              >
                ⌘K
              </button>
              <button
                onClick={() => setToolsOpen(v => !v)}
                className={cn(
                  "rounded-full px-3 py-2 text-[12px] font-medium transition-colors",
                  toolsOpen
                    ? "bg-accent text-accent-foreground"
                    : "bg-background/70 text-muted-foreground hover:bg-background hover:text-foreground"
                )}
                title="Toggle tools"
              >
                Tools
              </button>
              <button
                onClick={() => setCalendarOpen(v => !v)}
                className={cn(
                  "rounded-full px-3 py-2 text-[12px] font-medium transition-colors",
                  calendarOpen
                    ? "bg-accent text-accent-foreground"
                    : "bg-background/70 text-muted-foreground hover:bg-background hover:text-foreground"
                )}
                title="Toggle calendar"
              >
                Calendar
              </button>
              <button
                onClick={() => setSidebarOpen(v => !v)}
                className={cn(
                  "rounded-full px-3 py-2 text-[12px] font-medium transition-colors",
                  sidebarOpen
                    ? "bg-accent text-accent-foreground"
                    : "bg-background/70 text-muted-foreground hover:bg-background hover:text-foreground"
                )}
                title="Toggle tasks"
              >
                Tasks
              </button>
            </div>
          </div>

          {toolsOpen && (
            <div className="flex flex-col gap-2 px-4 py-2.5 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex min-w-0 items-center gap-2 rounded-full border border-border/60 bg-background/35 px-3 py-1.5">
                <Target className="h-3.5 w-3.5 shrink-0 text-primary/70" />
                <p className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Focus
                </p>
                {intentionEditing ? (
                  <input
                    autoFocus
                    value={intentionDraft}
                    onChange={e => setIntentionDraft(e.target.value)}
                    onBlur={commitIntention}
                    onKeyDown={e => {
                      if (e.key === "Enter") { e.preventDefault(); commitIntention(); }
                      if (e.key === "Escape") { setIntentionEditing(false); }
                    }}
                    placeholder="Add a focus for today"
                    className="min-w-0 flex-1 bg-transparent text-[12px] font-medium text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
                  />
                ) : activeIntention ? (
                  <button
                    onClick={() => { setIntentionDraft(activeIntention); setIntentionEditing(true); }}
                    className="group flex min-w-0 flex-1 items-center gap-2 text-left"
                  >
                    <span className="truncate text-[12px] font-medium text-foreground">{activeIntention}</span>
                    <span
                      onClick={e => { e.stopPropagation(); clearIntention(); }}
                      className="hidden h-5 w-5 cursor-pointer place-items-center rounded-full text-muted-foreground/60 hover:bg-foreground/5 hover:text-foreground group-hover:grid"
                      aria-label="Clear intention"
                    >
                      <X className="h-3 w-3" />
                    </span>
                  </button>
                ) : (
                  <button
                    onClick={() => { setIntentionDraft(""); setIntentionEditing(true); }}
                    className="min-w-0 text-[12px] text-muted-foreground/70 hover:text-foreground"
                  >
                    Add a focus for today
                  </button>
                )}
              </div>

              {settings.planningStatusVisible && (
                <PlanningSummary
                  className="w-full lg:w-auto lg:min-w-[500px]"
                  scheduledMinutes={todayScheduledMinutes}
                  unscheduledMinutes={todayUnscheduledMinutes}
                  planningState={todayPlanningState}
                  showPlanningStatus={settings.planningStatusVisible}
                  onAutoPlanToday={() => autoPlanScope("today")}
                  onReplanWeek={() => autoPlanScope("week")}
                />
              )}
            </div>
          )}
        </div>

        {/* Main content: left column (headers + calendar) + right sidebar */}
        <div className="flex flex-1 gap-3 overflow-hidden">

          {/* Left column: day headers + scrollable calendar body — same width, always aligned */}
          {!calendarOpen && (
            <button
              onClick={() => setCalendarOpen(true)}
              className="surface-card flex w-10 shrink-0 items-center justify-center text-muted-foreground/50 transition-colors hover:bg-card hover:text-foreground"
              title="Expand calendar"
            >
              <span
                className="select-none text-[9px] font-semibold uppercase tracking-widest"
                style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
              >
                Calendar
              </span>
            </button>
          )}

          {calendarOpen && (
          <div className="surface-panel flex min-w-0 flex-1 flex-col overflow-hidden bg-[linear-gradient(180deg,hsl(var(--card)/0.94),hsl(var(--background)/0.72))]">

            {/* Day headers */}
            <div className={cn("grid shrink-0 border-b border-border/60 bg-background/35 px-2 pt-2 backdrop-blur-sm", gridCols)}>
              <div className="rounded-xl bg-transparent" />
              {days.map((d, i) => {
                const iso = toISO(d);
                const isToday = iso === todayISO;
                const label = viewMode === "today"
                  ? d.toLocaleDateString(undefined, { weekday: "long" })
                  : DAY_LABELS[i];
                return (
                  <div key={iso} className="px-2 py-2 text-center">
                    <div className="rounded-2xl border border-border/50 bg-card/70 px-3 py-3 shadow-sm backdrop-blur-sm">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      {label}
                    </div>
                    <div
                      className={cn(
                        "mx-auto mt-2 grid h-8 w-8 place-items-center rounded-full text-[13px] font-semibold tabular-nums",
                        isToday ? "bg-primary text-primary-foreground shadow-sm" : "bg-background/70 text-foreground"
                      )}
                    >
                      {d.getDate()}
                    </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Calendar scroll area */}
            <div ref={scrollRef} className="scrollbar-thin flex-1 overflow-y-auto bg-[linear-gradient(180deg,hsl(var(--card)/0.72),hsl(var(--background)/0.55))] px-2 pb-2">
              <div className={cn("grid", gridCols)} style={{ height: DAY_PX }}>
                {/* Time ruler */}
                <div className="relative border-r border-border/50 bg-background/40">
                  {Array.from({ length: 24 }, (_, h) => (
                    <div
                      key={h}
                      className="absolute left-0 right-0 flex items-start justify-end pr-2"
                      style={{ top: h * HOUR_PX, height: HOUR_PX }}
                    >
                      <span className="relative -top-1.5 font-mono text-[10px] tabular-nums text-muted-foreground/60">
                        {formatHour(h)}
                      </span>
                    </div>
                  ))}
                </div>

                {days.map(d => {
                  const iso = toISO(d);
                  return (
                    <DayColumn
                      key={iso}
                      date={iso}
                      isToday={iso === todayISO}
                      blocks={blocksByDate.get(iso) ?? []}
                      categoriesById={categoriesById}
                      onBlockClick={handleBlockClick}
                      onBlockResize={handleBlockResize}
                      onCreate={handleCreate}
                      onTaskDrop={handleTaskDrop}
                    />
                  );
                })}
              </div>
            </div>
          </div>
          )}

          {!calendarOpen && !sidebarOpen && (
            <div className="surface-panel flex min-w-0 flex-1 items-center justify-center px-6 text-center">
              <div className="max-w-sm">
                <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/70">
                  Workspace Collapsed
                </p>
                <p className="mt-2 text-[14px] text-foreground">
                  Turn Calendar or Tasks back on from the header whenever you want them.
                </p>
              </div>
            </div>
          )}

          {/* Sidebar — always mounted, width animates for smooth slide */}
          <div
            className="shrink-0 overflow-hidden transition-[width] duration-300 ease-in-out"
            style={{ width: sidebarOpen ? 280 : 0 }}
          >
            <div className="surface-panel h-full w-[280px] overflow-hidden">
              <TaskSidebar
                tasks={tasks}
                weekStartISO={weekStartISO}
                weekEndISO={weekEndISO}
                scheduledTaskIds={scheduledTaskIds}
                scheduledMinutesByTask={scheduledMinutesByTask}
                onOpenTask={(task) => setEditor(getEditorDraftForTask(task))}
              />
            </div>
          </div>

          {/* Collapsed tab handle */}
          {!sidebarOpen && (
            <button
              onClick={() => setSidebarOpen(true)}
              className="surface-card flex w-10 shrink-0 items-center justify-center text-muted-foreground/50 transition-colors hover:bg-card hover:text-foreground"
              title="Expand task panel"
            >
              <span
                className="select-none text-[9px] font-semibold uppercase tracking-widest"
                style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
              >
                Tasks
              </span>
            </button>
          )}
        </div>

        <BlockEditor
          open={editor !== null}
          draft={editor}
          categories={categories}
          onCancel={() => setEditor(null)}
          onSave={draft => handleSave(draft, () => setEditor(null))}
          onDelete={id => handleDelete(id, () => setEditor(null))}
          onMove={handleMobileMoveStart}
        />

        <SearchDialog
          open={searchOpen}
          onOpenChange={setSearchOpen}
          tasks={tasks}
          blocks={blocks}
          onSelectBlock={(block) => {
            setSearchOpen(false);
            // Navigate to the week containing this block
            const blockDate = new Date(block.date + "T00:00:00");
            setWeekStart(startOfWeekMonday(blockDate));
            setViewMode("week");
            setTimeout(() => handleBlockClick(block), 100);
          }}
          onSelectTask={(task) => {
            setSearchOpen(false);
          }}
        />

        <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reset remaining day?</DialogTitle>
              <DialogDescription>
                {resetTargets.length === 0
                  ? "No unfinished blocks found for today."
                  : `This will clear ${resetTargets.length} unfinished block${resetTargets.length !== 1 ? "s" : ""} and move linked tasks back to your backlog. Completed tasks stay untouched.`}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <button
                onClick={() => setResetDialogOpen(false)}
                className="rounded-md px-4 py-2 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-foreground/5"
              >
                Cancel
              </button>
              {resetTargets.length > 0 && (
                <button
                  onClick={handleConfirmReset}
                  className="rounded-md bg-destructive px-4 py-2 text-[13px] font-medium text-destructive-foreground transition-colors hover:bg-destructive/90"
                >
                  Reset Day
                </button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <DragOverlay>
        {activeDragBlock && (
          <div
            className="rounded-md border-l-[3px] px-2 py-1 text-[11px] font-medium shadow-lg opacity-90"
            style={{
              borderLeftColor: categoriesById.get(activeDragBlock.categoryId)?.color ?? "#9CA3AF",
              backgroundColor: `${categoriesById.get(activeDragBlock.categoryId)?.color ?? "#9CA3AF"}33`,
              width: "120px",
              height: Math.max((activeDragBlock.durationMinutes / 60) * HOUR_PX - 2, 18),
            }}
          >
            <div className="truncate">{activeDragBlock.title}</div>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
};
