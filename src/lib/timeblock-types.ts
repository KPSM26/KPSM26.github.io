export interface TimeBlock {
  id: string;
  taskId?: string;
  title: string;
  date: string;       // ISO yyyy-mm-dd
  startHour: number;  // 0-23, supports half-hours via .5
  duration: number;   // hours, multiples of 0.5
  color?: "green" | "amber" | "red" | "slate";
  completed: boolean;
  createdAt: number;
}
