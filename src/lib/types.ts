export type Priority = "low" | "med" | "high";

export type RepeatRule = {
  frequency: "daily" | "weekly";
  daysOfWeek?: number[]; // 0=Sun…6=Sat, only used when frequency="weekly"
};

export interface Task {
  id: string;
  title: string;
  notes?: string;
  date: string; // ISO yyyy-mm-dd
  time?: string; // HH:mm
  durationMinutes?: number;
  sessionMinutes?: number;
  priority: Priority;
  completed: boolean;
  repeatDaily: boolean;   // kept for backwards compat; prefer repeatRule
  repeatRule?: RepeatRule; // overrides repeatDaily when set
  blockId?: string;       // ID of linked TimeBlock
  createdAt: number;
  movedByReset?: boolean;
  movedAt?: number;
}

export type FilterMode = "today" | "upcoming" | "all";
