import { cn } from "@/lib/utils";

type Props = {
  scheduledMinutes: number;
  unscheduledMinutes: number;
  planningState: "realistic" | "tight" | "overloaded";
  onAutoPlanToday: () => void;
  onReplanWeek: () => void;
  className?: string;
};

export const PlanningSummary = ({
  scheduledMinutes,
  unscheduledMinutes,
  planningState,
  onAutoPlanToday,
  onReplanWeek,
  className,
}: Props) => {
  const scheduledHours = Math.round((scheduledMinutes / 60) * 10) / 10;
  const unscheduledHours = Math.round((unscheduledMinutes / 60) * 10) / 10;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-2 rounded-[18px] border border-border/60 bg-background/35 px-2.5 py-2",
        className
      )}
    >
      <div className="min-w-0">
        <p
          className={cn(
            "text-[11px] font-medium",
            planningState === "realistic" && "text-emerald-700",
            planningState === "tight" && "text-amber-700",
            planningState === "overloaded" && "text-red-700"
          )}
        >
          {planningState === "realistic" && "Plan looks realistic."}
          {planningState === "tight" && "You are close to capacity today."}
          {planningState === "overloaded" && "Today is overloaded. Split or defer work."}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="rounded-full border border-border/60 bg-card/80 px-3 py-1.5 text-[11px] text-foreground">
          <span className="text-muted-foreground/70">Scheduled</span>
          <span className="ml-1.5 font-semibold">{scheduledHours}h</span>
        </div>

        <div className="rounded-full border border-border/60 bg-card/80 px-3 py-1.5 text-[11px] text-foreground">
          <span className="text-muted-foreground/70">Open</span>
          <span className="ml-1.5 font-semibold">{unscheduledHours}h</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onAutoPlanToday}
            className="rounded-full bg-primary px-3 py-1.5 text-[11px] font-medium text-primary-foreground transition-transform transition-colors hover:-translate-y-px hover:bg-primary/90"
          >
            Auto-plan Today
          </button>
          <button
            onClick={onReplanWeek}
            className="rounded-full border border-border/70 bg-background/70 px-3 py-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
          >
            Replan Week
          </button>
        </div>
      </div>
    </div>
  );
};
