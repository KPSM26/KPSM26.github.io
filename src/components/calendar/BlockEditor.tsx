import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { Category } from "@/types";
import { Trash2 } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

export type EditorDraft = {
  id?: string;
  title: string;
  notes?: string;
  date: string;
  startMinute: number;
  durationMinutes: number;
  categoryId: string;
  taskId?: string;
};

type Props = {
  open: boolean;
  draft: EditorDraft | null;
  categories: Category[];
  onCancel: () => void;
  onSave: (draft: EditorDraft) => void;
  onDelete?: (id: string) => void;
  onMove?: (draft: EditorDraft) => void;
};

export const BlockEditor = ({ open, draft, categories, onCancel, onSave, onDelete, onMove }: Props) => {
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [startMinute, setStartMinute] = useState(9 * 60);
  const isMobile = useIsMobile();

  useEffect(() => {
    if (!draft) return;
    setTitle(draft.title);
    setNotes(draft.notes ?? "");
    setCategoryId(draft.categoryId || categories[0]?.id || "");
    setDurationMinutes(draft.durationMinutes);
    setStartMinute(draft.startMinute);
  }, [draft, categories]);

  if (!draft) return null;

  const handleSave = () => {
    if (!title.trim()) return;
    onSave({
      ...draft,
      title: title.trim(),
      notes: notes.trim() || undefined,
      categoryId,
      durationMinutes,
      startMinute,
    });
  };

  const minuteToInput = (minute: number) => {
    const hours = String(Math.floor(minute / 60)).padStart(2, "0");
    const minutes = String(minute % 60).padStart(2, "0");
    return `${hours}:${minutes}`;
  };

  const inputToMinute = (value: string) => {
    const [hours, minutes] = value.split(":").map(Number);
    if (Number.isNaN(hours) || Number.isNaN(minutes)) return startMinute;
    return Math.max(0, Math.min(23 * 60 + 59, hours * 60 + minutes));
  };

  const editorBody = (
    <div className="space-y-4 py-2">
      <div>
        <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Title
        </label>
        <Input
          autoFocus
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="e.g. Deep Work"
          onKeyDown={e => { if (e.key === "Enter") handleSave(); }}
        />
      </div>

      <div>
        <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Start time
        </label>
        <Input
          type="time"
          value={minuteToInput(startMinute)}
          onChange={e => setStartMinute(inputToMinute(e.target.value))}
        />
      </div>

      <div>
        <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Category
        </label>
        <div className="flex flex-wrap gap-1.5">
          {categories.map(c => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCategoryId(c.id)}
              className="flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[12px] font-medium transition-colors"
              style={{
                borderColor: categoryId === c.id ? c.color : "hsl(var(--border))",
                backgroundColor: categoryId === c.id ? `${c.color}22` : "transparent",
              }}
            >
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: c.color }} />
              {c.name}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Duration
        </label>
        <div className="flex flex-wrap gap-1.5">
          {[15, 30, 45, 60, 90, 120].map(m => (
            <button
              key={m}
              type="button"
              onClick={() => setDurationMinutes(m)}
              className="rounded-md border px-2.5 py-1 text-[12px] font-medium transition-colors"
              style={{
                borderColor: durationMinutes === m ? "hsl(var(--primary))" : "hsl(var(--border))",
                backgroundColor: durationMinutes === m ? "hsl(var(--primary) / 0.15)" : "transparent",
              }}
            >
              {m < 60 ? `${m}m` : m % 60 === 0 ? `${m / 60}h` : `${Math.floor(m / 60)}h ${m % 60}m`}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Notes
        </label>
        <Textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Add context or notes…"
          rows={2}
          className="resize-none text-[13px]"
        />
      </div>
    </div>
  );

  const footer = (
    <>
      {draft.id && onDelete ? (
        <Button
          variant="ghost"
          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={() => { onDelete(draft.id!); }}
        >
          <Trash2 className="mr-1.5 h-4 w-4" /> Delete
        </Button>
      ) : <span />}
      <div className="flex gap-2">
        {draft.id && onMove && (
          <Button variant="outline" onClick={() => onMove({ ...draft, title, notes: notes.trim() || undefined, categoryId, durationMinutes, startMinute })}>
            Move
          </Button>
        )}
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button onClick={handleSave} disabled={!title.trim()}>Save</Button>
      </div>
    </>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={v => !v && onCancel()} shouldScaleBackground={false}>
        <DrawerContent className="max-h-[90svh] rounded-t-[24px] px-0 pb-[calc(env(safe-area-inset-bottom)+16px)]">
          <DrawerHeader className="px-5 pb-2 pt-2 text-left">
            <DrawerTitle>{draft.id ? "Edit block" : "New block"}</DrawerTitle>
          </DrawerHeader>
          <div className="space-y-4 overflow-y-auto px-5 pb-2">{editorBody}</div>
          <DrawerFooter className="gap-2 border-t border-border/60 px-5 pt-4">
            {draft.id && onMove && (
              <Button variant="outline" onClick={() => onMove({ ...draft, title, notes: notes.trim() || undefined, categoryId, durationMinutes, startMinute })}>
                Move
              </Button>
            )}
            <Button onClick={handleSave} disabled={!title.trim()}>Save</Button>
            <Button variant="ghost" onClick={onCancel}>Cancel</Button>
            {draft.id && onDelete && (
              <Button
                variant="ghost"
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => { onDelete(draft.id!); }}
              >
                <Trash2 className="mr-1.5 h-4 w-4" /> Delete
              </Button>
            )}
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onCancel()}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>{draft.id ? "Edit block" : "New block"}</DialogTitle>
        </DialogHeader>

        {editorBody}

        <DialogFooter className="gap-2 sm:justify-between">
          {footer}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
