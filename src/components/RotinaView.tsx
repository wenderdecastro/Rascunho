import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useApp, inferAreaType } from '../context/AppContext';
import { RoutineBlock, RoutineAreaType, EnergyTier, Obligation } from '../types';
import {
  timeStringToMinutes,
  minutesToTimeString,
  formatSecondsToHuman,
} from '../utils/helpers';
import { Plus, Trash2, X, Clock, GripHorizontal, Sparkles } from 'lucide-react';

const DAYS_OF_WEEK = [
  { name: 'Segunda', id: 1 },
  { name: 'Terça', id: 2 },
  { name: 'Quarta', id: 3 },
  { name: 'Quinta', id: 4 },
  { name: 'Sexta', id: 5 },
  { name: 'Sábado', id: 6 },
  { name: 'Domingo', id: 0 },
];

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
    addRoutineBlock,
    updateRoutineBlock,
    deleteRoutineBlock,
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

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingBlock, setEditingBlock] = useState<RoutineBlock | null>(null);
  const [formDay, setFormDay] = useState<number>(1);
  const [title, setTitle] = useState('');
  const [areaType, setAreaType] = useState<RoutineAreaType>('WORK');
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('10:00');
  const [tier, setTier] = useState<EnergyTier>('FOCUS');
  const [obligation, setObligation] = useState<Obligation>('MANDATORY');

  const clientYToSnappedMinutes = (dayId: number, clientY: number) => {
    const el = columnRefs.current[dayId];
    if (!el) return startHour * 60;
    const rect = el.getBoundingClientRect();
    const relY = Math.max(0, Math.min(rect.height, clientY - rect.top));
    const totalMins = startHour * 60 + (relY / HOUR_HEIGHT) * 60;
    const snapped = Math.round(totalMins / 15) * 15;
    return Math.max(startHour * 60, Math.min(endHour * 60, snapped));
  };

  const openCreateModal = (dayId: number, sTime = '08:00', eTime = '10:00') => {
    setEditingBlock(null);
    setFormDay(dayId);
    setTitle('Trabalho');
    setAreaType('WORK');
    setStartTime(sTime);
    setEndTime(eTime);
    setTier('FOCUS');
    setObligation('MANDATORY');
    setShowModal(true);
  };

  const openEditModal = (block: RoutineBlock) => {
    setEditingBlock(block);
    setFormDay(block.dayOfWeek);
    setTitle(block.title);
    setAreaType(block.areaType || inferAreaType(block.title, block.tier));
    setStartTime(block.startTime);
    setEndTime(block.endTime);
    setTier(block.tier);
    setObligation(block.obligation);
    setShowModal(true);
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
          ev.clientY
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
      .filter((b) => b.dayOfWeek === dayOfWeek)
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

    const colorMap: Record<RoutineAreaType, string> = {
      WORK: '#9AD4EE',
      COLLEGE: '#B49BFA',
      COMMUTE: '#F3D08E',
      CUSTOM: '#8DE2BA',
    };

    if (editingBlock) {
      updateRoutineBlock(editingBlock.id, {
        title: title.trim(),
        dayOfWeek: formDay,
        startTime,
        endTime,
        tier,
        obligation,
        areaType,
        color: colorMap[areaType] || '#B49BFA',
      });
    } else {
      addRoutineBlock({
        title: title.trim(),
        dayOfWeek: formDay,
        startTime,
        endTime,
        tier,
        obligation,
        areaType,
        color: colorMap[areaType] || '#B49BFA',
      });
    }

    setShowModal(false);
  };

  const getRoutineAreaStyle = (block: RoutineBlock) => {
    const type = block.areaType || inferAreaType(block.title, block.tier);
    switch (type) {
      case 'WORK':
        return {
          container:
            'bg-cozy-sky/[0.12] border-2 border-dashed border-cozy-sky/50 text-cozy-sky hover:bg-cozy-sky/[0.18]',
          badge: 'bg-cozy-sky/20 text-cozy-sky',
          icon: '💼',
          label: 'Área de Trabalho',
          sub: 'Elegível p/ tarefas de trabalho',
        };
      case 'COLLEGE':
        return {
          container:
            'bg-cozy-lavender/[0.12] border-2 border-dashed border-cozy-lavender/50 text-cozy-lavender hover:bg-cozy-lavender/[0.18]',
          badge: 'bg-cozy-lavender/20 text-cozy-lavender',
          icon: '🎓',
          label: 'Área de Faculdade',
          sub: 'Elegível p/ faculdade/estudos',
        };
      case 'COMMUTE':
        return {
          container:
            'bg-cozy-butter/[0.12] border-2 border-dashed border-cozy-butter/50 text-cozy-butter hover:bg-cozy-butter/[0.18]',
          badge: 'bg-cozy-butter/20 text-cozy-butter',
          icon: '🚌',
          label: 'Área de Transporte',
          sub: 'Elegível p/ deslocamento',
        };
      case 'CUSTOM':
      default:
        return {
          container:
            'bg-cozy-sage/[0.12] border-2 border-dashed border-cozy-sage/50 text-cozy-sage hover:bg-cozy-sage/[0.18]',
          badge: 'bg-cozy-sage/20 text-cozy-sage',
          icon: '🌿',
          label: 'Área Livre / Outra',
          sub: 'Área personalizada',
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
              Configure áreas como Trabalho, Faculdade e Transporte. Suas tarefas serão distribuídas automaticamente nelas.
            </span>
            <span>•</span>
            <span className="text-cozy-sage">Fundo verde = Tempo Livre</span>
          </p>
        </div>

        <button
          onClick={() => openCreateModal(1, '08:00', '10:00')}
          className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-cozy-lavender text-cozy-bg font-extrabold text-xs hover:brightness-110 transition-all shadow-cozy-pill self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Nova Área do Dia</span>
        </button>
      </div>

      {/* 7 Simultaneous Vertical Rulers Grid */}
      <div className="bg-cozy-card rounded-3xl p-6 border border-cozy-border shadow-cozy overflow-x-auto">
        <div className="min-w-[1160px]">
          {/* Days Header */}
          <div className="grid grid-cols-[65px_repeat(7,1fr)] gap-3 pb-3 border-b border-cozy-border text-center text-xs font-bold text-cozy-text">
            <div className="text-cozy-subtext flex flex-col items-center justify-center">
              <Clock className="w-4 h-4 mb-0.5" />
              <span className="text-[10px] font-mono text-cozy-peach">
                {minutesToTimeString(nowMinutes)}
              </span>
            </div>
            {DAYS_OF_WEEK.map((d) => {
              const blocksCount = routineBlocks.filter((b) => b.dayOfWeek === d.id).length;
              const isTodayCol = d.id === currentDayOfWeek;
              return (
                <div
                  key={d.id}
                  className={`p-2.5 rounded-2xl border ${
                    isTodayCol
                      ? 'bg-cozy-peach/10 border-cozy-peach/50'
                      : 'bg-cozy-bg border-cozy-border'
                  }`}
                >
                  <div className="text-sm font-extrabold flex items-center justify-center gap-1.5">
                    <span>{d.name}</span>
                    {isTodayCol && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-cozy-peach text-cozy-bg font-extrabold">
                        HOJE
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] font-medium text-cozy-subtext">
                    {blocksCount} compromissos
                  </div>
                </div>
              );
            })}
          </div>

          {/* Vertical Timelines */}
          <div className="grid grid-cols-[65px_repeat(7,1fr)] gap-3 mt-3 relative select-none">
            {/* Left Hour Axis */}
            <div
              className="relative text-xs font-mono font-bold text-cozy-subtext text-right pr-2"
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
              const dayBlocks = routineBlocks.filter((b) => b.dayOfWeek === d.id);
              const freeWindows = getDayFreeWindows(d.id);
              const isTodayCol = d.id === currentDayOfWeek;

              return (
                <div
                  key={d.id}
                  ref={(el) => {
                    columnRefs.current[d.id] = el;
                  }}
                  onMouseDown={(e) => {
                    if (e.button !== 0) return;
                    const anchorMin = clientYToSnappedMinutes(d.id, e.clientY);
                    setCreateDrag({
                      dayId: d.id,
                      anchorMin,
                      currentMin: Math.min(endHour * 60, anchorMin + 30),
                      startClientY: e.clientY,
                    });
                  }}
                  className={`relative rounded-2xl bg-cozy-bg border overflow-hidden cursor-crosshair ${
                    isTodayCol ? 'border-cozy-peach/40' : 'border-cozy-border'
                  }`}
                  style={{ height: `${hoursList.length * HOUR_HEIGHT}px` }}
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

                  {/* Routine Areas (drag body to move, drag edges to resize, click to edit) */}
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
                        style={{ top: `${topPx}px`, height: `${heightPx}px` }}
                        className={`group absolute inset-x-1 rounded-xl backdrop-blur-sm transition-shadow cursor-grab active:cursor-grabbing flex flex-col justify-between overflow-hidden z-10 ${style.container} ${
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
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-[11px] font-extrabold truncate leading-tight flex items-center gap-1">
                              <span>{style.icon}</span>
                              <span className="truncate">{block.title}</span>
                            </span>
                            <button
                              type="button"
                              onMouseDown={(e) => e.stopPropagation()}
                              onClick={(e) => {
                                e.stopPropagation();
                                requestConfirm(
                                  'Excluir da Rotina Semanal',
                                  `Remover a área "${block.title}" de todas as ${
                                    DAYS_OF_WEEK.find((dw) => dw.id === block.dayOfWeek)?.name || ''
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
                          <div className="flex items-center justify-between gap-1 mt-0.5">
                            <span className="text-[9px] font-mono text-cozy-subtext truncate">
                              {minutesToTimeString(sMin)}–{minutesToTimeString(eMin)}
                            </span>
                            {heightPx > 42 && (
                              <span className={`text-[9px] font-bold px-1 rounded ${style.badge}`}>
                                {style.label}
                              </span>
                            )}
                          </div>
                          {heightPx > 58 && (
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

      {/* Modal: Criar / Editar Bloco Fixo */}
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
                <label className="block text-xs font-bold mb-1.5">Tipo de Área (Contexto)</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setAreaType('WORK');
                      if (!title || title === 'Faculdade' || title === 'Transporte' || title === 'Tempo Livre / Pessoal') {
                        setTitle('Trabalho');
                      }
                      setTier('FOCUS');
                    }}
                    className={`p-2.5 rounded-xl text-xs font-bold border flex items-center gap-2 transition-all ${
                      areaType === 'WORK'
                        ? 'bg-cozy-sky/20 text-cozy-sky border-cozy-sky'
                        : 'border-cozy-border bg-cozy-bg text-cozy-subtext hover:border-cozy-sky/40'
                    }`}
                  >
                    <span className="text-base">💼</span>
                    <div className="text-left">
                      <div className="font-extrabold">Trabalho</div>
                      <div className="text-[10px] opacity-75 font-normal">Tarefas de trabalho</div>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAreaType('COLLEGE');
                      if (!title || title === 'Trabalho' || title === 'Transporte' || title === 'Tempo Livre / Pessoal') {
                        setTitle('Faculdade');
                      }
                      setTier('FOCUS');
                    }}
                    className={`p-2.5 rounded-xl text-xs font-bold border flex items-center gap-2 transition-all ${
                      areaType === 'COLLEGE'
                        ? 'bg-cozy-lavender/20 text-cozy-lavender border-cozy-lavender'
                        : 'border-cozy-border bg-cozy-bg text-cozy-subtext hover:border-cozy-lavender/40'
                    }`}
                  >
                    <span className="text-base">🎓</span>
                    <div className="text-left">
                      <div className="font-extrabold">Faculdade</div>
                      <div className="text-[10px] opacity-75 font-normal">Estudos & Aulas</div>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAreaType('COMMUTE');
                      if (!title || title === 'Trabalho' || title === 'Faculdade' || title === 'Tempo Livre / Pessoal') {
                        setTitle('Transporte');
                      }
                      setTier('TRANSIT');
                    }}
                    className={`p-2.5 rounded-xl text-xs font-bold border flex items-center gap-2 transition-all ${
                      areaType === 'COMMUTE'
                        ? 'bg-cozy-butter/20 text-cozy-butter border-cozy-butter'
                        : 'border-cozy-border bg-cozy-bg text-cozy-subtext hover:border-cozy-butter/40'
                    }`}
                  >
                    <span className="text-base">🚌</span>
                    <div className="text-left">
                      <div className="font-extrabold">Transporte</div>
                      <div className="text-[10px] opacity-75 font-normal">Trânsito / Baixo foco</div>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAreaType('CUSTOM');
                      if (!title || title === 'Trabalho' || title === 'Faculdade' || title === 'Transporte') {
                        setTitle('Tempo Livre / Pessoal');
                      }
                    }}
                    className={`p-2.5 rounded-xl text-xs font-bold border flex items-center gap-2 transition-all ${
                      areaType === 'CUSTOM'
                        ? 'bg-cozy-sage/20 text-cozy-sage border-cozy-sage'
                        : 'border-cozy-border bg-cozy-bg text-cozy-subtext hover:border-cozy-sage/40'
                    }`}
                  >
                    <span className="text-base">🌿</span>
                    <div className="text-left">
                      <div className="font-extrabold">Outra / Livre</div>
                      <div className="text-[10px] opacity-75 font-normal">Personalizada</div>
                    </div>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold mb-1">Dia da Semana</label>
                <select
                  value={formDay}
                  onChange={(e) => setFormDay(Number(e.target.value))}
                  className="w-full px-4 py-2 rounded-2xl border border-cozy-border bg-cozy-bg text-xs font-bold text-cozy-text"
                >
                  {DAYS_OF_WEEK.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold mb-1">Nome da Área</label>
                <input
                  type="text"
                  placeholder="Ex: Turno Trabalho, Aulas Noturnas, Deslocamento..."
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-4 py-2 rounded-2xl border border-cozy-border bg-cozy-bg text-sm focus:outline-none focus:ring-2 focus:ring-cozy-lavender text-cozy-text"
                  required
                />
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
                <label className="block text-xs font-bold mb-1.5">Tag de Atenção / Energia</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setTier('FOCUS')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
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
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                      tier === 'TRANSIT'
                        ? 'bg-cozy-butter/20 text-cozy-butter border-cozy-butter'
                        : 'border-cozy-border bg-cozy-bg text-cozy-subtext'
                    }`}
                  >
                    🟡 Baixo Foco
                  </button>
                  <button
                    type="button"
                    onClick={() => setTier('BACKGROUND')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                      tier === 'BACKGROUND'
                        ? 'bg-cozy-sky/20 text-cozy-sky border-cozy-sky'
                        : 'border-cozy-border bg-cozy-bg text-cozy-subtext'
                    }`}
                  >
                    🫧 Segundo Plano
                  </button>
                  <button
                    type="button"
                    onClick={() => setTier('REST')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                      tier === 'REST'
                        ? 'bg-cozy-sage/20 text-cozy-sage border-cozy-sage'
                        : 'border-cozy-border bg-cozy-bg text-cozy-subtext'
                    }`}
                  >
                    ☁️ Repouso
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
                        `Remover "${editingBlock.title}" de todas as ${
                          DAYS_OF_WEEK.find((dw) => dw.id === editingBlock.dayOfWeek)?.name || ''
                        }s?`,
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
    </div>
  );
};
