import { useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  CalendarDays,
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Search,
  Settings,
  Trash2,
  X,
} from "lucide-react";
import { DayColumn } from "./DayColumn";
import { TaskListContent, type TaskListSection } from "./TaskListContent";
import { TaskDialog } from "@/components/daydock/TaskDialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Drawer,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { Category, TimeBlock } from "@/types";
import type { Task } from "@/lib/types";
import type { EditorDraft } from "./BlockEditor";
import {
  DAY_PX,
  HOUR_PX,
  SLOT_MINUTES,
  formatHour,
  formatMinute,
  formatMinuteRange,
  toISO,
} from "./constants";
import { DEFAULT_SESSION_DURATION, DEFAULT_TASK_DURATION, PLANNING_END_MINUTE, PLANNING_START_MINUTE } from "@/lib/scheduling";
import { useTasksCtx } from "@/hooks/useTasksCtx";

type MobileTab = "schedule" | "tasks";
type MobileView = "day" | "week";

type Props = {
  onOpenSettings?: () => void;
  onOpenSearch: () => void;
  tasks: Task[];
  categories: Category[];
  categoriesById: Map<string, Category>;
  blocks: TimeBlock[];
  blocksByDate: Map<string, TimeBlock[]>;
  scheduledTaskIds: Set<string>;
  scheduledMinutesByTask: Map<string, number>;
  todayISO: string;
  onOpenEditor: (draft: EditorDraft) => void;
  onResizeBlock: (block: TimeBlock, durationMinutes: number) => void;
  onScheduleTaskDrop: (taskId: string, minute: number, date: string) => void;
  onAutoPlan: (scope: "today" | "week") => void;
  onOpenReset: () => void;
  getEditorDraftForTask: (task: Task) => EditorDraft;
  movingBlockId: string | null;
  onStartMoveBlock: (blockId: string) => void;
  onMoveBlock: (blockId: string, date: string, startMinute: number) => void;
  onCancelMove: () => void;
  deleteBlock: (id: string) => void;
  updateTask: (id: string, patch: Partial<Task>) => void;
};

type TaskScheduleState = {
  task: Task;
  date: string;
  minute: number | null;
  durationMinutes: number;
};

type SwipeHandlers = {
  onTouchStart: (event: React.TouchEvent<HTMLDivElement>) => void;
  onTouchMove: (event: React.TouchEvent<HTMLDivElement>) => void;
  onTouchEnd: () => void;
};

const scheduleDurations = [15, 30, 45, 60, 90, 120];
const schedulingSlotMinutes = 30;

const addDays = (date: Date, amount: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
};

const parseISO = (iso: string) => {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day);
};

const startOfDay = (date: Date) => {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
};

const formatDayLabel = (iso: string) =>
  parseISO(iso).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });

const buildDayPills = (todayISO: string) => {
  const today = parseISO(todayISO);
  return Array.from({ length: 8 }, (_, index) => addDays(today, index - 1)).map(date => ({
    iso: toISO(date),
    label: date.toLocaleDateString(undefined, { weekday: "short", day: "numeric" }),
    isPast: toISO(date) < todayISO,
  }));
};

const groupTasks = (
  tasks: Task[],
  weekStartISO: string,
  weekEndISO: string,
  scheduledTaskIds: Set<string>
): Record<TaskListSection, Task[]> => {
  const grouped: Record<TaskListSection, Task[]> = {
    thisWeek: [],
    backlog: [],
    scheduled: [],
  };

  tasks.forEach(task => {
    if (task.completed) return;
    if (scheduledTaskIds.has(task.id) || task.blockId) {
      grouped.scheduled.push(task);
    } else if (task.date >= weekStartISO && task.date <= weekEndISO) {
      grouped.thisWeek.push(task);
    } else {
      grouped.backlog.push(task);
    }
  });

  Object.values(grouped).forEach(section => section.sort((a, b) => a.date.localeCompare(b.date)));
  return grouped;
};

