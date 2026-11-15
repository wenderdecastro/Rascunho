import confetti from 'canvas-confetti';
import {
  RoutineBlock,
  ScheduledBlock,
  ProgressBarItem,
  TaskItem,
  DayHoursConfig,
  RecurrenceRule,
} from '../types';

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

  const dailyRoutine = routineBlocks.filter((b) => b.dayOfWeek === dayOfWeek);
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
  const scheduledTaskIds = new Set(
    dailyScheduled.filter((b) => b.linkedTaskId).map((b) => b.linkedTaskId!)
  );
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
