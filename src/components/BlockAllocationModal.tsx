import React, { useState, useEffect, useMemo } from 'react';
import { useApp, PRIORITY_WEIGHT } from '../context/AppContext';
import {
  BlockAllocatedItem,
  EnergyTier,
  Obligation,
  Priority,
  RecurrenceFrequency,
  RecurrenceRule,
  ScheduledBlock,
  TaskSubItem,
} from '../types';
import {
  formatSecondsToHuman,
  timeStringToMinutes,
  formatDateBR,
  expandRecurrenceDates,
  getBlockAllocatedItems,
} from '../utils/helpers';
import {
  X,
  BarChart3,
  CheckSquare,
  Plus,
  Trash2,
  ShieldAlert,
  Sparkles,
  Check,
  Repeat,
  Lock,
  Clock,
  ArrowUp,
  ArrowDown,
  ListOrdered,
} from 'lucide-react';

interface BlockAllocationModalProps {
  isOpen: boolean;
  date: string;
  initialStartTime: string;
  initialEndTime: string;
  initialTab?: SelectorTab;
  editingBlock?: ScheduledBlock | null;
  onClose: () => void;
}

type SelectorTab = 'PROGRESS' | 'TASK';

const WEEKDAY_LABELS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

const TIER_INFO: Record<EnergyTier, { label: string; icon: string; badgeCls: string }> = {
  FOCUS: {
    label: 'Focado',
    icon: '🧠',
    badgeCls: 'bg-cozy-lavender/15 text-cozy-lavender border-cozy-lavender/30',
  },
  TRANSIT: {
    label: 'Baixo Foco',
    icon: '🎧',
    badgeCls: 'bg-cozy-butter/15 text-cozy-butter border-cozy-butter/30',
  },
  BACKGROUND: {
    label: 'Segundo Plano',
    icon: '🫧',
    badgeCls: 'bg-cozy-sky/15 text-cozy-sky border-cozy-sky/30',
  },
};

