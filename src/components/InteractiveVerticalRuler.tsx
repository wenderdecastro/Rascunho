import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useApp, getTodayDateString } from '../context/AppContext';
import { ScheduledBlock } from '../types';
import {
  minutesToTimeString,
  timeStringToMinutes,
  formatSecondsToHuman,
  formatDateBR,
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
  EyeOff,
  RotateCcw,
} from 'lucide-react';

interface InteractiveVerticalRulerProps {
  dateStr: string;
  onSelectBlock: (block: ScheduledBlock) => void;
  onDragCreate: (startTime: string, endTime: string) => void;
  hourHeight?: number;
  title?: string;
  subtitle?: string;
  headerRight?: React.ReactNode;
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

interface CreateDragState {
  anchorMin: number;
  currentMin: number;
  startClientY: number;
}

export const InteractiveVerticalRuler: React.FC<InteractiveVerticalRulerProps> = ({
  dateStr,
  onSelectBlock,
  onDragCreate,
  hourHeight = 56,
  title,
  subtitle,
  headerRight,
}) => {
  const {
    currentTimeStr,
    getEffectiveBlocksForDate,
    getRoutineAreasForDay,
    hideRoutineAreaForDate,
    restoreHiddenRoutineAreasForDate,
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
  } = useApp();

  const rulerRef = useRef<HTMLDivElement>(null);
  const [blockDrag, setBlockDrag] = useState<BlockDragState | null>(null);
  const [createDrag, setCreateDrag] = useState<CreateDragState | null>(null);

  const nowMinutes = useMemo(() => timeStringToMinutes(currentTimeStr), [currentTimeStr]);
  const todayStr = getTodayDateString();
  const isToday = dateStr === todayStr;
  const dayOfWeek = useMemo(() => new Date(dateStr + 'T12:00:00').getDay(), [dateStr]);

  const routineAreas = useMemo(
    () => getRoutineAreasForDay(dayOfWeek, dateStr),
    [getRoutineAreasForDay, dayOfWeek, dateStr]
  );

  const hiddenAreasForThisDayCount = useMemo(() => {
    const hiddenIds = dayOverrides[dateStr]?.hiddenRoutineIds || [];
    if (hiddenIds.length === 0) return 0;
    return getRoutineAreasForDay(dayOfWeek).filter((a) => hiddenIds.includes(a.id)).length;
  }, [dayOverrides, dateStr, getRoutineAreasForDay, dayOfWeek]);

  const blocks = useMemo(
    () => getEffectiveBlocksForDate(dateStr),
    [getEffectiveBlocksForDate, dateStr]
  );
  const dayBounds = useMemo(() => getDayBoundsForDate(dateStr), [getDayBoundsForDate, dateStr]);

  // Expand hour window cleanly to always show all scheduled blocks + current hour indicator
  const { startHour, endHour } = useMemo(() => {
    let minH = dayBounds.startHour;
    let maxH = dayBounds.endHour;
    blocks.forEach((b) => {
      minH = Math.min(minH, Math.floor(timeStringToMinutes(b.startTime) / 60));
      maxH = Math.max(maxH, Math.ceil(timeStringToMinutes(b.endTime) / 60));
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
  }, [dayBounds, blocks, isToday, nowMinutes]);

  const hoursList = useMemo(
    () => Array.from({ length: endHour - startHour }, (_, idx) => startHour + idx),
    [startHour, endHour]
  );

  const clientYToSnappedMinutes = (clientY: number) => {
    if (!rulerRef.current) return startHour * 60;
    const rect = rulerRef.current.getBoundingClientRect();
    const relY = Math.max(0, Math.min(rect.height, clientY - rect.top));
    const totalMins = startHour * 60 + (relY / hourHeight) * 60;
    const snapped = Math.round(totalMins / 15) * 15;
    return Math.max(startHour * 60, Math.min(endHour * 60, snapped));
  };

  // Store live drag states and callbacks in refs so window listeners bind only once per drag
  const createDragRef = useRef<CreateDragState | null>(null);
  const blockDragRef = useRef<BlockDragState | null>(null);
  createDragRef.current = createDrag;
  blockDragRef.current = blockDrag;

  const dragCallbacksRef = useRef({
    onSelectBlock,
    onDragCreate,
    updateEffectiveBlock,
    clientYToSnappedMinutes,
  });
  dragCallbacksRef.current = {
    onSelectBlock,
    onDragCreate,
    updateEffectiveBlock,
    clientYToSnappedMinutes,
  };

  const isDragging = createDrag !== null || blockDrag !== null;

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (ev: MouseEvent) => {
      const cDrag = createDragRef.current;
      if (cDrag) {
        const currentMin = dragCallbacksRef.current.clientYToSnappedMinutes(ev.clientY);
        setCreateDrag((prev) => (prev ? { ...prev, currentMin } : null));
      }

      const bDrag = blockDragRef.current;
      if (bDrag) {
        const deltaPx = ev.clientY - bDrag.startClientY;
        const hasMoved = bDrag.hasMoved || Math.abs(deltaPx) > 4;
        const rawDeltaMins = (deltaPx / hourHeight) * 60;
        const deltaMins = Math.round(rawDeltaMins / 15) * 15;

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
          const clickEnd = Math.min(endHour * 60, cDrag.anchorMin + 60);
          if (clickEnd - cDrag.anchorMin >= 15) {
            dragCallbacksRef.current.onDragCreate(
              minutesToTimeString(cDrag.anchorMin),
              minutesToTimeString(clickEnd)
            );
          }
        } else if (e - s >= 15) {
          dragCallbacksRef.current.onDragCreate(minutesToTimeString(s), minutesToTimeString(e));
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
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, startHour, endHour, hourHeight, dateStr]);

  const handleRulerMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const anchorMin = clientYToSnappedMinutes(e.clientY);
    setCreateDrag({
      anchorMin,
      currentMin: Math.min(endHour * 60, anchorMin + 30),
      startClientY: e.clientY,
    });
  };

  const getTierStyle = (tier: ScheduledBlock['tier']) => {
    switch (tier) {
      case 'FOCUS':
        return {
          card: 'bg-cozy-lavender/15 border-cozy-lavender/50 hover:border-cozy-lavender',
          pill: 'bg-cozy-lavender/20 text-cozy-lavender',
          label: '🧠 Focado',
        };
      case 'TRANSIT':
        return {
          card: 'bg-cozy-butter/15 border-cozy-butter/50 hover:border-cozy-butter',
          pill: 'bg-cozy-butter/20 text-cozy-butter',
          label: '🎧 Baixo Foco',
        };
      case 'BACKGROUND':
        return {
          card: 'bg-cozy-sky/15 border-cozy-sky/50 hover:border-cozy-sky',
          pill: 'bg-cozy-sky/20 text-cozy-sky',
          label: '🫧 2º Plano',
        };
      case 'REST':
        return {
          card: 'bg-cozy-sage/15 border-cozy-sage/50 hover:border-cozy-sage',
          pill: 'bg-cozy-sage/20 text-cozy-sage',
          label: '☁️ Descanso',
        };
    }
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
        <div className="px-5 py-4 border-b border-cozy-border flex flex-wrap items-center justify-between gap-3 bg-cozy-bg/40">
          <div>
            {title && (
              <h3 className="text-base font-extrabold text-cozy-text flex items-center gap-2">
                <Clock className="w-4 h-4 text-cozy-peach" />
                <span>{title}</span>
              </h3>
            )}
            {subtitle && <p className="text-xs text-cozy-subtext mt-0.5">{subtitle}</p>}
          </div>
          {headerRight && <div className="flex items-center gap-2">{headerRight}</div>}
        </div>
      )}

      {/* Drag instruction hint & Restore hidden areas action */}
      <div className="px-5 py-2 bg-cozy-bg/30 border-b border-cozy-border/60 flex flex-wrap items-center justify-between gap-2 text-[11px] text-cozy-subtext">
        <span className="flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-cozy-lavender shrink-0" />
          <span>Arraste para criar • Bordas redimensionam • Clique ou use a lixeira no bloco</span>
        </span>
        <div className="flex items-center gap-2 ml-auto">
          {hiddenAreasForThisDayCount > 0 && (
            <button
              type="button"
              onClick={() => restoreHiddenRoutineAreasForDate(dateStr)}
              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-cozy-lavender/15 text-cozy-lavender border border-cozy-lavender/30 text-[10px] font-bold hover:bg-cozy-lavender/25 transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Restaurar áreas ocultas ({hiddenAreasForThisDayCount})</span>
            </button>
          )}
          {isToday && (
            <span className="font-bold text-cozy-peach tabular-nums">
              Agora: {minutesToTimeString(nowMinutes)}
            </span>
          )}
        </div>
      </div>

      {/* Vertical Ruler Body */}
      <div className="p-4 overflow-y-auto max-h-[760px] select-none">
        <div className="flex relative" style={{ height: `${hoursList.length * hourHeight}px` }}>
          {/* Time labels column */}
          <div className="w-14 shrink-0 relative">
            {hoursList.map((hour) => (
              <div
                key={hour}
                style={{ top: `${(hour - startHour) * hourHeight}px`, height: `${hourHeight}px` }}
                className="absolute left-0 right-2 -mt-2 text-right text-[11px] font-bold text-cozy-subtext tabular-nums"
              >
                {String(hour).padStart(2, '0')}:00
              </div>
            ))}
          </div>

          {/* Interactive Track Canvas */}
          <div
            ref={rulerRef}
            onMouseDown={handleRulerMouseDown}
            className="flex-1 relative border-l border-cozy-border/80 bg-cozy-bg/25 rounded-r-2xl cursor-crosshair"
            style={{ height: `${hoursList.length * hourHeight}px` }}
          >
            {/* Hour & half-hour grid lines + subtle LIVRE cue */}
            {hoursList.map((hour) => (
              <div
                key={hour}
                style={{
                  top: `${(hour - startHour) * hourHeight}px`,
                  height: `${hourHeight}px`,
                }}
                className="absolute left-0 right-0 border-t border-cozy-border/50 pointer-events-none"
              >
                <div className="w-full border-t border-dashed border-cozy-border/25 mt-[50%]" />
                <span className="absolute right-3 top-1.5 text-[10px] font-bold tracking-widest uppercase text-cozy-sage/20">
                  Livre
                </span>
              </div>
            ))}

            {/* Background Routine Context Areas (Partes do Dia) */}
            {routineAreas.map((area) => {
              const aStart = timeStringToMinutes(area.startTime);
              const aEnd = timeStringToMinutes(area.endTime);
              const topPx = ((aStart - startHour * 60) / 60) * hourHeight;
              const heightPx = Math.max(24, ((aEnd - aStart) / 60) * hourHeight);
              const areaType = area.areaType || 'CUSTOM';

              let bgStyle = 'bg-cozy-sky/[0.08] border-cozy-sky/30 text-cozy-sky';
              let icon = '💼';
              let badgeLabel = 'Área de Trabalho';
              if (areaType === 'COLLEGE') {
                bgStyle = 'bg-cozy-lavender/[0.08] border-cozy-lavender/30 text-cozy-lavender';
                icon = '🎓';
                badgeLabel = 'Área de Faculdade';
              } else if (areaType === 'COMMUTE') {
                bgStyle = 'bg-cozy-butter/[0.08] border-cozy-butter/30 text-cozy-butter';
                icon = '🚌';
                badgeLabel = 'Área de Transporte';
              } else if (areaType === 'CUSTOM') {
                bgStyle = 'bg-cozy-sage/[0.08] border-cozy-sage/30 text-cozy-sage';
                icon = '🌿';
                badgeLabel = area.title;
              }

              return (
                <div
                  key={area.id}
                  style={{ top: `${topPx}px`, height: `${heightPx}px` }}
                  className={`group/area absolute inset-x-0 border-t border-b border-dashed flex flex-col justify-between p-2 pointer-events-none z-0 ${bgStyle}`}
                >
                  <div className="flex items-center justify-between gap-2 text-[10px] font-extrabold uppercase tracking-wider opacity-75">
                    <span className="truncate">
                      {icon} {area.title}
                    </span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="font-mono text-[9px]">
                        {area.startTime}–{area.endTime}
                      </span>
                      <button
                        type="button"
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation();
                          requestConfirm(
                            'Ocultar Área Apenas Hoje?',
                            `Deseja ocultar "${area.title}" (${area.startTime}–${area.endTime}) apenas em ${formatDateBR(
                              dateStr
                            )}? Sua Rotina semanal permanecerá intacta.`,
                            () => hideRoutineAreaForDate(dateStr, area.id)
                          );
                        }}
                        className="pointer-events-auto inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-cozy-bg/85 border border-current/25 text-[9px] font-bold normal-case tracking-normal opacity-60 group-hover/area:opacity-100 hover:bg-cozy-rose/20 hover:text-cozy-rose hover:border-cozy-rose/40 transition-all"
                        title="Ocultar esta área da rotina apenas neste dia"
                      >
                        <EyeOff className="w-2.5 h-2.5" />
                        <span className="hidden sm:inline">Ocultar hoje</span>
                      </button>
                    </div>
                  </div>
                  <span className="text-[9px] uppercase tracking-widest opacity-35 text-right font-bold">
                    {badgeLabel}
                  </span>
                </div>
              );
            })}

            {/* Current Time Indicator Line */}
            {showNowLine && (
              <div
                style={{ top: `${nowTopPx}px` }}
                className="absolute left-0 right-0 z-30 pointer-events-none flex items-center"
              >
                <div className="w-2.5 h-2.5 -ml-1.5 rounded-full bg-cozy-peach shadow-[0_0_8px_rgba(244,162,140,0.9)]" />
                <div className="flex-1 h-[2px] bg-cozy-peach shadow-[0_0_6px_rgba(244,162,140,0.7)]" />
                <span className="px-1.5 py-0.5 rounded bg-cozy-peach text-cozy-bg text-[10px] font-extrabold tabular-nums mr-2 shadow">
                  {minutesToTimeString(nowMinutes)}
                </span>
              </div>
            )}

            {/* Drag-to-Create Preview */}
            {createDrag && (
              <div
                style={{
                  top: `${createPreviewTop}px`,
                  height: `${createPreviewHeight}px`,
                }}
                className="absolute left-2 right-2 z-20 rounded-2xl border-2 border-dashed border-cozy-peach bg-cozy-peach/20 pointer-events-none flex items-center justify-center"
              >
                <span className="text-xs font-extrabold text-cozy-peach bg-cozy-bg/90 px-2.5 py-1 rounded-full shadow">
                  {minutesToTimeString(Math.min(createDrag.anchorMin, createDrag.currentMin))} -{' '}
                  {minutesToTimeString(Math.max(createDrag.anchorMin, createDrag.currentMin))}
                </span>
              </div>
            )}

            {/* Scheduled Blocks */}
            {blocks.map((block) => {
              const isDraggingThis = blockDrag?.block.id === block.id;
              const sMin = isDraggingThis
                ? blockDrag.previewStartMin
                : timeStringToMinutes(block.startTime);
              const eMin = isDraggingThis
                ? blockDrag.previewEndMin
                : timeStringToMinutes(block.endTime);

              const topPx = ((sMin - startHour * 60) / 60) * hourHeight;
              const heightPx = Math.max(22, ((eMin - sMin) / 60) * hourHeight);
              const style = getTierStyle(block.tier);

              const linkedProgress = block.linkedProgressId
                ? progressBars.find((p) => p.id === block.linkedProgressId)
                : undefined;
              const linkedTask = block.linkedTaskId
                ? tasks.find((t) => t.id === block.linkedTaskId)
                : undefined;

              const isCompact = heightPx < 46;

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
                  }}
                  className={`group absolute rounded-2xl border backdrop-blur-sm transition-shadow cursor-grab active:cursor-grabbing flex flex-col justify-between overflow-hidden ${
                    block.layer === 1
                      ? 'left-[36%] right-2 z-20 shadow-lg ring-1 ring-cozy-lavender/40'
                      : 'left-2 right-2 z-10 shadow-sm'
                  } ${style.card} ${isDraggingThis ? 'opacity-90 ring-2 ring-cozy-peach z-30' : ''}`}
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
                    className="h-2.5 w-full cursor-ns-resize flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-cozy-text/10 transition-opacity shrink-0"
                  >
                    <GripHorizontal className="w-3.5 h-3 text-cozy-subtext" />
                  </div>

                  {/* Block Content */}
                  <div className="px-3 flex-1 min-h-0 flex items-center justify-between gap-2 overflow-hidden">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] font-bold text-cozy-subtext tabular-nums shrink-0">
                          {minutesToTimeString(sMin)}–{minutesToTimeString(eMin)}
                        </span>
                        <span className="text-xs font-extrabold text-cozy-text truncate">
                          {block.title}
                        </span>
                        {block.obligation === 'MANDATORY' && (
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-cozy-rose/20 text-cozy-rose border border-cozy-rose/30 flex items-center gap-0.5 shrink-0">
                            <ShieldAlert className="w-2.5 h-2.5" />
                            Obrigatório
                          </span>
                        )}
                        {block.routineOriginId && (
                          <span className="text-[9px] font-semibold px-1.5 rounded bg-cozy-bg/60 text-cozy-subtext shrink-0">
                            Rotina
                          </span>
                        )}
                      </div>

                      {!isCompact && (
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${style.pill}`}
                          >
                            {style.label}
                          </span>
                          {linkedProgress && (
                            <span className="text-[10px] font-semibold text-cozy-sage flex items-center gap-1">
                              <BarChart3 className="w-3 h-3" />
                              {linkedProgress.title}
                              {linkedProgress.type === 'TIME' &&
                                linkedProgress.spentTodaySeconds !== undefined &&
                                ` (${formatSecondsToHuman(linkedProgress.spentTodaySeconds)} hoje)`}
                            </span>
                          )}
                          {linkedTask && (
                            <span className="text-[10px] font-semibold text-cozy-sky flex items-center gap-1">
                              <CheckSquare className="w-3 h-3" />
                              [{linkedTask.priority}]
                              {linkedTask.subitems && linkedTask.subitems.length > 0
                                ? ` ${linkedTask.subitems.filter((i) => i.isCompleted).length}/${
                                    linkedTask.subitems.length
                                  } subitens`
                                : linkedTask.isCompleted
                                  ? ' Concluída'
                                  : ' Pendente'}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Quick Actions inside Block */}
                    <div className="flex items-center gap-1 shrink-0">
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
                          className={`p-1.5 rounded-xl border transition-colors ${
                            linkedProgress.isRunning
                              ? 'bg-cozy-peach text-cozy-bg border-cozy-peach'
                              : 'bg-cozy-bg/70 text-cozy-sage border-cozy-sage/40 hover:bg-cozy-sage/20'
                          }`}
                          title={linkedProgress.isRunning ? 'Pausar progresso' : 'Iniciar progresso'}
                        >
                          {linkedProgress.isRunning ? (
                            <Pause className="w-3.5 h-3.5" />
                          ) : (
                            <Play className="w-3.5 h-3.5" />
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
                          className={`px-2 py-1 rounded-lg border text-[10px] font-bold transition-colors ${
                            linkedTask.isCompleted
                              ? 'bg-cozy-sage/20 text-cozy-sage border-cozy-sage/40'
                              : 'bg-cozy-bg/70 text-cozy-sky border-cozy-sky/40 hover:bg-cozy-sky/20'
                          }`}
                        >
                          {linkedTask.isCompleted ? '✓ Feita' : 'Concluir'}
                        </button>
                      )}

                      <button
                        type="button"
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation();
                          requestConfirm(
                            'Remover bloco do dia',
                            `Deseja remover "${block.title}" (${block.startTime} - ${block.endTime}) apenas deste dia?`,
                            () => deleteEffectiveBlock(dateStr, block)
                          );
                        }}
                        className="p-1.5 rounded-xl bg-cozy-bg/70 border border-cozy-border text-cozy-subtext hover:text-cozy-rose hover:border-cozy-rose/40 hover:bg-cozy-rose/15 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-all"
                        title="Remover bloco deste dia"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
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
                    className="h-2.5 w-full cursor-ns-resize flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-cozy-text/10 transition-opacity shrink-0"
                  >
                    <GripHorizontal className="w-3.5 h-3 text-cozy-subtext" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
