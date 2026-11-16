import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useApp, inferAreaType } from '../context/AppContext';
import {
  RoutineBlock,
  EnergyTier,
  Obligation,
  Priority,
  RecurrenceFrequency,
  RecurrenceRule,
  TaskItem,
} from '../types';
import {
  timeStringToMinutes,
  minutesToTimeString,
  formatSecondsToHuman,
  expandRecurrenceDates,
  formatLocalDateString,
  formatDateBR,
  snapMinutesFromRelativeY,
  computeOverlapLayout,
  routineBlockMatchesDay,
} from '../utils/helpers';
import {
  Plus,
  Trash2,
  X,
  Clock,
  GripHorizontal,
  Sparkles,
  Repeat,
  CheckSquare,
  Check,
  Maximize2,
  Minimize2,
} from 'lucide-react';

const DAYS_OF_WEEK = [
  { name: 'Segunda', short: 'Seg', id: 1 },
  { name: 'Terça', short: 'Ter', id: 2 },
  { name: 'Quarta', short: 'Qua', id: 3 },
  { name: 'Quinta', short: 'Qui', id: 4 },
  { name: 'Sexta', short: 'Sex', id: 5 },
  { name: 'Sábado', short: 'Sáb', id: 6 },
  { name: 'Domingo', short: 'Dom', id: 0 },
];

const WEEKDAY_PILLS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const AREA_QUICK_CHIPS = ['Trabalho', 'Faculdade', 'Transporte', 'Estudos', 'Rotina Matinal'];

const TIER_META: Record<
  EnergyTier,
  { icon: string; label: string; badgeCls: string; colCls: string }
> = {
  FOCUS: {
    icon: '🧠',
    label: 'Focado',
    badgeCls: 'bg-cozy-lavender/15 text-cozy-lavender border-cozy-lavender/30',
    colCls: 'border-cozy-lavender/30 bg-cozy-lavender/[0.04]',
  },
  TRANSIT: {
    icon: '🎧',
    label: 'Baixo Foco',
    badgeCls: 'bg-cozy-butter/15 text-cozy-butter border-cozy-butter/30',
    colCls: 'border-cozy-butter/30 bg-cozy-butter/[0.04]',
  },
  BACKGROUND: {
    icon: '🫧',
    label: 'Segundo Plano',
    badgeCls: 'bg-cozy-sky/15 text-cozy-sky border-cozy-sky/30',
    colCls: 'border-cozy-sky/30 bg-cozy-sky/[0.04]',
  },
};

const HOUR_HEIGHT = 48; // px per hour on vertical ruler

interface RoutineDragState {
  mode: 'MOVE' | 'RESIZE_TOP' | 'RESIZE_BOTTOM';
  block: RoutineBlock;
  startClientY: number;
  origStartMin: number;
  origEndMin: number;
  previewStartMin: number;
  previewEndMin: number;
  hasMoved: boolean;
}

interface RoutineCreateState {
  dayId: number;
  anchorMin: number;
  currentMin: number;
  startClientY: number;
}

