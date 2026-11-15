import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from 'react';
import {
  ProgressBarItem,
  RoutineBlock,
  RoutineAreaType,
  ScheduledBlock,
  TaskItem,
  DayOverride,
  Priority,
  DayHoursConfig,
  EnergyTier,
  RecurrenceRule,
} from '../types';
import {
  fireCuteConfetti,
  playGentleBellChime,
  timeStringToMinutes,
  minutesToTimeString,
  formatLocalDateString,
  addDaysToDateString,
  expandRecurrenceDates,
} from '../utils/helpers';

export type ActiveTab = 'MEU_DIA' | 'AGENDA' | 'ROTINA' | 'PROGRESSOS' | 'CONFIGURACOES';

export interface ToastMessage {
  id: number;
  message: string;
  type: 'success' | 'info' | 'warning';
}

interface AppContextType {
  // Navigation & State
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  selectedDate: string; // YYYY-MM-DD
  setSelectedDate: (date: string) => void;
  isPiPMode: boolean;
  setIsPiPMode: (pip: boolean) => void;
  currentTimeStr: string;

  // Data
  progressBars: ProgressBarItem[];
  routineBlocks: RoutineBlock[];
  scheduledBlocks: ScheduledBlock[];
  tasks: TaskItem[];
  dayOverrides: Record<string, DayOverride>;
  dayHoursConfigs: DayHoursConfig[];

  // Progress Bar Actions
  createProgressBar: (
    item: Omit<ProgressBarItem, 'id' | 'createdAt' | 'isCompleted'>
  ) => ProgressBarItem;
  updateProgressBar: (id: string, updates: Partial<ProgressBarItem>) => void;
  deleteProgressBar: (id: string) => void;
  playProgress: (id: string) => void;
  pauseProgress: (id: string) => void;
  resumeFromPause: (id: string) => void;
  resetProgress: (id: string) => void;
  incrementCheckpoint: (id: string) => void;
  toggleSubtask: (progressId: string, subtaskId: string) => void;

  // Current Activity strictly resolved from real time
  currentActiveSchedule: {
    block: ScheduledBlock | null;
    progress: ProgressBarItem | null;
    currentArea?: RoutineBlock | null;
    isFreeSlot: boolean;
    currentTimeStr: string;
  };

  adaptivePauseAlert: { show: boolean; message: string } | null;
  dismissAdaptivePause: () => void;
  inactivityAlert: boolean;
  dismissInactivityAlert: () => void;

  // Routine & Effective Day Block Actions (Edit Day without altering Base Routine!)
  getEffectiveBlocksForDate: (dateStr: string) => ScheduledBlock[];
  getRoutineAreasForDay: (dayOfWeek: number, dateStr?: string) => RoutineBlock[];
  hideRoutineAreaForDate: (dateStr: string, routineId: string) => void;
  restoreHiddenRoutineAreasForDate: (dateStr: string) => void;
  addDayRoutineArea: (dateStr: string, area: Omit<RoutineBlock, 'id' | 'dayOfWeek'>) => void;
  updateDayRoutineArea: (dateStr: string, areaId: string, updates: Partial<RoutineBlock>) => void;
  deleteDayRoutineArea: (dateStr: string, areaId: string) => void;
  resetDayRoutineAreas: (dateStr: string) => void;
  addRoutineBlock: (block: Omit<RoutineBlock, 'id'>) => void;
  updateRoutineBlock: (id: string, updates: Partial<RoutineBlock>) => void;
  deleteRoutineBlock: (id: string) => void;
  addScheduledBlock: (block: Omit<ScheduledBlock, 'id'>, recurrence?: RecurrenceRule) => ScheduledBlock;
  updateEffectiveBlock: (
    dateStr: string,
    block: ScheduledBlock,
    updates: Partial<ScheduledBlock>
  ) => void;
  deleteEffectiveBlock: (dateStr: string, block: ScheduledBlock) => void;
  autoFillBlock: (blockId: string) => boolean;
  autoDistributeTasksForDate: (dateStr: string) => { scheduledCount: number; message: string };
  assignTaskToBlock: (blockId: string, taskId: string) => void;
  assignProgressToBlock: (blockId: string, progressId: string) => void;

  // Task Actions
  addTask: (task: Omit<TaskItem, 'id'>, recurrence?: RecurrenceRule) => TaskItem;
  updateTask: (id: string, updates: Partial<TaskItem>) => void;
  toggleTask: (id: string) => void;
  toggleTaskSubitem: (taskId: string, subitemId: string) => void;
  deleteTask: (id: string) => void;

  // Special Innovations
  triggerSOS: (dateStr: string) => void;
  undoSOS: (dateStr: string) => void;
  toggleBlockObligationToday: (dateStr: string, block: ScheduledBlock) => void;
  closeNightCheckOut: (
    dateStr: string,
    discardTaskIds: string[],
    pushToTomorrowTaskIds: string[]
  ) => void;

  // Configuration Actions
  updateDayHoursConfig: (dayOfWeek: number, startHour: string, endHour: string) => void;
  getDayBoundsForDate: (dateStr: string) => { startHour: number; endHour: number };

  // Confirmation Dialog Helpers
  requestConfirm: (title: string, message: string, onConfirm: () => void) => void;
  confirmDialog: {
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  } | null;
  closeConfirmDialog: () => void;

  // Non-blocking Toast Feedback
  toast: ToastMessage | null;
  showToast: (message: string, type?: ToastMessage['type']) => void;
  dismissToast: () => void;
}

const AppContext = createContext<AppContextType | null>(null);

export function getTodayDateString(): string {
  return formatLocalDateString(new Date());
}

