import confetti from 'canvas-confetti';
import {
  RoutineBlock,
  ScheduledBlock,
  ProgressBarItem,
  TaskItem,
  DayHoursConfig,
  RecurrenceRule,
  BlockAllocatedItem,
} from '../types';

export function routineBlockMatchesDay(block: RoutineBlock, dayOfWeek: number): boolean {
  if (Array.isArray(block.daysOfWeek) && block.daysOfWeek.length > 0) {
    return block.daysOfWeek.includes(dayOfWeek);
  }
  return block.dayOfWeek === dayOfWeek;
}

export function getBlockAllocatedItems(
  block: ScheduledBlock,
  progressBars: ProgressBarItem[],
  tasks: TaskItem[]
): BlockAllocatedItem[] {
  if (Array.isArray(block.allocatedItems) && block.allocatedItems.length > 0) {
    return block.allocatedItems;
  }
  const blockDuration =
    block.startTime && block.endTime
      ? Math.max(15, timeStringToMinutes(block.endTime) - timeStringToMinutes(block.startTime))
      : 45;
  const legacy: BlockAllocatedItem[] = [];
  if (block.linkedProgressId) {
    const prog = progressBars.find((p) => p.id === block.linkedProgressId);
    const mins =
      prog?.type === 'TIME' && prog.targetDailySeconds
        ? Math.max(5, Math.round(prog.targetDailySeconds / 60))
        : blockDuration;
    legacy.push({
      id: `legacy-prog-${block.linkedProgressId}`,
      type: 'PROGRESS',
      targetId: block.linkedProgressId,
      allocatedMinutes: mins,
    });
  }
  if (block.linkedTaskId) {
    const task = tasks.find((t) => t.id === block.linkedTaskId);
    legacy.push({
      id: `legacy-task-${block.linkedTaskId}`,
      type: 'TASK',
      targetId: block.linkedTaskId,
      allocatedMinutes: task?.durationMinutes || blockDuration,
    });
  }
  return legacy;
}

