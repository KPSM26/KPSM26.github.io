import { Task } from "@/lib/types";
import { formatTime, isOverdue } from "@/lib/task-utils";
import { Check, Pencil, Trash2, GripVertical, CalendarCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTaskDrag } from "@/hooks/useTaskDrag";

interface Props {
  task: Task;
  onToggle: (id: string) => void;
  onEdit: (t: Task) => void;
  onDelete: (id: string) => void;
  onSelect?: (id: string) => void;
  selected?: boolean;
  showDate?: string;
  rank?: number;
}

export const TaskItem = ({ task, onToggle, onEdit, onDelete, onSelect, selected, showDate, rank }: Props) => {
  const overdue = isOverdue(task);
  const { setDraggingTask } = useTaskDrag();

  return (
    <div
      draggable
      onDragStart={e => {
        setDraggingTask(task);
        e.dataTransfer.effectAllowed = "copy";
        e.dataTransfer.setData("text/plain", task.id);
      }}
      onDragEnd={() => setDraggingTask(null)}
      onClick={() => onSelect?.(task.id)}
      className={cn(
        "group flex items-center gap-3 px-4 py-1.5 transition-colors animate-slide-in cursor-grab active:cursor-grabbing",
        "hover:bg-foreground/[0.025]",
        selected && "bg-primary/[0.06]",
        task.completed && "opacity-45"
      )}
    >
      <GripVertical className="h-3 w-3 shrink-0 text-muted-foreground/0 transition-colors group-hover:text-muted-foreground/40" />
      {rank !== undefined && (
        <span className="w-3 shrink-0 font-mono text-[11px] font-medium text-muted-foreground/70">
          {rank}
        </span>
      )}

      <button
        onClick={() => onToggle(task.id)}
        className={cn(
          "grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full border transition-colors",
          task.completed
            ? "border-primary bg-primary"
            : "border-muted-foreground/35 hover:border-primary"
        )}
        aria-label={task.completed ? "Mark incomplete" : "Mark complete"}
      >
        {task.completed && <Check className="h-2.5 w-2.5 text-primary-foreground" strokeWidth={3.5} />}
      </button>

      <p
        className={cn(
          "min-w-0 flex-1 truncate text-[13.5px] leading-snug",
          task.completed && "line-through decoration-muted-foreground/60",
          overdue && !task.completed && "text-destructive"
        )}
      >
        {task.title}
      </p>

      {task.blockId && (
        <CalendarCheck className="h-3 w-3 shrink-0 text-primary/60" title="Scheduled on calendar" />
      )}

      {(task.time || showDate) && (
        <span className="shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground">
          {showDate ? `${showDate}${task.time ? " · " : ""}` : ""}
          {task.time ? formatTime(task.time) : ""}
        </span>
      )}

      <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          onClick={() => onEdit(task)}
          className="grid h-6 w-6 place-items-center rounded text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
          aria-label="Edit task"
        >
          <Pencil className="h-3 w-3" />
        </button>
        <button
          onClick={() => onDelete(task.id)}
          className="grid h-6 w-6 place-items-center rounded text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          aria-label="Delete task"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
};
