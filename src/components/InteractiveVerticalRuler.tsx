import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useApp, getTodayDateString } from '../context/AppContext';
import { EnergyTier, Obligation, RoutineBlock, ScheduledBlock } from '../types';
import {
  minutesToTimeString,
  timeStringToMinutes,
  formatSecondsToHuman,
  formatDateBR,
  snapMinutesFromRelativeY,
  computeOverlapLayout,
} from '../utils/helpers';
import {
  Clock,
  ShieldAlert,
  BarChart3,
  CheckSquare,
  GripHorizontal,
  Play,
  Pause,
  Sparkles,
  Trash2,
  RotateCcw,
  Plus,
  X,
  Brain,
  Headphones,
  Wind,
  Maximize2,
  Minimize2,
} from 'lucide-react';

interface InteractiveVerticalRulerProps {
  dateStr: string;
  onSelectBlock: (block: ScheduledBlock) => void;
  onDragCreate: (startTime: string, endTime: string) => void;
  hourHeight?: number;
  title?: string;
  subtitle?: string;
  headerRight?: React.ReactNode;
  allowAreaAdjustment?: boolean;
}

interface BlockDragState {
  mode: 'MOVE' | 'RESIZE_TOP' | 'RESIZE_BOTTOM';
  block: ScheduledBlock;
  startClientY: number;
  origStartMin: number;
  origEndMin: number;
  previewStartMin: number;
  previewEndMin: number;
  hasMoved: boolean;
}

interface AreaDragState {
  mode: 'MOVE' | 'RESIZE_TOP' | 'RESIZE_BOTTOM';
  area: RoutineBlock;
  startClientY: number;
  origStartMin: number;
  origEndMin: number;
  previewStartMin: number;
  previewEndMin: number;
  hasMoved: boolean;
}

interface CreateDragState {
  target: 'ACTIVITY' | 'AREA';
  anchorMin: number;
  currentMin: number;
  startClientY: number;
}

const TIER_META: Record<
  EnergyTier,
  {
    label: string;
    shortLabel: string;
    areaBg: string;
    blockCard: string;
    pill: string;
    hex: string;
  }
> = {
  FOCUS: {
    label: '🧠 Focado',
    shortLabel: '🧠 Focado',
    areaBg:
      'bg-cozy-lavender/[0.10] border border-dashed border-cozy-lavender/45 text-cozy-lavender hover:bg-cozy-lavender/[0.16]',
    blockCard:
      'bg-cozy-lavender/20 border-cozy-lavender/60 hover:border-cozy-lavender',
    pill: 'bg-cozy-lavender/20 text-cozy-lavender',
    hex: '#B49BFA',
  },
  TRANSIT: {
    label: '🎧 Baixo Foco',
    shortLabel: '🎧 Baixo Foco',
    areaBg:
      'bg-cozy-butter/[0.10] border border-dashed border-cozy-butter/45 text-cozy-butter hover:bg-cozy-butter/[0.16]',
    blockCard:
      'bg-cozy-butter/20 border-cozy-butter/60 hover:border-cozy-butter',
    pill: 'bg-cozy-butter/20 text-cozy-butter',
    hex: '#FDE047',
  },
  BACKGROUND: {
    label: '🫧 Segundo Plano',
    shortLabel: '🫧 2º Plano',
    areaBg:
      'bg-cozy-sky/[0.10] border border-dashed border-cozy-sky/45 text-cozy-sky hover:bg-cozy-sky/[0.16]',
    blockCard: 'bg-cozy-sky/20 border-cozy-sky/60 hover:border-cozy-sky',
    pill: 'bg-cozy-sky/20 text-cozy-sky',
    hex: '#7DD3FC',
  },
};

