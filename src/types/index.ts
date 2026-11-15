export type EnergyTier = 'FOCUS' | 'TRANSIT' | 'BACKGROUND';

export type Priority = 'P1' | 'P2' | 'P3' | 'P4';

export type Obligation = 'MANDATORY' | 'FLEXIBLE';

export type ProgressType = 'TIME' | 'TASKS' | 'CHECKPOINT';

export type RecurrenceFrequency = 'NONE' | 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'CUSTOM';

export interface RecurrenceRule {
  frequency: RecurrenceFrequency;
  interval: number;
  daysOfWeek?: number[]; // 0 = Dom, 1 = Seg, ... 6 = Sáb
  endType: 'NEVER' | 'ON_DATE' | 'AFTER_OCCURRENCES';
  endDate?: string; // YYYY-MM-DD
  occurrences?: number;
}

export interface DayHistoryChunk {
  date: string;
  seconds: number;
  colorTone: string;
}

export interface SubTask {
  id: string;
  title: string;
  weightPercent: number;
  isCompleted: boolean;
}

export interface TaskSubItem {
  id: string;
  title: string;
  isCompleted: boolean;
}

export interface ProgressBarItem {
  id: string;
  parentId?: string; // Links subprogress to a parent progress of the same category
  title: string;
  type: ProgressType;
  color: string;
  energyTier: EnergyTier;
  createdAt: string;
  isCompleted: boolean;

  // For type === 'TIME'
  isUnlimited?: boolean; // Time progress without total limit (scales indefinitely)
  targetTotalSeconds?: number;
  targetDailySeconds?: number;
  spentTotalSeconds?: number;
  spentTodaySeconds?: number;
  pauseTodaySeconds?: number;
  isRunning?: boolean;
  isPaused?: boolean;
  history?: DayHistoryChunk[];

  // For type === 'TASKS'
  subtasks?: SubTask[];

  // For type === 'CHECKPOINT'
  totalGoal?: number;
  dailyGoal?: number;
  totalCompleted?: number;
  todayCompleted?: number;
}

export type RoutineAreaType = 'WORK' | 'COLLEGE' | 'COMMUTE' | 'CUSTOM';

export interface RoutineBlock {
  id: string;
  title: string;
  dayOfWeek: number; // 0 = Domingo, 1 = Segunda, ... 6 = Sábado
  startTime: string; // "08:00"
  endTime: string; // "10:00"
  tier: EnergyTier;
  obligation: Obligation;
  color: string;
  areaType?: RoutineAreaType; // Legado/sugestão visual opcional
}

export interface ScheduledBlock {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  startTime: string; // "09:00"
  endTime: string; // "11:00"
  tier: EnergyTier;
  obligation: Obligation;
  layer: number; // 0 = base track, 1 = layered on top
  allocationType?: 'PROGRESS' | 'TASK';
  routineOriginId?: string; // Identifies if overridden from a base routine block
  isCancelledToday?: boolean;
  linkedProgressId?: string;
  linkedTaskId?: string;
  isCompleted?: boolean;
  color?: string;
  recurrence?: RecurrenceRule;
  recurringSeriesId?: string;
}

export interface TaskItem {
  id: string;
  title: string;
  priority: Priority;
  obligation: Obligation;
  energyTier: EnergyTier;
  isCompleted: boolean;
  date?: string; // YYYY-MM-DD
  durationMinutes: number;
  subitems?: TaskSubItem[];
  recurrence?: RecurrenceRule;
  recurringSeriesId?: string;
  attachedAreaId?: string;
}

export interface DayOverride {
  date: string;
  isSOSActive: boolean;
  isNightClosed: boolean;
  discardedTaskIds: string[];
  hiddenRoutineIds?: string[]; // Routine areas hidden for this date only (legacy/compat)
  customRoutineAreas?: RoutineBlock[]; // Day-only override of routine areas
}

export interface DayHoursConfig {
  dayOfWeek: number;
  startHour: string;
  endHour: string;
}