// Format seconds into "1h 45m" or "25m" or "0 min"
export function formatSecondsToHuman(seconds: number): string {
  if (seconds <= 0) return '0 min';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

export function formatSecondsToTimer(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  if (h > 0) {
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// Convert "08:30" to minutes from 00:00
export function timeStringToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

// Convert minutes from 00:00 to "08:30"
export function minutesToTimeString(minutes: number): string {
  const clamped = Math.max(0, Math.min(24 * 60 - 1, Math.round(minutes)));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// High-precision Y-coordinate snapping with magnetic capture for the top HH:00 line
export function snapMinutesFromRelativeY(
  relY: number,
  hourHeight: number,
  startHour: number,
  endHour: number,
  mode: 'ANCHOR' | 'CURSOR' = 'ANCHOR'
): number {
  const rawMins = startHour * 60 + (relY / hourHeight) * 60;
  let snapped: number;

  if (mode === 'ANCHOR') {
    const shifted = rawMins + 2.5;
    const hourBase = Math.floor(shifted / 60) * 60;
    const offsetInHour = shifted - hourBase;
    if (offsetInHour < 16.5) {
      snapped = hourBase; // [-2.5m, +14m) relative to HH:00 -> HH:00
    } else if (offsetInHour < 30.5) {
      snapped = hourBase + 15; // [+14m, +28m) -> HH:15
    } else if (offsetInHour < 45.5) {
      snapped = hourBase + 30; // [+28m, +43m) -> HH:30
    } else {
      snapped = hourBase + 45; // [+43m, +57.5m) -> HH:45
    }
  } else {
    snapped = Math.floor((rawMins + 3.5) / 15) * 15;
  }

  return Math.max(startHour * 60, Math.min(endHour * 60, snapped));
}

export interface OverlapLayoutSlot {
  colIndex: number;
  totalCols: number;
  leftCss: string;
  widthCss: string;
}

// Compute side-by-side layout slots for overlapping items while reserving a right-side creation gutter
export function computeOverlapLayout<T extends { id: string }>(
  items: T[],
  getRange: (item: T) => { startMin: number; endMin: number },
  usableWidthPct = 84
): Record<string, OverlapLayoutSlot> {
  const normalized = items
    .map((item) => {
      const r = getRange(item);
      const startMin = Math.min(r.startMin, r.endMin);
      const endMin = Math.max(startMin + 15, r.endMin);
      return { id: item.id, startMin, endMin };
    })
    .sort((a, b) => {
      if (a.startMin !== b.startMin) return a.startMin - b.startMin;
      const durDiff = b.endMin - b.startMin - (a.endMin - a.startMin);
      if (durDiff !== 0) return durDiff;
      return a.id.localeCompare(b.id);
    });

  const result: Record<string, OverlapLayoutSlot> = {};
  let cluster: typeof normalized = [];
  let clusterMaxEnd = -1;

  const flushCluster = (group: typeof normalized) => {
    if (group.length === 0) return;
    const colEnds: number[] = [];
    const assignedCol: Record<string, number> = {};

    group.forEach((entry) => {
      let placedCol = -1;
      for (let c = 0; c < colEnds.length; c++) {
        if (colEnds[c] <= entry.startMin) {
          placedCol = c;
          colEnds[c] = entry.endMin;
          break;
        }
      }
      if (placedCol === -1) {
        placedCol = colEnds.length;
        colEnds.push(entry.endMin);
      }
      assignedCol[entry.id] = placedCol;
    });

    const totalCols = Math.max(1, colEnds.length);
    const slotWidthPct = usableWidthPct / totalCols;

    group.forEach((entry) => {
      const colIndex = assignedCol[entry.id] ?? 0;
      const leftPct = colIndex * slotWidthPct;
      result[entry.id] = {
        colIndex,
        totalCols,
        leftCss: `calc(${leftPct.toFixed(2)}% + 2px)`,
        widthCss: `calc(${slotWidthPct.toFixed(2)}% - 3px)`,
      };
    });
  };

  normalized.forEach((item) => {
    if (cluster.length === 0) {
      cluster.push(item);
      clusterMaxEnd = item.endMin;
    } else if (item.startMin < clusterMaxEnd) {
      cluster.push(item);
      clusterMaxEnd = Math.max(clusterMaxEnd, item.endMin);
    } else {
      flushCluster(cluster);
      cluster = [item];
      clusterMaxEnd = item.endMin;
    }
  });
  flushCluster(cluster);

  return result;
}

// Local date utilities (avoiding UTC midnight shift bugs from toISOString)
export function formatLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function addDaysToDateString(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return formatLocalDateString(d);
}

export function formatDateBR(dateStr: string): string {
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

// Expand Google-Calendar-style RecurrenceRule into YYYY-MM-DD dates
export function expandRecurrenceDates(
  startDateStr: string,
  rule?: RecurrenceRule,
  maxHorizonDays = 56
): string[] {
  if (!rule || rule.frequency === 'NONE') {
    return [startDateStr];
  }

  const interval = Math.max(1, Math.floor(rule.interval || 1));
  const maxOccurrences =
    rule.endType === 'AFTER_OCCURRENCES'
      ? Math.max(1, Math.min(60, Math.floor(rule.occurrences || 1)))
      : 60;

  const capEndStr = addDaysToDateString(startDateStr, 365);
  let effectiveEndStr = addDaysToDateString(startDateStr, maxHorizonDays);
  if (rule.endType === 'ON_DATE' && rule.endDate) {
    effectiveEndStr = rule.endDate < capEndStr ? rule.endDate : capEndStr;
  } else if (rule.endType === 'AFTER_OCCURRENCES') {
    effectiveEndStr = capEndStr;
  }

  if (effectiveEndStr < startDateStr) {
    return [startDateStr];
  }

  const results: string[] = [];
  const startDate = new Date(startDateStr + 'T12:00:00');
  const startWeekday = startDate.getDay();

  if (
    rule.frequency === 'WEEKLY' ||
    (rule.frequency === 'CUSTOM' && rule.daysOfWeek && rule.daysOfWeek.length > 0)
  ) {
    const activeWeekdays = new Set(
      rule.daysOfWeek && rule.daysOfWeek.length > 0 ? rule.daysOfWeek : [startWeekday]
    );
    for (let offset = 0; offset <= 365; offset++) {
      const candidateStr = addDaysToDateString(startDateStr, offset);
      if (candidateStr > effectiveEndStr) break;
      const weekIndex = Math.floor((startWeekday + offset) / 7);
      const weekday = (startWeekday + offset) % 7;
      if (weekIndex % interval === 0 && activeWeekdays.has(weekday)) {
        results.push(candidateStr);
        if (results.length >= maxOccurrences) break;
      }
    }
  } else if (rule.frequency === 'MONTHLY') {
    const startYear = startDate.getFullYear();
    const startMonth = startDate.getMonth();
    const startDay = startDate.getDate();

    for (let step = 0; step < 36; step++) {
      const targetMonthIndex = startMonth + step * interval;
      const tempYear = startYear + Math.floor(targetMonthIndex / 12);
      const tempMonth = ((targetMonthIndex % 12) + 12) % 12;
      const daysInTargetMonth = new Date(tempYear, tempMonth + 1, 0).getDate();
      const clampedDay = Math.min(startDay, daysInTargetMonth);
      const candidateDate = new Date(tempYear, tempMonth, clampedDay, 12, 0, 0);
      const candidateStr = formatLocalDateString(candidateDate);

      if (candidateStr > effectiveEndStr) break;
      if (candidateStr >= startDateStr) {
        results.push(candidateStr);
        if (results.length >= maxOccurrences) break;
      }
    }
  } else {
    // DAILY or CUSTOM without weekdays
    for (let step = 0; step <= 365; step++) {
      const candidateStr = addDaysToDateString(startDateStr, step * interval);
      if (candidateStr > effectiveEndStr) break;
      results.push(candidateStr);
      if (results.length >= maxOccurrences) break;
    }
  }

  return results.length > 0 ? results : [startDateStr];
}

// Pastel celebration confetti
export function fireCuteConfetti() {
  confetti({
    particleCount: 50,
    spread: 70,
    origin: { y: 0.65 },
    colors: ['#FF9E80', '#82C284', '#A78BFA', '#FCD34D', '#7DD3FC', '#FB7185'],
    disableForReducedMotion: true,
  });
}

// Singleton Web Audio API Context to avoid hitting browser context limits
let sharedAudioCtx: AudioContext | null = null;

function getSharedAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AudioContextClass =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return null;
  if (!sharedAudioCtx || sharedAudioCtx.state === 'closed') {
    sharedAudioCtx = new AudioContextClass();
  }
  if (sharedAudioCtx.state === 'suspended') {
    sharedAudioCtx.resume().catch(() => {});
  }
  return sharedAudioCtx;
}

// Gentle Tibetan bell sound synthesizer using Web Audio API (no external files needed!)
export function playGentleBellChime() {
  try {
    const ctx = getSharedAudioContext();
    if (!ctx) return;

    const frequencies = [528, 1056, 1584, 2112];
    const gains = [0.3, 0.15, 0.08, 0.04];

    frequencies.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);

      gain.gain.setValueAtTime(gains[idx], ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 3.5);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 3.6);
    });
  } catch (err) {
    console.warn('Audio chime could not be played:', err);
  }
}

