export type RecurrenceRule = {
  frequency: "daily" | "weekly";
  daysOfWeek?: number[];
  endDate?: string;
};

export type TimeBlock = {
  id: string;
  title: string;
  date: string;
  startMinute: number;
  durationMinutes: number;
  categoryId: string;
  recurrence?: RecurrenceRule;
  taskId?: string;      // ID of linked Task
  notes?: string;       // optional description/context
  completed?: boolean;  // visual completion state (driven by linked task)
};

export type Category = {
  id: string;
  name: string;
  color: string;
};

export type Intention = {
  text: string;
  date: string;
};

export type AppData = {
  blocks: TimeBlock[];
  categories: Category[];
  intention?: Intention;
};
