import { useEffect, useRef, useState } from "react";
import type { TimeBlock, Category } from "@/types";
import { DAY_MINUTES, HOUR_PX, SLOT_MINUTES, formatMinute, formatMinuteRange } from "./constants";
import { cn } from "@/lib/utils";
import { CheckSquare, FileText } from "lucide-react";
import { useDraggable } from "@dnd-kit/core";

type Props = {
  block: TimeBlock;
  category: Category | undefined;
  onClick: () => void;
  onResize: (block: TimeBlock, durationMinutes: number) => void;
  readOnly?: boolean;
  enableDrag?: boolean;
  mobile?: boolean;
  isMoveSource?: boolean;
  onLongPress?: (block: TimeBlock) => void;
};

export const TimeBlockView = ({
  block,
  category,
  onClick,
  onResize,
  readOnly = false,
  enableDrag = true,
  mobile = false,
  isMoveSource = false,
  onLongPress,
}: Props) => {
  const [previewDuration, setPreviewDuration] = useState<number | null>(null);
  const [isResizing, setIsResizing] = useState(false);
  const resizeStartY = useRef<number | null>(null);
  const resizeStartDuration = useRef<number | null>(null);
  const resizePointerId = useRef<number | null>(null);
  const latestDuration = useRef<number>(block.durationMinutes);
  const suppressClick = useRef(false);
  const pressPointerId = useRef<number | null>(null);
  const pressStart = useRef<{ x: number; y: number } | null>(null);
  const handledPointerOpen = useRef(false);
  const longPressTimer = useRef<number | null>(null);

  useEffect(() => {
    if (!isResizing) {
      setPreviewDuration(null);
    }
  }, [block.durationMinutes, isResizing]);

  useEffect(() => {
    if (!isResizing) return;

    const minuteHeight = HOUR_PX / 60;
    const startY = resizeStartY.current;
    const startDuration = resizeStartDuration.current;
    const maxDuration = DAY_MINUTES - block.startMinute;

    if (typeof startY !== "number" || typeof startDuration !== "number") return;

    const onMove = (e: PointerEvent) => {
      if (resizePointerId.current !== null && e.pointerId !== resizePointerId.current) return;
      const rawDuration = startDuration + ((e.clientY - startY) / minuteHeight);
      const snappedDuration = Math.round(rawDuration / SLOT_MINUTES) * SLOT_MINUTES;
      const nextDuration = Math.max(SLOT_MINUTES, Math.min(maxDuration, snappedDuration));
      latestDuration.current = nextDuration;
      setPreviewDuration(nextDuration);
    };

    const stopResize = (e: PointerEvent) => {
      if (resizePointerId.current !== null && e.pointerId !== resizePointerId.current) return;
      const nextDuration = latestDuration.current;
      setIsResizing(false);
      setPreviewDuration(null);
      resizeStartY.current = null;
      resizeStartDuration.current = null;
      resizePointerId.current = null;
      if (nextDuration !== block.durationMinutes) {
        onResize(block, nextDuration);
      }
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", stopResize);
    window.addEventListener("pointercancel", stopResize);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", stopResize);
      window.removeEventListener("pointercancel", stopResize);
    };
  }, [block, isResizing, onResize]);

  const top = (block.startMinute / 60) * HOUR_PX;
  const durationMinutes = previewDuration ?? block.durationMinutes;
  const height = Math.max((durationMinutes / 60) * HOUR_PX - 2, 18);
  const isTinyBlock = height < 34;
  const isCompactBlock = height < 48;
  const resizeHandleHeight = readOnly ? 0 : Math.max(24, isTinyBlock ? 24 : isCompactBlock ? 24 : 28);
  const color = category?.color ?? "#9CA3AF";

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: block.id,
    data: { block },
    disabled: !enableDrag,
  });

  const startResize = (pointerId: number, clientY: number) => {
    resizeStartY.current = clientY;
    resizeStartDuration.current = block.durationMinutes;
    resizePointerId.current = pointerId;
    latestDuration.current = block.durationMinutes;
    suppressClick.current = true;
    setPreviewDuration(block.durationMinutes);
    setIsResizing(true);
  };

  const clearLongPress = () => {
    if (longPressTimer.current !== null) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  return (
    <button
      ref={setNodeRef}
      data-block
      {...listeners}
      {...attributes}
      onPointerDown={e => {
        if (enableDrag) {
          listeners?.onPointerDown?.(e);
        }
        if (e.button !== 0) return;
        pressPointerId.current = e.pointerId;
        pressStart.current = { x: e.clientX, y: e.clientY };
        handledPointerOpen.current = false;
        if (mobile && onLongPress && !readOnly) {
          clearLongPress();
          longPressTimer.current = window.setTimeout(() => {
            suppressClick.current = true;
            handledPointerOpen.current = true;
            onLongPress(block);
          }, 360);
        }
      }}
      onPointerMove={e => {
        if (pressPointerId.current !== e.pointerId || !pressStart.current) return;
        const movedX = Math.abs(e.clientX - pressStart.current.x);
        const movedY = Math.abs(e.clientY - pressStart.current.y);
        if (movedX > 4 || movedY > 4) {
          pressStart.current = null;
          clearLongPress();
        }
      }}
      onPointerUp={e => {
        clearLongPress();
        if (pressPointerId.current !== e.pointerId) return;
        const start = pressStart.current;
        pressPointerId.current = null;
        pressStart.current = null;
        if (!start || isDragging || isResizing || suppressClick.current) return;
        const movedX = Math.abs(e.clientX - start.x);
        const movedY = Math.abs(e.clientY - start.y);
        if (movedX <= 4 && movedY <= 4) {
          handledPointerOpen.current = true;
          onClick();
        }
      }}
      onPointerCancel={() => {
        pressPointerId.current = null;
        pressStart.current = null;
        clearLongPress();
      }}
      onClick={e => {
        e.stopPropagation();
        if (handledPointerOpen.current) {
          handledPointerOpen.current = false;
          return;
        }
        if (suppressClick.current) {
          suppressClick.current = false;
          return;
        }
        if (!isDragging && !isResizing) onClick();
      }}
      className={cn(
        "timeblock group absolute left-1.5 right-1.5 overflow-visible rounded-2xl border border-white/30 text-left text-[11px] font-medium backdrop-blur-[2px]",
        "transition-[transform,box-shadow,background-color] hover:z-10 focus-visible:z-10 focus-visible:outline-none",
        isTinyBlock ? "px-2 py-1" : isCompactBlock ? "px-2 py-1.5" : "px-2.5 py-2 pb-3",
        block.completed && "opacity-50",
        isDragging && "opacity-30",
        isResizing && "shadow-md",
        isMoveSource && "ring-2 ring-primary ring-offset-2 ring-offset-background"
      )}
      style={{
        top,
        height,
        borderLeftColor: "transparent",
        background: `linear-gradient(180deg, ${color}30, ${color}1a)`,
        color: "hsl(var(--foreground))",
        cursor: "default",
        touchAction: mobile ? "manipulation" : "none",
        boxShadow: `inset 0 1px 0 rgba(255,255,255,0.28), inset 4px 0 0 ${color}`,
        userSelect: "none",
        WebkitUserSelect: "none",
        WebkitTouchCallout: "none",
      }}
    >
      {isTinyBlock ? (
        <div className="flex items-center gap-1.5 overflow-hidden text-[10px]">
          <span className={cn("min-w-0 flex-1 truncate font-semibold", block.completed && "line-through")}>
            {block.title}
          </span>
          <span className="shrink-0 font-medium text-foreground/65">
            {formatMinute(block.startMinute)}
          </span>
        </div>
      ) : (
        <>
          <div className={cn("font-medium text-foreground/65", isCompactBlock ? "mb-0.5 text-[9px]" : "mb-1 text-[10px]")}>
            {formatMinuteRange(block.startMinute, durationMinutes)}
          </div>
          <div className="flex items-start gap-1">
            <span className={cn("flex-1 truncate text-[11px] font-semibold", block.completed && "line-through")}>
              {block.title}
            </span>
            {!isCompactBlock && (
              <span className="flex shrink-0 items-center gap-0.5 opacity-55">
                {block.taskId && <CheckSquare className="h-2.5 w-2.5" />}
                {block.notes && <FileText className="h-2.5 w-2.5" />}
              </span>
            )}
          </div>
        </>
      )}
      {!isCompactBlock && height > 54 && block.notes && (
        <div className="mt-1 line-clamp-2 text-[10px] leading-snug text-foreground/60">
          {block.notes}
        </div>
      )}
      {isResizing && previewDuration !== null && (
        <div className="pointer-events-none absolute -top-8 right-0 rounded-full border border-border/70 bg-background/95 px-2.5 py-1 text-[10px] font-semibold text-foreground shadow-md whitespace-nowrap">
          {formatMinuteRange(block.startMinute, previewDuration)}
        </div>
      )}
      {!readOnly && (
        <span
          role="presentation"
          onPointerDown={e => {
            e.preventDefault();
            e.stopPropagation();
            clearLongPress();
            startResize(e.pointerId, e.clientY);
          }}
          className="absolute bottom-0 rounded-b-2xl"
          style={{
            left: 4,
            right: 4,
            height: resizeHandleHeight,
          }}
        />
      )}
    </button>
  );
};