export function getCurrentTimeString(): string {
  const now = new Date();
  const h = String(now.getHours()).padStart(2, '0');
  const m = String(now.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

export const PRIORITY_WEIGHT: Record<Priority, number> = {
  P1: 4,
  P2: 3,
  P3: 2,
  P4: 1,
};

export function inferAreaType(title: string, _tier?: string): RoutineAreaType {
  const t = title.toLowerCase();
  if (
    t.includes('trabalh') ||
    t.includes('job') ||
    t.includes('work') ||
    t.includes('projet') ||
    t.includes('reuni')
  ) {
    return 'WORK';
  }
  if (
    t.includes('aula') ||
    t.includes('facul') ||
    t.includes('univers') ||
    t.includes('estud') ||
    t.includes('pesquis') ||
    t.includes('laborat')
  ) {
    return 'COLLEGE';
  }
  if (
    t.includes('ônibus') ||
    t.includes('transp') ||
    t.includes('desloc') ||
    t.includes('metrô') ||
    t.includes('carro') ||
    t.includes('trânsit')
  ) {
    return 'COMMUTE';
  }
  return 'CUSTOM';
}

const STORAGE_KEY = 'cozyflow_dark_v4';

export function normalizeEnergyTier(tier: string | undefined): EnergyTier {
  if (tier === 'FOCUS' || tier === 'TRANSIT' || tier === 'BACKGROUND') {
    return tier;
  }
  return 'BACKGROUND';
}

function loadFromStorage<T>(suffix: string, fallback: T): T {
  try {
    const saved = localStorage.getItem(STORAGE_KEY + suffix);
    return saved ? (JSON.parse(saved) as T) : fallback;
  } catch {
    return fallback;
  }
}

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const todayStr = getTodayDateString();

  const [activeTab, setActiveTab] = useState<ActiveTab>('MEU_DIA');
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [isPiPMode, setIsPiPMode] = useState<boolean>(false);

  const [currentTimeStr, setCurrentTimeStr] = useState<string>(getCurrentTimeString());
  const [adaptivePauseAlert, setAdaptivePauseAlert] = useState<{
    show: boolean;
    message: string;
  } | null>(null);
  const [inactivityAlert, setInactivityAlert] = useState<boolean>(false);
  const lastUserInteractionRef = useRef<number>(Date.now());
  const lastPauseAlertKeyRef = useRef<string>('');
  const inactivityAlertedRef = useRef<boolean>(false);

  const [toast, setToast] = useState<ToastMessage | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  const showToast = useCallback((message: string, type: ToastMessage['type'] = 'info') => {
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
    const id = Date.now();
    setToast({ id, message, type });
    toastTimerRef.current = window.setTimeout(() => {
      setToast((prev) => (prev?.id === id ? null : prev));
    }, 4200);
  }, []);

  const dismissToast = useCallback(() => {
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
    setToast(null);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  const requestConfirm = useCallback(
    (title: string, message: string, onConfirm: () => void) => {
      setConfirmDialog({
        isOpen: true,
        title,
        message,
        onConfirm: () => {
          setConfirmDialog(null);
          onConfirm();
        },
      });
    },
    []
  );

  const closeConfirmDialog = useCallback(() => setConfirmDialog(null), []);

  const defaultDayHoursConfigs: DayHoursConfig[] = useMemo(
    () => [
      { dayOfWeek: 1, startHour: '06:00', endHour: '23:00' },
      { dayOfWeek: 2, startHour: '06:00', endHour: '23:00' },
      { dayOfWeek: 3, startHour: '06:00', endHour: '23:00' },
      { dayOfWeek: 4, startHour: '06:00', endHour: '23:00' },
      { dayOfWeek: 5, startHour: '06:00', endHour: '23:00' },
      { dayOfWeek: 6, startHour: '08:00', endHour: '22:00' },
      { dayOfWeek: 0, startHour: '08:00', endHour: '22:00' },
    ],
    []
  );

  const defaultProgressBars: ProgressBarItem[] = [
    {
      id: 'prog-estudar',
      title: 'Estudar (Geral)',
      type: 'TIME',
      color: '#B49BFA',
      energyTier: 'FOCUS',
      createdAt: todayStr,
      isCompleted: false,
      isUnlimited: true,
      targetDailySeconds: 3 * 3600,
      spentTotalSeconds: 14.5 * 3600,
      spentTodaySeconds: 3600,
      pauseTodaySeconds: 300,
      isRunning: false,
      isPaused: false,
      history: [
        { date: '2026-11-09', seconds: 5 * 3600, colorTone: '#8B5CF6' },
        { date: '2026-11-10', seconds: 8.5 * 3600, colorTone: '#A78BFA' },
        { date: todayStr, seconds: 3600, colorTone: '#DDD6FE' },
      ],
    },
    {
      id: 'prog-mat',
      parentId: 'prog-estudar',
      title: 'Matemática',
      type: 'TIME',
      color: '#7DD3FC',
      energyTier: 'FOCUS',
      createdAt: todayStr,
      isCompleted: false,
      isUnlimited: false,
      targetTotalSeconds: 20 * 3600,
      targetDailySeconds: 1.5 * 3600,
      spentTotalSeconds: 8.5 * 3600,
      spentTodaySeconds: 2400,
      pauseTodaySeconds: 0,
      isRunning: false,
      isPaused: false,
      history: [
        { date: '2026-11-10', seconds: 7.8 * 3600, colorTone: '#38BDF8' },
        { date: todayStr, seconds: 2400, colorTone: '#BAE6FD' },
      ],
    },
    {
      id: 'prog-port',
      parentId: 'prog-estudar',
      title: 'Português & Redação',
      type: 'TIME',
      color: '#86EFAC',
      energyTier: 'FOCUS',
      createdAt: todayStr,
      isCompleted: false,
      isUnlimited: true,
      targetDailySeconds: 1 * 3600,
      spentTotalSeconds: 6 * 3600,
      spentTodaySeconds: 1200,
      pauseTodaySeconds: 0,
      isRunning: false,
      isPaused: false,
      history: [
        { date: '2026-11-09', seconds: 5.6 * 3600, colorTone: '#4ADE80' },
        { date: todayStr, seconds: 1200, colorTone: '#BBF7D0' },
      ],
    },
    {
      id: 'prog-2',
      title: 'Podcasts & Aulas em Trânsito',
      type: 'TIME',
      color: '#FCA5A5',
      energyTier: 'TRANSIT',
      createdAt: todayStr,
      isCompleted: false,
      isUnlimited: false,
      targetTotalSeconds: 20 * 3600,
      targetDailySeconds: 45 * 60,
      spentTotalSeconds: 6 * 3600,
      spentTodaySeconds: 1200,
      pauseTodaySeconds: 0,
      isRunning: false,
      isPaused: false,
      history: [
        { date: '2026-11-10', seconds: 5.6 * 3600, colorTone: '#FB7185' },
        { date: todayStr, seconds: 1200, colorTone: '#FECDD3' },
      ],
    },
    {
      id: 'prog-3',
      title: 'Desenvolvimento do MVP SaaS',
      type: 'TASKS',
      color: '#86EFAC',
      energyTier: 'FOCUS',
      createdAt: todayStr,
      isCompleted: false,
      subtasks: [
        { id: 's1', title: 'Dark Mode & Google Cute Tokens', weightPercent: 25, isCompleted: true },
        { id: 's2', title: 'Réguas Verticais & Drag-to-Create', weightPercent: 40, isCompleted: true },
        { id: 's3', title: 'Subprogressos Vinculados', weightPercent: 20, isCompleted: false },
        { id: 's4', title: 'Modal com 3 Abas de Alocação', weightPercent: 15, isCompleted: false },
      ],
    },
    {
      id: 'prog-4',
      title: 'Copos de Água (Hidratação)',
      type: 'CHECKPOINT',
      color: '#7DD3FC',
      energyTier: 'BACKGROUND',
      createdAt: todayStr,
      isCompleted: false,
      totalGoal: 80,
      dailyGoal: 8,
      totalCompleted: 44,
      todayCompleted: 6,
    },
  ];

  const defaultRoutine: RoutineBlock[] = [
    { id: 'r1', title: 'Aula: Engenharia de Software', dayOfWeek: 1, startTime: '08:00', endTime: '10:00', tier: 'FOCUS', obligation: 'MANDATORY', color: '#B49BFA', areaType: 'COLLEGE' },
    { id: 'r2', title: 'Deslocamento / Ônibus', dayOfWeek: 1, startTime: '10:15', endTime: '11:15', tier: 'TRANSIT', obligation: 'FLEXIBLE', color: '#FCA5A5', areaType: 'COMMUTE' },
    { id: 'r3', title: 'Almoço & Pausa', dayOfWeek: 1, startTime: '12:00', endTime: '13:30', tier: 'BACKGROUND', obligation: 'MANDATORY', color: '#7DD3FC', areaType: 'CUSTOM' },
    { id: 'r4', title: 'Trabalho / Projetos', dayOfWeek: 1, startTime: '14:00', endTime: '18:00', tier: 'FOCUS', obligation: 'MANDATORY', color: '#B49BFA', areaType: 'WORK' },
    { id: 'r5', title: 'Academia & Treino', dayOfWeek: 2, startTime: '07:30', endTime: '09:00', tier: 'FOCUS', obligation: 'MANDATORY', color: '#B49BFA', areaType: 'CUSTOM' },
    { id: 'r6', title: 'Trabalho', dayOfWeek: 2, startTime: '14:00', endTime: '18:00', tier: 'FOCUS', obligation: 'MANDATORY', color: '#B49BFA', areaType: 'WORK' },
    { id: 'r7', title: 'Aula: Banco de Dados', dayOfWeek: 3, startTime: '08:00', endTime: '11:00', tier: 'FOCUS', obligation: 'MANDATORY', color: '#B49BFA', areaType: 'COLLEGE' },
    { id: 'r8', title: 'Trabalho', dayOfWeek: 3, startTime: '14:00', endTime: '18:00', tier: 'FOCUS', obligation: 'MANDATORY', color: '#B49BFA', areaType: 'WORK' },
    { id: 'r9', title: 'Laboratório & Pesquisa', dayOfWeek: 4, startTime: '09:00', endTime: '12:00', tier: 'FOCUS', obligation: 'MANDATORY', color: '#B49BFA', areaType: 'COLLEGE' },
    { id: 'r10', title: 'Trabalho', dayOfWeek: 4, startTime: '14:00', endTime: '18:00', tier: 'FOCUS', obligation: 'MANDATORY', color: '#B49BFA', areaType: 'WORK' },
    { id: 'r11', title: 'Reunião de Alinhamento', dayOfWeek: 5, startTime: '10:00', endTime: '11:30', tier: 'FOCUS', obligation: 'MANDATORY', color: '#B49BFA', areaType: 'WORK' },
    { id: 'r12', title: 'Trabalho', dayOfWeek: 5, startTime: '14:00', endTime: '17:00', tier: 'FOCUS', obligation: 'MANDATORY', color: '#B49BFA', areaType: 'WORK' },
    { id: 'r13', title: 'Organização da Casa & Mercado', dayOfWeek: 6, startTime: '09:00', endTime: '11:30', tier: 'BACKGROUND', obligation: 'FLEXIBLE', color: '#7DD3FC', areaType: 'CUSTOM' },
    { id: 'r14', title: 'Descanso & Lazer', dayOfWeek: 0, startTime: '10:00', endTime: '16:00', tier: 'BACKGROUND', obligation: 'MANDATORY', color: '#7DD3FC', areaType: 'CUSTOM' },
  ];

  const defaultScheduled: ScheduledBlock[] = [
    {
      id: 'sch-1',
      title: 'Estudo de Matemática',
      date: todayStr,
      startTime: '19:00',
      endTime: '20:30',
      tier: 'FOCUS',
      obligation: 'FLEXIBLE',
      layer: 0,
      allocationType: 'PROGRESS',
      linkedProgressId: 'prog-mat',
      color: '#7DD3FC',
    },
    {
      id: 'sch-2',
      title: 'Revisão Noturna & MVP',
      date: todayStr,
      startTime: '22:00',
      endTime: '23:55',
      tier: 'FOCUS',
      obligation: 'FLEXIBLE',
      layer: 0,
      allocationType: 'PROGRESS',
      linkedProgressId: 'prog-port',
      color: '#86EFAC',
    },
  ];

  const defaultTasks: TaskItem[] = [
    {
      id: 'tsk-1',
      title: 'Configurar régua vertical interativa',
      priority: 'P1',
      obligation: 'MANDATORY',
      energyTier: 'FOCUS',
      isCompleted: false,
      date: todayStr,
      durationMinutes: 45,
      subitems: [
        { id: 'sub-1', title: 'Arrastar para criar bloco', isCompleted: true },
        { id: 'sub-2', title: 'Redimensionar puxando bordas', isCompleted: false },
        { id: 'sub-3', title: 'Linha da hora atual', isCompleted: false },
      ],
    },
    {
      id: 'tsk-2',
      title: 'Ouvir podcast no ônibus',
      priority: 'P2',
      obligation: 'FLEXIBLE',
      energyTier: 'TRANSIT',
      isCompleted: false,
      date: todayStr,
      durationMinutes: 25,
      subitems: [],
    },
    {
      id: 'tsk-3',
      title: 'Deixar backup rodando em segundo plano',
      priority: 'P3',
      obligation: 'FLEXIBLE',
      energyTier: 'BACKGROUND',
      isCompleted: false,
      date: todayStr,
      durationMinutes: 15,
      subitems: [],
    },
    {
      id: 'tsk-4',
      title: 'Resolver lista de exercícios de BD',
      priority: 'P1',
      obligation: 'MANDATORY',
      energyTier: 'FOCUS',
      isCompleted: false,
      date: todayStr,
      durationMinutes: 60,
      subitems: [
        { id: 'sub-4-1', title: 'Questões de Álgebra Relacional', isCompleted: false },
        { id: 'sub-4-2', title: 'Queries SQL Avançadas', isCompleted: false },
      ],
    },
  ];

  // State Initialization (preserving user's localStorage and normalizing legacy REST tier)
  const [progressBars, setProgressBars] = useState<ProgressBarItem[]>(() =>
    loadFromStorage('_progress', defaultProgressBars).map((p) => ({
      ...p,
      energyTier: normalizeEnergyTier(p.energyTier),
    }))
  );
  const [routineBlocks, setRoutineBlocks] = useState<RoutineBlock[]>(() =>
    loadFromStorage('_routine', defaultRoutine).map((r) => ({
      ...r,
      tier: normalizeEnergyTier(r.tier),
    }))
  );
  const [scheduledBlocks, setScheduledBlocks] = useState<ScheduledBlock[]>(() =>
    loadFromStorage('_scheduled', defaultScheduled).map((b) => ({
      ...b,
      tier: normalizeEnergyTier(b.tier),
      allocationType:
        b.allocationType === 'PROGRESS' || b.allocationType === 'TASK'
          ? b.allocationType
          : b.linkedProgressId
            ? 'PROGRESS'
            : b.linkedTaskId
              ? 'TASK'
              : undefined,
    }))
  );
  const [tasks, setTasks] = useState<TaskItem[]>(() =>
    loadFromStorage('_tasks', defaultTasks).map((t) => ({
      ...t,
      energyTier: normalizeEnergyTier(t.energyTier),
    }))
  );
  const [dayOverrides, setDayOverrides] = useState<Record<string, DayOverride>>(() => {
    const raw = loadFromStorage<Record<string, DayOverride>>('_overrides', {});
    const normalized: Record<string, DayOverride> = {};
    for (const [k, ov] of Object.entries(raw)) {
      normalized[k] = {
        ...ov,
        customRoutineAreas: ov.customRoutineAreas?.map((a) => ({
          ...a,
          tier: normalizeEnergyTier(a.tier),
        })),
      };
    }
    return normalized;
  });
  const [dayHoursConfigs, setDayHoursConfigs] = useState<DayHoursConfig[]>(() =>
    loadFromStorage('_day_hours', defaultDayHoursConfigs)
  );

  // Sync to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY + '_progress', JSON.stringify(progressBars));
  }, [progressBars]);
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY + '_routine', JSON.stringify(routineBlocks));
  }, [routineBlocks]);
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY + '_scheduled', JSON.stringify(scheduledBlocks));
  }, [scheduledBlocks]);
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY + '_tasks', JSON.stringify(tasks));
  }, [tasks]);
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY + '_overrides', JSON.stringify(dayOverrides));
  }, [dayOverrides]);
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY + '_day_hours', JSON.stringify(dayHoursConfigs));
  }, [dayHoursConfigs]);

  // Update real current time every 10 seconds, triggering state only when minute actually changes
  useEffect(() => {
    const timeInterval = setInterval(() => {
      setCurrentTimeStr((prev) => {
        const next = getCurrentTimeString();
        return prev === next ? prev : next;
      });
    }, 10000);
    return () => clearInterval(timeInterval);
  }, []);

  // Passive listeners for user activity tracking
  useEffect(() => {
    const handleActivity = () => {
      lastUserInteractionRef.current = Date.now();
    };
    window.addEventListener('mousemove', handleActivity, { passive: true });
    window.addEventListener('keydown', handleActivity, { passive: true });
    window.addEventListener('click', handleActivity, { passive: true });
    return () => {
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('click', handleActivity);
    };
  }, []);

  // Only tick the 1-second timer when at least one TIME progress bar is running or paused
  const hasActiveOrPausedTimer = useMemo(
    () => progressBars.some((p) => p.type === 'TIME' && (p.isRunning || p.isPaused)),
    [progressBars]
  );

  useEffect(() => {
    if (!hasActiveOrPausedTimer) return;

    const interval = setInterval(() => {
      setProgressBars((prev) => {
        const runningItem = prev.find((p) => p.type === 'TIME' && p.isRunning && !p.isPaused);
        const parentIdToCredit = runningItem?.parentId;

        return prev.map((p) => {
          if (p.type !== 'TIME') return p;

          const isSelfRunning = p.isRunning && !p.isPaused;
          const isParentOfRunning = parentIdToCredit === p.id;

          if (isSelfRunning || isParentOfRunning) {
            const nextSpentToday = (p.spentTodaySeconds || 0) + 1;
            const nextSpentTotal = (p.spentTotalSeconds || 0) + 1;
            const isCompletedNow =
              !p.isUnlimited && p.targetTotalSeconds
                ? nextSpentTotal >= p.targetTotalSeconds
                : false;

            const currentHistory = p.history || [];
            const todayIndex = currentHistory.findIndex((h) => h.date === todayStr);
            const updatedHistory = [...currentHistory];
            if (todayIndex >= 0) {
              updatedHistory[todayIndex] = {
                ...updatedHistory[todayIndex],
                seconds: updatedHistory[todayIndex].seconds + 1,
              };
            } else {
              updatedHistory.push({
                date: todayStr,
                seconds: 1,
                colorTone: '#DDD6FE',
              });
            }

            return {
              ...p,
              spentTodaySeconds: nextSpentToday,
              spentTotalSeconds: nextSpentTotal,
              history: updatedHistory,
              isCompleted: isCompletedNow || p.isCompleted,
            };
          }

          if (p.isPaused) {
            return {
              ...p,
              pauseTodaySeconds: (p.pauseTodaySeconds || 0) + 1,
            };
          }

          return p;
        });
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [hasActiveOrPausedTimer, todayStr]);

  // Separate effect for timer side-effects (confetti, chime, adaptive pause & inactivity alerts)
  const completedIdsRef = useRef<Set<string>>(
    new Set(progressBars.filter((p) => p.isCompleted).map((p) => p.id))
  );

  useEffect(() => {
    const runningItem = progressBars.find((p) => p.type === 'TIME' && p.isRunning && !p.isPaused);

    // Check newly completed progress bars
    let newlyCompleted = false;
    const nextCompletedIds = new Set<string>();
    progressBars.forEach((p) => {
      if (p.isCompleted) {
        nextCompletedIds.add(p.id);
        if (!completedIdsRef.current.has(p.id)) {
          newlyCompleted = true;
        }
      }
    });
    completedIdsRef.current = nextCompletedIds;

    if (newlyCompleted) {
      fireCuteConfetti();
      playGentleBellChime();
    }

    if (!runningItem) return;

    const spentToday = runningItem.spentTodaySeconds || 0;
    if (
      runningItem.targetDailySeconds &&
      runningItem.targetDailySeconds > 30 * 60 &&
      spentToday > 0 &&
      spentToday % 2700 === 0
    ) {
      const alertKey = `${runningItem.id}:${spentToday}`;
      if (lastPauseAlertKeyRef.current !== alertKey) {
        lastPauseAlertKeyRef.current = alertKey;
        playGentleBellChime();
        setAdaptivePauseAlert({
          show: true,
          message: `Você está focado em "${runningItem.title}" há 45 min. Que tal uma pausa rápida de 10 min? 🍵`,
        });
      }
    }

    const idleTime = Date.now() - lastUserInteractionRef.current;
    if (idleTime > 90 * 60 * 1000 && !inactivityAlertedRef.current) {
      inactivityAlertedRef.current = true;
      playGentleBellChime();
      setInactivityAlert(true);
    }
  }, [progressBars]);

  const getRoutineAreasForDay = useCallback(
    (dayOfWeek: number, dateStr?: string): RoutineBlock[] => {
      if (dateStr) {
        const override = dayOverrides[dateStr];
        if (override?.customRoutineAreas !== undefined) {
          return [...override.customRoutineAreas]
            .map((r) => ({
              ...r,
              tier: normalizeEnergyTier(r.tier),
              areaType: r.areaType || inferAreaType(r.title, r.tier),
            }))
            .sort((a, b) => timeStringToMinutes(a.startTime) - timeStringToMinutes(b.startTime));
        }
      }
      const hiddenIds = dateStr ? dayOverrides[dateStr]?.hiddenRoutineIds || [] : [];
      return routineBlocks
        .filter((r) => r.dayOfWeek === dayOfWeek && !hiddenIds.includes(r.id))
        .map((r) => ({
          ...r,
          tier: normalizeEnergyTier(r.tier),
          areaType: r.areaType || inferAreaType(r.title, r.tier),
        }))
        .sort((a, b) => timeStringToMinutes(a.startTime) - timeStringToMinutes(b.startTime));
    },
    [routineBlocks, dayOverrides]
  );

  const materializeBaseAreasForDate = useCallback(
    (dateStr: string, existing?: DayOverride): RoutineBlock[] => {
      if (existing?.customRoutineAreas !== undefined) {
        return existing.customRoutineAreas;
      }
      const dayOfWeek = new Date(dateStr + 'T12:00:00').getDay();
      const hiddenIds = existing?.hiddenRoutineIds || [];
      return routineBlocks
        .filter((r) => r.dayOfWeek === dayOfWeek && !hiddenIds.includes(r.id))
        .map((r) => ({ ...r, tier: normalizeEnergyTier(r.tier) }));
    },
    [routineBlocks]
  );

  const addDayRoutineArea = useCallback(
    (dateStr: string, area: Omit<RoutineBlock, 'id' | 'dayOfWeek'>) => {
      const dayOfWeek = new Date(dateStr + 'T12:00:00').getDay();
      setDayOverrides((prev) => {
        const existing = prev[dateStr] || {
          date: dateStr,
          isSOSActive: false,
          isNightClosed: false,
          discardedTaskIds: [],
          hiddenRoutineIds: [],
        };
        const currentAreas = materializeBaseAreasForDate(dateStr, existing);
        const newArea: RoutineBlock = {
          ...area,
          id: `dayarea-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
          dayOfWeek,
          tier: normalizeEnergyTier(area.tier),
        };
        return {
          ...prev,
          [dateStr]: {
            ...existing,
            customRoutineAreas: [...currentAreas, newArea],
          },
        };
      });
    },
    [materializeBaseAreasForDate]
  );

  const updateDayRoutineArea = useCallback(
    (dateStr: string, areaId: string, updates: Partial<RoutineBlock>) => {
      setDayOverrides((prev) => {
        const existing = prev[dateStr] || {
          date: dateStr,
          isSOSActive: false,
          isNightClosed: false,
          discardedTaskIds: [],
          hiddenRoutineIds: [],
        };
        const currentAreas = materializeBaseAreasForDate(dateStr, existing);
        return {
          ...prev,
          [dateStr]: {
            ...existing,
            customRoutineAreas: currentAreas.map((a) =>
              a.id === areaId
                ? {
                    ...a,
                    ...updates,
                    tier: updates.tier ? normalizeEnergyTier(updates.tier) : a.tier,
                  }
                : a
            ),
          },
        };
      });
    },
    [materializeBaseAreasForDate]
  );

  const deleteDayRoutineArea = useCallback(
    (dateStr: string, areaId: string) => {
      setDayOverrides((prev) => {
        const existing = prev[dateStr] || {
          date: dateStr,
          isSOSActive: false,
          isNightClosed: false,
          discardedTaskIds: [],
          hiddenRoutineIds: [],
        };
        const currentAreas = materializeBaseAreasForDate(dateStr, existing);
        return {
          ...prev,
          [dateStr]: {
            ...existing,
            customRoutineAreas: currentAreas.filter((a) => a.id !== areaId),
          },
        };
      });
    },
    [materializeBaseAreasForDate]
  );

  const resetDayRoutineAreas = useCallback((dateStr: string) => {
    setDayOverrides((prev) => {
      const existing = prev[dateStr];
      if (!existing) return prev;
      return {
        ...prev,
        [dateStr]: {
          ...existing,
          hiddenRoutineIds: [],
          customRoutineAreas: undefined,
        },
      };
    });
  }, []);

  const hideRoutineAreaForDate = useCallback(
    (dateStr: string, routineId: string) => {
      deleteDayRoutineArea(dateStr, routineId);
    },
    [deleteDayRoutineArea]
  );

  const restoreHiddenRoutineAreasForDate = useCallback(
    (dateStr: string) => {
      resetDayRoutineAreas(dateStr);
    },
    [resetDayRoutineAreas]
  );

  const getEffectiveBlocksForDate = useCallback(
    (dateStr: string): ScheduledBlock[] => {
      const override = dayOverrides[dateStr];
      const isSOS = override?.isSOSActive || false;
      const explicitScheduled = scheduledBlocks.filter((b) => b.date === dateStr);

      if (isSOS) {
        return explicitScheduled.filter((b) => b.obligation === 'MANDATORY');
      }
      return explicitScheduled;
    },
    [dayOverrides, scheduledBlocks]
  );

  // Current active schedule strictly based on real clock time
  const currentActiveSchedule = useMemo(() => {
    const currentMinutes = timeStringToMinutes(currentTimeStr);
    const todayEffective = getEffectiveBlocksForDate(todayStr);

    const matchedBlocks = todayEffective.filter((b) => {
      if (b.isCancelledToday) return false;
      const start = timeStringToMinutes(b.startTime);
      const end = timeStringToMinutes(b.endTime);
      return start <= currentMinutes && currentMinutes < end;
    });

    const matchedBlock = matchedBlocks.find((b) => b.layer === 1) || matchedBlocks[0] || null;

    let matchedProgress: ProgressBarItem | null = null;
    if (matchedBlock?.linkedProgressId) {
      matchedProgress = progressBars.find((p) => p.id === matchedBlock.linkedProgressId) || null;
    } else if (matchedBlock) {
      matchedProgress =
        progressBars.find((p) => p.energyTier === matchedBlock.tier && !p.isCompleted) || null;
    }

    const todayDayOfWeek = new Date(todayStr + 'T12:00:00').getDay();
    const todayAreas = getRoutineAreasForDay(todayDayOfWeek, todayStr);
    const matchedArea =
      todayAreas.find((a) => {
        const start = timeStringToMinutes(a.startTime);
        const end = timeStringToMinutes(a.endTime);
        return start <= currentMinutes && currentMinutes < end;
      }) || null;

    return {
      block: matchedBlock,
      progress: matchedProgress,
      currentArea: matchedArea,
      isFreeSlot: matchedBlock === null,
      currentTimeStr,
    };
  }, [currentTimeStr, getEffectiveBlocksForDate, todayStr, progressBars, getRoutineAreasForDay]);

  const getDayBoundsForDate = useCallback(
    (dateStr: string) => {
      const dateObj = new Date(dateStr + 'T12:00:00');
      const dayOfWeek = dateObj.getDay();
      const cfg = dayHoursConfigs.find((c) => c.dayOfWeek === dayOfWeek);
      const startH = cfg ? Math.floor(timeStringToMinutes(cfg.startHour) / 60) : 6;
      const endH = cfg ? Math.floor(timeStringToMinutes(cfg.endHour) / 60) : 23;
      return {
        startHour: Math.max(0, Math.min(22, startH)),
        endHour: Math.max(startH + 1, Math.min(23, endH)),
      };
    },
    [dayHoursConfigs]
  );

  // Progress Bar Handlers
  const createProgressBar = useCallback(
    (item: Omit<ProgressBarItem, 'id' | 'createdAt' | 'isCompleted'>): ProgressBarItem => {
      const newItem: ProgressBarItem = {
        ...item,
        id: `prog-${Date.now()}`,
        createdAt: todayStr,
        isCompleted: false,
        spentTotalSeconds: 0,
        spentTodaySeconds: 0,
        pauseTodaySeconds: 0,
        isRunning: false,
        isPaused: false,
        history: [],
      };
      setProgressBars((prev) => [newItem, ...prev]);
      fireCuteConfetti();
      return newItem;
    },
    [todayStr]
  );

  const updateProgressBar = useCallback((id: string, updates: Partial<ProgressBarItem>) => {
    setProgressBars((prev) => prev.map((p) => (p.id === id ? { ...p, ...updates } : p)));
  }, []);

  const deleteProgressBar = useCallback(
    (id: string) => {
      const idsToRemove = new Set(
        progressBars.filter((p) => p.id === id || p.parentId === id).map((p) => p.id)
      );
      idsToRemove.add(id);

      setProgressBars((prev) => prev.filter((p) => !idsToRemove.has(p.id)));
      setScheduledBlocks((prev) =>
        prev.map((b) =>
          b.linkedProgressId && idsToRemove.has(b.linkedProgressId)
            ? {
                ...b,
                linkedProgressId: undefined,
                allocationType: b.allocationType === 'PROGRESS' ? undefined : b.allocationType,
              }
            : b
        )
      );
    },
    [progressBars]
  );

  const playProgress = useCallback(
    (id: string) => {
      const target = progressBars.find((p) => p.id === id);
      if (
        target?.type === 'TIME' &&
        target.targetDailySeconds &&
        (target.spentTodaySeconds || 0) >= target.targetDailySeconds
      ) {
        requestConfirm(
          'Meta Diária Já Atingida!',
          `Você já cumpriu a meta de hoje para "${target.title}". Deseja continuar no modo foco estendido?`,
          () => {
            setProgressBars((prev) =>
              prev.map((p) =>
                p.id === id
                  ? { ...p, isRunning: true, isPaused: false }
                  : { ...p, isRunning: false, isPaused: false }
              )
            );
          }
        );
        return;
      }

      setProgressBars((prev) =>
        prev.map((p) =>
          p.id === id
            ? { ...p, isRunning: true, isPaused: false }
            : { ...p, isRunning: false, isPaused: false }
        )
      );
    },
    [progressBars, requestConfirm]
  );

  const pauseProgress = useCallback((id: string) => {
    setProgressBars((prev) =>
      prev.map((p) => (p.id === id ? { ...p, isRunning: false, isPaused: true } : p))
    );
  }, []);

  const resumeFromPause = useCallback(
    (id: string) => {
      playProgress(id);
    },
    [playProgress]
  );

  const resetProgress = useCallback(
    (id: string) => {
      requestConfirm(
        'Resetar Tempo de Hoje?',
        'Isso zerará os segundos registrados para hoje neste objetivo e ajustará o total acumulado.',
        () => {
          setProgressBars((prev) => {
            const target = prev.find((p) => p.id === id);
            if (!target) return prev;
            const todaySpentToDeduct = target.spentTodaySeconds || 0;
            const parentId = target.parentId;

            return prev.map((p) => {
              if (p.id === id) {
                const nextTotal = Math.max(0, (p.spentTotalSeconds || 0) - todaySpentToDeduct);
                const nextHistory = (p.history || []).filter((h) => h.date !== todayStr);
                const isStillCompleted =
                  !p.isUnlimited && p.targetTotalSeconds
                    ? nextTotal >= p.targetTotalSeconds
                    : false;
                return {
                  ...p,
                  spentTodaySeconds: 0,
                  pauseTodaySeconds: 0,
                  spentTotalSeconds: nextTotal,
                  history: nextHistory,
                  isRunning: false,
                  isPaused: false,
                  isCompleted: isStillCompleted,
                };
              }

              if (parentId && p.id === parentId && todaySpentToDeduct > 0) {
                const nextTotal = Math.max(0, (p.spentTotalSeconds || 0) - todaySpentToDeduct);
                const nextToday = Math.max(0, (p.spentTodaySeconds || 0) - todaySpentToDeduct);
                const nextHistory = (p.history || [])
                  .map((h) =>
                    h.date === todayStr
                      ? { ...h, seconds: Math.max(0, h.seconds - todaySpentToDeduct) }
                      : h
                  )
                  .filter((h) => h.seconds > 0);
                const isStillCompleted =
                  !p.isUnlimited && p.targetTotalSeconds
                    ? nextTotal >= p.targetTotalSeconds
                    : false;
                return {
                  ...p,
                  spentTodaySeconds: nextToday,
                  spentTotalSeconds: nextTotal,
                  history: nextHistory,
                  isCompleted: isStillCompleted,
                };
              }

              return p;
            });
          });
        }
      );
    },
    [requestConfirm, todayStr]
  );

  const incrementCheckpoint = useCallback((id: string) => {
    setProgressBars((prev) =>
      prev.map((p) => {
        if (p.id === id && p.type === 'CHECKPOINT') {
          const nextToday = (p.todayCompleted || 0) + 1;
          const nextTotal = (p.totalCompleted || 0) + 1;
          const reachedGlobal = p.totalGoal ? nextTotal >= p.totalGoal : false;
          return {
            ...p,
            todayCompleted: nextToday,
            totalCompleted: nextTotal,
            isCompleted: reachedGlobal || p.isCompleted,
          };
        }
        return p;
      })
    );
    fireCuteConfetti();
  }, []);

  const toggleSubtask = useCallback((progressId: string, subtaskId: string) => {
    setProgressBars((prev) =>
      prev.map((p) => {
        if (p.id === progressId && p.subtasks) {
          const updatedSubtasks = p.subtasks.map((s) =>
            s.id === subtaskId ? { ...s, isCompleted: !s.isCompleted } : s
          );
          const totalWeight = updatedSubtasks
            .filter((s) => s.isCompleted)
            .reduce((acc, curr) => acc + curr.weightPercent, 0);

          const isNow100 = totalWeight >= 100;
          return {
            ...p,
            subtasks: updatedSubtasks,
            isCompleted: isNow100,
          };
        }
        return p;
      })
    );
  }, []);

  // Routine Actions
  const addRoutineBlock = useCallback((block: Omit<RoutineBlock, 'id'>) => {
    const newBlock: RoutineBlock = {
      ...block,
      id: `rout-${Date.now()}`,
    };
    setRoutineBlocks((prev) => [...prev, newBlock]);
  }, []);

  const updateRoutineBlock = useCallback((id: string, updates: Partial<RoutineBlock>) => {
    setRoutineBlocks((prev) => prev.map((r) => (r.id === id ? { ...r, ...updates } : r)));
  }, []);

  // Direct synchronous delete (UI calls requestConfirm before invoking)
  const deleteRoutineBlock = useCallback((id: string) => {
    setRoutineBlocks((prev) => prev.filter((r) => r.id !== id));
  }, []);

  // Scheduled Block Actions (with optional Google-Calendar-style Recurrence expansion)
  const addScheduledBlock = useCallback(
    (block: Omit<ScheduledBlock, 'id'>, recurrence?: RecurrenceRule): ScheduledBlock => {
      const dates = expandRecurrenceDates(block.date, recurrence);
      const isRecurring = dates.length > 1 && recurrence && recurrence.frequency !== 'NONE';
      const seriesId = isRecurring
        ? block.recurringSeriesId ||
          `series-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
        : block.recurringSeriesId;

      const baseTs = Date.now();
      const createdBlocks: ScheduledBlock[] = dates.map((occDate, idx) => ({
        ...block,
        date: occDate,
        tier: normalizeEnergyTier(block.tier),
        id: `sch-${baseTs}-${idx}-${Math.random().toString(36).slice(2, 5)}`,
        recurrence: recurrence && recurrence.frequency !== 'NONE' ? recurrence : undefined,
        recurringSeriesId: seriesId,
      }));

      setScheduledBlocks((prev) => [...prev, ...createdBlocks]);
      return createdBlocks[0];
    },
    []
  );

  const updateEffectiveBlock = useCallback(
    (dateStr: string, block: ScheduledBlock, updates: Partial<ScheduledBlock>) => {
      if (block.routineOriginId && block.id.startsWith('virt-')) {
        setDayOverrides((prev) => {
          const existing = prev[dateStr] || {
            date: dateStr,
            isSOSActive: false,
            isNightClosed: false,
            discardedTaskIds: [],
            hiddenRoutineIds: [],
          };
          return {
            ...prev,
            [dateStr]: {
              ...existing,
              hiddenRoutineIds: [...(existing.hiddenRoutineIds || []), block.routineOriginId!],
            },
          };
        });

        const detached: ScheduledBlock = {
          ...block,
          ...updates,
          id: `sch-${Date.now()}`,
          routineOriginId: block.routineOriginId,
        };
        setScheduledBlocks((prev) => [...prev, detached]);
      } else {
        setScheduledBlocks((prev) =>
          prev.map((b) => (b.id === block.id ? { ...b, ...updates } : b))
        );
      }
    },
    []
  );

  // Direct synchronous delete (UI calls requestConfirm before invoking)
  const deleteEffectiveBlock = useCallback((dateStr: string, block: ScheduledBlock) => {
    if (block.routineOriginId && block.id.startsWith('virt-')) {
      setDayOverrides((prev) => {
        const existing = prev[dateStr] || {
          date: dateStr,
          isSOSActive: false,
          isNightClosed: false,
          discardedTaskIds: [],
          hiddenRoutineIds: [],
        };
        return {
          ...prev,
          [dateStr]: {
            ...existing,
            hiddenRoutineIds: [...(existing.hiddenRoutineIds || []), block.routineOriginId!],
          },
        };
      });
    } else {
      setScheduledBlocks((prev) => prev.filter((b) => b.id !== block.id));
    }
  }, []);

  const assignTaskToBlock = useCallback(
    (blockId: string, taskId: string) => {
      const task = tasks.find((t) => t.id === taskId);
      if (!task) return;

      setScheduledBlocks((prev) =>
        prev.map((b) =>
          b.id === blockId
            ? {
                ...b,
                title: task.title,
                linkedTaskId: task.id,
                allocationType: 'TASK',
                color: task.energyTier === 'FOCUS' ? '#B49BFA' : '#FCA5A5',
              }
            : b
        )
      );
      fireCuteConfetti();
    },
    [tasks]
  );

  const assignProgressToBlock = useCallback(
    (blockId: string, progressId: string) => {
      const progress = progressBars.find((p) => p.id === progressId);
      if (!progress) return;

      setScheduledBlocks((prev) =>
        prev.map((b) =>
          b.id === blockId
            ? {
                ...b,
                title: progress.title,
                linkedProgressId: progress.id,
                allocationType: 'PROGRESS',
                color: progress.color,
              }
            : b
        )
      );
      fireCuteConfetti();
    },
    [progressBars]
  );

  const autoFillBlock = useCallback(
    (blockId: string): boolean => {
      const block = scheduledBlocks.find((b) => b.id === blockId);
      if (!block) return false;

      const dateObj = new Date(block.date + 'T12:00:00');
      const dayOfWeek = dateObj.getDay();
      const areas = getRoutineAreasForDay(dayOfWeek, block.date);

      const blockStartMin = timeStringToMinutes(block.startTime);
      const blockEndMin = timeStringToMinutes(block.endTime);

      const matchedArea = areas.find((a) => {
        const aStart = timeStringToMinutes(a.startTime);
        const aEnd = timeStringToMinutes(a.endTime);
        return Math.max(aStart, blockStartMin) < Math.min(aEnd, blockEndMin);
      });

      const requiredTier = matchedArea ? matchedArea.tier : block.tier;

      const alreadyScheduledTaskIds = new Set(
        scheduledBlocks
          .filter((b) => b.date === block.date && b.linkedTaskId && b.id !== blockId)
          .map((b) => b.linkedTaskId!)
      );

      const candidateTask = tasks.find(
        (t) =>
          !t.isCompleted &&
          (!t.date || t.date === block.date) &&
          !alreadyScheduledTaskIds.has(t.id) &&
          t.energyTier === requiredTier
      );

      if (candidateTask) {
        assignTaskToBlock(blockId, candidateTask.id);
        return true;
      }

      const candidateProgress = progressBars.find(
        (p) => !p.isCompleted && p.energyTier === requiredTier
      );

      if (candidateProgress) {
        assignProgressToBlock(blockId, candidateProgress.id);
        return true;
      }

      return false;
    },
    [
      scheduledBlocks,
      getRoutineAreasForDay,
      tasks,
      assignTaskToBlock,
      progressBars,
      assignProgressToBlock,
    ]
  );

  const autoDistributeTasksForDate = useCallback(
    (dateStr: string): { scheduledCount: number; message: string } => {
      const dateObj = new Date(dateStr + 'T12:00:00');
      const dayOfWeek = dateObj.getDay();
      const areas = getRoutineAreasForDay(dayOfWeek, dateStr);
      const dayBounds = getDayBoundsForDate(dateStr);
      const dayStartMin = dayBounds.startHour * 60;
      const dayEndMin = dayBounds.endHour * 60;

      const existingBlocks = scheduledBlocks.filter((b) => b.date === dateStr);
      const existingIntervals = existingBlocks.map((b) => ({
        start: timeStringToMinutes(b.startTime),
        end: timeStringToMinutes(b.endTime),
      }));

      const alreadyScheduledTaskIds = new Set(
        existingBlocks.filter((b) => b.linkedTaskId).map((b) => b.linkedTaskId!)
      );

      const candidateTasks = tasks
        .filter(
          (t) =>
            !t.isCompleted &&
            (!t.date || t.date === dateStr) &&
            !alreadyScheduledTaskIds.has(t.id)
        )
        .sort((a, b) => PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority]);

      if (candidateTasks.length === 0) {
        return {
          scheduledCount: 0,
          message: 'Não há tarefas pendentes para distribuir neste dia.',
        };
      }

      const newBlocks: ScheduledBlock[] = [];
      const usedTaskIds = new Set<string>();

      const getUnoccupiedSlices = (rangeStart: number, rangeEnd: number) => {
        let current = rangeStart;
        const slices: Array<{ start: number; end: number }> = [];

        const overlaps = existingIntervals
          .filter((iv) => Math.max(iv.start, rangeStart) < Math.min(iv.end, rangeEnd))
          .sort((a, b) => a.start - b.start);

        for (const ov of overlaps) {
          if (ov.start > current + 15) {
            slices.push({ start: current, end: ov.start });
          }
          current = Math.max(current, ov.end);
        }
        if (current + 15 <= rangeEnd) {
          slices.push({ start: current, end: rangeEnd });
        }
        return slices;
      };

      const tierColor = (t: EnergyTier) =>
        t === 'FOCUS' ? '#B49BFA' : t === 'TRANSIT' ? '#FDE047' : '#7DD3FC';

      // 1. Distribute into configured Routine Areas matching strictly by EnergyTier
      for (const area of areas) {
        const areaStart = timeStringToMinutes(area.startTime);
        const areaEnd = timeStringToMinutes(area.endTime);

        const eligibleForArea = candidateTasks.filter(
          (t) => !usedTaskIds.has(t.id) && t.energyTier === area.tier
        );

        const freeSlices = getUnoccupiedSlices(areaStart, areaEnd);
        for (const slice of freeSlices) {
          let sliceCur = slice.start;
          for (const task of eligibleForArea) {
            if (usedTaskIds.has(task.id)) continue;
            if (sliceCur + 15 > slice.end) break;

            const duration = Math.min(task.durationMinutes || 45, slice.end - sliceCur);
            if (duration < 15) break;

            const blockStart = sliceCur;
            const blockEnd = sliceCur + duration;

            newBlocks.push({
              id: `sch-auto-${Date.now()}-${task.id}`,
              title: task.title,
              date: dateStr,
              startTime: minutesToTimeString(blockStart),
              endTime: minutesToTimeString(blockEnd),
              tier: area.tier,
              obligation: task.obligation || 'FLEXIBLE',
              layer: 0,
              allocationType: 'TASK',
              linkedTaskId: task.id,
              color: area.color || tierColor(area.tier),
            });

            existingIntervals.push({ start: blockStart, end: blockEnd });
            usedTaskIds.add(task.id);
            sliceCur = blockEnd;
          }
        }
      }

      // 2. Distribute remaining tasks into Free windows outside configured Areas
      const occupiedByAreasOrBlocks = [
        ...areas.map((a) => ({
          start: timeStringToMinutes(a.startTime),
          end: timeStringToMinutes(a.endTime),
        })),
        ...existingIntervals,
      ].sort((a, b) => a.start - b.start);

      let freePtr = dayStartMin;
      const globalFreeSlices: Array<{ start: number; end: number }> = [];
      for (const occ of occupiedByAreasOrBlocks) {
        if (occ.start > freePtr + 15) {
          globalFreeSlices.push({ start: freePtr, end: occ.start });
        }
        freePtr = Math.max(freePtr, occ.end);
      }
      if (freePtr + 15 <= dayEndMin) {
        globalFreeSlices.push({ start: freePtr, end: dayEndMin });
      }

      const remainingTasks = candidateTasks.filter((t) => !usedTaskIds.has(t.id));

      for (const slice of globalFreeSlices) {
        let sliceCur = slice.start;
        for (const task of remainingTasks) {
          if (usedTaskIds.has(task.id)) continue;
          if (sliceCur + 15 > slice.end) break;

          const duration = Math.min(task.durationMinutes || 45, slice.end - sliceCur);
          if (duration < 15) break;

          const blockStart = sliceCur;
          const blockEnd = sliceCur + duration;

          newBlocks.push({
            id: `sch-auto-${Date.now()}-${task.id}`,
            title: task.title,
            date: dateStr,
            startTime: minutesToTimeString(blockStart),
            endTime: minutesToTimeString(blockEnd),
            tier: task.energyTier || 'FOCUS',
            obligation: task.obligation || 'FLEXIBLE',
            layer: 0,
            allocationType: 'TASK',
            linkedTaskId: task.id,
            color: tierColor(task.energyTier || 'FOCUS'),
          });

          existingIntervals.push({ start: blockStart, end: blockEnd });
          usedTaskIds.add(task.id);
          sliceCur = blockEnd;
        }
      }

      if (newBlocks.length > 0) {
        setScheduledBlocks((prev) => [...prev, ...newBlocks]);
        fireCuteConfetti();
        playGentleBellChime();
        return {
          scheduledCount: newBlocks.length,
          message: `${newBlocks.length} tarefa(s) distribuída(s) por compatibilidade de energia!`,
        };
      }

      return {
        scheduledCount: 0,
        message: 'Nenhuma tarefa compatível pôde ser encaixada nos horários livres das áreas.',
      };
    },
    [getRoutineAreasForDay, getDayBoundsForDate, scheduledBlocks, tasks]
  );

  // Task Actions (supports Google-Calendar-style recurrence expansion)
  const addTask = useCallback(
    (task: Omit<TaskItem, 'id'>, recurrence?: RecurrenceRule): TaskItem => {
      const startDate = task.date || todayStr;
      const dates =
        recurrence && recurrence.frequency !== 'NONE'
          ? expandRecurrenceDates(startDate, recurrence)
          : [startDate];
      const isRecurring = dates.length > 1 && recurrence && recurrence.frequency !== 'NONE';
      const seriesId = isRecurring
        ? task.recurringSeriesId ||
          `tseries-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
        : task.recurringSeriesId;

      const baseTs = Date.now();
      const createdTasks: TaskItem[] = dates.map((occDate, idx) => ({
        ...task,
        date: task.date || isRecurring ? occDate : undefined,
        energyTier: normalizeEnergyTier(task.energyTier),
        id: `tsk-${baseTs}-${idx}-${Math.random().toString(36).slice(2, 5)}`,
        recurrence: recurrence && recurrence.frequency !== 'NONE' ? recurrence : undefined,
        recurringSeriesId: seriesId,
      }));

      setTasks((prev) => [...createdTasks, ...prev]);
      return createdTasks[0];
    },
    [todayStr]
  );

  const updateTask = useCallback((id: string, updates: Partial<TaskItem>) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...updates } : t)));
  }, []);

  const toggleTask = useCallback((id: string) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, isCompleted: !t.isCompleted } : t)));
  }, []);

  const toggleTaskSubitem = useCallback((taskId: string, subitemId: string) => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id === taskId && t.subitems) {
          return {
            ...t,
            subitems: t.subitems.map((s) =>
              s.id === subitemId ? { ...s, isCompleted: !s.isCompleted } : s
            ),
          };
        }
        return t;
      })
    );
  }, []);

  // Direct synchronous delete + orphan block cleanup (UI calls requestConfirm before invoking)
  const deleteTask = useCallback((id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    setScheduledBlocks((prev) =>
      prev.filter((b) => !(b.allocationType === 'TASK' && b.linkedTaskId === id))
    );
  }, []);

  // SOS & Overrides
  const triggerSOS = useCallback((dateStr: string) => {
    setDayOverrides((prev) => ({
      ...prev,
      [dateStr]: {
        ...(prev[dateStr] || {
          date: dateStr,
          isNightClosed: false,
          discardedTaskIds: [],
          hiddenRoutineIds: [],
        }),
        isSOSActive: true,
      },
    }));
    fireCuteConfetti();
  }, []);

  const undoSOS = useCallback((dateStr: string) => {
    setDayOverrides((prev) => {
      const copy = { ...prev };
      if (copy[dateStr]) {
        copy[dateStr] = { ...copy[dateStr], isSOSActive: false };
      }
      return copy;
    });
  }, []);

  const toggleBlockObligationToday = useCallback(
    (dateStr: string, block: ScheduledBlock) => {
      updateEffectiveBlock(dateStr, block, {
        obligation: block.obligation === 'MANDATORY' ? 'FLEXIBLE' : 'MANDATORY',
      });
    },
    [updateEffectiveBlock]
  );

  const closeNightCheckOut = useCallback(
    (dateStr: string, discardTaskIds: string[], pushToTomorrowTaskIds: string[]) => {
      const tomorrowStr = addDaysToDateString(dateStr, 1);

      setTasks((prev) =>
        prev
          .filter((t) => !discardTaskIds.includes(t.id))
          .map((t) => (pushToTomorrowTaskIds.includes(t.id) ? { ...t, date: tomorrowStr } : t))
      );

      if (discardTaskIds.length > 0) {
        setScheduledBlocks((prev) =>
          prev.filter(
            (b) => !(b.allocationType === 'TASK' && b.linkedTaskId && discardTaskIds.includes(b.linkedTaskId))
          )
        );
      }

      setDayOverrides((prev) => ({
        ...prev,
        [dateStr]: {
          ...(prev[dateStr] || { date: dateStr, isSOSActive: false, hiddenRoutineIds: [] }),
          isNightClosed: true,
          discardedTaskIds: discardTaskIds,
        },
      }));

      fireCuteConfetti();
    },
    []
  );

  const updateDayHoursConfig = useCallback(
    (dayOfWeek: number, startHour: string, endHour: string) => {
      setDayHoursConfigs((prev) =>
        prev.map((c) => (c.dayOfWeek === dayOfWeek ? { ...c, startHour, endHour } : c))
      );
    },
    []
  );

  const dismissAdaptivePause = useCallback(() => setAdaptivePauseAlert(null), []);
  const dismissInactivityAlert = useCallback(() => {
    setInactivityAlert(false);
    inactivityAlertedRef.current = false;
    lastUserInteractionRef.current = Date.now();
  }, []);

  const value = useMemo<AppContextType>(
    () => ({
      activeTab,
      setActiveTab,
      selectedDate,
      setSelectedDate,
      isPiPMode,
      setIsPiPMode,
      currentTimeStr,
      progressBars,
      routineBlocks,
      scheduledBlocks,
      tasks,
      dayOverrides,
      dayHoursConfigs,
      createProgressBar,
      updateProgressBar,
      deleteProgressBar,
      playProgress,
      pauseProgress,
      resumeFromPause,
      resetProgress,
      incrementCheckpoint,
      toggleSubtask,
      currentActiveSchedule,
      adaptivePauseAlert,
      dismissAdaptivePause,
      inactivityAlert,
      dismissInactivityAlert,
      getEffectiveBlocksForDate,
      getRoutineAreasForDay,
      hideRoutineAreaForDate,
      restoreHiddenRoutineAreasForDate,
      addDayRoutineArea,
      updateDayRoutineArea,
      deleteDayRoutineArea,
      resetDayRoutineAreas,
      addRoutineBlock,
      updateRoutineBlock,
      deleteRoutineBlock,
      addScheduledBlock,
      updateEffectiveBlock,
      deleteEffectiveBlock,
      autoFillBlock,
      autoDistributeTasksForDate,
      assignTaskToBlock,
      assignProgressToBlock,
      addTask,
      updateTask,
      toggleTask,
      toggleTaskSubitem,
      deleteTask,
      triggerSOS,
      undoSOS,
      toggleBlockObligationToday,
      closeNightCheckOut,
      updateDayHoursConfig,
      getDayBoundsForDate,
      requestConfirm,
      confirmDialog,
      closeConfirmDialog,
      toast,
      showToast,
      dismissToast,
    }),
    [
      activeTab,
      selectedDate,
      isPiPMode,
      currentTimeStr,
      progressBars,
      routineBlocks,
      scheduledBlocks,
      tasks,
      dayOverrides,
      dayHoursConfigs,
      createProgressBar,
      updateProgressBar,
      deleteProgressBar,
      playProgress,
      pauseProgress,
      resumeFromPause,
      resetProgress,
      incrementCheckpoint,
      toggleSubtask,
      currentActiveSchedule,
      adaptivePauseAlert,
      dismissAdaptivePause,
      inactivityAlert,
      dismissInactivityAlert,
      getEffectiveBlocksForDate,
      getRoutineAreasForDay,
      hideRoutineAreaForDate,
      restoreHiddenRoutineAreasForDate,
      addDayRoutineArea,
      updateDayRoutineArea,
      deleteDayRoutineArea,
      resetDayRoutineAreas,
      addRoutineBlock,
      updateRoutineBlock,
      deleteRoutineBlock,
      addScheduledBlock,
      updateEffectiveBlock,
      deleteEffectiveBlock,
      autoFillBlock,
      autoDistributeTasksForDate,
      assignTaskToBlock,
      assignProgressToBlock,
      addTask,
      updateTask,
      toggleTask,
      toggleTaskSubitem,
      deleteTask,
      triggerSOS,
      undoSOS,
      toggleBlockObligationToday,
      closeNightCheckOut,
      updateDayHoursConfig,
      getDayBoundsForDate,
      requestConfirm,
      confirmDialog,
      closeConfirmDialog,
      toast,
      showToast,
      dismissToast,
    ]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