export const InteractiveVerticalRuler: React.FC<InteractiveVerticalRulerProps> = ({
  dateStr,
  onSelectBlock,
  onDragCreate,
  hourHeight = 56,
  title,
  subtitle,
  headerRight,
  allowAreaAdjustment = true,
}) => {
  const {
    currentTimeStr,
    getEffectiveBlocksForDate,
    getRoutineAreasForDay,
    addDayRoutineArea,
    updateDayRoutineArea,
    deleteDayRoutineArea,
    resetDayRoutineAreas,
    dayOverrides,
    getDayBoundsForDate,
    updateEffectiveBlock,
    deleteEffectiveBlock,
    progressBars,
    tasks,
    playProgress,
    pauseProgress,
    toggleTask,
    requestConfirm,
    showToast,
  } = useApp();

  const canvasRef = useRef<HTMLDivElement>(null);
  const [blockDrag, setBlockDrag] = useState<BlockDragState | null>(null);
  const [areaDrag, setAreaDrag] = useState<AreaDragState | null>(null);
  const [createDrag, setCreateDrag] = useState<CreateDragState | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  // Day-only Routine Area modal state
  const [areaModalOpen, setAreaModalOpen] = useState(false);
  const [editingArea, setEditingArea] = useState<RoutineBlock | null>(null);
  const [areaTitle, setAreaTitle] = useState('');
  const [areaStartTime, setAreaStartTime] = useState('09:00');
  const [areaEndTime, setAreaEndTime] = useState('12:00');
  const [areaTier, setAreaTier] = useState<EnergyTier>('FOCUS');
  const [areaObligation, setAreaObligation] = useState<Obligation>('FLEXIBLE');

  const nowMinutes = useMemo(() => timeStringToMinutes(currentTimeStr), [currentTimeStr]);
  const todayStr = getTodayDateString();
  const isToday = dateStr === todayStr;
  const dayOfWeek = useMemo(() => new Date(dateStr + 'T12:00:00').getDay(), [dateStr]);

  const routineAreas = useMemo(
    () => getRoutineAreasForDay(dayOfWeek, dateStr),
    [getRoutineAreasForDay, dayOfWeek, dateStr]
  );

  const hasDayAreaOverride = useMemo(() => {
    const ov = dayOverrides[dateStr];
    return ov?.customRoutineAreas !== undefined || (ov?.hiddenRoutineIds?.length || 0) > 0;
  }, [dayOverrides, dateStr]);

  const blocks = useMemo(
    () => getEffectiveBlocksForDate(dateStr),
    [getEffectiveBlocksForDate, dateStr]
  );
  const timedBlocks = useMemo(
    () => blocks.filter((b) => Boolean(b.startTime && b.endTime)),
    [blocks]
  );
  const untimedBlocks = useMemo(
    () => blocks.filter((b) => !b.startTime || !b.endTime),
    [blocks]
  );
  const dayBounds = useMemo(() => getDayBoundsForDate(dateStr), [getDayBoundsForDate, dateStr]);

  // Expand hour window cleanly to always show all areas, blocks, and current time indicator
  const { startHour, endHour } = useMemo(() => {
    let minH = dayBounds.startHour;
    let maxH = dayBounds.endHour;
    timedBlocks.forEach((b) => {
      minH = Math.min(minH, Math.floor(timeStringToMinutes(b.startTime) / 60));
      maxH = Math.max(maxH, Math.ceil(timeStringToMinutes(b.endTime) / 60));
    });
    routineAreas.forEach((a) => {
      minH = Math.min(minH, Math.floor(timeStringToMinutes(a.startTime) / 60));
      maxH = Math.max(maxH, Math.ceil(timeStringToMinutes(a.endTime) / 60));
    });
    if (isToday) {
      const currH = Math.floor(nowMinutes / 60);
      minH = Math.min(minH, currH);
      maxH = Math.max(maxH, Math.min(24, currH + 1));
    }
    return {
      startHour: Math.max(0, minH),
      endHour: Math.min(24, Math.max(minH + 1, maxH)),
    };
  }, [dayBounds, timedBlocks, routineAreas, isToday, nowMinutes]);

  const hoursList = useMemo(
    () => Array.from({ length: endHour - startHour }, (_, idx) => startHour + idx),
    [startHour, endHour]
  );

  const openAreaModalForCreate = (sTime: string, eTime: string) => {
    setEditingArea(null);
    setAreaTitle('');
    setAreaStartTime(sTime);
    setAreaEndTime(eTime);
    setAreaTier('FOCUS');
    setAreaObligation('FLEXIBLE');
    setAreaModalOpen(true);
  };

  const openAreaModalForEdit = (area: RoutineBlock) => {
    setEditingArea(area);
    setAreaTitle(area.title);
    setAreaStartTime(area.startTime);
    setAreaEndTime(area.endTime);
    setAreaTier(area.tier);
    setAreaObligation(area.obligation);
    setAreaModalOpen(true);
  };

  const handleSaveAreaModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!areaTitle.trim()) {
      showToast('Digite um nome para a área deste dia.', 'warning');
      return;
    }
    if (timeStringToMinutes(areaEndTime) <= timeStringToMinutes(areaStartTime)) {
      showToast('O horário de término da área deve ser após o início.', 'warning');
      return;
    }

    const hex = TIER_META[areaTier].hex;
    if (editingArea) {
      updateDayRoutineArea(dateStr, editingArea.id, {
        title: areaTitle.trim(),
        startTime: areaStartTime,
        endTime: areaEndTime,
        tier: areaTier,
        obligation: areaObligation,
        color: hex,
      });
      showToast('Área ajustada apenas para este dia.', 'success');
    } else {
      addDayRoutineArea(dateStr, {
        title: areaTitle.trim(),
        startTime: areaStartTime,
        endTime: areaEndTime,
        tier: areaTier,
        obligation: areaObligation,
        color: hex,
      });
      showToast('Área criada apenas para este dia.', 'success');
    }
    setAreaModalOpen(false);
  };

  const areaOverlapLayout = useMemo(
    () =>
      computeOverlapLayout(
        routineAreas,
        (a) => {
          const isDraggingThis = areaDrag?.area.id === a.id;
          return {
            startMin: isDraggingThis
              ? areaDrag.previewStartMin
              : timeStringToMinutes(a.startTime),
            endMin: isDraggingThis
              ? areaDrag.previewEndMin
              : timeStringToMinutes(a.endTime),
          };
        },
        92
      ),
    [routineAreas, areaDrag]
  );

  const blockOverlapLayout = useMemo(
    () =>
      computeOverlapLayout(
        timedBlocks,
        (b) => {
          const isDraggingThis = blockDrag?.block.id === b.id;
          return {
            startMin: isDraggingThis
              ? blockDrag.previewStartMin
              : timeStringToMinutes(b.startTime),
            endMin: isDraggingThis
              ? blockDrag.previewEndMin
              : timeStringToMinutes(b.endTime),
          };
        },
        92
      ),
    [timedBlocks, blockDrag]
  );

  const clientYToSnappedMinutes = (clientY: number, mode: 'ANCHOR' | 'CURSOR' = 'ANCHOR') => {
    if (!canvasRef.current) return startHour * 60;
    const rect = canvasRef.current.getBoundingClientRect();
    const relY = Math.max(0, Math.min(rect.height, clientY - rect.top));
    return snapMinutesFromRelativeY(relY, hourHeight, startHour, endHour, mode);
  };

  const createDragRef = useRef<CreateDragState | null>(null);
  const blockDragRef = useRef<BlockDragState | null>(null);
  const areaDragRef = useRef<AreaDragState | null>(null);
  createDragRef.current = createDrag;
  blockDragRef.current = blockDrag;
  areaDragRef.current = areaDrag;

  const dragCallbacksRef = useRef({
    onSelectBlock,
    onDragCreate,
    updateEffectiveBlock,
    updateDayRoutineArea,
    openAreaModalForCreate,
    openAreaModalForEdit,
    clientYToSnappedMinutes,
  });
  dragCallbacksRef.current = {
    onSelectBlock,
    onDragCreate,
    updateEffectiveBlock,
    updateDayRoutineArea,
    openAreaModalForCreate,
    openAreaModalForEdit,
    clientYToSnappedMinutes,
  };

  const isDragging = createDrag !== null || blockDrag !== null || areaDrag !== null;

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (ev: MouseEvent) => {
      const cDrag = createDragRef.current;
      if (cDrag) {
        const currentMin = dragCallbacksRef.current.clientYToSnappedMinutes(ev.clientY, 'CURSOR');
        setCreateDrag((prev) => (prev ? { ...prev, currentMin } : null));
      }

      const bDrag = blockDragRef.current;
      if (bDrag) {
        const deltaPx = ev.clientY - bDrag.startClientY;
        const hasMoved = bDrag.hasMoved || Math.abs(deltaPx) > 4;
        const deltaMins = Math.round(((deltaPx / hourHeight) * 60) / 15) * 15;

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

      const aDrag = areaDragRef.current;
      if (aDrag) {
        const deltaPx = ev.clientY - aDrag.startClientY;
        const hasMoved = aDrag.hasMoved || Math.abs(deltaPx) > 4;
        const deltaMins = Math.round(((deltaPx / hourHeight) * 60) / 15) * 15;

        let newStart = aDrag.origStartMin;
        let newEnd = aDrag.origEndMin;

        if (aDrag.mode === 'RESIZE_TOP') {
          newStart = Math.max(
            startHour * 60,
            Math.min(aDrag.origEndMin - 15, aDrag.origStartMin + deltaMins)
          );
        } else if (aDrag.mode === 'RESIZE_BOTTOM') {
          newEnd = Math.min(
            endHour * 60,
            Math.max(aDrag.origStartMin + 15, aDrag.origEndMin + deltaMins)
          );
        } else {
          const duration = aDrag.origEndMin - aDrag.origStartMin;
          newStart = Math.max(
            startHour * 60,
            Math.min(endHour * 60 - duration, aDrag.origStartMin + deltaMins)
          );
          newEnd = newStart + duration;
        }

        setAreaDrag((prev) =>
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

        let resolvedStart = '';
        let resolvedEnd = '';
        if (dist <= 4) {
          const clickEnd = Math.min(endHour * 60, cDrag.anchorMin + 60);
          if (clickEnd - cDrag.anchorMin >= 15) {
            resolvedStart = minutesToTimeString(cDrag.anchorMin);
            resolvedEnd = minutesToTimeString(clickEnd);
          }
        } else if (e - s >= 15) {
          resolvedStart = minutesToTimeString(s);
          resolvedEnd = minutesToTimeString(e);
        }

        if (resolvedStart && resolvedEnd) {
          if (cDrag.target === 'AREA') {
            dragCallbacksRef.current.openAreaModalForCreate(resolvedStart, resolvedEnd);
          } else {
            dragCallbacksRef.current.onDragCreate(resolvedStart, resolvedEnd);
          }
        }
        setCreateDrag(null);
      }

      const bDrag = blockDragRef.current;
      if (bDrag) {
        if (!bDrag.hasMoved && bDrag.mode === 'MOVE') {
          dragCallbacksRef.current.onSelectBlock(bDrag.block);
        } else if (
          bDrag.previewStartMin !== bDrag.origStartMin ||
          bDrag.previewEndMin !== bDrag.origEndMin
        ) {
          dragCallbacksRef.current.updateEffectiveBlock(dateStr, bDrag.block, {
            startTime: minutesToTimeString(bDrag.previewStartMin),
            endTime: minutesToTimeString(bDrag.previewEndMin),
          });
        }
        setBlockDrag(null);
      }

      const aDrag = areaDragRef.current;
      if (aDrag) {
        if (!aDrag.hasMoved && aDrag.mode === 'MOVE') {
          dragCallbacksRef.current.openAreaModalForEdit(aDrag.area);
        } else if (
          aDrag.previewStartMin !== aDrag.origStartMin ||
          aDrag.previewEndMin !== aDrag.origEndMin
        ) {
          dragCallbacksRef.current.updateDayRoutineArea(dateStr, aDrag.area.id, {
            startTime: minutesToTimeString(aDrag.previewStartMin),
            endTime: minutesToTimeString(aDrag.previewEndMin),
          });
        }
        setAreaDrag(null);
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, startHour, endHour, hourHeight, dateStr]);

  const startTrackCreateDrag = (target: 'ACTIVITY' | 'AREA', e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const anchorMin = clientYToSnappedMinutes(e.clientY, 'ANCHOR');
    setCreateDrag({
      target,
      anchorMin,
      currentMin: Math.min(endHour * 60, anchorMin + 30),
      startClientY: e.clientY,
    });
  };

  const createPreviewTop =
    createDrag !== null
      ? ((Math.min(createDrag.anchorMin, createDrag.currentMin) - startHour * 60) / 60) * hourHeight
      : 0;
  const createPreviewHeight =
    createDrag !== null
      ? Math.max(
          (15 / 60) * hourHeight,
          (Math.abs(createDrag.currentMin - createDrag.anchorMin) / 60) * hourHeight
        )
      : 0;

  const nowTopPx = ((nowMinutes - startHour * 60) / 60) * hourHeight;
  const showNowLine = isToday && nowMinutes >= startHour * 60 && nowMinutes <= endHour * 60;

  return (
    <div className="bg-cozy-card border border-cozy-border rounded-3xl shadow-cozy overflow-hidden flex flex-col">
      {(title || subtitle || headerRight) && (
        <div className="px-4 py-3.5 border-b border-cozy-border flex flex-wrap items-center justify-between gap-2 bg-cozy-bg/40">
          <div className="min-w-0 flex-1">
            {title && (
              <h3 className="text-sm font-extrabold text-cozy-text flex items-start gap-1.5 whitespace-normal break-words leading-tight">
                <Clock className="w-4 h-4 text-cozy-peach shrink-0 mt-0.5" />
                <span className="whitespace-normal break-words">{title}</span>
              </h3>
            )}
            {subtitle && (
              <p className="text-[11px] text-cozy-subtext mt-0.5 whitespace-normal break-words leading-snug">
                {subtitle}
              </p>
            )}
          </div>
          {headerRight && <div className="flex items-center gap-1.5 shrink-0">{headerRight}</div>}
        </div>
      )}

      {/* Compact info, Overlap Expansion toggle & Conditional Area Restore */}
      <div className="px-3.5 py-2 bg-cozy-bg/30 border-b border-cozy-border/60 flex flex-wrap items-center justify-between gap-1.5 text-[10px] text-cozy-subtext">
        <span className="flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-cozy-lavender shrink-0" />
          <span>
            {allowAreaAdjustment
              ? 'Esq: Áreas do dia • Dir: Atividades'
              : 'Áreas no fundo • Clique/arraste para blocos'}
          </span>
        </span>
        <div className="flex items-center gap-1.5 ml-auto flex-wrap">
          <button
            type="button"
            onClick={() => setIsExpanded((prev) => !prev)}
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold transition-colors ${
              isExpanded
                ? 'bg-cozy-peach/20 text-cozy-peach border-cozy-peach/40'
                : 'bg-cozy-bg text-cozy-subtext border-cozy-border hover:text-cozy-text'
            }`}
            title={
              isExpanded
                ? 'Voltar ao modo sobreposto com blur'
                : 'Expandir itens sobrepostos lado a lado'
            }
          >
            {isExpanded ? <Minimize2 className="w-2.5 h-2.5" /> : <Maximize2 className="w-2.5 h-2.5" />}
            <span>{isExpanded ? 'Sobrepor c/ Blur' : 'Expandir Lado a Lado'}</span>
          </button>

          {allowAreaAdjustment && hasDayAreaOverride && (
            <button
              type="button"
              onClick={() => resetDayRoutineAreas(dateStr)}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-cozy-lavender/15 text-cozy-lavender border border-cozy-lavender/30 text-[10px] font-bold hover:bg-cozy-lavender/25 transition-colors"
              title="Restaurar as áreas padrão da Rotina para esta data"
            >
              <RotateCcw className="w-2.5 h-2.5" />
              <span>Restaurar áreas</span>
            </button>
          )}
          {isToday && (
            <span className="font-bold text-cozy-peach tabular-nums">
              {minutesToTimeString(nowMinutes)}
            </span>
          )}
        </div>
      </div>

      {/* Untimed events strip for this date */}
      {untimedBlocks.length > 0 && (
        <div className="px-3 py-2 border-b border-cozy-border/60 bg-cozy-sky/[0.06] space-y-1.5">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-cozy-sky block">
            Eventos sem horário específico ({untimedBlocks.length})
          </span>
          <div className="flex flex-wrap gap-1.5">
            {untimedBlocks.map((blk) => {
              const meta = TIER_META[blk.tier] || TIER_META.FOCUS;
              return (
                <div
                  key={blk.id}
                  onClick={() => onSelectBlock(blk)}
                  className={`group inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl border text-[11px] font-bold cursor-pointer transition-colors ${meta.blockCard}`}
                >
                  <span className="whitespace-normal break-words leading-snug text-cozy-text">
                    {blk.recurringSeriesId ? '↻ ' : ''}
                    {blk.title}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      requestConfirm(
                        'Remover evento do dia',
                        `Deseja remover "${blk.title}" de ${formatDateBR(dateStr)}?`,
                        () => deleteEffectiveBlock(dateStr, blk)
                      );
                    }}
                    className="text-cozy-subtext hover:text-cozy-rose opacity-75 hover:opacity-100"
                    title="Remover evento"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Subheader: Conditional 2 Columns vs Single Activity Column */}
      <div
        className={`px-3 pt-2.5 pb-1.5 grid gap-1.5 border-b border-cozy-border/50 bg-cozy-bg/20 text-[10px] font-extrabold uppercase tracking-wider ${
          allowAreaAdjustment ? 'grid-cols-[44px_1fr_1fr]' : 'grid-cols-[44px_1fr]'
        }`}
      >
        <div className="text-right pr-1 text-cozy-subtext flex items-center justify-end">Hora</div>
        {allowAreaAdjustment && (
          <div className="flex items-center justify-between px-2 py-1 rounded-xl bg-cozy-bg/70 border border-dashed border-cozy-border text-cozy-subtext">
            <span className="whitespace-normal break-words leading-tight">Áreas (Só hoje)</span>
            <button
              type="button"
              onClick={() => openAreaModalForCreate('09:00', '11:00')}
              className="p-0.5 rounded-md hover:bg-cozy-hover text-cozy-lavender shrink-0"
              title="Adicionar área apenas para este dia"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>
        )}
        <div className="flex items-center justify-between px-2 py-1 rounded-xl bg-cozy-bg/70 border border-cozy-border text-cozy-text">
          <span className="whitespace-normal break-words leading-tight">Atividades</span>
          <button
            type="button"
            onClick={() => onDragCreate('09:00', '10:00')}
            className="p-0.5 rounded-md hover:bg-cozy-hover text-cozy-peach shrink-0"
            title="Adicionar bloco de atividade"
          >
            <Plus className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Vertical Ruler Body */}
      <div className="p-3 overflow-y-auto max-h-[720px] select-none">
        <div
          className={`grid gap-1.5 relative ${
            allowAreaAdjustment ? 'grid-cols-[44px_1fr_1fr]' : 'grid-cols-[44px_1fr]'
          }`}
          style={{ height: `${hoursList.length * hourHeight}px` }}
        >
          {/* Time labels column */}
          <div className="relative">
            {hoursList.map((hour) => (
              <div
                key={hour}
                style={{ top: `${(hour - startHour) * hourHeight}px`, height: `${hourHeight}px` }}
                className="absolute inset-x-0 pr-1.5 -mt-2 text-right text-[10px] font-bold text-cozy-subtext tabular-nums"
              >
                {String(hour).padStart(2, '0')}:00
              </div>
            ))}
          </div>

          {/* Shared Canvas Wrapper for synchronized Y coordinates & Now-Line */}
          <div
            ref={canvasRef}
            className={`relative grid gap-1.5 ${
              allowAreaAdjustment ? 'col-span-2 grid-cols-2' : 'col-span-1 grid-cols-1'
            }`}
            style={{ height: `${hoursList.length * hourHeight}px` }}
          >
            {/* Current Time Line spanning column(s) */}
            {showNowLine && (
              <div
                style={{ top: `${nowTopPx}px` }}
                className="absolute inset-x-0 z-30 pointer-events-none flex items-center"
              >
                <div className="w-2 h-2 -ml-1 rounded-full bg-cozy-peach shadow-[0_0_8px_rgba(244,162,140,0.9)]" />
                <div className="flex-1 h-[2px] bg-cozy-peach shadow-[0_0_6px_rgba(244,162,140,0.7)]" />
              </div>
            )}

            {/* LEFT COLUMN: DAY ROUTINE AREAS (Only when allowAreaAdjustment === true) */}
            {allowAreaAdjustment && (
              <div
                onMouseDown={(e) => startTrackCreateDrag('AREA', e)}
                className="relative border-l border-r border-cozy-border/70 bg-cozy-bg/20 rounded-xl cursor-crosshair overflow-hidden"
                style={{ height: `${hoursList.length * hourHeight}px` }}
              >
                {/* Subtle Hour Grid Lines */}
                {hoursList.map((hour) => (
                  <div
                    key={`a-line-${hour}`}
                    style={{
                      top: `${(hour - startHour) * hourHeight}px`,
                      height: `${hourHeight}px`,
                    }}
                    className="absolute inset-x-0 border-t border-cozy-border/40 pointer-events-none"
                  />
                ))}

                {/* Compact 8% Right-side Reserved Creation Gutter for Overlapping Areas */}
                <div
                  aria-hidden="true"
                  className="absolute right-0 inset-y-0 w-[8%] border-l border-dashed border-cozy-border/35 bg-cozy-bg/15 pointer-events-none"
                />

                {/* Drag-to-Create Preview on Left Area Track */}
                {createDrag && createDrag.target === 'AREA' && (
                  <div
                    style={{ top: `${createPreviewTop}px`, height: `${createPreviewHeight}px` }}
                    className="absolute inset-x-1 z-20 rounded-xl border-2 border-dashed border-cozy-lavender bg-cozy-lavender/15 pointer-events-none flex items-center justify-center"
                  >
                    <span className="text-[10px] font-extrabold text-cozy-lavender bg-cozy-bg/90 px-1.5 py-0.5 rounded-full shadow">
                      {minutesToTimeString(Math.min(createDrag.anchorMin, createDrag.currentMin))}–
                      {minutesToTimeString(Math.max(createDrag.anchorMin, createDrag.currentMin))}
                    </span>
                  </div>
                )}

                {/* Area Cards: Blur overlap by default vs side-by-side when isExpanded */}
                {routineAreas.map((area) => {
                  const isDraggingThis = areaDrag?.area.id === area.id;
                  const sMin = isDraggingThis
                    ? areaDrag.previewStartMin
                    : timeStringToMinutes(area.startTime);
                  const eMin = isDraggingThis
                    ? areaDrag.previewEndMin
                    : timeStringToMinutes(area.endTime);

                  const topPx = ((sMin - startHour * 60) / 60) * hourHeight;
                  const heightPx = Math.max(22, ((eMin - sMin) / 60) * hourHeight);
                  const meta = TIER_META[area.tier] || TIER_META.BACKGROUND;
                  const isCompact = heightPx < 44;
                  const slot = areaOverlapLayout[area.id] ?? {
                    colIndex: 0,
                    totalCols: 1,
                    leftCss: '2px',
                    widthCss: 'calc(92% - 4px)',
                  };

                  const leftPos = isExpanded ? slot.leftCss : '2px';
                  const widthPos = isExpanded ? slot.widthCss : 'calc(92% - 4px)';

                  return (
                    <div
                      key={area.id}
                      onMouseDown={(e) => {
                        if (e.button !== 0) return;
                        e.stopPropagation();
                        setAreaDrag({
                          mode: 'MOVE',
                          area,
                          startClientY: e.clientY,
                          origStartMin: timeStringToMinutes(area.startTime),
                          origEndMin: timeStringToMinutes(area.endTime),
                          previewStartMin: timeStringToMinutes(area.startTime),
                          previewEndMin: timeStringToMinutes(area.endTime),
                          hasMoved: false,
                        });
                      }}
                      style={{
                        top: `${topPx}px`,
                        height: `${heightPx}px`,
                        left: leftPos,
                        width: widthPos,
                      }}
                      className={`group/area absolute rounded-xl backdrop-blur-sm flex flex-col justify-between overflow-hidden cursor-grab active:cursor-grabbing z-10 transition-[left,width,box-shadow] duration-200 ${
                        meta.areaBg
                      } ${isDraggingThis ? 'ring-2 ring-cozy-peach z-30 opacity-95' : ''}`}
                    >
                      {/* Top Resize */}
                      <div
                        onMouseDown={(e) => {
                          if (e.button !== 0) return;
                          e.stopPropagation();
                          setAreaDrag({
                            mode: 'RESIZE_TOP',
                            area,
                            startClientY: e.clientY,
                            origStartMin: timeStringToMinutes(area.startTime),
                            origEndMin: timeStringToMinutes(area.endTime),
                            previewStartMin: timeStringToMinutes(area.startTime),
                            previewEndMin: timeStringToMinutes(area.endTime),
                            hasMoved: true,
                          });
                        }}
                        title="Arraste para ajustar início da área hoje"
                        className="h-2 w-full cursor-ns-resize flex items-center justify-center opacity-0 group-hover/area:opacity-100 hover:bg-white/10 shrink-0"
                      >
                        <GripHorizontal className="w-3 h-2.5 opacity-70" />
                      </div>

                      <div className="px-2 flex-1 min-h-0 flex flex-col justify-center overflow-hidden">
                        <div className="flex items-start justify-between gap-1">
                          <span className="text-[11px] font-bold whitespace-normal break-words leading-tight opacity-95">
                            {area.title}
                          </span>
                          <button
                            type="button"
                            onMouseDown={(e) => e.stopPropagation()}
                            onClick={(e) => {
                              e.stopPropagation();
                              requestConfirm(
                                'Remover Área Apenas Neste Dia?',
                                `Deseja remover "${area.title}" (${area.startTime}–${area.endTime}) apenas em ${formatDateBR(
                                  dateStr
                                )}? A Rotina semanal não será alterada.`,
                                () => deleteDayRoutineArea(dateStr, area.id)
                              );
                            }}
                            className="p-0.5 rounded text-current/60 hover:text-cozy-rose hover:bg-cozy-bg/70 opacity-0 group-hover/area:opacity-100 transition-opacity shrink-0"
                            title="Remover área apenas neste dia"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>

                        {!isCompact && (
                          <div className="flex items-center justify-between gap-1 mt-0.5 text-[9px] opacity-80 flex-wrap">
                            <span className="font-mono tabular-nums">
                              {minutesToTimeString(sMin)}–{minutesToTimeString(eMin)}
                            </span>
                            <span className="font-semibold">{meta.shortLabel}</span>
                          </div>
                        )}
                      </div>

                      {/* Bottom Resize */}
                      <div
                        onMouseDown={(e) => {
                          if (e.button !== 0) return;
                          e.stopPropagation();
                          setAreaDrag({
                            mode: 'RESIZE_BOTTOM',
                            area,
                            startClientY: e.clientY,
                            origStartMin: timeStringToMinutes(area.startTime),
                            origEndMin: timeStringToMinutes(area.endTime),
                            previewStartMin: timeStringToMinutes(area.startTime),
                            previewEndMin: timeStringToMinutes(area.endTime),
                            hasMoved: true,
                          });
                        }}
                        title="Arraste para ajustar término da área hoje"
                        className="h-2 w-full cursor-ns-resize flex items-center justify-center opacity-0 group-hover/area:opacity-100 hover:bg-white/10 shrink-0"
                      >
                        <GripHorizontal className="w-3 h-2.5 opacity-70" />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ACTIVITY BLOCKS COLUMN */}
            <div
              onMouseDown={(e) => startTrackCreateDrag('ACTIVITY', e)}
              className="relative border-l border-r border-cozy-border/70 bg-cozy-bg/35 rounded-xl cursor-crosshair overflow-hidden"
              style={{ height: `${hoursList.length * hourHeight}px` }}
            >
              {/* Subtle Hour Grid Lines */}
              {hoursList.map((hour) => (
                <div
                  key={`b-line-${hour}`}
                  style={{
                    top: `${(hour - startHour) * hourHeight}px`,
                    height: `${hourHeight}px`,
                  }}
                  className="absolute inset-x-0 border-t border-cozy-border/50 pointer-events-none"
                >
                  <div className="w-full border-t border-dashed border-cozy-border/25 mt-[50%]" />
                </div>
              ))}

              {/* Read-only Low-Opacity Background Areas on Agenda Ruler (no adjustment controls) */}
              {!allowAreaAdjustment &&
                routineAreas.map((area) => {
                  const sMin = timeStringToMinutes(area.startTime);
                  const eMin = timeStringToMinutes(area.endTime);
                  const topPx = ((sMin - startHour * 60) / 60) * hourHeight;
                  const heightPx = Math.max(22, ((eMin - sMin) / 60) * hourHeight);
                  const meta = TIER_META[area.tier] || TIER_META.BACKGROUND;
                  return (
                    <div
                      key={`bg-area-${area.id}`}
                      style={{
                        top: `${topPx}px`,
                        height: `${heightPx}px`,
                        left: '2px',
                        width: 'calc(92% - 4px)',
                      }}
                      className={`pointer-events-none absolute rounded-xl px-2 py-1 z-0 opacity-45 backdrop-blur-[1px] overflow-hidden flex flex-col justify-start ${meta.areaBg}`}
                    >
                      <span className="text-[10px] font-bold whitespace-normal break-words leading-tight">
                        {area.title}
                      </span>
                    </div>
                  );
                })}

              {/* Compact 8% Right-side Reserved Creation Gutter for Overlapping Activity Blocks */}
              <div
                aria-hidden="true"
                className="absolute right-0 inset-y-0 w-[8%] border-l border-dashed border-cozy-border/35 bg-cozy-bg/15 pointer-events-none"
              />

              {/* Drag-to-Create Preview on Activity Track */}
              {createDrag && createDrag.target === 'ACTIVITY' && (
                <div
                  style={{ top: `${createPreviewTop}px`, height: `${createPreviewHeight}px` }}
                  className="absolute inset-x-1 z-20 rounded-xl border-2 border-dashed border-cozy-peach bg-cozy-peach/20 pointer-events-none flex items-center justify-center"
                >
                  <span className="text-[10px] font-extrabold text-cozy-peach bg-cozy-bg/90 px-1.5 py-0.5 rounded-full shadow">
                    {minutesToTimeString(Math.min(createDrag.anchorMin, createDrag.currentMin))}–
                    {minutesToTimeString(Math.max(createDrag.anchorMin, createDrag.currentMin))}
                  </span>
                </div>
              )}

              {/* Scheduled Timed Activity Blocks */}
              {timedBlocks.map((block) => {
                const isDraggingThis = blockDrag?.block.id === block.id;
                const sMin = isDraggingThis
                  ? blockDrag.previewStartMin
                  : timeStringToMinutes(block.startTime);
                const eMin = isDraggingThis
                  ? blockDrag.previewEndMin
                  : timeStringToMinutes(block.endTime);

                const topPx = ((sMin - startHour * 60) / 60) * hourHeight;
                const heightPx = Math.max(24, ((eMin - sMin) / 60) * hourHeight);
                const meta = TIER_META[block.tier] || TIER_META.FOCUS;

                const linkedProgress = block.linkedProgressId
                  ? progressBars.find((p) => p.id === block.linkedProgressId)
                  : undefined;
                const linkedTask = block.linkedTaskId
                  ? tasks.find((t) => t.id === block.linkedTaskId)
                  : undefined;

                const isCompact = heightPx < 48;
                const slot = blockOverlapLayout[block.id] ?? {
                  colIndex: 0,
                  totalCols: 1,
                  leftCss: '2px',
                  widthCss: 'calc(92% - 4px)',
                };

                const leftPos = isExpanded
                  ? slot.leftCss
                  : block.layer === 1
                    ? '8px'
                    : '2px';
                const widthPos = isExpanded
                  ? slot.widthCss
                  : block.layer === 1
                    ? 'calc(92% - 10px)'
                    : 'calc(92% - 4px)';

                return (
                  <div
                    key={block.id}
                    onMouseDown={(e) => {
                      if (e.button !== 0) return;
                      e.stopPropagation();
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
                    className={`group absolute rounded-xl border backdrop-blur-sm transition-[left,width,box-shadow] duration-200 cursor-grab active:cursor-grabbing flex flex-col justify-between overflow-hidden ${
                      block.layer === 1
                        ? 'z-20 shadow-lg ring-1 ring-cozy-lavender/40'
                        : 'z-10 shadow-sm'
                    } ${meta.blockCard} ${isDraggingThis ? 'opacity-90 ring-2 ring-cozy-peach z-30' : ''}`}
                  >
                    {/* Top Resize Handle */}
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
                      title="Arraste para ajustar início"
                      className="h-2 w-full cursor-ns-resize flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-cozy-text/10 transition-opacity shrink-0"
                    >
                      <GripHorizontal className="w-3 h-2.5 text-cozy-subtext" />
                    </div>

                    {/* Block Content */}
                    <div className="px-2 flex-1 min-h-0 flex items-center justify-between gap-1 overflow-hidden">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start gap-1">
                          <span className="text-[9px] font-bold text-cozy-subtext tabular-nums shrink-0 mt-0.5">
                            {minutesToTimeString(sMin)}
                          </span>
                          <span className="text-[11px] font-extrabold text-cozy-text whitespace-normal break-words leading-tight">
                            {block.title}
                          </span>
                        </div>

                        {!isCompact && (
                          <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                            {block.obligation === 'MANDATORY' && (
                              <span className="text-[8px] font-bold px-1 rounded bg-cozy-rose/20 text-cozy-rose flex items-center gap-0.5">
                                <ShieldAlert className="w-2 h-2" />
                                Obrig.
                              </span>
                            )}
                            {linkedProgress && (
                              <span className="text-[9px] font-semibold text-cozy-sage flex items-center gap-0.5 whitespace-normal break-words">
                                <BarChart3 className="w-2.5 h-2.5 shrink-0" />
                                <span className="whitespace-normal break-words leading-tight">
                                  {linkedProgress.type === 'TIME' &&
                                  linkedProgress.spentTodaySeconds !== undefined
                                    ? formatSecondsToHuman(linkedProgress.spentTodaySeconds)
                                    : linkedProgress.title}
                                </span>
                              </span>
                            )}
                            {linkedTask && (
                              <span className="text-[9px] font-semibold text-cozy-sky flex items-center gap-0.5">
                                <CheckSquare className="w-2.5 h-2.5 shrink-0" />
                                [{linkedTask.priority}]
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Quick Actions */}
                      <div className="flex items-center gap-0.5 shrink-0">
                        {linkedProgress && linkedProgress.type === 'TIME' && (
                          <button
                            type="button"
                            onMouseDown={(e) => e.stopPropagation()}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (linkedProgress.isRunning) {
                                pauseProgress(linkedProgress.id);
                              } else {
                                playProgress(linkedProgress.id);
                              }
                            }}
                            className={`p-1 rounded-lg border transition-colors ${
                              linkedProgress.isRunning
                                ? 'bg-cozy-peach text-cozy-bg border-cozy-peach'
                                : 'bg-cozy-bg/70 text-cozy-sage border-cozy-sage/40 hover:bg-cozy-sage/20'
                            }`}
                            title={linkedProgress.isRunning ? 'Pausar' : 'Iniciar'}
                          >
                            {linkedProgress.isRunning ? (
                              <Pause className="w-2.5 h-2.5" />
                            ) : (
                              <Play className="w-2.5 h-2.5" />
                            )}
                          </button>
                        )}

                        {linkedTask && (
                          <button
                            type="button"
                            onMouseDown={(e) => e.stopPropagation()}
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleTask(linkedTask.id);
                            }}
                            className={`px-1 py-0.5 rounded-md border text-[9px] font-bold transition-colors ${
                              linkedTask.isCompleted
                                ? 'bg-cozy-sage/20 text-cozy-sage border-cozy-sage/40'
                                : 'bg-cozy-bg/70 text-cozy-sky border-cozy-sky/40'
                            }`}
                            title={linkedTask.isCompleted ? 'Concluída' : 'Marcar como concluída'}
                          >
                            ✓
                          </button>
                        )}

                        <button
                          type="button"
                          onMouseDown={(e) => e.stopPropagation()}
                          onClick={(e) => {
                            e.stopPropagation();
                            requestConfirm(
                              'Remover bloco de atividade',
                              `Deseja remover "${block.title}" (${block.startTime} - ${block.endTime}) apenas deste dia?`,
                              () => deleteEffectiveBlock(dateStr, block)
                            );
                          }}
                          className="p-1 rounded-lg bg-cozy-bg/70 border border-cozy-border text-cozy-subtext hover:text-cozy-rose hover:border-cozy-rose/40 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-all"
                          title="Remover bloco"
                        >
                          <Trash2 className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    </div>

                    {/* Bottom Resize Handle */}
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
                      title="Arraste para ajustar término"
                      className="h-2 w-full cursor-ns-resize flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-cozy-text/10 transition-opacity shrink-0"
                    >
                      <GripHorizontal className="w-3 h-2.5 text-cozy-subtext" />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Modal: Create/Edit Day-Only Routine Area */}
      {areaModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setAreaModalOpen(false)}
        >
          <div
            className="bg-cozy-card border border-cozy-border rounded-3xl p-6 max-w-md w-full shadow-2xl text-cozy-text space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-cozy-border pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-cozy-lavender/15 text-cozy-lavender border border-cozy-lavender/30">
                  Válido somente em {formatDateBR(dateStr)}
                </span>
                <h4 className="font-extrabold text-base mt-1">
                  {editingArea ? 'Ajustar Área Neste Dia' : 'Nova Área Neste Dia'}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setAreaModalOpen(false)}
                className="p-1.5 rounded-full text-cozy-subtext hover:bg-cozy-hover"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveAreaModal} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-cozy-subtext mb-1">
                  Nome da Área (Genérica)
                </label>
                <input
                  type="text"
                  value={areaTitle}
                  onChange={(e) => setAreaTitle(e.target.value)}
                  placeholder="Ex: Trabalho, Faculdade, Transporte, Leitura..."
                  className="w-full px-3.5 py-2 rounded-xl bg-cozy-bg border border-cozy-border text-sm text-cozy-text focus:outline-none focus:border-cozy-lavender"
                  required
                />
                <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                  {['Trabalho', 'Faculdade', 'Transporte', 'Estudos'].map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => setAreaTitle(chip)}
                      className="text-[10px] px-2 py-0.5 rounded-full bg-cozy-bg border border-cozy-border text-cozy-subtext hover:text-cozy-text"
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-cozy-subtext mb-1">
                    Início
                  </label>
                  <input
                    type="time"
                    value={areaStartTime}
                    onChange={(e) => setAreaStartTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-cozy-bg border border-cozy-border text-xs font-mono text-cozy-text"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-cozy-subtext mb-1">
                    Término
                  </label>
                  <input
                    type="time"
                    value={areaEndTime}
                    onChange={(e) => setAreaEndTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-cozy-bg border border-cozy-border text-xs font-mono text-cozy-text"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-cozy-subtext mb-1.5">
                  Tag de Energia da Área (compatibilidade automática)
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setAreaTier('FOCUS')}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      areaTier === 'FOCUS'
                        ? 'bg-cozy-lavender/15 border-cozy-lavender text-cozy-text'
                        : 'bg-cozy-bg border-cozy-border text-cozy-subtext'
                    }`}
                  >
                    <Brain className="w-4 h-4 text-cozy-lavender mb-1" />
                    <div className="text-[11px] font-bold">Focado</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAreaTier('TRANSIT')}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      areaTier === 'TRANSIT'
                        ? 'bg-cozy-butter/15 border-cozy-butter text-cozy-text'
                        : 'bg-cozy-bg border-cozy-border text-cozy-subtext'
                    }`}
                  >
                    <Headphones className="w-4 h-4 text-cozy-butter mb-1" />
                    <div className="text-[11px] font-bold">Baixo Foco</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAreaTier('BACKGROUND')}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      areaTier === 'BACKGROUND'
                        ? 'bg-cozy-sky/15 border-cozy-sky text-cozy-text'
                        : 'bg-cozy-bg border-cozy-border text-cozy-subtext'
                    }`}
                  >
                    <Wind className="w-4 h-4 text-cozy-sky mb-1" />
                    <div className="text-[11px] font-bold">2º Plano</div>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-cozy-subtext mb-1">
                  Obrigatoriedade
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAreaObligation('MANDATORY')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                      areaObligation === 'MANDATORY'
                        ? 'bg-cozy-rose/20 text-cozy-rose border-cozy-rose/50'
                        : 'bg-cozy-bg border-cozy-border text-cozy-subtext'
                    }`}
                  >
                    Obrigatório
                  </button>
                  <button
                    type="button"
                    onClick={() => setAreaObligation('FLEXIBLE')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                      areaObligation === 'FLEXIBLE'
                        ? 'bg-cozy-sky/20 text-cozy-sky border-cozy-sky/50'
                        : 'bg-cozy-bg border-cozy-border text-cozy-subtext'
                    }`}
                  >
                    Flexível
                  </button>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between gap-2">
                {editingArea ? (
                  <button
                    type="button"
                    onClick={() =>
                      requestConfirm(
                        'Remover Área Neste Dia?',
                        `Remover "${editingArea.title}" apenas em ${formatDateBR(dateStr)}?`,
                        () => {
                          deleteDayRoutineArea(dateStr, editingArea.id);
                          setAreaModalOpen(false);
                        }
                      )
                    }
                    className="flex items-center gap-1 px-3 py-2 rounded-full text-xs font-bold bg-cozy-rose/15 text-cozy-rose border border-cozy-rose/30"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Remover Só Hoje</span>
                  </button>
                ) : (
                  <div />
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setAreaModalOpen(false)}
                    className="px-4 py-2 rounded-full text-xs font-bold text-cozy-subtext hover:bg-cozy-hover"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-full text-xs font-extrabold bg-cozy-lavender text-cozy-bg hover:brightness-110"
                  >
                    {editingArea ? 'Salvar Só Hoje' : 'Criar Área Hoje'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