export const RotinaView: React.FC = () => {
  const {
    currentTimeStr,
    routineBlocks,
    dayHoursConfigs,
    tasks,
    addRoutineBlock,
    updateRoutineBlock,
    deleteRoutineBlock,
    addTask,
    toggleTask,
    deleteTask,
    requestConfirm,
    showToast,
  } = useApp();

  const nowMinutes = useMemo(() => timeStringToMinutes(currentTimeStr), [currentTimeStr]);
  const currentDayOfWeek = new Date().getDay();

  // Compute global hour bounds across all week configs + routine blocks + current time
  const { startHour, endHour, hoursList } = useMemo(() => {
    const minCfgHour = Math.min(
      ...dayHoursConfigs.map((c) => Math.floor(timeStringToMinutes(c.startHour) / 60)),
      6
    );
    const maxCfgHour = Math.max(
      ...dayHoursConfigs.map((c) => Math.ceil(timeStringToMinutes(c.endHour) / 60)),
      23
    );
    const currHour = Math.floor(nowMinutes / 60);
    const sH = Math.max(0, Math.min(minCfgHour, currHour));
    const eH = Math.min(24, Math.max(maxCfgHour, currHour + 1));
    return {
      startHour: sH,
      endHour: eH,
      hoursList: Array.from({ length: eH - sH }, (_, i) => i + sH),
    };
  }, [dayHoursConfigs, nowMinutes]);

  // Refs for each day's column to compute Y coordinates cleanly
  const columnRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const [blockDrag, setBlockDrag] = useState<RoutineDragState | null>(null);
  const [createDrag, setCreateDrag] = useState<RoutineCreateState | null>(null);
  const [expandedDayId, setExpandedDayId] = useState<number | null>(null);

  // Area Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingBlock, setEditingBlock] = useState<RoutineBlock | null>(null);
  const [formDay, setFormDay] = useState<number>(1);
  const [selectedDays, setSelectedDays] = useState<number[]>([1]);
  const [title, setTitle] = useState('');
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('10:00');
  const [tier, setTier] = useState<EnergyTier>('FOCUS');
  const [obligation, setObligation] = useState<Obligation>('MANDATORY');

  // Task Modal State (for routine/recurring tasks without creating activity blocks)
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskPriority, setTaskPriority] = useState<Priority>('P2');
  const [taskTier, setTaskTier] = useState<EnergyTier>('FOCUS');
  const [taskObligation, setTaskObligation] = useState<Obligation>('FLEXIBLE');
  const [taskDuration, setTaskDuration] = useState<number>(45);
  const [taskStartDate, setTaskStartDate] = useState<string>(() =>
    formatLocalDateString(new Date())
  );
  const [taskRecFrequency, setTaskRecFrequency] = useState<RecurrenceFrequency>('WEEKLY');
  const [taskRecInterval, setTaskRecInterval] = useState<number>(1);
  const [taskRecDays, setTaskRecDays] = useState<number[]>([1, 3, 5]);
  const [taskRecEndType, setTaskRecEndType] = useState<'NEVER' | 'ON_DATE' | 'AFTER_OCCURRENCES'>(
    'NEVER'
  );
  const [taskRecEndDate, setTaskRecEndDate] = useState<string>('');
  const [taskRecOccurrences, setTaskRecOccurrences] = useState<number>(8);

  const builtTaskRecurrenceRule: RecurrenceRule | undefined = useMemo(() => {
    if (taskRecFrequency === 'NONE') return undefined;
    const baseWeekday = new Date(`${taskStartDate}T12:00:00`).getDay();
    return {
      frequency: taskRecFrequency,
      interval: Math.max(1, taskRecInterval),
      daysOfWeek:
        taskRecFrequency === 'WEEKLY' || taskRecFrequency === 'CUSTOM'
          ? taskRecDays.length > 0
            ? taskRecDays
            : [baseWeekday]
          : undefined,
      endType: taskRecEndType,
      endDate: taskRecEndType === 'ON_DATE' && taskRecEndDate ? taskRecEndDate : undefined,
      occurrences:
        taskRecEndType === 'AFTER_OCCURRENCES' ? Math.max(1, taskRecOccurrences) : undefined,
    };
  }, [
    taskRecFrequency,
    taskRecInterval,
    taskRecDays,
    taskRecEndType,
    taskRecEndDate,
    taskRecOccurrences,
    taskStartDate,
  ]);

  const taskRecPreviewCount = useMemo(() => {
    if (!builtTaskRecurrenceRule) return 1;
    return expandRecurrenceDates(taskStartDate, builtTaskRecurrenceRule).length;
  }, [taskStartDate, builtTaskRecurrenceRule]);

  const groupedTasksByTier = useMemo(() => {
    const groups: Record<EnergyTier, TaskItem[]> = {
      FOCUS: [],
      TRANSIT: [],
      BACKGROUND: [],
    };
    tasks
      .filter((t) => !t.isCompleted)
      .forEach((t) => {
        groups[t.energyTier]?.push(t);
      });
    return groups;
  }, [tasks]);

  const clientYToSnappedMinutes = (
    dayId: number,
    clientY: number,
    mode: 'ANCHOR' | 'CURSOR' = 'ANCHOR'
  ) => {
    const el = columnRefs.current[dayId];
    if (!el) return startHour * 60;
    const rect = el.getBoundingClientRect();
    const relY = Math.max(0, Math.min(rect.height, clientY - rect.top));
    return snapMinutesFromRelativeY(relY, HOUR_HEIGHT, startHour, endHour, mode);
  };

  const openCreateModal = (dayId: number, sTime = '08:00', eTime = '10:00') => {
    setEditingBlock(null);
    setFormDay(dayId);
    setSelectedDays([dayId]);
    setTitle('');
    setStartTime(sTime);
    setEndTime(eTime);
    setTier('FOCUS');
    setObligation('MANDATORY');
    setShowModal(true);
  };

  const openEditModal = (block: RoutineBlock) => {
    const initialDays =
      block.daysOfWeek && block.daysOfWeek.length > 0 ? block.daysOfWeek : [block.dayOfWeek];
    setEditingBlock(block);
    setFormDay(initialDays[0] ?? block.dayOfWeek);
    setSelectedDays(initialDays);
    setTitle(block.title);
    setStartTime(block.startTime);
    setEndTime(block.endTime);
    setTier(block.tier);
    setObligation(block.obligation);
    setShowModal(true);
  };

  const openTaskModal = (defaultTier: EnergyTier = 'FOCUS') => {
    const todayStr = formatLocalDateString(new Date());
    setTaskTitle('');
    setTaskPriority('P2');
    setTaskTier(defaultTier);
    setTaskObligation('FLEXIBLE');
    setTaskDuration(45);
    setTaskStartDate(todayStr);
    setTaskRecFrequency('WEEKLY');
    setTaskRecInterval(1);
    setTaskRecDays([new Date(`${todayStr}T12:00:00`).getDay()]);
    setTaskRecEndType('NEVER');
    setTaskRecEndDate('');
    setTaskRecOccurrences(8);
    setShowTaskModal(true);
  };

  const createDragRef = useRef<RoutineCreateState | null>(null);
  const blockDragRef = useRef<RoutineDragState | null>(null);
  createDragRef.current = createDrag;
  blockDragRef.current = blockDrag;

  const dragCallbacksRef = useRef({
    clientYToSnappedMinutes,
    openCreateModal,
    openEditModal,
    updateRoutineBlock,
  });
  dragCallbacksRef.current = {
    clientYToSnappedMinutes,
    openCreateModal,
    openEditModal,
    updateRoutineBlock,
  };

  const isDragging = createDrag !== null || blockDrag !== null;

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (ev: MouseEvent) => {
      const cDrag = createDragRef.current;
      if (cDrag) {
        const currentMin = dragCallbacksRef.current.clientYToSnappedMinutes(
          cDrag.dayId,
          ev.clientY,
          'CURSOR'
        );
        setCreateDrag((prev) => (prev ? { ...prev, currentMin } : null));
      }

      const bDrag = blockDragRef.current;
      if (bDrag) {
        const deltaPx = ev.clientY - bDrag.startClientY;
        const hasMoved = bDrag.hasMoved || Math.abs(deltaPx) > 4;
        const deltaMins = Math.round(((deltaPx / HOUR_HEIGHT) * 60) / 15) * 15;

        let newStart = bDrag.origStartMin;
        let newEnd = bDrag.origEndMin;

        if (bDrag.mode === 'RESIZE_TOP') {
          newStart = Math.max(
            startHour * 60,
            Math.min(bDrag.origEndMin - 15, bDrag.origStartMin + deltaMins)
          );
        } else if (bDrag.mode === 'RESIZE_BOTTOM') {
          newEnd = Math.min(
            endHour * 60,
            Math.max(bDrag.origStartMin + 15, bDrag.origEndMin + deltaMins)
          );
        } else {
          const duration = bDrag.origEndMin - bDrag.origStartMin;
          newStart = Math.max(
            startHour * 60,
            Math.min(endHour * 60 - duration, bDrag.origStartMin + deltaMins)
          );
          newEnd = newStart + duration;
        }

        setBlockDrag((prev) =>
          prev
            ? {
                ...prev,
                hasMoved,
                previewStartMin: newStart,
                previewEndMin: newEnd,
              }
            : null
        );
      }
    };

    const handleMouseUp = (ev: MouseEvent) => {
      const cDrag = createDragRef.current;
      if (cDrag) {
        const dist = Math.abs(ev.clientY - cDrag.startClientY);
        const s = Math.min(cDrag.anchorMin, cDrag.currentMin);
        const e = Math.max(cDrag.anchorMin, cDrag.currentMin);

        if (dist <= 4) {
          dragCallbacksRef.current.openCreateModal(
            cDrag.dayId,
            minutesToTimeString(cDrag.anchorMin),
            minutesToTimeString(Math.min(endHour * 60, cDrag.anchorMin + 60))
          );
        } else if (e - s >= 15) {
          dragCallbacksRef.current.openCreateModal(
            cDrag.dayId,
            minutesToTimeString(s),
            minutesToTimeString(e)
          );
        }
        setCreateDrag(null);
      }

      const bDrag = blockDragRef.current;
      if (bDrag) {
        if (!bDrag.hasMoved && bDrag.mode === 'MOVE') {
          dragCallbacksRef.current.openEditModal(bDrag.block);
        } else if (
          bDrag.previewStartMin !== bDrag.origStartMin ||
          bDrag.previewEndMin !== bDrag.origEndMin
        ) {
          dragCallbacksRef.current.updateRoutineBlock(bDrag.block.id, {
            startTime: minutesToTimeString(bDrag.previewStartMin),
            endTime: minutesToTimeString(bDrag.previewEndMin),
          });
        }
        setBlockDrag(null);
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, startHour, endHour]);

  // Detect free gaps within the user's configured usable hours for a given weekday
  const getDayFreeWindows = (dayOfWeek: number) => {
    const cfg = dayHoursConfigs.find((c) => c.dayOfWeek === dayOfWeek);
    const cfgStartMin = cfg ? timeStringToMinutes(cfg.startHour) : startHour * 60;
    const cfgEndMin = cfg ? timeStringToMinutes(cfg.endHour) : endHour * 60;

    const blocks = routineBlocks
      .filter((b) => routineBlockMatchesDay(b, dayOfWeek))
      .sort((a, b) => timeStringToMinutes(a.startTime) - timeStringToMinutes(b.startTime));

    const freeSlots: Array<{ start: number; end: number; durationMin: number }> = [];
    let currentMin = cfgStartMin;

    blocks.forEach((block) => {
      const bStart = timeStringToMinutes(block.startTime);
      const bEnd = timeStringToMinutes(block.endTime);

      if (bStart > currentMin + 15) {
        freeSlots.push({
          start: currentMin,
          end: Math.min(bStart, cfgEndMin),
          durationMin: Math.min(bStart, cfgEndMin) - currentMin,
        });
      }
      currentMin = Math.max(currentMin, bEnd);
    });

    if (currentMin + 15 <= cfgEndMin) {
      freeSlots.push({
        start: currentMin,
        end: cfgEndMin,
        durationMin: cfgEndMin - currentMin,
      });
    }

    return freeSlots.filter((s) => s.durationMin >= 15);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    if (timeStringToMinutes(endTime) <= timeStringToMinutes(startTime)) {
      showToast('O horário final deve ser após o inicial.', 'warning');
      return;
    }

    const colorMap: Record<EnergyTier, string> = {
      FOCUS: '#B49BFA',
      TRANSIT: '#F3D08E',
      BACKGROUND: '#9AD4EE',
    };

    const inferredType = inferAreaType(title.trim(), tier);
    const targetDays =
      selectedDays.length > 0
        ? Array.from(new Set(selectedDays)).sort((a, b) => a - b)
        : [formDay];

    if (editingBlock) {
      updateRoutineBlock(editingBlock.id, {
        title: title.trim(),
        dayOfWeek: targetDays[0],
        daysOfWeek: targetDays,
        startTime,
        endTime,
        tier,
        obligation,
        areaType: inferredType,
        color: colorMap[tier],
      });
      showToast(
        `Área "${title.trim()}" atualizada em ${targetDays.length} dia(s) da rotina.`,
        'success'
      );
    } else {
      addRoutineBlock({
        title: title.trim(),
        dayOfWeek: targetDays[0],
        daysOfWeek: targetDays,
        startTime,
        endTime,
        tier,
        obligation,
        areaType: inferredType,
        color: colorMap[tier],
      });
      if (targetDays.length > 1) {
        showToast(
          `Área "${title.trim()}" configurada para ${targetDays.length} dias da rotina.`,
          'success'
        );
      }
    }

    setShowModal(false);
  };

  const handleSaveRoutineTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim()) {
      showToast('Digite o título da tarefa.', 'warning');
      return;
    }
    addTask(
      {
        title: taskTitle.trim(),
        priority: taskPriority,
        obligation: taskObligation,
        energyTier: taskTier,
        isCompleted: false,
        durationMinutes: Math.max(15, Number(taskDuration) || 45),
        date: taskStartDate,
        recurrence: builtTaskRecurrenceRule,
      },
      builtTaskRecurrenceRule
    );
    setShowTaskModal(false);
    showToast(
      builtTaskRecurrenceRule
        ? `Tarefa recorrente criada em ${taskRecPreviewCount} data(s)!`
        : 'Tarefa compatível criada na rotina!',
      'success'
    );
  };

  const getRoutineAreaStyle = (block: RoutineBlock) => {
    switch (block.tier) {
      case 'FOCUS':
        return {
          container:
            'bg-cozy-lavender/[0.12] border-2 border-dashed border-cozy-lavender/50 text-cozy-lavender hover:bg-cozy-lavender/[0.18]',
          badge: 'bg-cozy-lavender/20 text-cozy-lavender',
          icon: '🧠',
          label: 'Focado',
          sub: 'Compatível c/ Focado',
        };
      case 'TRANSIT':
        return {
          container:
            'bg-cozy-butter/[0.12] border-2 border-dashed border-cozy-butter/50 text-cozy-butter hover:bg-cozy-butter/[0.18]',
          badge: 'bg-cozy-butter/20 text-cozy-butter',
          icon: '🎧',
          label: 'Baixo Foco',
          sub: 'Compatível c/ Baixo Foco',
        };
      case 'BACKGROUND':
      default:
        return {
          container:
            'bg-cozy-sky/[0.12] border-2 border-dashed border-cozy-sky/50 text-cozy-sky hover:bg-cozy-sky/[0.18]',
          badge: 'bg-cozy-sky/20 text-cozy-sky',
          icon: '🫧',
          label: 'Segundo Plano',
          sub: 'Compatível c/ 2º Plano',
        };
    }
  };

  const nowTopPx = ((nowMinutes - startHour * 60) / 60) * HOUR_HEIGHT;
  const showNowLine = nowMinutes >= startHour * 60 && nowMinutes <= endHour * 60;

  return (
    <div className="p-6 md:p-10 max-w-[1920px] w-full mx-auto space-y-6 text-cozy-text">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-cozy-border">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight font-sans">
            Áreas da Rotina Semanal (Partes do Dia) 📅
          </h1>
          <p className="text-sm text-cozy-subtext mt-0.5 flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-cozy-lavender" />
              Defina áreas genéricas do dia com 1 das 3 Tags de Energia (Focado, Baixo Foco, Segundo Plano). Aqui não ficam blocos de atividade — apenas partes do dia e tarefas compatíveis.
            </span>
            <span>•</span>
            <span className="text-cozy-sage">Fundo verde = Tempo Livre</span>
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
          {expandedDayId !== null && (
            <button
              type="button"
              onClick={() => setExpandedDayId(null)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-cozy-bg text-cozy-peach border border-cozy-peach/40 font-extrabold text-xs hover:bg-cozy-peach/10 transition-all"
              title="Restaurar visualização igual para os 7 dias"
            >
              <Minimize2 className="w-3.5 h-3.5" />
              <span>Ver 7 dias iguais</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => openTaskModal('FOCUS')}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-cozy-sky/20 text-cozy-sky border border-cozy-sky/40 font-extrabold text-xs hover:bg-cozy-sky/30 transition-all"
          >
            <CheckSquare className="w-4 h-4" />
            <span>Nova Tarefa Compatível</span>
          </button>
          <button
            type="button"
            onClick={() => openCreateModal(1, '08:00', '10:00')}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-cozy-lavender text-cozy-bg font-extrabold text-xs hover:brightness-110 transition-all shadow-cozy-pill"
          >
            <Plus className="w-4 h-4" />
            <span>Nova Área do Dia</span>
          </button>
        </div>
      </div>

      {/* 7 Simultaneous Vertical Rulers Grid */}
      <div className="bg-cozy-card rounded-3xl p-6 border border-cozy-border shadow-cozy overflow-x-auto">
        <div className="min-w-[1160px]">
          {/* Days Header */}
          <div className="flex items-stretch gap-2.5 pb-3 border-b border-cozy-border text-center text-xs font-bold text-cozy-text">
            <div className="w-[60px] shrink-0 text-cozy-subtext flex flex-col items-center justify-center">
              <Clock className="w-4 h-4 mb-0.5" />
              <span className="text-[10px] font-mono text-cozy-peach">
                {minutesToTimeString(nowMinutes)}
              </span>
            </div>
            {DAYS_OF_WEEK.map((d) => {
              const blocksCount = routineBlocks.filter((b) =>
                routineBlockMatchesDay(b, d.id)
              ).length;
              const isTodayCol = d.id === currentDayOfWeek;
              const isExpanded = expandedDayId === d.id;
              const isShrunk = expandedDayId !== null && !isExpanded;
              return (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setExpandedDayId((prev) => (prev === d.id ? null : d.id))}
                  style={{
                    flex: isExpanded ? '3 1 0%' : isShrunk ? '0.6667 1 0%' : '1 1 0%',
                    minWidth: isExpanded ? '230px' : isShrunk ? '82px' : '115px',
                  }}
                  title={
                    isExpanded
                      ? 'Clique para restaurar todos os dias'
                      : `Expandir ${d.name} (3/7 da largura) para ver áreas lado a lado`
                  }
                  className={`p-2.5 rounded-2xl border text-center transition-all duration-300 ease-out cursor-pointer group ${
                    isExpanded
                      ? 'bg-cozy-lavender/15 border-cozy-lavender/60 ring-1 ring-cozy-lavender/30'
                      : isTodayCol
                        ? 'bg-cozy-peach/10 border-cozy-peach/50 hover:border-cozy-peach'
                        : 'bg-cozy-bg border-cozy-border hover:border-cozy-lavender/40'
                  }`}
                >
                  <div className="text-sm font-extrabold flex items-center justify-center gap-1.5 min-w-0">
                    <span className={`truncate ${isShrunk ? 'text-xs' : ''}`}>
                      {isShrunk ? d.name.slice(0, 3) : d.name}
                    </span>
                    {isTodayCol && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-cozy-peach text-cozy-bg font-extrabold shrink-0">
                        HOJE
                      </span>
                    )}
                    {isExpanded ? (
                      <Minimize2 className="w-3 h-3 text-cozy-lavender shrink-0 opacity-85" />
                    ) : (
                      !isShrunk && (
                        <Maximize2 className="w-3 h-3 text-cozy-subtext shrink-0 opacity-0 group-hover:opacity-80 transition-opacity" />
                      )
                    )}
                  </div>
                  <div className="text-[10px] font-medium text-cozy-subtext truncate">
                    {blocksCount} área(s)
                  </div>
                </button>
              );
            })}
          </div>

          {/* Vertical Timelines */}
          <div className="flex items-stretch gap-2.5 mt-3 relative select-none">
            {/* Left Hour Axis */}
            <div
              className="w-[60px] shrink-0 relative text-xs font-mono font-bold text-cozy-subtext text-right pr-2"
              style={{ height: `${hoursList.length * HOUR_HEIGHT}px` }}
            >
              {hoursList.map((h, idx) => (
                <div
                  key={h}
                  style={{ top: `${idx * HOUR_HEIGHT}px`, height: `${HOUR_HEIGHT}px` }}
                  className="absolute inset-x-0 pr-2 -mt-2 text-right"
                >
                  {String(h).padStart(2, '0')}:00
                </div>
              ))}
            </div>

            {/* 7 Vertical Day Columns */}
            {DAYS_OF_WEEK.map((d) => {
              const dayBlocks = routineBlocks.filter((b) => routineBlockMatchesDay(b, d.id));
              const freeWindows = getDayFreeWindows(d.id);
              const isTodayCol = d.id === currentDayOfWeek;
              const isExpanded = expandedDayId === d.id;
              const isShrunk = expandedDayId !== null && !isExpanded;
              const dayOverlapLayout = computeOverlapLayout(
                dayBlocks,
                (b) => {
                  const isDraggingB = blockDrag?.block.id === b.id;
                  return {
                    startMin: isDraggingB
                      ? blockDrag.previewStartMin
                      : timeStringToMinutes(b.startTime),
                    endMin: isDraggingB
                      ? blockDrag.previewEndMin
                      : timeStringToMinutes(b.endTime),
                  };
                },
                92
              );

              return (
                <div
                  key={d.id}
                  ref={(el) => {
                    columnRefs.current[d.id] = el;
                  }}
                  onMouseDown={(e) => {
                    if (e.button !== 0) return;
                    const anchorMin = clientYToSnappedMinutes(d.id, e.clientY, 'ANCHOR');
                    setExpandedDayId(d.id);
                    setCreateDrag({
                      dayId: d.id,
                      anchorMin,
                      currentMin: Math.min(endHour * 60, anchorMin + 30),
                      startClientY: e.clientY,
                    });
                  }}
                  className={`relative rounded-2xl bg-cozy-bg border overflow-hidden cursor-crosshair transition-all duration-300 ease-out ${
                    isExpanded
                      ? 'border-cozy-lavender/55 ring-1 ring-cozy-lavender/20'
                      : isTodayCol
                        ? 'border-cozy-peach/40'
                        : 'border-cozy-border'
                  }`}
                  style={{
                    height: `${hoursList.length * HOUR_HEIGHT}px`,
                    flex: isExpanded ? '3 1 0%' : isShrunk ? '0.6667 1 0%' : '1 1 0%',
                    minWidth: isExpanded ? '230px' : isShrunk ? '82px' : '115px',
                  }}
                >
                  {/* Hour Grid Lines */}
                  {hoursList.map((h, i) => (
                    <div
                      key={h}
                      style={{ top: `${i * HOUR_HEIGHT}px`, height: `${HOUR_HEIGHT}px` }}
                      className="absolute inset-x-0 border-t border-cozy-border/35 pointer-events-none"
                    />
                  ))}

                  {/* Subtle green LIVRE background indicator on free gaps */}
                  {freeWindows.map((slot, idx) => {
                    const topPx = ((slot.start - startHour * 60) / 60) * HOUR_HEIGHT;
                    const heightPx = (slot.durationMin / 60) * HOUR_HEIGHT;

                    return (
                      <div
                        key={`free-${idx}`}
                        className="absolute inset-x-0 bg-cozy-sage/[0.08] border-t border-b border-dashed border-cozy-sage/20 flex flex-col justify-center items-center text-center p-1 pointer-events-none"
                        style={{
                          top: `${topPx}px`,
                          height: `${Math.max(20, heightPx)}px`,
                        }}
                      >
                        <span className="text-[10px] font-extrabold uppercase tracking-widest text-cozy-sage opacity-35">
                          LIVRE
                        </span>
                        {heightPx > 45 && (
                          <span className="text-[9px] font-mono text-cozy-sage opacity-25">
                            {formatSecondsToHuman(slot.durationMin * 60)}
                          </span>
                        )}
                      </div>
                    );
                  })}

                  {/* Current Time Line Indicator across rulers */}
                  {showNowLine && (
                    <div
                      style={{ top: `${nowTopPx}px` }}
                      className={`absolute left-0 right-0 z-20 pointer-events-none flex items-center ${
                        isTodayCol ? 'opacity-100' : 'opacity-35'
                      }`}
                    >
                      {isTodayCol && (
                        <div className="w-2 h-2 -ml-1 rounded-full bg-cozy-peach shadow-[0_0_8px_rgba(244,162,140,0.9)]" />
                      )}
                      <div
                        className={`flex-1 ${
                          isTodayCol
                            ? 'h-[2px] bg-cozy-peach shadow-[0_0_6px_rgba(244,162,140,0.8)]'
                            : 'h-[1px] border-t border-dashed border-cozy-peach'
                        }`}
                      />
                    </div>
                  )}

                  {/* Drag-to-Create Preview */}
                  {createDrag && createDrag.dayId === d.id && (
                    <div
                      style={{
                        top: `${
                          ((Math.min(createDrag.anchorMin, createDrag.currentMin) -
                            startHour * 60) /
                            60) *
                          HOUR_HEIGHT
                        }px`,
                        height: `${Math.max(
                          (15 / 60) * HOUR_HEIGHT,
                          (Math.abs(createDrag.currentMin - createDrag.anchorMin) / 60) *
                            HOUR_HEIGHT
                        )}px`,
                      }}
                      className="absolute inset-x-1 z-30 rounded-xl border-2 border-dashed border-cozy-peach bg-cozy-peach/20 pointer-events-none flex items-center justify-center"
                    >
                      <span className="text-[10px] font-extrabold text-cozy-peach bg-cozy-bg/90 px-2 py-0.5 rounded-full">
                        {minutesToTimeString(
                          Math.min(createDrag.anchorMin, createDrag.currentMin)
                        )}{' '}
                        -{' '}
                        {minutesToTimeString(
                          Math.max(createDrag.anchorMin, createDrag.currentMin)
                        )}
                      </span>
                    </div>
                  )}

                  {/* Compact 8% right-side free gutter so overlapping areas can always be drag-created */}
                  <div
                    className="absolute top-0 bottom-0 right-0 w-[8%] border-l border-dashed border-cozy-border/35 bg-cozy-bg/15 pointer-events-none"
                  />

                  {/* Routine Areas (blur overlap by default; side-by-side when day is expanded) */}
                  {dayBlocks.map((block) => {
                    const isDraggingThis = blockDrag?.block.id === block.id;
                    const sMin = isDraggingThis
                      ? blockDrag.previewStartMin
                      : timeStringToMinutes(block.startTime);
                    const eMin = isDraggingThis
                      ? blockDrag.previewEndMin
                      : timeStringToMinutes(block.endTime);

                    const topPx = ((sMin - startHour * 60) / 60) * HOUR_HEIGHT;
                    const heightPx = Math.max(24, ((eMin - sMin) / 60) * HOUR_HEIGHT);
                    const style = getRoutineAreaStyle(block);
                    const slot = dayOverlapLayout[block.id] ?? {
                      colIndex: 0,
                      totalCols: 1,
                      leftCss: '0%',
                      widthCss: '92%',
                    };

                    const leftPos = isExpanded ? slot.leftCss : '3px';
                    const widthPos = isExpanded ? slot.widthCss : 'calc(92% - 5px)';

                    return (
                      <div
                        key={block.id}
                        onMouseDown={(e) => {
                          if (e.button !== 0) return;
                          e.stopPropagation();
                          setExpandedDayId(d.id);
                          setBlockDrag({
                            mode: 'MOVE',
                            block,
                            startClientY: e.clientY,
                            origStartMin: timeStringToMinutes(block.startTime),
                            origEndMin: timeStringToMinutes(block.endTime),
                            previewStartMin: timeStringToMinutes(block.startTime),
                            previewEndMin: timeStringToMinutes(block.endTime),
                            hasMoved: false,
                          });
                        }}
                        style={{
                          top: `${topPx}px`,
                          height: `${heightPx}px`,
                          left: leftPos,
                          width: widthPos,
                        }}
                        className={`group absolute rounded-xl backdrop-blur-sm transition-[left,width,box-shadow] duration-300 cursor-grab active:cursor-grabbing flex flex-col justify-between overflow-hidden z-10 ${style.container} ${
                          isDraggingThis ? 'ring-2 ring-cozy-peach z-30 opacity-90' : ''
                        }`}
                      >
                        {/* Top resize handle */}
                        <div
                          onMouseDown={(e) => {
                            if (e.button !== 0) return;
                            e.stopPropagation();
                            setBlockDrag({
                              mode: 'RESIZE_TOP',
                              block,
                              startClientY: e.clientY,
                              origStartMin: timeStringToMinutes(block.startTime),
                              origEndMin: timeStringToMinutes(block.endTime),
                              previewStartMin: timeStringToMinutes(block.startTime),
                              previewEndMin: timeStringToMinutes(block.endTime),
                              hasMoved: true,
                            });
                          }}
                          className="h-2 w-full cursor-ns-resize flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-white/10 shrink-0"
                        >
                          <GripHorizontal className="w-3 h-2.5 text-cozy-subtext" />
                        </div>

                        <div className="px-2 flex-1 min-h-0 flex flex-col justify-center overflow-hidden">
                          <div className="flex items-start justify-between gap-1">
                            <span
                              className={`font-extrabold leading-tight flex items-start gap-1 min-w-0 ${
                                isExpanded ? 'text-xs leading-snug' : 'text-[11px]'
                              }`}
                            >
                              <span className="shrink-0">{style.icon}</span>
                              <span className="whitespace-normal break-words leading-tight">
                                {block.title}
                              </span>
                            </span>
                            <button
                              type="button"
                              onMouseDown={(e) => e.stopPropagation()}
                              onClick={(e) => {
                                e.stopPropagation();
                                const dayCount =
                                  block.daysOfWeek && block.daysOfWeek.length > 0
                                    ? block.daysOfWeek.length
                                    : 1;
                                requestConfirm(
                                  'Excluir da Rotina Semanal',
                                  dayCount > 1
                                    ? `Remover o template "${block.title}" dos ${dayCount} dia(s) selecionados na rotina?`
                                    : `Remover a área "${block.title}" de todas as ${
                                        DAYS_OF_WEEK.find((dw) => dw.id === d.id)?.name || ''
                                      }s?`,
                                  () => deleteRoutineBlock(block.id)
                                );
                              }}
                              className="text-cozy-subtext hover:text-cozy-rose opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                              title="Excluir da rotina"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                          <div className="flex items-center justify-between gap-1 mt-0.5 flex-wrap">
                            <span className="text-[9px] font-mono text-cozy-subtext truncate">
                              {minutesToTimeString(sMin)}–{minutesToTimeString(eMin)}
                            </span>
                            {(isExpanded ? heightPx > 32 : heightPx > 42) && (
                              <div className="flex items-center gap-1 flex-wrap">
                                <span className={`text-[9px] font-bold px-1 rounded ${style.badge}`}>
                                  {style.label}
                                </span>
                                {isExpanded && (
                                  <span
                                    className={`text-[8px] font-bold px-1 rounded border ${
                                      block.obligation === 'MANDATORY'
                                        ? 'border-cozy-peach/40 text-cozy-peach bg-cozy-peach/10'
                                        : 'border-cozy-sage/40 text-cozy-sage bg-cozy-sage/10'
                                    }`}
                                  >
                                    {block.obligation === 'MANDATORY' ? 'Obrig.' : 'Flex.'}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                          {(isExpanded ? heightPx > 64 : heightPx > 58) && (
                            <span className="text-[8px] text-cozy-subtext truncate opacity-80">
                              {style.sub}
                            </span>
                          )}
                        </div>

                        {/* Bottom resize handle */}
                        <div
                          onMouseDown={(e) => {
                            if (e.button !== 0) return;
                            e.stopPropagation();
                            setBlockDrag({
                              mode: 'RESIZE_BOTTOM',
                              block,
                              startClientY: e.clientY,
                              origStartMin: timeStringToMinutes(block.startTime),
                              origEndMin: timeStringToMinutes(block.endTime),
                              previewStartMin: timeStringToMinutes(block.startTime),
                              previewEndMin: timeStringToMinutes(block.endTime),
                              hasMoved: true,
                            });
                          }}
                          className="h-2 w-full cursor-ns-resize flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-white/10 shrink-0"
                        >
                          <GripHorizontal className="w-3 h-2.5 text-cozy-subtext" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Compatible & Recurring Routine Tasks by Energy Tag (No Activity Blocks) */}
      <div className="bg-cozy-card rounded-3xl p-6 border border-cozy-border shadow-cozy space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-extrabold text-cozy-text flex items-center gap-2">
              <CheckSquare className="w-4 h-4 text-cozy-sky" />
              <span>Tarefas Compatíveis por Tag de Energia</span>
            </h2>
            <p className="text-xs text-cozy-subtext mt-0.5">
              Tarefas criadas aqui entram automaticamente nas áreas da rotina e janelas da mesma tag (sem criar blocos de atividade fixos).
            </p>
          </div>
          <button
            type="button"
            onClick={() => openTaskModal('FOCUS')}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-cozy-sky/15 text-cozy-sky border border-cozy-sky/30 font-bold text-xs hover:bg-cozy-sky/25 transition-colors self-start sm:self-auto"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Adicionar Tarefa Recorrente</span>
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {(['FOCUS', 'TRANSIT', 'BACKGROUND'] as EnergyTier[]).map((tierKey) => {
            const meta = TIER_META[tierKey];
            const list = groupedTasksByTier[tierKey];
            return (
              <div
                key={tierKey}
                className={`rounded-2xl border p-4 space-y-3 ${meta.colCls}`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`text-xs font-extrabold px-2.5 py-1 rounded-full border ${meta.badgeCls}`}
                  >
                    {meta.icon} {meta.label}
                  </span>
                  <button
                    type="button"
                    onClick={() => openTaskModal(tierKey)}
                    className="text-[11px] font-bold text-cozy-subtext hover:text-cozy-text flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Criar</span>
                  </button>
                </div>

                {list.length === 0 ? (
                  <p className="text-xs text-cozy-subtext text-center py-4 opacity-75">
                    Nenhuma tarefa pendente nesta tag.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {list.map((task) => (
                      <div
                        key={task.id}
                        className="p-2.5 rounded-xl bg-cozy-bg border border-cozy-border flex items-start justify-between gap-2"
                      >
                        <button
                          type="button"
                          onClick={() => toggleTask(task.id)}
                          className="flex items-start gap-2 text-left min-w-0 flex-1"
                        >
                          <span className="mt-0.5 w-4 h-4 rounded-md border border-cozy-border bg-cozy-card hover:border-cozy-sage flex items-center justify-center shrink-0">
                            {task.isCompleted && <Check className="w-3 h-3 text-cozy-sage" />}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold text-cozy-text whitespace-normal break-words leading-snug">{task.title}</p>
                            <div className="flex items-center gap-1.5 flex-wrap mt-1">
                              <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-cozy-card border border-cozy-border text-cozy-subtext">
                                {task.priority}
                              </span>
                              <span className="text-[10px] font-mono text-cozy-subtext">
                                {task.durationMinutes}m
                              </span>
                              {task.date && (
                                <span className="text-[10px] font-mono text-cozy-sky">
                                  {formatDateBR(task.date)}
                                </span>
                              )}
                              {task.recurringSeriesId && (
                                <span
                                  className="text-[10px] font-bold text-cozy-lavender flex items-center gap-0.5"
                                  title="Tarefa recorrente"
                                >
                                  <Repeat className="w-2.5 h-2.5" />
                                  Recorrente
                                </span>
                              )}
                            </div>
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            requestConfirm(
                              'Excluir Tarefa',
                              `Remover a tarefa "${task.title}"?`,
                              () => deleteTask(task.id)
                            )
                          }
                          className="p-1 text-cozy-subtext hover:text-cozy-rose transition-colors shrink-0"
                          title="Excluir tarefa"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal: Criar / Editar Área Genérica do Dia */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          onClick={() => setShowModal(false)}
        >
          <div
            className="bg-cozy-card rounded-3xl p-6 max-w-md w-full shadow-2xl border border-cozy-border text-cozy-text max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-extrabold text-lg">
                {editingBlock ? 'Editar Área da Rotina' : 'Nova Área da Rotina (Parte do Dia)'}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="p-1.5 rounded-full text-cozy-subtext hover:bg-cozy-hover transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-bold mb-1">Nome da Área</label>
                <input
                  type="text"
                  placeholder="Ex: Trabalho, Faculdade, Estudos, Transporte..."
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-4 py-2 rounded-2xl border border-cozy-border bg-cozy-bg text-sm focus:outline-none focus:ring-2 focus:ring-cozy-lavender text-cozy-text"
                  required
                />
                <div className="flex items-center gap-1.5 flex-wrap mt-2">
                  {AREA_QUICK_CHIPS.map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => setTitle(chip)}
                      className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-cozy-bg border border-cozy-border text-cozy-subtext hover:text-cozy-text hover:border-cozy-lavender/50 transition-colors"
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold mb-1.5">
                  Dias da Semana ({selectedDays.length} selecionado(s))
                </label>
                <div className="grid grid-cols-7 gap-1.5">
                  {DAYS_OF_WEEK.map((d) => {
                    const active = selectedDays.includes(d.id);
                    return (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() =>
                          setSelectedDays((prev) =>
                            prev.includes(d.id)
                              ? prev.length > 1
                                ? prev.filter((id) => id !== d.id)
                                : prev
                              : [...prev, d.id]
                          )
                        }
                        className={`py-2 rounded-xl text-[11px] font-extrabold border transition-all flex flex-col items-center gap-0.5 ${
                          active
                            ? 'bg-cozy-lavender text-cozy-bg border-cozy-lavender shadow-sm'
                            : 'bg-cozy-bg text-cozy-subtext border-cozy-border hover:text-cozy-text'
                        }`}
                      >
                        <span>{d.short}</span>
                        <span className="text-[9px] leading-none">{active ? '☑' : '☐'}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-cozy-subtext">Horário de Início</label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-cozy-border bg-cozy-bg text-xs font-mono mt-1 text-cozy-text"
                    required
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-cozy-subtext">Horário de Término</label>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-cozy-border bg-cozy-bg text-xs font-mono mt-1 text-cozy-text"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold mb-1.5">
                  Tag de Energia (Define compatibilidade de tarefas e progressos)
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setTier('FOCUS')}
                    className={`py-2.5 px-2 rounded-xl text-xs font-bold border transition-all ${
                      tier === 'FOCUS'
                        ? 'bg-cozy-lavender/20 text-cozy-lavender border-cozy-lavender'
                        : 'border-cozy-border bg-cozy-bg text-cozy-subtext'
                    }`}
                  >
                    🧠 Focado
                  </button>
                  <button
                    type="button"
                    onClick={() => setTier('TRANSIT')}
                    className={`py-2.5 px-2 rounded-xl text-xs font-bold border transition-all ${
                      tier === 'TRANSIT'
                        ? 'bg-cozy-butter/20 text-cozy-butter border-cozy-butter'
                        : 'border-cozy-border bg-cozy-bg text-cozy-subtext'
                    }`}
                  >
                    🎧 Baixo Foco
                  </button>
                  <button
                    type="button"
                    onClick={() => setTier('BACKGROUND')}
                    className={`py-2.5 px-2 rounded-xl text-xs font-bold border transition-all ${
                      tier === 'BACKGROUND'
                        ? 'bg-cozy-sky/20 text-cozy-sky border-cozy-sky'
                        : 'border-cozy-border bg-cozy-bg text-cozy-subtext'
                    }`}
                  >
                    🫧 2º Plano
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold mb-1">Obrigatoriedade</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setObligation('MANDATORY')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                      obligation === 'MANDATORY'
                        ? 'bg-cozy-rose/20 text-cozy-rose border-cozy-rose/50'
                        : 'border-cozy-border bg-cozy-bg text-cozy-subtext'
                    }`}
                  >
                    Obrigatório
                  </button>
                  <button
                    type="button"
                    onClick={() => setObligation('FLEXIBLE')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                      obligation === 'FLEXIBLE'
                        ? 'bg-cozy-sky/20 text-cozy-sky border-cozy-sky/50'
                        : 'border-cozy-border bg-cozy-bg text-cozy-subtext'
                    }`}
                  >
                    Flexível
                  </button>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between gap-2">
                {editingBlock ? (
                  <button
                    type="button"
                    onClick={() =>
                      requestConfirm(
                        'Excluir Área da Rotina?',
                        editingBlock.daysOfWeek && editingBlock.daysOfWeek.length > 1
                          ? `Remover o template "${editingBlock.title}" dos ${editingBlock.daysOfWeek.length} dias da rotina semanal?`
                          : `Remover "${editingBlock.title}" da rotina semanal?`,
                        () => {
                          deleteRoutineBlock(editingBlock.id);
                          setShowModal(false);
                        }
                      )
                    }
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-bold bg-cozy-rose/15 text-cozy-rose border border-cozy-rose/30 hover:bg-cozy-rose/25 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Excluir Área</span>
                  </button>
                ) : (
                  <div />
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 rounded-full text-xs font-bold text-cozy-subtext hover:bg-cozy-hover"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-full text-xs font-extrabold bg-cozy-lavender text-cozy-bg hover:brightness-110 shadow-cozy-pill"
                  >
                    {editingBlock ? 'Salvar Área' : 'Criar Área da Rotina'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Nova Tarefa Compatível & Recorrente (Sem Blocos de Atividade) */}
      {showTaskModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
          onClick={() => setShowTaskModal(false)}
        >
          <div
            className="bg-cozy-card rounded-3xl p-6 max-w-lg w-full shadow-2xl border border-cozy-border text-cozy-text max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-extrabold text-lg">Nova Tarefa na Rotina</h3>
                <p className="text-xs text-cozy-subtext">
                  Compatível com áreas da mesma Tag de Energia (sem bloco fixo).
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowTaskModal(false)}
                className="p-1.5 rounded-full text-cozy-subtext hover:bg-cozy-hover transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveRoutineTask} className="space-y-4">
              <div>
                <label className="block text-xs font-bold mb-1">Título da Tarefa</label>
                <input
                  type="text"
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  placeholder="Ex: Responder e-mails, Revisar aula, Ouvir podcast..."
                  className="w-full px-4 py-2 rounded-2xl border border-cozy-border bg-cozy-bg text-sm text-cozy-text focus:outline-none focus:ring-2 focus:ring-cozy-sky"
                  required
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-cozy-subtext mb-1">
                    Prioridade
                  </label>
                  <select
                    value={taskPriority}
                    onChange={(e) => setTaskPriority(e.target.value as Priority)}
                    className="w-full px-3 py-2 rounded-xl border border-cozy-border bg-cozy-bg text-xs font-bold text-cozy-text"
                  >
                    <option value="P1">P1 — Crítica</option>
                    <option value="P2">P2 — Alta</option>
                    <option value="P3">P3 — Normal</option>
                    <option value="P4">P4 — Baixa</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-cozy-subtext mb-1">
                    Duração (min)
                  </label>
                  <input
                    type="number"
                    min={15}
                    max={480}
                    step={5}
                    value={taskDuration}
                    onChange={(e) => setTaskDuration(Math.max(15, Number(e.target.value) || 45))}
                    className="w-full px-3 py-2 rounded-xl border border-cozy-border bg-cozy-bg text-xs font-bold text-cozy-text"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-cozy-subtext mb-1">
                    Data Inicial
                  </label>
                  <input
                    type="date"
                    value={taskStartDate}
                    onChange={(e) => setTaskStartDate(e.target.value)}
                    className="w-full px-2.5 py-2 rounded-xl border border-cozy-border bg-cozy-bg text-xs font-bold text-cozy-text"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold mb-1.5">Tag de Energia Compatível</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['FOCUS', 'TRANSIT', 'BACKGROUND'] as EnergyTier[]).map((tierKey) => (
                    <button
                      key={tierKey}
                      type="button"
                      onClick={() => setTaskTier(tierKey)}
                      className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all ${
                        taskTier === tierKey
                          ? TIER_META[tierKey].badgeCls
                          : 'border-cozy-border bg-cozy-bg text-cozy-subtext'
                      }`}
                    >
                      {TIER_META[tierKey].icon} {TIER_META[tierKey].label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold mb-1">Obrigatoriedade</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setTaskObligation('MANDATORY')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                      taskObligation === 'MANDATORY'
                        ? 'bg-cozy-rose/20 text-cozy-rose border-cozy-rose/50'
                        : 'border-cozy-border bg-cozy-bg text-cozy-subtext'
                    }`}
                  >
                    Obrigatório
                  </button>
                  <button
                    type="button"
                    onClick={() => setTaskObligation('FLEXIBLE')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                      taskObligation === 'FLEXIBLE'
                        ? 'bg-cozy-sky/20 text-cozy-sky border-cozy-sky/50'
                        : 'border-cozy-border bg-cozy-bg text-cozy-subtext'
                    }`}
                  >
                    Flexível
                  </button>
                </div>
              </div>

              {/* Google Calendar Style Recurrence */}
              <div className="p-4 rounded-2xl bg-cozy-bg/75 border border-cozy-border space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-cozy-text">
                    <Repeat className="w-4 h-4 text-cozy-sky" />
                    <span>Repetição da Tarefa</span>
                  </div>
                  <select
                    value={taskRecFrequency}
                    onChange={(e) => setTaskRecFrequency(e.target.value as RecurrenceFrequency)}
                    className="px-3 py-1.5 rounded-xl bg-cozy-card border border-cozy-border text-xs font-bold text-cozy-text"
                  >
                    <option value="NONE">Não se repete</option>
                    <option value="DAILY">Diariamente</option>
                    <option value="WEEKLY">Semanalmente</option>
                    <option value="MONTHLY">Mensalmente</option>
                    <option value="CUSTOM">Personalizada</option>
                  </select>
                </div>

                {taskRecFrequency !== 'NONE' && (
                  <div className="space-y-3 pt-2 border-t border-cozy-border/60">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-cozy-subtext font-semibold">A cada</span>
                      <input
                        type="number"
                        min={1}
                        max={30}
                        value={taskRecInterval}
                        onChange={(e) =>
                          setTaskRecInterval(Math.max(1, Number(e.target.value) || 1))
                        }
                        className="w-16 px-2.5 py-1 rounded-xl bg-cozy-card border border-cozy-border text-xs font-bold text-cozy-text text-center"
                      />
                      <span className="text-xs text-cozy-subtext font-semibold">
                        {taskRecFrequency === 'DAILY'
                          ? 'dia(s)'
                          : taskRecFrequency === 'MONTHLY'
                            ? 'mês(es)'
                            : 'semana(s)'}
                      </span>
                    </div>

                    {(taskRecFrequency === 'WEEKLY' || taskRecFrequency === 'CUSTOM') && (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {WEEKDAY_PILLS.map((lbl, idx) => {
                          const selected = taskRecDays.includes(idx);
                          return (
                            <button
                              key={idx}
                              type="button"
                              onClick={() =>
                                setTaskRecDays((prev) =>
                                  prev.includes(idx)
                                    ? prev.length > 1
                                      ? prev.filter((d) => d !== idx)
                                      : prev
                                    : [...prev, idx]
                                )
                              }
                              className={`w-8 h-8 rounded-full text-xs font-extrabold border transition-all ${
                                selected
                                  ? 'bg-cozy-sky text-cozy-bg border-cozy-sky shadow-sm'
                                  : 'bg-cozy-card text-cozy-subtext border-cozy-border'
                              }`}
                            >
                              {lbl}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => setTaskRecEndType('NEVER')}
                        className={`px-3 py-1.5 rounded-xl border text-xs font-bold text-left ${
                          taskRecEndType === 'NEVER'
                            ? 'bg-cozy-sky/15 border-cozy-sky text-cozy-sky'
                            : 'bg-cozy-card border-cozy-border text-cozy-subtext'
                        }`}
                      >
                        Nunca (até 8 sem.)
                      </button>
                      <div
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl border ${
                          taskRecEndType === 'ON_DATE'
                            ? 'bg-cozy-sky/15 border-cozy-sky'
                            : 'bg-cozy-card border-cozy-border'
                        }`}
                      >
                        <input
                          type="radio"
                          checked={taskRecEndType === 'ON_DATE'}
                          onChange={() => setTaskRecEndType('ON_DATE')}
                        />
                        <input
                          type="date"
                          value={taskRecEndDate}
                          onFocus={() => setTaskRecEndType('ON_DATE')}
                          onChange={(e) => {
                            setTaskRecEndType('ON_DATE');
                            setTaskRecEndDate(e.target.value);
                          }}
                          className="w-full bg-transparent text-[11px] font-bold text-cozy-text focus:outline-none"
                        />
                      </div>
                      <div
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl border ${
                          taskRecEndType === 'AFTER_OCCURRENCES'
                            ? 'bg-cozy-sky/15 border-cozy-sky'
                            : 'bg-cozy-card border-cozy-border'
                        }`}
                      >
                        <input
                          type="radio"
                          checked={taskRecEndType === 'AFTER_OCCURRENCES'}
                          onChange={() => setTaskRecEndType('AFTER_OCCURRENCES')}
                        />
                        <span className="text-[11px] text-cozy-subtext">Após</span>
                        <input
                          type="number"
                          min={1}
                          max={60}
                          value={taskRecOccurrences}
                          onFocus={() => setTaskRecEndType('AFTER_OCCURRENCES')}
                          onChange={(e) => {
                            setTaskRecEndType('AFTER_OCCURRENCES');
                            setTaskRecOccurrences(Math.max(1, Number(e.target.value) || 1));
                          }}
                          className="w-12 bg-cozy-bg border border-cozy-border rounded-lg px-1.5 py-0.5 text-xs font-bold text-cozy-text text-center"
                        />
                        <span className="text-[11px] text-cozy-subtext">x</span>
                      </div>
                    </div>

                    <p className="text-[11px] text-cozy-sky font-semibold">
                      Criará {taskRecPreviewCount} ocorrência(s) da tarefa a partir de{' '}
                      {formatDateBR(taskStartDate)}.
                    </p>
                  </div>
                )}
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowTaskModal(false)}
                  className="px-4 py-2 rounded-full text-xs font-bold text-cozy-subtext hover:bg-cozy-hover"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-full text-xs font-extrabold bg-cozy-sky text-cozy-bg hover:brightness-110 shadow-cozy-pill"
                >
                  Criar Tarefa(s)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
