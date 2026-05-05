import { useCallback, useMemo, useState } from "react";
import { toast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import type { Task } from "@/lib/types";
import type { Category, TimeBlock } from "@/types";
import type { EditorDraft } from "@/components/calendar/BlockEditor";
import {
  autoPlanTasks,
  DEFAULT_SESSION_DURATION,
  DEFAULT_TASK_DURATION,
  getTaskScheduledMinutes,
  minuteToTaskTime,
  workloadStatus,
} from "@/lib/scheduling";
import { DAY_MINUTES, HOUR_PX, SLOT_MINUTES, toISO } from "@/components/calendar/constants";
import type { DragEndEvent } from "@dnd-kit/core";

type Params = {
  tasks: Task[];
  categories: Category[];
  blocks: TimeBlock[];
  blocksByDate: Map<string, TimeBlock[]>;
  taskById: Map<string, Task>;
  days: Date[];
  todayISO: string;
  weekStartISO: string;
  addBlock: (block: Omit<TimeBlock, "id">) => string;
  updateBlock: (id: string, patch: Partial<TimeBlock>) => void;
  deleteBlock: (id: string) => void;
  updateTask: (id: string, patch: Partial<Task>) => void;
};

export function useWeekPlanning({
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
}: Params) {
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetTargets, setResetTargets] = useState<TimeBlock[]>([]);

  const blocksByTaskId = useMemo(() => {
    const map = new Map<string, TimeBlock[]>();
    blocks.forEach(block => {
      if (!block.taskId) return;
      const list = map.get(block.taskId) ?? [];
      list.push(block);
      map.set(block.taskId, list);
    });
    return map;
  }, [blocks]);

  const scheduledMinutesByTask = useMemo(() => {
    const map = new Map<string, number>();
    tasks.forEach(task => {
      map.set(task.id, getTaskScheduledMinutes(blocks, task.id));
    });
    return map;
  }, [blocks, tasks]);

  const scheduledTaskIds = useMemo(
    () => new Set([...scheduledMinutesByTask.entries()].filter(([, minutes]) => minutes > 0).map(([taskId]) => taskId)),
    [scheduledMinutesByTask]
  );

  const todayTasks = useMemo(
    () => tasks.filter(task => !task.completed && task.date <= todayISO),
    [tasks, todayISO]
  );

  const todayScheduledMinutes = useMemo(
    () => (blocksByDate.get(todayISO) ?? []).reduce((sum, block) => sum + block.durationMinutes, 0),
    [blocksByDate, todayISO]
  );

  const todayUnscheduledMinutes = useMemo(
    () => todayTasks.reduce((sum, task) => {
      const scheduled = scheduledMinutesByTask.get(task.id) ?? 0;
      const total = task.durationMinutes ?? DEFAULT_TASK_DURATION;
      return sum + Math.max(0, total - scheduled);
    }, 0),
    [todayTasks, scheduledMinutesByTask]
  );

  const todayPlanningState = workloadStatus(todayScheduledMinutes, todayUnscheduledMinutes);

  const syncTaskSchedule = useCallback((taskId: string, patch: Partial<Task>) => {
    updateTask(taskId, patch);
  }, [updateTask]);

  const getLinkedBlockForTask = useCallback((taskId: string) => {
    const linkedBlocks = [...(blocksByTaskId.get(taskId) ?? [])].sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return a.startMinute - b.startMinute;
    });
    return linkedBlocks[0];
  }, [blocksByTaskId]);

  const getEditorDraftForTask = useCallback((task: Task): EditorDraft => {
    const linkedBlock = getLinkedBlockForTask(task.id);
    if (linkedBlock) {
      return {
        id: linkedBlock.id,
        title: linkedBlock.title,
        notes: linkedBlock.notes,
        date: linkedBlock.date,
        startMinute: linkedBlock.startMinute,
        durationMinutes: linkedBlock.durationMinutes,
        categoryId: linkedBlock.categoryId,
        taskId: linkedBlock.taskId,
      };
    }

    return {
      title: task.title,
      date: task.date > weekStartISO ? task.date : weekStartISO,
      startMinute: 9 * 60,
      durationMinutes: Math.min(
        task.durationMinutes ?? DEFAULT_TASK_DURATION,
        task.sessionMinutes ?? DEFAULT_SESSION_DURATION
      ),
      categoryId: categories[0]?.id ?? "",
      taskId: task.id,
    };
  }, [categories, getLinkedBlockForTask, weekStartISO]);

  const handleBlockResize = useCallback((block: TimeBlock, durationMinutes: number) => {
    updateBlock(block.id, { durationMinutes });
  }, [updateBlock]);

  const handleSave = useCallback((draft: EditorDraft, closeEditor: () => void) => {
    if (draft.id) {
      updateBlock(draft.id, {
        title: draft.title,
        notes: draft.notes,
        date: draft.date,
        startMinute: draft.startMinute,
        durationMinutes: draft.durationMinutes,
        categoryId: draft.categoryId,
      });
      if (draft.taskId) {
        syncTaskSchedule(draft.taskId, {
          title: draft.title,
          date: draft.date,
          time: minuteToTaskTime(draft.startMinute),
          blockId: draft.id,
        });
      }
    } else {
      const newBlockId = addBlock({
        title: draft.title,
        notes: draft.notes,
        date: draft.date,
        startMinute: draft.startMinute,
        durationMinutes: draft.durationMinutes,
        categoryId: draft.categoryId,
        taskId: draft.taskId,
      });
      if (draft.taskId) {
        syncTaskSchedule(draft.taskId, {
          title: draft.title,
          date: draft.date,
          time: minuteToTaskTime(draft.startMinute),
          blockId: newBlockId,
        });
      }
    }
    closeEditor();
  }, [addBlock, syncTaskSchedule, updateBlock]);

  const handleDelete = useCallback((id: string, closeEditor: () => void) => {
    const block = blocks.find(candidate => candidate.id === id);
    if (block?.taskId) {
      const fallback = (blocksByTaskId.get(block.taskId) ?? []).find(candidate => candidate.id !== id);
      syncTaskSchedule(block.taskId, {
        blockId: fallback?.id,
        time: fallback ? minuteToTaskTime(fallback.startMinute) : undefined,
      });
    }
    deleteBlock(id);
    closeEditor();
  }, [blocks, blocksByTaskId, deleteBlock, syncTaskSchedule]);

  const handleOpenReset = useCallback(() => {
    const now = new Date();
    const currentMinute = now.getHours() * 60 + now.getMinutes();
    const todayBlocks = blocksByDate.get(todayISO) ?? [];
    const targets = todayBlocks.filter(block => {
      if (block.startMinute >= currentMinute) return true;
      const linkedTask = block.taskId ? taskById.get(block.taskId) : undefined;
      return !linkedTask?.completed;
    });
    setResetTargets(targets);
    setResetDialogOpen(true);
  }, [blocksByDate, taskById, todayISO]);

  const handleConfirmReset = useCallback(() => {
    const snapshot = resetTargets.map(block => ({ ...block }));
    const now = Date.now();

    for (const block of resetTargets) {
      deleteBlock(block.id);
      if (block.taskId) {
        syncTaskSchedule(block.taskId, {
          blockId: undefined,
          time: undefined,
          movedByReset: true,
          movedAt: now,
        });
      }
    }
    setResetDialogOpen(false);

    toast({
      description: `Day reset · ${snapshot.length} block${snapshot.length !== 1 ? "s" : ""} cleared`,
      duration: 8000,
      action: (
        <ToastAction
          altText="Undo reset"
          onClick={() => {
            for (const block of snapshot) {
              const { id: _id, ...rest } = block;
              const newId = addBlock(rest);
              if (block.taskId) {
                syncTaskSchedule(block.taskId, {
                  blockId: newId,
                  date: block.date,
                  time: minuteToTaskTime(block.startMinute),
                  movedByReset: false,
                  movedAt: undefined,
                });
              }
            }
          }}
        >
          Undo
        </ToastAction>
      ),
    });
  }, [addBlock, deleteBlock, resetTargets, syncTaskSchedule]);

  const handleTaskDrop = useCallback((taskId: string, minute: number, date: string) => {
    const task = taskById.get(taskId);
    if (!task) return;

    const snappedMinute = Math.max(0, Math.min(DAY_MINUTES - 30, Math.round(minute / SLOT_MINUTES) * SLOT_MINUTES));
    const sessionMinutes = Math.min(
      task.durationMinutes ?? DEFAULT_TASK_DURATION,
      task.sessionMinutes ?? DEFAULT_SESSION_DURATION
    );
    const newBlockId = addBlock({
      title: task.title,
      date,
      startMinute: snappedMinute,
      durationMinutes: sessionMinutes,
      categoryId: categories[0]?.id ?? "",
      taskId,
    });

    syncTaskSchedule(taskId, {
      blockId: newBlockId,
      date,
      time: minuteToTaskTime(snappedMinute),
    });
  }, [addBlock, categories, syncTaskSchedule, taskById]);

  const autoPlanScope = useCallback((scope: "today" | "week") => {
    const planningDates = scope === "today" ? [todayISO] : days.map(day => toISO(day));
    const planningEndDate = planningDates[planningDates.length - 1];
    const scopedTasks = tasks.filter(task => !task.completed && task.date <= planningEndDate);
    const scopedTaskIds = new Set(scopedTasks.map(task => task.id));

    if (scope === "today") {
      const remainingTasks = scopedTasks
        .map(task => {
          const scheduled = scheduledMinutesByTask.get(task.id) ?? 0;
          const total = task.durationMinutes ?? DEFAULT_TASK_DURATION;
          const remaining = Math.max(0, total - scheduled);
          if (remaining < SLOT_MINUTES) return null;
          return {
            ...task,
            durationMinutes: remaining,
            sessionMinutes: Math.min(task.sessionMinutes ?? DEFAULT_SESSION_DURATION, remaining),
          };
        })
        .filter((task): task is Task => task !== null);

      if (remainingTasks.length === 0) {
        toast({
          description: "Today's tasks are already planned",
        });
        return;
      }

      const plan = autoPlanTasks(remainingTasks, blocks, planningDates);
      const firstNewBlockByTask = new Map<string, { id: string; startMinute: number; date: string }>();

      for (const item of plan) {
        const newId = addBlock({
          title: item.title,
          date: item.date,
          startMinute: item.startMinute,
          durationMinutes: item.durationMinutes,
          categoryId: categories[0]?.id ?? "",
          taskId: item.taskId,
        });
        if (!firstNewBlockByTask.has(item.taskId)) {
          firstNewBlockByTask.set(item.taskId, {
            id: newId,
            startMinute: item.startMinute,
            date: item.date,
          });
        }
      }

      remainingTasks.forEach(task => {
        const firstNewBlock = firstNewBlockByTask.get(task.id);
        if (!firstNewBlock) return;
        if (getLinkedBlockForTask(task.id)) return;
        syncTaskSchedule(task.id, {
          blockId: firstNewBlock.id,
          date: firstNewBlock.date,
          time: minuteToTaskTime(firstNewBlock.startMinute),
        });
      });

      toast({
        description: plan.length === 0
          ? "No open time found to auto-plan today"
          : `Added ${plan.length} session${plan.length === 1 ? "" : "s"} to today`,
      });
      return;
    }

    const replannableBlocks = blocks.filter(block =>
      !!block.taskId &&
      scopedTaskIds.has(block.taskId) &&
      planningDates.includes(block.date)
    );

    replannableBlocks.forEach(block => deleteBlock(block.id));
    scopedTaskIds.forEach(taskId => syncTaskSchedule(taskId, { blockId: undefined, time: undefined }));

    const preservedBlocks = blocks.filter(block =>
      !planningDates.includes(block.date) ||
      !block.taskId ||
      !scopedTaskIds.has(block.taskId)
    );

    const plan = autoPlanTasks(scopedTasks, preservedBlocks, planningDates);
    const firstBlockByTask = new Map<string, { id: string; startMinute: number }>();

    for (const item of plan) {
      const newId = addBlock({
        title: item.title,
        date: item.date,
        startMinute: item.startMinute,
        durationMinutes: item.durationMinutes,
        categoryId: categories[0]?.id ?? "",
        taskId: item.taskId,
      });
      if (!firstBlockByTask.has(item.taskId)) {
        firstBlockByTask.set(item.taskId, { id: newId, startMinute: item.startMinute });
      }
    }

    scopedTasks.forEach(task => {
      const first = firstBlockByTask.get(task.id);
      if (!first) return;
      syncTaskSchedule(task.id, {
        blockId: first.id,
        time: minuteToTaskTime(first.startMinute),
      });
    });

    toast({
      description: plan.length === 0
        ? "No open time found to replan this week"
        : `Replanned ${plan.length} session${plan.length === 1 ? "" : "s"} for this week`,
    });
  }, [addBlock, blocks, categories, days, deleteBlock, getLinkedBlockForTask, scheduledMinutesByTask, syncTaskSchedule, tasks, todayISO]);

  const handleDragEnd = useCallback((event: DragEndEvent, clearActiveDrag: () => void) => {
    clearActiveDrag();
    const { active, delta, over } = event;
    if (!over) return;

    const block = (active.data.current as { block: TimeBlock }).block;
    const newDate = over.id as string;
    const minutesDelta = Math.round((delta.y / HOUR_PX) * 60 / SLOT_MINUTES) * SLOT_MINUTES;
    const newStartMinute = Math.max(
      0,
      Math.min(DAY_MINUTES - block.durationMinutes, block.startMinute + minutesDelta)
    );

    if (newDate !== block.date || newStartMinute !== block.startMinute) {
      updateBlock(block.id, { date: newDate, startMinute: newStartMinute });
      if (block.taskId) {
        syncTaskSchedule(block.taskId, {
          date: newDate,
          time: minuteToTaskTime(newStartMinute),
        });
      }
    }
  }, [syncTaskSchedule, updateBlock]);

  return {
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
  };
}
