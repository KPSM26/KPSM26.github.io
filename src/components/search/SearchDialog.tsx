import { useState, useMemo, useEffect, useRef } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import type { Task } from "@/lib/types";
import type { TimeBlock } from "@/types";
import { CalendarDays, CheckSquare, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDateLabel } from "@/lib/task-utils";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tasks: Task[];
  blocks: TimeBlock[];
  onSelectBlock: (block: TimeBlock) => void;
  onSelectTask: (task: Task) => void;
};

export const SearchDialog = ({ open, onOpenChange, tasks, blocks, onSelectBlock, onSelectTask }: Props) => {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const results = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return { tasks: [], blocks: [] };

    const matchedTasks = tasks
      .filter(t =>
        t.title.toLowerCase().includes(q) ||
        t.notes?.toLowerCase().includes(q)
      )
      .slice(0, 6);

    const matchedBlocks = blocks
      .filter(b =>
        b.title.toLowerCase().includes(q) ||
        b.notes?.toLowerCase().includes(q)
      )
      .slice(0, 6);

    return { tasks: matchedTasks, blocks: matchedBlocks };
  }, [query, tasks, blocks]);

  const hasResults = results.tasks.length > 0 || results.blocks.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-[480px]">
        <div className="flex items-center gap-3 border-b border-border/60 px-4 py-3">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search tasks and blocks…"
            className="flex-1 bg-transparent text-[14px] outline-none placeholder:text-muted-foreground/60"
          />
          <span className="text-[11px] text-muted-foreground/50">Esc to close</span>
        </div>

        <div className="max-h-[360px] overflow-y-auto">
          {!query && (
            <div className="px-4 py-8 text-center text-[12px] text-muted-foreground/60">
              Type to search tasks and time blocks
            </div>
          )}

          {query && !hasResults && (
            <div className="px-4 py-8 text-center text-[12px] text-muted-foreground/60">
              No results for "{query}"
            </div>
          )}

          {results.tasks.length > 0 && (
            <section>
              <p className="px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                Tasks
              </p>
              {results.tasks.map(t => (
                <button
                  key={t.id}
                  onClick={() => { onSelectTask(t); onOpenChange(false); }}
                  className="flex w-full items-center gap-3 px-4 py-2 text-left transition-colors hover:bg-foreground/[0.04]"
                >
                  <CheckSquare className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
                  <div className="min-w-0 flex-1">
                    <p className={cn("truncate text-[13px]", t.completed && "line-through opacity-50")}>
                      {t.title}
                    </p>
                    {t.notes && (
                      <p className="truncate text-[11px] text-muted-foreground/60">{t.notes}</p>
                    )}
                  </div>
                  <span className="shrink-0 text-[11px] text-muted-foreground/50">
                    {formatDateLabel(t.date)}
                  </span>
                </button>
              ))}
            </section>
          )}

          {results.blocks.length > 0 && (
            <section>
              <p className="px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                Time blocks
              </p>
              {results.blocks.map(b => (
                <button
                  key={`${b.id}-${b.date}`}
                  onClick={() => onSelectBlock(b)}
                  className="flex w-full items-center gap-3 px-4 py-2 text-left transition-colors hover:bg-foreground/[0.04]"
                >
                  <CalendarDays className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px]">{b.title}</p>
                    {b.notes && (
                      <p className="truncate text-[11px] text-muted-foreground/60">{b.notes}</p>
                    )}
                  </div>
                  <span className="shrink-0 text-[11px] text-muted-foreground/50">
                    {formatDateLabel(b.date)}
                  </span>
                </button>
              ))}
            </section>
          )}
        </div>

        <div className="border-t border-border/60 px-4 py-2 text-[10px] text-muted-foreground/50">
          ↑↓ navigate · ↵ select · Esc close
        </div>
      </DialogContent>
    </Dialog>
  );
};
