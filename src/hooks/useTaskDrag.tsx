import { createContext, useContext, useState, ReactNode } from "react";
import { Task } from "@/lib/types";

interface DragCtx {
  draggingTask: Task | null;
  setDraggingTask: (t: Task | null) => void;
}

const Ctx = createContext<DragCtx | null>(null);

export const TaskDragProvider = ({ children }: { children: ReactNode }) => {
  const [draggingTask, setDraggingTask] = useState<Task | null>(null);
  return <Ctx.Provider value={{ draggingTask, setDraggingTask }}>{children}</Ctx.Provider>;
};

export const useTaskDrag = () => {
  const v = useContext(Ctx);
  if (!v) throw new Error("useTaskDrag must be used within TaskDragProvider");
  return v;
};
