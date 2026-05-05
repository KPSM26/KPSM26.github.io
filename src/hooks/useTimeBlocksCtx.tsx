import { createContext, useContext, ReactNode } from "react";
import { useTimeBlocks } from "@/hooks/useTimeBlocks";

type TimeBlocksApi = ReturnType<typeof useTimeBlocks>;

const Ctx = createContext<TimeBlocksApi | null>(null);

export const TimeBlocksProvider = ({ children }: { children: ReactNode }) => {
  const value = useTimeBlocks();
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};

export const useTimeBlocksCtx = (): TimeBlocksApi => {
  const v = useContext(Ctx);
  if (!v) throw new Error("useTimeBlocksCtx must be used within TimeBlocksProvider");
  return v;
};
