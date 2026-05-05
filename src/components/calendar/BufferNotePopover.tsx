import { useState, useEffect } from "react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { useSettings } from "@/hooks/useSettings";

type Props = {
  date: string;
  gapStartMinute: number;
  top: number;
  height: number;
};

export const BufferNotePopover = ({ date, gapStartMinute, top, height }: Props) => {
  const { settings, update } = useSettings();
  const key = `${date}:${gapStartMinute}`;
  const existing = settings.bufferNotes[key] ?? "";

  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(existing);

  useEffect(() => { setDraft(existing); }, [existing, open]);

  const save = () => {
    const trimmed = draft.trim();
    const next = { ...settings.bufferNotes };
    if (trimmed) next[key] = trimmed;
    else delete next[key];
    update({ bufferNotes: next });
  };

  const hasNote = existing.length > 0;

  return (
    <Popover open={open} onOpenChange={(v) => { if (!v) save(); setOpen(v); }}>
      <div
        className="pointer-events-none absolute left-1 right-1 flex items-center justify-center"
        style={{ top, height }}
      >
        <div className="absolute left-2 right-2 h-px bg-border/60" />
        <PopoverTrigger asChild>
          <button
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            className={
              "pointer-events-auto relative grid h-2 w-2 place-items-center rounded-full transition-colors " +
              (hasNote
                ? "bg-primary hover:bg-primary/80"
                : "bg-muted-foreground/50 hover:bg-primary")
            }
            aria-label={hasNote ? "Edit buffer note" : "Add buffer note"}
          />
        </PopoverTrigger>
      </div>
      <PopoverContent className="w-56 p-2" align="center">
        <Textarea
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={save}
          placeholder="Buffer note…"
          className="min-h-[60px] resize-none text-[12px]"
        />
      </PopoverContent>
    </Popover>
  );
};