// Merge overlapping [start, end] minute intervals so busy time isn't double counted
function mergeIntervals(intervals: Array<{ start: number; end: number }>): Array<{ start: number; end: number }> {
  if (intervals.length === 0) return [];
  const sorted = [...intervals].sort((a, b) => a.start - b.start);
  const merged: Array<{ start: number; end: number }> = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    const curr = sorted[i];
    const last = merged[merged.length - 1];
    if (curr.start <= last.end) {
      last.end = Math.max(last.end, curr.end);
    } else {
      merged.push({ ...curr });
    }
  }
  return merged;
}

// Anti-Sobrecarga: Calculate Real Capacity
export function calculateRealCapacity(
  routineBlocks: RoutineBlock[],
  scheduledBlocks: ScheduledBlock[],
  progressBars: ProgressBarItem[],
  tasks: TaskItem[],
  targetDateStr: string,
  dayHoursConfigs?: DayHoursConfig[]
) {
  const dateObj = new Date(targetDateStr + 'T12:00:00');
  const dayOfWeek = dateObj.getDay();

  // Compute configured usable active minutes for this day of week (fallback to 16h = 960 min)
  const dayCfg = dayHoursConfigs?.find((c) => c.dayOfWeek === dayOfWeek);
  const activeDayMinutes = dayCfg
    ? Math.max(60, timeStringToMinutes(dayCfg.endHour) - timeStringToMinutes(dayCfg.startHour))
    : 16 * 60;

  const dailyRoutine = routineBlocks.filter((b) => routineBlockMatchesDay(b, dayOfWeek));
  const dailyScheduled = scheduledBlocks.filter(
    (b) => b.date === targetDateStr && !b.isCancelledToday
  );

  // Merge routine & scheduled occupied intervals so overlapping blocks/areas don't double count
  const rawIntervals: Array<{ start: number; end: number }> = [];
  dailyRoutine.forEach((r) => {
    const s = timeStringToMinutes(r.startTime);
    const e = timeStringToMinutes(r.endTime);
    if (e > s) rawIntervals.push({ start: s, end: e });
  });
  dailyScheduled.forEach((b) => {
    const s = timeStringToMinutes(b.startTime);
    const e = timeStringToMinutes(b.endTime);
    if (e > s) rawIntervals.push({ start: s, end: e });
  });

  const mergedBusy = mergeIntervals(rawIntervals);
  const busyMinutes = mergedBusy.reduce((acc, iv) => acc + (iv.end - iv.start), 0);

  const realFreeMinutes = Math.max(0, activeDayMinutes - busyMinutes);

  // Total goal minutes planned for progress bars today (only count root items to avoid double counting parent+child)
  let plannedGoalMinutes = 0;
  progressBars.forEach((p) => {
    if (p.isCompleted || p.parentId) return;
    if (p.type === 'TIME' && p.targetDailySeconds) {
      plannedGoalMinutes += Math.round(p.targetDailySeconds / 60);
    }
  });

  // Add unscheduled tasks for today (skip tasks already linked to a scheduled block on this date)
  const scheduledTaskIds = new Set<string>();
  dailyScheduled.forEach((b) => {
    if (b.linkedTaskId) scheduledTaskIds.add(b.linkedTaskId);
    b.allocatedItems?.forEach((it) => {
      if (it.type === 'TASK') scheduledTaskIds.add(it.targetId);
    });
  });
  tasks
    .filter((t) => t.date === targetDateStr && !t.isCompleted && !scheduledTaskIds.has(t.id))
    .forEach((t) => {
      plannedGoalMinutes += t.durationMinutes || 30;
    });

  const ratio = realFreeMinutes > 0 ? plannedGoalMinutes / realFreeMinutes : plannedGoalMinutes > 0 ? 2 : 0;

  let status: 'OK' | 'WARNING' | 'CRITICAL' = 'OK';
  let message = 'Seu dia está leve e bem equilibrado! ✨';

  if (ratio > 1.2 || realFreeMinutes < 60) {
    status = 'CRITICAL';
    message =
      'Psiu! Você planejou mais metas do que seu tempo livre suporta. Respire e priorize o essencial 🌸';
  } else if (ratio > 0.85) {
    status = 'WARNING';
    message = 'Atenção carinhosa: seu dia está bem justo. Evite assumir novos compromissos hoje 🍵';
  }

  return {
    realFreeMinutes,
    plannedGoalMinutes,
    ratio,
    status,
    message,
    freeHoursFormatted: formatSecondsToHuman(realFreeMinutes * 60),
    plannedHoursFormatted: formatSecondsToHuman(plannedGoalMinutes * 60),
  };
}

