import type { DragEventHandler, ReactNode } from "react";
import type { Task } from "@/lib/types";

export type TaskListSection = "thisWeek" | "backlog" | "scheduled";

export type TaskDragAdapter = {
  draggable?: boolean;
  onDragStart?: DragEventHandler<HTMLDivElement>;
  title?: string;
};

type RenderArgs = {
  task: Task;
  section: TaskListSection;
  scheduled: boolean;
  scheduledMinutes?: number;
  dragAdapter?: TaskDragAdapter;
};

type Props = {
  tasks: Task[];
  weekStartISO: string;
  weekEndISO: string;
  scheduledTaskIds?: Set<string>;
  scheduledMinutesByTask?: Map<string, number>;
  pendingDeleteId?: string | null;
  dragAdapter?: (task: Task, scheduled: boolean) => TaskDragAdapter | undefined;
  renderTask: (args: RenderArgs) => ReactNode;
  emptyState?: ReactNode;
};

type GroupedTasks = {
  thisWeek: Task[];
  backlog: Task[];
  scheduled: Task[];
};

const sectionLabels: Record<TaskListSection, string> = {
  thisWeek: "This week",
  backlog: "Backlog",
  scheduled: "Scheduled",
};

const groupTasks = ({
  tasks,
  weekStartISO,
  weekEndISO,
  scheduledTaskIds,
  pendingDeleteId,
}: Omit<Props, "renderTask" | "scheduledMinutesByTask" | "dragAdapter" | "emptyState">): GroupedTasks => {
  const grouped: GroupedTasks = {
    thisWeek: [],
    backlog: [],
    scheduled: [],
  };

  for (const task of tasks) {
    if (task.completed) continue;
    if (pendingDeleteId && pendingDeleteId === task.id) continue;

    if (scheduledTaskIds?.has(task.id) || task.blockId) {
      grouped.scheduled.push(task);
      continue;
    }

    if (task.date >= weekStartISO && task.date <= weekEndISO) {
      grouped.thisWeek.push(task);
      continue;
    }

    grouped.backlog.push(task);
  }

  grouped.thisWeek.sort((a, b) => a.date.localeCompare(b.date));
  grouped.backlog.sort((a, b) => a.date.localeCompare(b.date));
  grouped.scheduled.sort((a, b) => a.date.localeCompare(b.date));

  return grouped;
};

const TaskSection = ({ label, children }: { label: string; children: ReactNode }) => (
  <section className="mb-4">
    <p className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/65">
      {label}
    </p>
    <div className="space-y-2">{children}</div>
  </section>
);

export const TaskListContent = ({
  tasks,
  weekStartISO,
  weekEndISO,
  scheduledTaskIds,
  scheduledMinutesByTask,
  pendingDeleteId,
  dragAdapter,
  renderTask,
  emptyState,
}: Props) => {
  const grouped = groupTasks({
    tasks,
    weekStartISO,
    weekEndISO,
    scheduledTaskIds,
    pendingDeleteId,
  });

  const sections: TaskListSection[] = ["thisWeek", "backlog", "scheduled"];
  const isEmpty = sections.every(section => grouped[section].length === 0);

  if (isEmpty) {
    return <>{emptyState}</>;
  }

  return (
    <>
      {sections.map(section => {
        const sectionTasks = grouped[section];
        if (sectionTasks.length === 0) return null;

        return (
          <TaskSection key={section} label={sectionLabels[section]}>
            {sectionTasks.map(task =>
              renderTask({
                task,
                section,
                scheduled: section === "scheduled",
                scheduledMinutes: scheduledMinutesByTask?.get(task.id),
                dragAdapter: dragAdapter?.(task, section === "scheduled"),
              })
            )}
          </TaskSection>
        );
      })}
    </>
  );
};
