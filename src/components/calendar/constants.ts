export const SLOT_MINUTES = 15;
export const SLOT_PX = 14;
export const HOUR_PX = SLOT_PX * (60 / SLOT_MINUTES);
export const DAY_MINUTES = 24 * 60;
export const DAY_PX = HOUR_PX * 24;

export const DAY_LABELS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

export function startOfWeekMonday(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const day = x.getDay();
  const delta = (day + 6) % 7;
  x.setDate(x.getDate() - delta);
  return x;
}

export function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function formatHour(h: number): string {
  if (h === 0) return "12 AM";
  if (h === 12) return "12 PM";
  return h < 12 ? `${h} AM` : `${h - 12} PM`;
}

export function formatMinuteRange(start: number, duration: number): string {
  const end = start + duration;
  return `${formatMinute(start)} – ${formatMinute(end)}`;
}

export function formatMinute(m: number): string {
  const h = Math.floor(m / 60);
  const mm = m % 60;
  const period = h >= 12 ? "PM" : "AM";
  const display = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${display}:${String(mm).padStart(2, "0")} ${period}`;
}