export const BlockAllocationModal: React.FC<BlockAllocationModalProps> = ({
  isOpen,
  date,
  initialStartTime,
  initialEndTime,
  initialTab,
  editingBlock,
  onClose,
}) => {
  const {
    progressBars,
    tasks,
    getRoutineAreasForDay,
    addScheduledBlock,
    updateEffectiveBlock,
    deleteEffectiveBlock,
    updateProgressBar,
    addTask,
    updateTask,
    deleteTask,
    toggleTaskSubitem,
    requestConfirm,
    showToast,
  } = useApp();

  // Left section: Main block configurations
  const [blockTitle, setBlockTitle] = useState<string>('');
  const [hasSpecificTime, setHasSpecificTime] = useState<boolean>(true);
  const [startTime, setStartTime] = useState(initialStartTime);
  const [endTime, setEndTime] = useState(initialEndTime);
  const [obligation, setObligation] = useState<Obligation>('FLEXIBLE');
  const [blockTier, setBlockTier] = useState<EnergyTier>('FOCUS');

  // Recurrence (new blocks only)
  const [recFrequency, setRecFrequency] = useState<RecurrenceFrequency>('NONE');
  const [recInterval, setRecInterval] = useState<number>(1);
  const [recDaysOfWeek, setRecDaysOfWeek] = useState<number[]>([]);
  const [recEndType, setRecEndType] = useState<'NEVER' | 'ON_DATE' | 'AFTER_OCCURRENCES'>('NEVER');
  const [recEndDate, setRecEndDate] = useState<string>('');
  const [recOccurrences, setRecOccurrences] = useState<number>(8);

  // Right section: Ordered allocated items + multi-select catalog
  const [allocatedItems, setAllocatedItems] = useState<BlockAllocatedItem[]>([]);
  const [selectorTab, setSelectorTab] = useState<SelectorTab>('PROGRESS');
  const [expandedTaskSubitemsId, setExpandedTaskSubitemsId] = useState<string | null>(null);
  const [newSubitemText, setNewSubitemText] = useState<string>('');

  // Inline new task creator inside Task selector tab
  const [showInlineNewTask, setShowInlineNewTask] = useState<boolean>(false);
  const [newTaskTitle, setNewTaskTitle] = useState<string>('');
  const [newTaskPriority, setNewTaskPriority] = useState<Priority>('P2');
  const [newTaskDuration, setNewTaskDuration] = useState<number>(60);
  const [newTaskSubitems, setNewTaskSubitems] = useState<TaskSubItem[]>([]);
  const [newTaskSubitemDraft, setNewTaskSubitemDraft] = useState<string>('');

  const overlappingArea = useMemo(() => {
    if (!hasSpecificTime) return null;
    const startMin = timeStringToMinutes(startTime);
    const endMin = timeStringToMinutes(endTime);
    if (endMin <= startMin) return null;
    const dayOfWeek = new Date(`${date}T12:00:00`).getDay();
    const areas = getRoutineAreasForDay(dayOfWeek, date);
    return (
      areas.find((area) => {
        const aStart = timeStringToMinutes(area.startTime);
        const aEnd = timeStringToMinutes(area.endTime);
        return startMin < aEnd && endMin > aStart;
      }) || null
    );
  }, [date, startTime, endTime, hasSpecificTime, getRoutineAreasForDay]);

  const effectiveTier = overlappingArea ? overlappingArea.tier : blockTier;

  const allocatedProgressIds = useMemo(
    () => new Set(allocatedItems.filter((i) => i.type === 'PROGRESS').map((i) => i.targetId)),
    [allocatedItems]
  );

  const allocatedTaskIds = useMemo(
    () => new Set(allocatedItems.filter((i) => i.type === 'TASK').map((i) => i.targetId)),
    [allocatedItems]
  );

  const availableProgresses = useMemo(
    () =>
      progressBars.filter(
        (p) =>
          (!p.isCompleted && (!overlappingArea || p.energyTier === overlappingArea.tier)) ||
          allocatedProgressIds.has(p.id)
      ),
    [progressBars, overlappingArea, allocatedProgressIds]
  );

  const sortedTasks = useMemo(
    () =>
      [...tasks]
        .filter(
          (t) =>
            !overlappingArea || t.energyTier === overlappingArea.tier || allocatedTaskIds.has(t.id)
        )
        .sort((a, b) => {
          if (a.isCompleted !== b.isCompleted) return a.isCompleted ? 1 : -1;
          return PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority];
        }),
    [tasks, overlappingArea, allocatedTaskIds]
  );

  const builtRecurrenceRule: RecurrenceRule | undefined = useMemo(() => {
    if (recFrequency === 'NONE' || editingBlock) return undefined;
    const defaultWeekday = new Date(`${date}T12:00:00`).getDay();
    return {
      frequency: recFrequency,
      interval: Math.max(1, recInterval),
      daysOfWeek:
        recFrequency === 'WEEKLY' || recFrequency === 'CUSTOM'
          ? recDaysOfWeek.length > 0
            ? recDaysOfWeek
            : [defaultWeekday]
          : undefined,
      endType: recEndType,
      endDate: recEndType === 'ON_DATE' && recEndDate ? recEndDate : undefined,
      occurrences: recEndType === 'AFTER_OCCURRENCES' ? Math.max(1, recOccurrences) : undefined,
    };
  }, [recFrequency, recInterval, recDaysOfWeek, recEndType, recEndDate, recOccurrences, editingBlock, date]);

  const recurrencePreviewCount = useMemo(() => {
    if (!builtRecurrenceRule) return 1;
    return expandRecurrenceDates(date, builtRecurrenceRule).length;
  }, [date, builtRecurrenceRule]);

  useEffect(() => {
    if (!isOpen) return;

    const defaultWeekday = new Date(`${date}T12:00:00`).getDay();
    setRecFrequency('NONE');
    setRecInterval(1);
    setRecDaysOfWeek([defaultWeekday]);
    setRecEndType('NEVER');
    setRecEndDate('');
    setRecOccurrences(8);
    setExpandedTaskSubitemsId(null);
    setNewSubitemText('');
    setShowInlineNewTask(false);
    setNewTaskTitle('');
    setNewTaskPriority('P2');
    setNewTaskDuration(60);
    setNewTaskSubitems([]);
    setNewTaskSubitemDraft('');

    if (editingBlock) {
      const blockHasTime = Boolean(editingBlock.startTime && editingBlock.endTime);
      setHasSpecificTime(blockHasTime);
      setStartTime(editingBlock.startTime || initialStartTime || '09:00');
      setEndTime(editingBlock.endTime || initialEndTime || '10:00');
      setObligation(editingBlock.obligation);
      setBlockTier(editingBlock.tier);
      setBlockTitle(editingBlock.title || '');
      const initialAllocated = getBlockAllocatedItems(editingBlock, progressBars, tasks);
      setAllocatedItems(initialAllocated);
      setSelectorTab(
        initialTab ||
          (initialAllocated[0]?.type === 'TASK' ? 'TASK' : 'PROGRESS')
      );
    } else {
      setHasSpecificTime(true);
      setStartTime(initialStartTime);
      setEndTime(initialEndTime);
      setObligation('FLEXIBLE');
      setBlockTier('FOCUS');
      setBlockTitle('');
      setAllocatedItems([]);
      setSelectorTab(initialTab || 'PROGRESS');
    }
  }, [isOpen, editingBlock, initialStartTime, initialEndTime, initialTab, date]);

  if (!isOpen) return null;

  const durationMins = hasSpecificTime
    ? Math.max(0, timeStringToMinutes(endTime) - timeStringToMinutes(startTime))
    : 0;

  const totalAllocatedMins = allocatedItems.reduce(
    (sum, item) => sum + Math.max(0, item.allocatedMinutes || 0),
    0
  );

  const getProgressLabel = (progId: string) => {
    const p = progressBars.find((item) => item.id === progId);
    if (!p) return 'Progresso removido';
    if (p.parentId) {
      const parent = progressBars.find((par) => par.id === p.parentId);
      return parent ? `${parent.title} › ${p.title}` : p.title;
    }
    return p.title;
  };

  const getItemTitle = (item: BlockAllocatedItem): string => {
    if (item.type === 'PROGRESS') {
      return getProgressLabel(item.targetId);
    }
    return tasks.find((t) => t.id === item.targetId)?.title || 'Tarefa removida';
  };

  const toggleProgressSelection = (progId: string) => {
    setAllocatedItems((prev) => {
      const exists = prev.some((it) => it.type === 'PROGRESS' && it.targetId === progId);
      if (exists) {
        return prev.filter((it) => !(it.type === 'PROGRESS' && it.targetId === progId));
      }
      const prog = progressBars.find((p) => p.id === progId);
      const defaultMins =
        prog?.type === 'TIME' && prog.targetDailySeconds
          ? Math.max(5, Math.round(prog.targetDailySeconds / 60))
          : 30;
      if (prev.length === 0 && prog && !overlappingArea) {
        setBlockTier(prog.energyTier);
      }
      return [
        ...prev,
        {
          id: `alloc-prog-${progId}-${Date.now()}`,
          type: 'PROGRESS',
          targetId: progId,
          allocatedMinutes: defaultMins,
        },
      ];
    });
  };

  const toggleTaskSelection = (taskId: string) => {
    setAllocatedItems((prev) => {
      const exists = prev.some((it) => it.type === 'TASK' && it.targetId === taskId);
      if (exists) {
        return prev.filter((it) => !(it.type === 'TASK' && it.targetId === taskId));
      }
      const task = tasks.find((t) => t.id === taskId);
      const defaultMins = Math.max(5, task?.durationMinutes || 30);
      if (prev.length === 0 && task && !overlappingArea) {
        setBlockTier(task.energyTier);
      }
      return [
        ...prev,
        {
          id: `alloc-task-${taskId}-${Date.now()}`,
          type: 'TASK',
          targetId: taskId,
          allocatedMinutes: defaultMins,
        },
      ];
    });
  };

  const moveAllocatedItem = (index: number, delta: -1 | 1) => {
    setAllocatedItems((prev) => {
      const nextIndex = index + delta;
      if (nextIndex < 0 || nextIndex >= prev.length) return prev;
      const copy = [...prev];
      const [moved] = copy.splice(index, 1);
      copy.splice(nextIndex, 0, moved);
      return copy;
    });
  };

  const updateAllocatedMinutes = (itemId: string, mins: number) => {
    const clean = Math.max(1, Math.min(720, Math.round(mins) || 1));
    setAllocatedItems((prev) =>
      prev.map((it) => (it.id === itemId ? { ...it, allocatedMinutes: clean } : it))
    );
  };

  const removeAllocatedItem = (itemId: string) => {
    setAllocatedItems((prev) => prev.filter((it) => it.id !== itemId));
  };

  const handleAddDraftSubitem = () => {
    if (!newTaskSubitemDraft.trim()) return;
    setNewTaskSubitems((prev) => [
      ...prev,
      {
        id: `draft-sub-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        title: newTaskSubitemDraft.trim(),
        isCompleted: false,
      },
    ]);
    setNewTaskSubitemDraft('');
  };

  const handleCreateInlineTask = () => {
    if (!newTaskTitle.trim()) {
      showToast('Digite o título da nova tarefa.', 'warning');
      return;
    }
    const created = addTask({
      title: newTaskTitle.trim(),
      priority: newTaskPriority,
      obligation,
      energyTier: effectiveTier,
      isCompleted: false,
      durationMinutes: Math.max(5, Number(newTaskDuration) || 45),
      date: builtRecurrenceRule ? undefined : date,
      recurrence: builtRecurrenceRule,
      attachedAreaId: overlappingArea?.id,
      subitems: newTaskSubitems,
    });

    setAllocatedItems((prev) => [
      ...prev,
      {
        id: `alloc-task-${created.id}-${Date.now()}`,
        type: 'TASK',
        targetId: created.id,
        allocatedMinutes: created.durationMinutes,
      },
    ]);

    setNewTaskTitle('');
    setNewTaskDuration(60);
    setNewTaskSubitems([]);
    setNewTaskSubitemDraft('');
    setShowInlineNewTask(false);
    showToast(`Tarefa "${created.title}" criada e adicionada ao bloco!`, 'success');
  };

  const handleAddSubitemToTask = (taskId: string) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task || !newSubitemText.trim()) return;
    const item: TaskSubItem = {
      id: `sub-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: newSubitemText.trim(),
      isCompleted: false,
    };
    updateTask(task.id, {
      subitems: [...(task.subitems || []), item],
    });
    setNewSubitemText('');
  };

  const handleRemoveSubitemFromTask = (taskId: string, subId: string) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    updateTask(task.id, {
      subitems: (task.subitems || []).filter((s) => s.id !== subId),
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const startMin = timeStringToMinutes(startTime);
    const endMin = timeStringToMinutes(endTime);
    if (hasSpecificTime && endMin <= startMin) {
      showToast('O horário de término precisa ser posterior ao horário de início.', 'warning');
      return;
    }

    if (allocatedItems.length === 0) {
      showToast(
        'Selecione pelo menos um progresso ou tarefa na seção à direita para alocar neste bloco.',
        'warning'
      );
      return;
    }

    // Validate energy tier compatibility when overlapping an Area
    if (overlappingArea) {
      const incompatibleItem = allocatedItems.find((it) => {
        if (it.type === 'PROGRESS') {
          const p = progressBars.find((pb) => pb.id === it.targetId);
          return p && p.energyTier !== overlappingArea.tier;
        }
        const t = tasks.find((tk) => tk.id === it.targetId);
        return t && t.energyTier !== overlappingArea.tier;
      });
      if (incompatibleItem) {
        showToast(
          `Há itens selecionados incompatíveis com a área "${overlappingArea.title}" (${TIER_INFO[overlappingArea.tier].label}).`,
          'warning'
        );
        return;
      }
    }

    // Sync edited daily target / duration back into allocated progresses and tasks
    allocatedItems.forEach((it) => {
      if (it.type === 'PROGRESS') {
        const prog = progressBars.find((p) => p.id === it.targetId);
        if (prog?.type === 'TIME') {
          updateProgressBar(prog.id, {
            targetDailySeconds: Math.max(60, Math.round(it.allocatedMinutes * 60)),
          });
        }
      } else {
        const task = tasks.find((t) => t.id === it.targetId);
        if (task) {
          updateTask(task.id, {
            durationMinutes: Math.max(5, Math.round(it.allocatedMinutes)),
          });
        }
      }
    });

    const firstProgItem = allocatedItems.find((it) => it.type === 'PROGRESS');
    const firstTaskItem = allocatedItems.find((it) => it.type === 'TASK');
    const primaryProg = firstProgItem
      ? progressBars.find((p) => p.id === firstProgItem.targetId)
      : undefined;

    const autoTitle = allocatedItems
      .map((it) => {
        if (it.type === 'PROGRESS') {
          return progressBars.find((p) => p.id === it.targetId)?.title || '';
        }
        return tasks.find((t) => t.id === it.targetId)?.title || '';
      })
      .filter(Boolean)
      .slice(0, 3)
      .join(' • ');

    const payload: Omit<ScheduledBlock, 'id'> = {
      date,
      title: blockTitle.trim() || autoTitle || 'Bloco de Atividade',
      startTime: hasSpecificTime ? startTime : '',
      endTime: hasSpecificTime ? endTime : '',
      tier: effectiveTier,
      obligation,
      layer: editingBlock?.layer ?? 0,
      allocationType: allocatedItems[0].type,
      linkedProgressId: firstProgItem?.targetId,
      linkedTaskId: firstTaskItem?.targetId,
      allocatedItems,
      color: primaryProg?.color,
    };

    if (editingBlock) {
      updateEffectiveBlock(date, editingBlock, payload);
    } else {
      addScheduledBlock(payload, builtRecurrenceRule);
    }
    onClose();
  };

  const handleDelete = () => {
    if (!editingBlock) return;
    const rangeLabel = editingBlock.startTime
      ? `(${editingBlock.startTime} - ${editingBlock.endTime})`
      : '(sem horário definido)';
    requestConfirm(
      'Remover bloco do dia',
      `Deseja remover "${editingBlock.title}" ${rangeLabel} apenas deste dia? Se veio da rotina semanal, a sua rotina base continuará intacta.`,
      () => {
        deleteEffectiveBlock(date, editingBlock);
        onClose();
      }
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-cozy-card border border-cozy-border rounded-3xl w-full max-w-5xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-cozy-border flex items-center justify-between bg-cozy-bg/60">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-cozy-lavender/15 text-cozy-lavender border border-cozy-lavender/30">
                {editingBlock ? 'Editar Bloco de Atividade' : 'Novo Bloco de Atividade'}
              </span>
              {editingBlock?.routineOriginId && (
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-cozy-sky/15 text-cozy-sky border border-cozy-sky/30">
                  Originado da Rotina (altera só este dia)
                </span>
              )}
            </div>
            <h3 className="text-lg font-extrabold text-cozy-text mt-1">
              Bloco &amp; Alocações • {formatDateBR(date)}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-cozy-hover text-cozy-subtext hover:text-cozy-text transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto p-6 space-y-5">
          {/* 2-SECTION BODY: Left = Main Block Settings | Right = Multiple Allocations & Order */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* LEFT SECTION (5 Cols): Configurações Principais do Bloco */}
            <div className="lg:col-span-5 space-y-4">
              {/* Block Title */}
              <div className="bg-cozy-bg/70 p-4 rounded-2xl border border-cozy-border space-y-2">
                <label className="text-[11px] font-bold text-cozy-subtext uppercase block">
                  Título do Bloco (opcional)
                </label>
                <input
                  type="text"
                  value={blockTitle}
                  onChange={(e) => setBlockTitle(e.target.value)}
                  placeholder="Ex: Sessão Faculdade, Bloco Foco Manhã..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-cozy-card border border-cozy-border text-sm font-bold text-cozy-text focus:outline-none focus:border-cozy-lavender"
                />
                <p className="text-[10px] text-cozy-subtext">
                  Se ficar em branco, será nomeado automaticamente pelos itens alocados.
                </p>
              </div>

              {/* Time & Obligation */}
              <div className="bg-cozy-bg/70 p-4 rounded-2xl border border-cozy-border space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-[11px] font-bold text-cozy-subtext uppercase flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-cozy-lavender" />
                    Horário do Bloco
                  </span>
                  <button
                    type="button"
                    onClick={() => setHasSpecificTime((prev) => !prev)}
                    className={`px-2.5 py-1 rounded-full text-[10px] font-bold border transition-colors ${
                      hasSpecificTime
                        ? 'bg-cozy-lavender/15 text-cozy-lavender border-cozy-lavender/40 hover:bg-cozy-lavender/25'
                        : 'bg-cozy-sky/20 text-cozy-sky border-cozy-sky/40 hover:bg-cozy-sky/30'
                    }`}
                  >
                    {hasSpecificTime ? '🕒 Com horário definido' : '📅 Sem horário específico'}
                  </button>
                </div>

                {!hasSpecificTime && (
                  <div className="p-2.5 rounded-xl bg-cozy-sky/10 border border-dashed border-cozy-sky/35 text-[11px] text-cozy-sky font-medium leading-relaxed">
                    Evento sem horário especificado — exibirá &ldquo;É hoje&rdquo; no Meu Dia na data marcada.
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-cozy-subtext uppercase block mb-1">
                      Início
                    </label>
                    <input
                      type="time"
                      disabled={!hasSpecificTime}
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-cozy-card border border-cozy-border text-sm font-bold text-cozy-text focus:outline-none focus:border-cozy-lavender disabled:opacity-40"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-cozy-subtext uppercase block mb-1">
                      Término {hasSpecificTime ? `(${formatSecondsToHuman(durationMins * 60)})` : ''}
                    </label>
                    <input
                      type="time"
                      disabled={!hasSpecificTime}
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-cozy-card border border-cozy-border text-sm font-bold text-cozy-text focus:outline-none focus:border-cozy-lavender disabled:opacity-40"
                    />
                  </div>
                </div>

                {/* Obligation & Energy Tag (NO Empilhamento!) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="text-[11px] font-bold text-cozy-subtext uppercase block mb-1">
                      Obrigatoriedade
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        setObligation((prev) => (prev === 'MANDATORY' ? 'FLEXIBLE' : 'MANDATORY'))
                      }
                      className={`w-full px-3 py-2 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${
                        obligation === 'MANDATORY'
                          ? 'bg-cozy-rose/20 text-cozy-rose border-cozy-rose/40'
                          : 'bg-cozy-card text-cozy-subtext border-cozy-border hover:text-cozy-text'
                      }`}
                    >
                      <ShieldAlert className="w-3.5 h-3.5" />
                      {obligation === 'MANDATORY' ? 'Obrigatório' : 'Flexível'}
                    </button>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-cozy-subtext uppercase block mb-1">
                      Tag de Energia {overlappingArea ? '(Área)' : ''}
                    </label>
                    <select
                      value={effectiveTier}
                      disabled={Boolean(overlappingArea)}
                      onChange={(e) => setBlockTier(e.target.value as EnergyTier)}
                      className="w-full px-3 py-2 rounded-xl bg-cozy-card border border-cozy-border text-xs font-bold text-cozy-text disabled:opacity-75"
                    >
                      <option value="FOCUS">🧠 Focado</option>
                      <option value="TRANSIT">🎧 Baixo Foco</option>
                      <option value="BACKGROUND">🫧 Segundo Plano</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Overlapping Area Notice */}
              {overlappingArea && (
                <div className="p-3 rounded-2xl bg-cozy-lavender/10 border border-cozy-lavender/30 flex items-start gap-2.5">
                  <Lock className="w-4 h-4 text-cozy-lavender shrink-0 mt-0.5" />
                  <div className="text-xs">
                    <span className="font-bold text-cozy-text block">
                      Dentro da área &ldquo;{overlappingArea.title}&rdquo;
                    </span>
                    <span className="text-[11px] text-cozy-subtext">
                      Apenas itens compatíveis com{' '}
                      <strong className="text-cozy-lavender">
                        {TIER_INFO[overlappingArea.tier].icon} {TIER_INFO[overlappingArea.tier].label}
                      </strong>{' '}
                      ficam elegíveis na lista ao lado.
                    </span>
                  </div>
                </div>
              )}

              {/* Google Calendar Style Recurrence (new blocks only) */}
              {!editingBlock && (
                <div className="p-4 rounded-2xl bg-cozy-bg/70 border border-cozy-border space-y-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 text-xs font-bold text-cozy-text">
                      <Repeat className="w-4 h-4 text-cozy-lavender" />
                      <span>Repetição</span>
                    </div>
                    <select
                      value={recFrequency}
                      onChange={(e) => setRecFrequency(e.target.value as RecurrenceFrequency)}
                      className="px-3 py-1.5 rounded-xl bg-cozy-card border border-cozy-border text-xs font-bold text-cozy-text focus:outline-none focus:border-cozy-lavender"
                    >
                      <option value="NONE">Não se repete</option>
                      <option value="DAILY">Diariamente</option>
                      <option value="WEEKLY">Semanalmente</option>
                      <option value="MONTHLY">Mensalmente</option>
                      <option value="CUSTOM">Personalizada</option>
                    </select>
                  </div>

                  {recFrequency !== 'NONE' && (
                    <div className="space-y-3 pt-2 border-t border-cozy-border/60">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs text-cozy-subtext font-semibold">A cada</span>
                        <input
                          type="number"
                          min={1}
                          max={30}
                          value={recInterval}
                          onChange={(e) => setRecInterval(Math.max(1, Number(e.target.value) || 1))}
                          className="w-14 px-2 py-1 rounded-xl bg-cozy-card border border-cozy-border text-xs font-bold text-cozy-text text-center"
                        />
                        <span className="text-xs text-cozy-subtext font-semibold">
                          {recFrequency === 'DAILY'
                            ? recInterval === 1
                              ? 'dia'
                              : 'dias'
                            : recFrequency === 'MONTHLY'
                              ? recInterval === 1
                                ? 'mês'
                                : 'meses'
                              : recInterval === 1
                                ? 'semana'
                                : 'semanas'}
                        </span>
                      </div>

                      {(recFrequency === 'WEEKLY' || recFrequency === 'CUSTOM') && (
                        <div className="space-y-1.5">
                          <span className="text-[11px] font-bold text-cozy-subtext block">
                            Dias da semana:
                          </span>
                          <div className="flex items-center gap-1 flex-wrap">
                            {WEEKDAY_LABELS.map((lbl, idx) => {
                              const selected = recDaysOfWeek.includes(idx);
                              return (
                                <button
                                  key={idx}
                                  type="button"
                                  onClick={() =>
                                    setRecDaysOfWeek((prev) =>
                                      prev.includes(idx)
                                        ? prev.length > 1
                                          ? prev.filter((d) => d !== idx)
                                          : prev
                                        : [...prev, idx]
                                    )
                                  }
                                  className={`w-7 h-7 rounded-full text-[11px] font-extrabold border transition-all ${
                                    selected
                                      ? 'bg-cozy-lavender text-cozy-bg border-cozy-lavender shadow-sm'
                                      : 'bg-cozy-card text-cozy-subtext border-cozy-border hover:text-cozy-text'
                                  }`}
                                >
                                  {lbl}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      <div className="space-y-1.5">
                        <span className="text-[11px] font-bold text-cozy-subtext block">Termina:</span>
                        <div className="space-y-1.5">
                          <button
                            type="button"
                            onClick={() => setRecEndType('NEVER')}
                            className={`w-full px-3 py-1.5 rounded-xl border text-xs font-bold text-left ${
                              recEndType === 'NEVER'
                                ? 'bg-cozy-lavender/15 border-cozy-lavender text-cozy-lavender'
                                : 'bg-cozy-card border-cozy-border text-cozy-subtext'
                            }`}
                          >
                            Nunca (até 8 sem.)
                          </button>

                          <div className="grid grid-cols-2 gap-1.5">
                            <div
                              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl border ${
                                recEndType === 'ON_DATE'
                                  ? 'bg-cozy-lavender/15 border-cozy-lavender'
                                  : 'bg-cozy-card border-cozy-border'
                              }`}
                            >
                              <input
                                type="radio"
                                checked={recEndType === 'ON_DATE'}
                                onChange={() => setRecEndType('ON_DATE')}
                              />
                              <input
                                type="date"
                                value={recEndDate}
                                onFocus={() => setRecEndType('ON_DATE')}
                                onChange={(e) => {
                                  setRecEndType('ON_DATE');
                                  setRecEndDate(e.target.value);
                                }}
                                className="w-full bg-transparent text-[11px] font-bold text-cozy-text focus:outline-none"
                              />
                            </div>

                            <div
                              className={`flex items-center gap-1 px-2.5 py-1 rounded-xl border ${
                                recEndType === 'AFTER_OCCURRENCES'
                                  ? 'bg-cozy-lavender/15 border-cozy-lavender'
                                  : 'bg-cozy-card border-cozy-border'
                              }`}
                            >
                              <input
                                type="radio"
                                checked={recEndType === 'AFTER_OCCURRENCES'}
                                onChange={() => setRecEndType('AFTER_OCCURRENCES')}
                              />
                              <span className="text-[10px] text-cozy-subtext">Após</span>
                              <input
                                type="number"
                                min={1}
                                max={60}
                                value={recOccurrences}
                                onFocus={() => setRecEndType('AFTER_OCCURRENCES')}
                                onChange={(e) => {
                                  setRecEndType('AFTER_OCCURRENCES');
                                  setRecOccurrences(Math.max(1, Number(e.target.value) || 1));
                                }}
                                className="w-10 bg-cozy-bg border border-cozy-border rounded px-1 py-0.5 text-xs font-bold text-cozy-text text-center"
                              />
                              <span className="text-[10px] text-cozy-subtext">x</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <p className="text-[11px] text-cozy-lavender font-semibold">
                        Serão criados {recurrencePreviewCount} bloco(s) a partir de{' '}
                        {formatDateBR(date)}.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* RIGHT SECTION (7 Cols): Multiple Progresses/Tasks + Order inside Block */}
            <div className="lg:col-span-7 space-y-4">
              {/* PANEL 1: Ordered items allocated inside this block */}
              <div className="p-4 rounded-2xl bg-cozy-bg/75 border border-cozy-border space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-xs font-extrabold text-cozy-text flex items-center gap-1.5">
                    <ListOrdered className="w-4 h-4 text-cozy-peach" />
                    Itens Alocados &amp; Ordem no Bloco ({allocatedItems.length})
                  </span>
                  <span
                    className={`text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full border ${
                      hasSpecificTime && totalAllocatedMins > durationMins
                        ? 'bg-cozy-peach/15 text-cozy-peach border-cozy-peach/40'
                        : 'bg-cozy-sage/15 text-cozy-sage border-cozy-sage/40'
                    }`}
                  >
                    {formatSecondsToHuman(totalAllocatedMins * 60)} alocados
                    {hasSpecificTime ? ` / ${formatSecondsToHuman(durationMins * 60)}` : ''}
                  </span>
                </div>

                {allocatedItems.length === 0 ? (
                  <div className="p-4 rounded-xl bg-cozy-card/60 border border-dashed border-cozy-border text-center text-xs text-cozy-subtext">
                    Selecione um ou mais <strong>Progressos</strong> e/ou <strong>Tarefas</strong> abaixo para compor este bloco.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {allocatedItems.map((item, idx) => {
                      const taskObj =
                        item.type === 'TASK'
                          ? tasks.find((t) => t.id === item.targetId)
                          : undefined;
                      const isExpandedSub = taskObj && expandedTaskSubitemsId === taskObj.id;

                      return (
                        <div
                          key={item.id}
                          className="p-2.5 rounded-xl bg-cozy-card border border-cozy-border space-y-2"
                        >
                          <div className="flex items-center justify-between gap-2">
                            {/* Order arrows + Number + Title */}
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <div className="flex flex-col gap-0.5 shrink-0">
                                <button
                                  type="button"
                                  disabled={idx === 0}
                                  onClick={() => moveAllocatedItem(idx, -1)}
                                  className="p-0.5 rounded bg-cozy-bg border border-cozy-border text-cozy-subtext hover:text-cozy-text disabled:opacity-30"
                                  title="Subir na ordem"
                                >
                                  <ArrowUp className="w-3 h-3" />
                                </button>
                                <button
                                  type="button"
                                  disabled={idx === allocatedItems.length - 1}
                                  onClick={() => moveAllocatedItem(idx, 1)}
                                  className="p-0.5 rounded bg-cozy-bg border border-cozy-border text-cozy-subtext hover:text-cozy-text disabled:opacity-30"
                                  title="Descer na ordem"
                                >
                                  <ArrowDown className="w-3 h-3" />
                                </button>
                              </div>

                              <span className="text-[10px] font-mono font-extrabold text-cozy-subtext shrink-0">
                                {idx + 1}º
                              </span>

                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span
                                    className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded ${
                                      item.type === 'PROGRESS'
                                        ? 'bg-cozy-sage/15 text-cozy-sage'
                                        : 'bg-cozy-sky/15 text-cozy-sky'
                                    }`}
                                  >
                                    {item.type === 'PROGRESS' ? 'Progresso' : 'Tarefa'}
                                  </span>
                                  <span className="text-xs font-bold text-cozy-text whitespace-normal break-words leading-snug">
                                    {getItemTitle(item)}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Time input + Formatted duration + Subitems button + Remove */}
                            <div className="flex items-center gap-1.5 shrink-0">
                              <input
                                type="number"
                                min={1}
                                max={720}
                                step={5}
                                value={item.allocatedMinutes}
                                onChange={(e) =>
                                  updateAllocatedMinutes(item.id, Number(e.target.value))
                                }
                                title="Tempo / Meta diária (em minutos)"
                                className="w-14 px-1.5 py-1 rounded-lg bg-cozy-bg border border-cozy-border text-xs font-mono font-bold text-cozy-text text-center focus:outline-none focus:border-cozy-lavender"
                              />
                              <span className="text-[11px] font-mono font-bold text-cozy-lavender min-w-[44px] text-right">
                                {formatSecondsToHuman(item.allocatedMinutes * 60)}
                              </span>

                              {taskObj && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setExpandedTaskSubitemsId((prev) =>
                                      prev === taskObj.id ? null : taskObj.id
                                    )
                                  }
                                  className="px-2 py-1 rounded-lg bg-cozy-bg border border-cozy-border text-[10px] font-bold text-cozy-sky hover:bg-cozy-hover"
                                  title="Gerenciar subitens da tarefa"
                                >
                                  Sub ({taskObj.subitems?.length || 0})
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => removeAllocatedItem(item.id)}
                                className="p-1 rounded-lg text-cozy-subtext hover:text-cozy-rose hover:bg-cozy-rose/10"
                                title="Remover item do bloco"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Subitems drawer for allocated task */}
                          {isExpandedSub && taskObj && (
                            <div className="pt-2 border-t border-cozy-border/60 space-y-1.5 pl-6">
                              {(taskObj.subitems || []).map((sub) => (
                                <div
                                  key={sub.id}
                                  className="flex items-center justify-between gap-2 text-xs bg-cozy-bg px-2.5 py-1 rounded-lg border border-cozy-border"
                                >
                                  <button
                                    type="button"
                                    onClick={() => toggleTaskSubitem(taskObj.id, sub.id)}
                                    className="flex items-center gap-2 text-left flex-1 min-w-0"
                                  >
                                    <span
                                      className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${
                                        sub.isCompleted
                                          ? 'bg-cozy-sage border-cozy-sage text-cozy-bg'
                                          : 'border-cozy-border'
                                      }`}
                                    >
                                      {sub.isCompleted && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                                    </span>
                                    <span
                                      className={`whitespace-normal break-words leading-snug ${
                                        sub.isCompleted
                                          ? 'line-through text-cozy-subtext'
                                          : 'text-cozy-text'
                                      }`}
                                    >
                                      {sub.title}
                                    </span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveSubitemFromTask(taskObj.id, sub.id)}
                                    className="text-cozy-subtext hover:text-cozy-rose p-0.5"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              ))}
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="text"
                                  value={newSubitemText}
                                  onChange={(e) => setNewSubitemText(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      handleAddSubitemToTask(taskObj.id);
                                    }
                                  }}
                                  placeholder="Novo subitem..."
                                  className="flex-1 px-2.5 py-1 rounded-lg bg-cozy-bg border border-cozy-border text-xs text-cozy-text focus:outline-none focus:border-cozy-sky"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleAddSubitemToTask(taskObj.id)}
                                  className="px-2.5 py-1 rounded-lg bg-cozy-sky/20 text-cozy-sky border border-cozy-sky/30 text-[11px] font-bold"
                                >
                                  + Subitem
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* PANEL 2: Multi-Select Progresses & Tasks Picker */}
              <div className="p-4 rounded-2xl bg-cozy-bg/60 border border-cozy-border space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="grid grid-cols-2 gap-1.5 p-1 bg-cozy-card rounded-xl border border-cozy-border flex-1">
                    <button
                      type="button"
                      onClick={() => setSelectorTab('PROGRESS')}
                      className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-bold transition-all ${
                        selectorTab === 'PROGRESS'
                          ? 'bg-cozy-sage/20 text-cozy-sage border border-cozy-sage/40'
                          : 'text-cozy-subtext hover:text-cozy-text'
                      }`}
                    >
                      <BarChart3 className="w-3.5 h-3.5" />
                      <span>Progressos ({availableProgresses.length})</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectorTab('TASK')}
                      className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-bold transition-all ${
                        selectorTab === 'TASK'
                          ? 'bg-cozy-sky/20 text-cozy-sky border border-cozy-sky/40'
                          : 'text-cozy-subtext hover:text-cozy-text'
                      }`}
                    >
                      <CheckSquare className="w-3.5 h-3.5" />
                      <span>Tarefas ({sortedTasks.length})</span>
                    </button>
                  </div>

                  {selectorTab === 'TASK' && (
                    <button
                      type="button"
                      onClick={() => setShowInlineNewTask((prev) => !prev)}
                      className="flex items-center gap-1 px-3 py-2 rounded-xl bg-cozy-sky/15 text-cozy-sky border border-cozy-sky/40 text-xs font-bold hover:bg-cozy-sky/25 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{showInlineNewTask ? 'Fechar Nova' : 'Nova Tarefa'}</span>
                    </button>
                  )}
                </div>

                {/* Progress Multi-select List */}
                {selectorTab === 'PROGRESS' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
                    {availableProgresses.length === 0 ? (
                      <div className="sm:col-span-2 p-4 rounded-xl border border-dashed border-cozy-border text-center text-xs text-cozy-subtext">
                        Nenhum progresso compatível encontrado nesta Tag de Energia.
                      </div>
                    ) : (
                      availableProgresses.map((prog) => {
                        const isSelected = allocatedProgressIds.has(prog.id);
                        const tierMeta = TIER_INFO[prog.energyTier];
                        return (
                          <button
                            key={prog.id}
                            type="button"
                            onClick={() => toggleProgressSelection(prog.id)}
                            className={`text-left p-2.5 rounded-xl border transition-all flex items-start gap-2 ${
                              isSelected
                                ? 'border-cozy-sage bg-cozy-sage/15 ring-1 ring-cozy-sage/40'
                                : 'border-cozy-border bg-cozy-card hover:bg-cozy-hover'
                            }`}
                          >
                            <span
                              className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                                isSelected
                                  ? 'bg-cozy-sage border-cozy-sage text-cozy-bg'
                                  : 'border-cozy-border bg-cozy-bg'
                              }`}
                            >
                              {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="text-xs font-bold text-cozy-text whitespace-normal break-words leading-snug">
                                {getProgressLabel(prog.id)}
                              </div>
                              <div className="flex items-center gap-1.5 mt-1 flex-wrap text-[10px] text-cozy-subtext">
                                <span
                                  className={`font-bold px-1.5 py-0.2 rounded-full border ${tierMeta.badgeCls}`}
                                >
                                  {tierMeta.icon} {tierMeta.label}
                                </span>
                                {prog.type === 'TIME' && prog.targetDailySeconds && (
                                  <span className="font-mono">
                                    Meta: {formatSecondsToHuman(prog.targetDailySeconds)}
                                  </span>
                                )}
                              </div>
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                )}

                {/* Task Multi-select List & Inline Creator */}
                {selectorTab === 'TASK' && (
                  <div className="space-y-3">
                    {showInlineNewTask && (
                      <div className="p-3 rounded-xl bg-cozy-card border border-cozy-sky/40 space-y-2.5">
                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                          <input
                            type="text"
                            value={newTaskTitle}
                            onChange={(e) => setNewTaskTitle(e.target.value)}
                            placeholder="Ex: Criar currículo..."
                            className="sm:col-span-2 px-3 py-1.5 rounded-lg bg-cozy-bg border border-cozy-border text-xs font-bold text-cozy-text focus:outline-none focus:border-cozy-sky"
                          />
                          <select
                            value={newTaskPriority}
                            onChange={(e) => setNewTaskPriority(e.target.value as Priority)}
                            className="px-2 py-1.5 rounded-lg bg-cozy-bg border border-cozy-border text-xs font-bold text-cozy-text"
                          >
                            <option value="P1">P1 — Crítica</option>
                            <option value="P2">P2 — Alta</option>
                            <option value="P3">P3 — Normal</option>
                            <option value="P4">P4 — Baixa</option>
                          </select>
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              min={5}
                              max={480}
                              step={5}
                              value={newTaskDuration}
                              onChange={(e) =>
                                setNewTaskDuration(Math.max(5, Number(e.target.value) || 30))
                              }
                              className="w-full px-2 py-1.5 rounded-lg bg-cozy-bg border border-cozy-border text-xs font-mono font-bold text-cozy-text text-center"
                            />
                            <span className="text-[10px] text-cozy-subtext">min</span>
                          </div>
                        </div>

                        {/* Subitems builder for new task */}
                        <div className="space-y-1.5">
                          {newTaskSubitems.map((sub) => (
                            <div
                              key={sub.id}
                              className="flex items-center justify-between px-2.5 py-1 rounded-lg bg-cozy-bg border border-cozy-border text-xs"
                            >
                              <span className="whitespace-normal break-words">{sub.title}</span>
                              <button
                                type="button"
                                onClick={() =>
                                  setNewTaskSubitems((prev) => prev.filter((i) => i.id !== sub.id))
                                }
                                className="text-cozy-subtext hover:text-cozy-rose"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                          <div className="flex items-center gap-1.5">
                            <input
                              type="text"
                              value={newTaskSubitemDraft}
                              onChange={(e) => setNewTaskSubitemDraft(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleAddDraftSubitem();
                                }
                              }}
                              placeholder="Etapa/subitem opcional..."
                              className="flex-1 px-2.5 py-1 rounded-lg bg-cozy-bg border border-cozy-border text-xs text-cozy-text focus:outline-none focus:border-cozy-sky"
                            />
                            <button
                              type="button"
                              onClick={handleAddDraftSubitem}
                              className="px-2.5 py-1 rounded-lg bg-cozy-bg border border-cozy-border text-xs font-bold text-cozy-subtext hover:text-cozy-text"
                            >
                              + Subitem
                            </button>
                            <button
                              type="button"
                              onClick={handleCreateInlineTask}
                              className="px-3 py-1 rounded-lg bg-cozy-sky text-cozy-bg text-xs font-extrabold hover:brightness-110"
                            >
                              Criar &amp; Alocar
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                      {sortedTasks.length === 0 ? (
                        <div className="p-4 rounded-xl border border-dashed border-cozy-border text-center text-xs text-cozy-subtext">
                          Nenhuma tarefa compatível. Clique em &ldquo;Nova Tarefa&rdquo; acima para criar.
                        </div>
                      ) : (
                        sortedTasks.map((t) => {
                          const isSelected = allocatedTaskIds.has(t.id);
                          const tierMeta = TIER_INFO[t.energyTier];
                          return (
                            <div
                              key={t.id}
                              onClick={() => toggleTaskSelection(t.id)}
                              className={`p-2.5 rounded-xl border cursor-pointer transition-all flex items-center justify-between gap-2 ${
                                isSelected
                                  ? 'border-cozy-sky bg-cozy-sky/15 ring-1 ring-cozy-sky/40'
                                  : 'border-cozy-border bg-cozy-card hover:bg-cozy-hover'
                              } ${t.isCompleted ? 'opacity-60' : ''}`}
                            >
                              <div className="flex items-start gap-2 min-w-0 flex-1">
                                <span
                                  className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                                    isSelected
                                      ? 'bg-cozy-sky border-cozy-sky text-cozy-bg'
                                      : 'border-cozy-border bg-cozy-bg'
                                  }`}
                                >
                                  {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                                </span>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="text-[10px] font-extrabold px-1.5 py-0.2 rounded bg-cozy-bg border border-cozy-border">
                                      {t.priority}
                                    </span>
                                    <span
                                      className={`text-xs font-bold whitespace-normal break-words leading-snug ${
                                        t.isCompleted ? 'line-through' : ''
                                      }`}
                                    >
                                      {t.title}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2 mt-1 flex-wrap text-[10px] text-cozy-subtext">
                                    <span
                                      className={`font-bold px-1.5 py-0.2 rounded-full border ${tierMeta.badgeCls}`}
                                    >
                                      {tierMeta.icon} {tierMeta.label}
                                    </span>
                                    <span className="font-mono">
                                      {formatSecondsToHuman((t.durationMinutes || 30) * 60)}
                                    </span>
                                    {t.subitems && t.subitems.length > 0 && (
                                      <span>• {t.subitems.length} subitem(ns)</span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  requestConfirm(
                                    'Excluir tarefa permanentemente?',
                                    `Deseja excluir "${t.title}"?`,
                                    () => {
                                      setAllocatedItems((prev) =>
                                        prev.filter(
                                          (it) => !(it.type === 'TASK' && it.targetId === t.id)
                                        )
                                      );
                                      deleteTask(t.id);
                                    }
                                  );
                                }}
                                className="p-1.5 rounded-lg text-cozy-subtext hover:text-cozy-rose hover:bg-cozy-rose/10 shrink-0"
                                title="Excluir tarefa"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-cozy-border flex items-center justify-between gap-3">
            {editingBlock ? (
              <button
                type="button"
                onClick={handleDelete}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-cozy-rose/15 text-cozy-rose border border-cozy-rose/30 text-xs font-bold hover:bg-cozy-rose/25 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                <span>Remover do Dia</span>
              </button>
            ) : (
              <div className="text-[11px] text-cozy-subtext flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-cozy-peach" />
                <span>Aloque múltiplos progressos e tarefas na ordem desejada</span>
              </div>
            )}

            <div className="flex items-center gap-2 ml-auto">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl bg-cozy-bg text-cozy-subtext hover:text-cozy-text text-xs font-bold border border-cozy-border transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-cozy-peach text-cozy-bg font-extrabold text-xs hover:brightness-110 transition-all shadow-md"
              >
                {editingBlock ? 'Salvar Alterações' : 'Alocar no Horário'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
