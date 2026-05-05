import { useEffect, useRef, useState } from "react";

interface Pos { x: number; y: number }

export function useDraggable(storageKey: string, initial: Pos) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<Pos>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) return JSON.parse(raw);
    } catch {}
    return initial;
  });
  const dragging = useRef<{ ox: number; oy: number } | null>(null);

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(pos));
  }, [pos, storageKey]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (!ref.current) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragging.current = { ox: e.clientX - pos.x, oy: e.clientY - pos.y };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current || !ref.current) return;
    const w = ref.current.offsetWidth;
    const h = ref.current.offsetHeight;
    const maxX = window.innerWidth - w - 8;
    const maxY = window.innerHeight - h - 8;
    const x = Math.min(Math.max(8, e.clientX - dragging.current.ox), maxX);
    const y = Math.min(Math.max(8, e.clientY - dragging.current.oy), maxY);
    setPos({ x, y });
  };

  const onPointerUp = () => { dragging.current = null; };

  return { ref, pos, dragHandlers: { onPointerDown, onPointerMove, onPointerUp } };
}