const getNeighborTaskId = (tasks: Task[], taskId: string, direction: "up" | "down") => {
  const index = tasks.findIndex(task => task.id === taskId);
  if (index === -1) return null;
  const nextIndex = direction === "up" ? index - 1 : index + 1;
  return tasks[nextIndex]?.id ?? null;
};

const buildSchedulingSlots = () => {
  const slots: number[] = [];
  for (let minute = PLANNING_START_MINUTE; minute <= PLANNING_END_MINUTE; minute += schedulingSlotMinutes) {
    slots.push(minute);
  }
  return slots;
};

const schedulingSlots = buildSchedulingSlots();

const slotOccupied = (
  blocks: TimeBlock[],
  minute: number,
  durationMinutes: number
) => blocks.some(block => minute < block.startMinute + block.durationMinutes && minute + durationMinutes > block.startMinute);

const MobileTaskRow = ({
  task,
  scheduled,
  scheduledMinutes,
  dragOpen,
  onSwipeToggle,
  onOpenTask,
  onSchedulePress,
  onDelete,
  onUnschedule,
  onLongPress,
  onMoveUp,
  onMoveDown,
}: {
  task: Task;
  scheduled: boolean;
  scheduledMinutes?: number;
  dragOpen: boolean;
  onSwipeToggle: (open: boolean) => void;
  onOpenTask: () => void;
  onSchedulePress: () => void;
  onDelete: () => void;
  onUnschedule: () => void;
  onLongPress: () => void;
  onMoveUp: (() => void) | null;
  onMoveDown: (() => void) | null;
}) => {
  const touchStartX = useRef<number | null>(null);
  const longPressTimer = useRef<number | null>(null);

  const clearLongPress = () => {
    if (longPressTimer.current !== null) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const swipeHandlers: SwipeHandlers = {
    onTouchStart: event => {
      touchStartX.current = event.touches[0]?.clientX ?? null;
      clearLongPress();
      longPressTimer.current = window.setTimeout(() => {
        onLongPress();
      }, 380);
    },
    onTouchMove: event => {
      if (touchStartX.current === null) return;
      const deltaX = event.touches[0].clientX - touchStartX.current;
      if (Math.abs(deltaX) > 12) clearLongPress();
    },
    onTouchEnd: () => {
      clearLongPress();
      touchStartX.current = null;
    },
  };

  return (
    <div className="relative overflow-hidden rounded-2xl">
      <div className="absolute inset-y-0 right-0 flex items-center gap-2 pr-3">
        {!scheduled ? (
          <button
            onClick={onDelete}
            className="h-10 rounded-xl bg-destructive px-3 text-[11px] font-semibold text-destructive-foreground"
          >
            Delete
          </button>
        ) : (
          <button
            onClick={onUnschedule}
            className="h-10 rounded-xl bg-secondary px-3 text-[11px] font-semibold text-secondary-foreground"
          >
            Unschedule
          </button>
        )}
      </div>

      <div
        {...swipeHandlers}
        className={cn(
          "surface-card relative z-[1] rounded-2xl px-3 py-3 transition-transform duration-200",
          dragOpen && "-translate-x-[88px]"
        )}
        style={{ userSelect: "none", WebkitUserSelect: "none", WebkitTouchCallout: "none", touchAction: "manipulation" }}
      >
        <div className="flex items-start gap-3">
          <button onClick={onOpenTask} className="min-w-0 flex-1 text-left">
            <div className="truncate text-[13px] font-semibold text-foreground">{task.title}</div>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-secondary-foreground">
                {task.priority === "high" ? "High" : task.priority === "med" ? "Medium" : "Low"}
              </span>
              <span className="rounded-full bg-background/80 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                {formatDayLabel(task.date)}
              </span>
              {scheduled && typeof scheduledMinutes === "number" && (
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                  {scheduledMinutes}m scheduled
                </span>
              )}
            </div>
          </button>

          <div className="flex shrink-0 items-center gap-1">
            {!scheduled && (
              <button
                onClick={onSchedulePress}
                className="grid h-11 w-11 place-items-center rounded-2xl border border-border/70 bg-background/70 text-muted-foreground"
                aria-label="Schedule task"
              >
                <CalendarPlus className="h-4 w-4" />
              </button>
            )}
            <button
              onClick={() => onSwipeToggle(!dragOpen)}
              className="grid h-11 w-11 place-items-center rounded-2xl border border-border/70 bg-background/70 text-muted-foreground"
              aria-label="More actions"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </div>
        </div>

        {(onMoveUp || onMoveDown) && (
          <div className="mt-3 flex items-center gap-2">
            {onMoveUp && (
              <button
                onClick={onMoveUp}
                className="inline-flex h-9 items-center gap-1 rounded-full border border-border/70 px-3 text-[11px] font-medium text-muted-foreground"
              >
                <ArrowUp className="h-3.5 w-3.5" /> Move up
              </button>
            )}
            {onMoveDown && (
              <button
                onClick={onMoveDown}
                className="inline-flex h-9 items-center gap-1 rounded-full border border-border/70 px-3 text-[11px] font-medium text-muted-foreground"
              >
                <ArrowDown className="h-3.5 w-3.5" /> Move down
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export const MobileWeekView = ({
  onOpenSettings,
  onOpenSearch,
  tasks,
  categories,
  categoriesById,
  blocks,
  blocksByDate,
  scheduledTaskIds,
  scheduledMinutesByTask,
  todayISO,
  onOpenEditor,
  onResizeBlock,
  onScheduleTaskDrop,
  onAutoPlan,
  onOpenReset,
  getEditorDraftForTask,
  movingBlockId,
  onStartMoveBlock,
  onMoveBlock,
  onCancelMove,
  deleteBlock,
  updateTask,
}: Props) => {
  const { addTask, updateTask: updateTaskDetails, deleteTask, reorderTasks } = useTasksCtx();
  const [mobileTab, setMobileTab] = useState<MobileTab>("schedule");
  const [mobileView, setMobileView] = useState<MobileView>("day");
  const [selectedDayISO, setSelectedDayISO] = useState(todayISO);
  const [weekRollingAnchor, setWeekRollingAnchor] = useState(startOfDay(parseISO(todayISO)));
  const [taskDialogTask, setTaskDialogTask] = useState<Task | null>(null);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [taskSchedule, setTaskSchedule] = useState<TaskScheduleState | null>(null);
  const [openSwipeId, setOpenSwipeId] = useState<string | null>(null);
  const [reorderTaskId, setReorderTaskId] = useState<string | null>(null);
  const weekSwipeStartX = useRef<number | null>(null);

  const selectedDayBlocks = blocksByDate.get(selectedDayISO) ?? [];
  const rollingDays = useMemo(
    () => Array.from({ length: 3 }, (_, index) => addDays(weekRollingAnchor, index)),
    [weekRollingAnchor]
  );
  const weekStartISO = toISO(rollingDays[0]);
  const weekEndISO = toISO(rollingDays[rollingDays.length - 1]);
  const groupedTasks = useMemo(
    () => groupTasks(tasks, weekStartISO, weekEndISO, scheduledTaskIds),
    [tasks, weekStartISO, weekEndISO, scheduledTaskIds]
  );
  const dayPills = useMemo(() => buildDayPills(todayISO), [todayISO]);

  const openTaskDialog = (task?: Task | null) => {
    setTaskDialogTask(task ?? null);
    setTaskDialogOpen(true);
  };

  const startCreateAt = (date: string, minute: number) => {
    onOpenEditor({
      title: "",
      date,
      startMinute: minute,
      durationMinutes: 30,
      categoryId: categories[0]?.id ?? "",
    });
  };

  const handleMoveTarget = (date: string, minute: number) => {
    if (!movingBlockId) return;
    onMoveBlock(movingBlockId, date, minute);
  };

  const shiftWeek = (delta: number) => {
    setWeekRollingAnchor(previous => addDays(previous, delta));
  };

  const unscheduleTask = (task: Task) => {
    blocks
      .filter(block => block.taskId === task.id)
      .forEach(block => deleteBlock(block.id));
    updateTask(task.id, { blockId: undefined, time: undefined });
  };

  const confirmTaskSchedule = () => {
    if (!taskSchedule || taskSchedule.minute === null) return;
    onScheduleTaskDrop(taskSchedule.task.id, taskSchedule.minute, taskSchedule.date);
    setTaskSchedule(null);
  };

  const handleWeekTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    weekSwipeStartX.current = event.touches[0]?.clientX ?? null;
  };

  const handleWeekTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    if (weekSwipeStartX.current === null) return;
    const deltaX = event.changedTouches[0].clientX - weekSwipeStartX.current;
    if (deltaX <= -40) shiftWeek(1);
    if (deltaX >= 40) shiftWeek(-1);
    weekSwipeStartX.current = null;
  };

  const schedulingBlocks = blocksByDate.get(taskSchedule?.date ?? todayISO) ?? [];

  const selectedMoveBlock = movingBlockId ? blocks.find(block => block.id === movingBlockId) : null;

  return (
    <div className="flex h-screen flex-col bg-background">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/95 px-4 pb-3 pt-[max(env(safe-area-inset-top),12px)] backdrop-blur-md">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-[15px] font-semibold tracking-[-0.03em] text-foreground">
              {mobileView === "day"
                ? parseISO(selectedDayISO).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })
                : `${formatDayLabel(weekStartISO)} - ${formatDayLabel(weekEndISO)}`}
            </p>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              {mobileTab === "schedule" ? "Schedule" : "Tasks"}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onOpenSearch}
              className="grid h-11 w-11 place-items-center rounded-2xl border border-border/70 bg-card/90 text-muted-foreground"
              aria-label="Search"
            >
              <Search className="h-4 w-4" />
            </button>
            <button
              onClick={onOpenSettings}
              className="grid h-11 w-11 place-items-center rounded-2xl border border-border/70 bg-card/90 text-muted-foreground"
              aria-label="Settings"
            >
              <Settings className="h-4 w-4" />
            </button>
          </div>
        </div>

        {mobileTab === "schedule" && (
          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={() => {
                setSelectedDayISO(todayISO);
                setWeekRollingAnchor(startOfDay(parseISO(todayISO)));
                setMobileView("day");
              }}
              className="rounded-full bg-primary px-4 py-2 text-[12px] font-semibold text-primary-foreground"
            >
              Today
            </button>
            <Tabs value={mobileView} onValueChange={value => setMobileView(value as MobileView)}>
              <TabsList className="h-11 rounded-full bg-secondary/80 p-1">
                <TabsTrigger value="day" className="rounded-full px-4 text-[12px]">Day</TabsTrigger>
                <TabsTrigger value="week" className="rounded-full px-4 text-[12px]">Week</TabsTrigger>
              </TabsList>
            </Tabs>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="ml-auto grid h-11 w-11 place-items-center rounded-2xl border border-border/70 bg-card/90 text-muted-foreground">
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem onClick={() => onAutoPlan("today")}>Auto-plan Today</DropdownMenuItem>
                <DropdownMenuItem onClick={onOpenReset}>Reset Day</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}

        {movingBlockId && selectedMoveBlock && (
          <div className="mt-3 flex items-center justify-between rounded-2xl border border-primary/20 bg-primary/10 px-3 py-2 text-[12px] font-medium text-primary">
            <span>Moving "{selectedMoveBlock.title}". Tap a new time to place it.</span>
            <button onClick={onCancelMove} className="grid h-8 w-8 place-items-center rounded-full bg-background/80 text-primary">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </header>

      <main className="flex-1 overflow-hidden pb-[calc(72px+env(safe-area-inset-bottom))]">
        {mobileTab === "schedule" ? (
          mobileView === "day" ? (
            <div className="flex h-full flex-col overflow-hidden">
              <div className="grid grid-cols-[52px_1fr] border-b border-border/50 bg-background/70 px-2 py-2">
                <div />
                <div className="rounded-2xl border border-border/60 bg-card/80 px-3 py-3 text-center shadow-sm">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    {parseISO(selectedDayISO).toLocaleDateString(undefined, { weekday: "long" })}
                  </div>
                  <div className="mt-2 text-[22px] font-semibold tracking-[-0.04em] text-foreground">
                    {parseISO(selectedDayISO).getDate()}
                  </div>
                </div>
              </div>

              <div
                className="flex-1 overflow-y-auto overscroll-y-none px-2 pb-4"
                style={{ overscrollBehaviorY: "none" }}
              >
                <div className="grid grid-cols-[52px_1fr]" style={{ height: DAY_PX }}>
                  <div className="relative border-r border-border/40 bg-background/50 pr-2">
                    {Array.from({ length: 24 }, (_, hour) => (
                      <div
                        key={hour}
                        className="absolute left-0 right-0 flex items-start justify-end"
                        style={{ top: hour * HOUR_PX, height: HOUR_PX }}
                      >
                        <span className="relative -top-1.5 font-mono text-[10px] text-muted-foreground/70">
                          {formatHour(hour)}
                        </span>
                      </div>
                    ))}
                  </div>

                  <DayColumn
                    date={selectedDayISO}
                    isToday={selectedDayISO === todayISO}
                    blocks={selectedDayBlocks}
                    categoriesById={categoriesById}
                    onBlockClick={block => {
                      if (movingBlockId === block.id) {
                        onCancelMove();
                        return;
                      }
                      onOpenEditor({
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
                    onBlockResize={onResizeBlock}
                    onCreate={() => {}}
                    readOnly={false}
                    mode="mobile-day"
                    onSlotTap={startCreateAt}
                    movingBlockId={movingBlockId}
                    onMoveBlock={handleMoveTarget}
                    onBlockLongPress={block => onStartMoveBlock(block.id)}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="flex h-full flex-col">
              <div
                className="flex items-center gap-2 border-b border-border/50 px-3 py-3"
                onTouchStart={handleWeekTouchStart}
                onTouchEnd={handleWeekTouchEnd}
              >
                <button
                  onClick={() => shiftWeek(-1)}
                  className="grid h-10 w-10 place-items-center rounded-full border border-border/70 bg-card/90 text-muted-foreground"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                {rollingDays.map(day => {
                  const iso = toISO(day);
                  return (
                    <button
                      key={iso}
                      onClick={() => {
                        setSelectedDayISO(iso);
                        setMobileView("day");
                      }}
                      className={cn(
                        "min-w-0 flex-1 rounded-2xl border px-2 py-3 text-center",
                        iso === todayISO ? "border-primary/40 bg-primary/10 text-primary" : "border-border/60 bg-card/70 text-foreground"
                      )}
                    >
                      <div className="truncate text-[10px] font-semibold uppercase tracking-[0.14em]">
                        {day.toLocaleDateString(undefined, { weekday: "short" })}
                      </div>
                      <div className="mt-1 text-[17px] font-semibold">{day.getDate()}</div>
                    </button>
                  );
                })}
                <button
                  onClick={() => shiftWeek(1)}
                  className="grid h-10 w-10 place-items-center rounded-full border border-border/70 bg-card/90 text-muted-foreground"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-2 pb-4">
                <div className="grid grid-cols-[40px_repeat(3,1fr)]" style={{ height: DAY_PX }}>
                  <div className="relative border-r border-border/40 bg-background/40 pr-1">
                    {Array.from({ length: 24 }, (_, hour) => (
                      <div
                        key={hour}
                        className="absolute left-0 right-0 flex items-start justify-end"
                        style={{ top: hour * HOUR_PX, height: HOUR_PX }}
                      >
                        <span className="relative -top-1.5 font-mono text-[9px] text-muted-foreground/60">
                          {formatHour(hour)}
                        </span>
                      </div>
                    ))}
                  </div>
                  {rollingDays.map(day => {
                    const iso = toISO(day);
                    return (
                      <DayColumn
                        key={iso}
                        date={iso}
                        isToday={iso === todayISO}
                        blocks={blocksByDate.get(iso) ?? []}
                        categoriesById={categoriesById}
                        onBlockClick={() => {
                          setSelectedDayISO(iso);
                          setMobileView("day");
                        }}
                        onBlockResize={onResizeBlock}
                        onCreate={() => {}}
                        readOnly
                        mode="mobile-week"
                      />
                    );
                  })}
                </div>
              </div>
            </div>
          )
        ) : (
          <div className="flex h-full flex-col px-3 pt-3">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Task Library
                </p>
                <p className="mt-1 text-[15px] font-semibold tracking-[-0.03em] text-foreground">
                  Manage and schedule tasks
                </p>
              </div>
              <button
                onClick={() => openTaskDialog(null)}
                className="grid h-11 w-11 place-items-center rounded-2xl border border-border/70 bg-card/90 text-muted-foreground"
                aria-label="New task"
              >
                <CalendarPlus className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto pb-6">
              <TaskListContent
                tasks={tasks}
                weekStartISO={weekStartISO}
                weekEndISO={weekEndISO}
                scheduledTaskIds={scheduledTaskIds}
                scheduledMinutesByTask={scheduledMinutesByTask}
                renderTask={({ task, section, scheduled, scheduledMinutes }) => {
                  const siblings = groupedTasks[section];
                  const upId = reorderTaskId === task.id ? getNeighborTaskId(siblings, task.id, "up") : null;
                  const downId = reorderTaskId === task.id ? getNeighborTaskId(siblings, task.id, "down") : null;

                  return (
                    <MobileTaskRow
                      key={task.id}
                      task={task}
                      scheduled={scheduled}
                      scheduledMinutes={scheduledMinutes}
                      dragOpen={openSwipeId === task.id}
                      onSwipeToggle={open => setOpenSwipeId(open ? task.id : null)}
                      onOpenTask={() => openTaskDialog(task)}
                      onSchedulePress={() =>
                        setTaskSchedule({
                          task,
                          date: todayISO,
                          minute: null,
                          durationMinutes: Math.min(
                            task.sessionMinutes ?? DEFAULT_SESSION_DURATION,
                            task.durationMinutes ?? DEFAULT_TASK_DURATION
                          ),
                        })
                      }
                      onDelete={() => deleteTask(task.id)}
                      onUnschedule={() => unscheduleTask(task)}
                      onLongPress={() => setReorderTaskId(current => current === task.id ? null : task.id)}
                      onMoveUp={upId ? () => reorderTasks(task.id, upId) : null}
                      onMoveDown={downId ? () => reorderTasks(task.id, downId) : null}
                    />
                  );
                }}
                emptyState={
                  <div className="surface-card flex flex-col items-center px-4 py-8 text-center">
                    <CalendarDays className="mb-3 h-7 w-7 text-muted-foreground/30" />
                    <p className="text-[13px] font-medium text-foreground">No tasks yet</p>
                    <button
                      onClick={() => openTaskDialog(null)}
                      className="mt-3 rounded-full bg-primary px-3 py-1.5 text-[11px] font-medium text-primary-foreground"
                    >
                      Add your first task
                    </button>
                  </div>
                }
              />
            </div>
          </div>
        )}
      </main>

      <div
        className="fixed inset-x-0 bottom-0 z-30 border-t border-border/60 bg-background/95 px-4 pt-2 backdrop-blur-md"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 12px)" }}
      >
        <Tabs value={mobileTab} onValueChange={value => setMobileTab(value as MobileTab)}>
          <TabsList className="grid h-14 w-full grid-cols-2 rounded-2xl bg-secondary/80 p-1">
            <TabsTrigger value="schedule" className="h-full rounded-xl text-[13px]">
              Schedule
            </TabsTrigger>
            <TabsTrigger value="tasks" className="h-full rounded-xl text-[13px]">
              Tasks
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <TaskDialog
        open={taskDialogOpen}
        onOpenChange={setTaskDialogOpen}
        initial={taskDialogTask}
        onSave={task => addTask(task)}
        onUpdate={(id, patch) => updateTaskDetails(id, patch)}
      />

      <Drawer open={!!taskSchedule} onOpenChange={open => !open && setTaskSchedule(null)} shouldScaleBackground={false}>
        <DrawerContent
          overlayProps={{ preventScroll: true }}
          className="max-h-[90svh] rounded-t-[24px] px-0 pb-[calc(env(safe-area-inset-bottom)+16px)]"
        >
          {taskSchedule && (
            <>
              <DrawerHeader className="px-5 pb-2 pt-2 text-left">
                <DrawerTitle>Schedule: "{taskSchedule.task.title}"</DrawerTitle>
              </DrawerHeader>
              <div className="space-y-4 overflow-y-auto px-5 pb-3" style={{ overscrollBehaviorY: "contain" }}>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {dayPills.map(day => (
                    <button
                      key={day.iso}
                      onClick={() => setTaskSchedule(current => current ? { ...current, date: day.iso, minute: null } : current)}
                      className={cn(
                        "shrink-0 rounded-full border px-3 py-2 text-[12px] font-medium",
                        taskSchedule.date === day.iso
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border/70 bg-background/80 text-foreground",
                        day.isPast && "opacity-60"
                      )}
                    >
                      {day.label}
                    </button>
                  ))}
                </div>

                <div
                  className="rounded-3xl border border-border/70 bg-card/80 p-2"
                  style={{ overscrollBehaviorY: "contain" }}
                >
                  <div className="max-h-[320px] overflow-y-auto pr-1" style={{ overscrollBehaviorY: "contain" }}>
                    {schedulingSlots.map(minute => {
                      const occupied = slotOccupied(schedulingBlocks, minute, taskSchedule.durationMinutes);
                      const selected = taskSchedule.minute === minute;
                      return (
                        <button
                          key={`${taskSchedule.date}-${minute}`}
                          onClick={() => !occupied && setTaskSchedule(current => current ? { ...current, minute } : current)}
                          className={cn(
                            "flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left",
                            occupied && "bg-muted/70 text-muted-foreground",
                            selected && "bg-primary/10 text-primary ring-1 ring-primary/20",
                            !occupied && !selected && "hover:bg-background/80"
                          )}
                        >
                          <span className="w-20 shrink-0 font-mono text-[12px]">{formatMinute(minute)}</span>
                          <span className="min-w-0 flex-1 text-[12px] font-medium">
                            {occupied ? "Occupied" : selected ? `Selected ${formatMinuteRange(minute, taskSchedule.durationMinutes)}` : "Tap to place"}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="rounded-3xl border border-border/70 bg-card/80 p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    Duration
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {scheduleDurations.map(duration => (
                      <button
                        key={duration}
                        onClick={() => setTaskSchedule(current => current ? { ...current, durationMinutes: duration, minute: null } : current)}
                        className={cn(
                          "rounded-full border px-3 py-2 text-[12px] font-medium",
                          taskSchedule.durationMinutes === duration
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border/70 bg-background/80 text-foreground"
                        )}
                      >
                        {duration < 60 ? `${duration} min` : duration % 60 === 0 ? `${duration / 60} hr` : `${Math.floor(duration / 60)}h ${duration % 60}m`}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <DrawerFooter className="px-5 pt-2">
                <Button
                  onClick={confirmTaskSchedule}
                  disabled={taskSchedule.minute === null}
                  className="h-11 rounded-2xl"
                >
                  {taskSchedule.minute === null ? "Choose a time" : `Schedule for ${formatMinute(taskSchedule.minute)}`}
                </Button>
                <Button variant="ghost" onClick={() => setTaskSchedule(null)}>Cancel</Button>
              </DrawerFooter>
            </>
          )}
        </DrawerContent>
      </Drawer>
    </div>
  );
};