// Previsão do Clima Mental (Burnout Forecast) for a month day
export function getDayBurnoutForecast(
  routineBlocks: RoutineBlock[],
  scheduledBlocks: ScheduledBlock[],
  progressBars: ProgressBarItem[],
  dateStr: string,
  dayHoursConfigs?: DayHoursConfig[]
): { weather: 'SUNNY' | 'CLOUDY' | 'RAINY'; icon: string; label: string; tip: string } {
  const cap = calculateRealCapacity(
    routineBlocks,
    scheduledBlocks,
    progressBars,
    [],
    dateStr,
    dayHoursConfigs
  );

  if (cap.status === 'CRITICAL') {
    return {
      weather: 'RAINY',
      icon: '🌧️',
      label: 'Dia Puxado',
      tip: 'Muitos blocos e metas. Bom dia para desacelerar e focar só no que for obrigatório.',
    };
  }
  if (cap.status === 'WARNING') {
    return {
      weather: 'CLOUDY',
      icon: '⛅',
      label: 'Dia Movimentado',
      tip: 'Dia produtivo e bem preenchido, com pausas estratégicas.',
    };
  }
  return {
    weather: 'SUNNY',
    icon: '☀️',
    label: 'Dia Equilibrado',
    tip: 'Tempo livre generoso e metas suaves. Excelente para progredir com tranquilidade.',
  };
}
