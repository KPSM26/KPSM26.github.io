import { createContext, useContext, ReactNode } from "react";
import { useTasks } from "@/hooks/useTasks";

type TasksApi = ReturnType<typeof useTasks>;

const Ctx = createContext<TasksApi | null>(null);

export const TasksProvider = ({ children }: { children: ReactNode }) => {
  const value = useTasks();
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};

export const useTasksCtx = (): TasksApi => {
  const v = useContext(Ctx);
  if (!v) throw new Error("useTasksCtx must be used within TasksProvider");
  return v;
};
