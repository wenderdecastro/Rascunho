import React, { useState, useEffect, useMemo } from 'react';
import { useApp, PRIORITY_WEIGHT } from '../context/AppContext';
import {
  EnergyTier,
  Obligation,
  Priority,
  RecurrenceFrequency,
  RecurrenceRule,
  ScheduledBlock,
  TaskItem,
  TaskSubItem,
} from '../types';
import {
  formatSecondsToHuman,
  timeStringToMinutes,
  formatDateBR,
  expandRecurrenceDates,
} from '../utils/helpers';
import {
  X,
  BarChart3,
  CheckSquare,
  Plus,
  Trash2,
  ShieldAlert,
  Sparkles,
  Layers,
  Check,
  Target,
  Repeat,
  Lock,
  Clock,
} from 'lucide-react';

interface BlockAllocationModalProps {
  isOpen: boolean;
  date: string;
  initialStartTime: string;
  initialEndTime: string;
  initialTab?: ModalTab;
  editingBlock?: ScheduledBlock | null;
  onClose: () => void;
}

type ModalTab = 'PROGRESS' | 'TASK';

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

  const [activeTab, setActiveTab] = useState<ModalTab>('PROGRESS');
  const [hasSpecificTime, setHasSpecificTime] = useState<boolean>(true);
  const [startTime, setStartTime] = useState(initialStartTime);
  const [endTime, setEndTime] = useState(initialEndTime);
  const [obligation, setObligation] = useState<Obligation>('FLEXIBLE');
  const [layer, setLayer] = useState<0 | 1>(0);

  // Tab 1: Progresso
  const [selectedProgressId, setSelectedProgressId] = useState<string>('');
  const [progressBlockTitle, setProgressBlockTitle] = useState<string>('');
  const [dailyTargetInput, setDailyTargetInput] = useState<string>('');

  // Tab 2: Tarefa
  const [taskMode, setTaskMode] = useState<'EXISTING' | 'NEW'>('EXISTING');
  const [selectedTaskId, setSelectedTaskId] = useState<string>('');
  const [taskBlockTitle, setTaskBlockTitle] = useState<string>('');
  const [newSubitemText, setNewSubitemText] = useState<string>('');
  // New task creation state
  const [newTaskTitle, setNewTaskTitle] = useState<string>('');
  const [newTaskPriority, setNewTaskPriority] = useState<Priority>('P2');
  const [newTaskTier, setNewTaskTier] = useState<EnergyTier>('FOCUS');
  const [newTaskSubitems, setNewTaskSubitems] = useState<TaskSubItem[]>([]);
  const [newTaskSubitemDraft, setNewTaskSubitemDraft] = useState<string>('');

  // Google Calendar style Recurrence (when creating a new block)
  const [recFrequency, setRecFrequency] = useState<RecurrenceFrequency>('NONE');
  const [recInterval, setRecInterval] = useState<number>(1);
  const [recDaysOfWeek, setRecDaysOfWeek] = useState<number[]>([]);
  const [recEndType, setRecEndType] = useState<'NEVER' | 'ON_DATE' | 'AFTER_OCCURRENCES'>('NEVER');
  const [recEndDate, setRecEndDate] = useState<string>('');
  const [recOccurrences, setRecOccurrences] = useState<number>(8);

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

  const availableProgresses = useMemo(
    () =>
      progressBars.filter(
        (p) =>
          (!p.isCompleted && (!overlappingArea || p.energyTier === overlappingArea.tier)) ||
          p.id === editingBlock?.linkedProgressId
      ),
    [progressBars, overlappingArea, editingBlock]
  );

  const sortedTasks = useMemo(
    () =>
      [...tasks]
        .filter(
          (t) =>
            !overlappingArea ||
            t.energyTier === overlappingArea.tier ||
            t.id === editingBlock?.linkedTaskId
        )
        .sort((a, b) => {
          if (a.isCompleted !== b.isCompleted) return a.isCompleted ? 1 : -1;
          return PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority];
        }),
    [tasks, overlappingArea, editingBlock]
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

  const selectedProgress = useMemo(
    () => progressBars.find((p) => p.id === selectedProgressId),
    [progressBars, selectedProgressId]
  );

  const selectedTask = useMemo(
    () => tasks.find((t) => t.id === selectedTaskId),
    [tasks, selectedTaskId]
  );

  // Initialize state whenever modal opens or editingBlock changes
  useEffect(() => {
    if (!isOpen) return;

    const defaultWeekday = new Date(`${date}T12:00:00`).getDay();
    setRecFrequency('NONE');
    setRecInterval(1);
    setRecDaysOfWeek([defaultWeekday]);
    setRecEndType('NEVER');
    setRecEndDate('');
    setRecOccurrences(8);

    if (editingBlock) {
      const blockHasTime = Boolean(editingBlock.startTime && editingBlock.endTime);
      setHasSpecificTime(blockHasTime);
      setStartTime(editingBlock.startTime || initialStartTime || '09:00');
      setEndTime(editingBlock.endTime || initialEndTime || '10:00');
      setObligation(editingBlock.obligation);
      setLayer(editingBlock.layer === 1 ? 1 : 0);

      if (editingBlock.linkedTaskId || editingBlock.allocationType === 'TASK') {
        setActiveTab('TASK');
        setTaskMode('EXISTING');
        setSelectedTaskId(editingBlock.linkedTaskId || '');
        setTaskBlockTitle(editingBlock.title);
      } else {
        setActiveTab('PROGRESS');
        const progId = editingBlock.linkedProgressId || '';
        setSelectedProgressId(progId);
        setProgressBlockTitle(editingBlock.title);
        const prog = progressBars.find((p) => p.id === progId);
        if (prog) {
          if (prog.type === 'TIME') {
            setDailyTargetInput(
              prog.targetDailySeconds ? String(Math.round(prog.targetDailySeconds / 60)) : ''
            );
          } else {
            setDailyTargetInput(prog.dailyGoal ? String(prog.dailyGoal) : '');
          }
        }
      }
    } else {
      setHasSpecificTime(true);
      setStartTime(initialStartTime);
      setEndTime(initialEndTime);
      setObligation('FLEXIBLE');
      setLayer(0);
      setActiveTab(initialTab || 'PROGRESS');

      setSelectedProgressId('');
      setProgressBlockTitle('');
      setDailyTargetInput('');

      setTaskMode(tasks.some((t) => !t.isCompleted) ? 'EXISTING' : 'NEW');
      setSelectedTaskId('');
      setTaskBlockTitle('');
      setNewSubitemText('');
      setNewTaskTitle('');
      setNewTaskPriority('P2');
      setNewTaskTier('FOCUS');
      setNewTaskSubitems([]);
      setNewTaskSubitemDraft('');
    }
  }, [isOpen, editingBlock, initialStartTime, initialEndTime, initialTab, date]);

  if (!isOpen) return null;

  const getProgressLabel = (progId: string) => {
    const p = progressBars.find((item) => item.id === progId);
    if (!p) return '';
    if (p.parentId) {
      const parent = progressBars.find((par) => par.id === p.parentId);
      return parent ? `${parent.title} › ${p.title}` : p.title;
    }
    return p.title;
  };

  const handleSelectProgress = (id: string) => {
    setSelectedProgressId(id);
    const prog = progressBars.find((p) => p.id === id);
    if (prog) {
      if (!progressBlockTitle || progressBars.some((p) => p.title === progressBlockTitle)) {
        setProgressBlockTitle(prog.title);
      }
      if (prog.type === 'TIME') {
        setDailyTargetInput(
          prog.targetDailySeconds ? String(Math.round(prog.targetDailySeconds / 60)) : ''
        );
      } else {
        setDailyTargetInput(prog.dailyGoal ? String(prog.dailyGoal) : '');
      }
    }
  };

  const handleSelectTask = (id: string) => {
    setSelectedTaskId(id);
    const task = tasks.find((t) => t.id === id);
    if (task && (!taskBlockTitle || tasks.some((t) => t.title === taskBlockTitle))) {
      setTaskBlockTitle(task.title);
    }
  };

  const handleAddSubitemToExistingTask = () => {
    if (!selectedTask || !newSubitemText.trim()) return;
    const item: TaskSubItem = {
      id: `sub-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: newSubitemText.trim(),
      isCompleted: false,
    };
    updateTask(selectedTask.id, {
      subitems: [...(selectedTask.subitems || []), item],
    });
    setNewSubitemText('');
  };

  const handleRemoveSubitemFromExistingTask = (subId: string) => {
    if (!selectedTask) return;
    updateTask(selectedTask.id, {
      subitems: (selectedTask.subitems || []).filter((s) => s.id !== subId),
    });
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const startMin = timeStringToMinutes(startTime);
    const endMin = timeStringToMinutes(endTime);
    if (hasSpecificTime && endMin <= startMin) {
      showToast('O horário de término precisa ser posterior ao horário de início.', 'warning');
      return;
    }

    let payload: Omit<ScheduledBlock, 'id'> | null = null;

    if (activeTab === 'PROGRESS') {
      if (!selectedProgress) {
        showToast('Selecione um progresso para alocar neste horário.', 'warning');
        return;
      }
      if (overlappingArea && selectedProgress.energyTier !== overlappingArea.tier) {
        showToast(
          `Este horário está na área "${overlappingArea.title}" (${TIER_INFO[overlappingArea.tier].label}). Selecione um progresso compatível.`,
          'warning'
        );
        return;
      }

      // Persist adjusted daily target if user edited it
      const parsedVal = Number(dailyTargetInput);
      if (!Number.isNaN(parsedVal) && dailyTargetInput.trim() !== '') {
        if (selectedProgress.type === 'TIME') {
          updateProgressBar(selectedProgress.id, {
            targetDailySeconds: parsedVal > 0 ? Math.round(parsedVal * 60) : undefined,
          });
        } else if (selectedProgress.type === 'CHECKPOINT' || selectedProgress.type === 'TASKS') {
          updateProgressBar(selectedProgress.id, {
            dailyGoal: parsedVal > 0 ? Math.round(parsedVal) : undefined,
          });
        }
      } else if (dailyTargetInput.trim() === '') {
        if (selectedProgress.type === 'TIME') {
          updateProgressBar(selectedProgress.id, { targetDailySeconds: undefined });
        } else {
          updateProgressBar(selectedProgress.id, { dailyGoal: undefined });
        }
      }

      payload = {
        date,
        title: progressBlockTitle.trim() || selectedProgress.title,
        startTime: hasSpecificTime ? startTime : '',
        endTime: hasSpecificTime ? endTime : '',
        tier: selectedProgress.energyTier,
        obligation,
        layer,
        allocationType: 'PROGRESS',
        linkedProgressId: selectedProgress.id,
        linkedTaskId: undefined,
        color: selectedProgress.color,
      };
    } else {
      let targetTask: TaskItem | undefined;
      if (taskMode === 'NEW') {
        if (!newTaskTitle.trim()) {
          showToast('Digite o título da nova tarefa.', 'warning');
          return;
        }
        const durationMinutes = hasSpecificTime ? Math.max(15, endMin - startMin) : 45;
        const effectiveNewTaskTier = overlappingArea ? overlappingArea.tier : newTaskTier;
        targetTask = addTask({
          title: newTaskTitle.trim(),
          priority: newTaskPriority,
          obligation,
          energyTier: effectiveNewTaskTier,
          isCompleted: false,
          durationMinutes,
          date: builtRecurrenceRule ? undefined : date,
          recurrence: builtRecurrenceRule,
          attachedAreaId: overlappingArea?.id,
          subitems: newTaskSubitems,
        });
      } else {
        if (!selectedTask) {
          showToast('Selecione uma tarefa existente ou crie uma nova.', 'warning');
          return;
        }
        if (overlappingArea && selectedTask.energyTier !== overlappingArea.tier) {
          showToast(
            `Esta tarefa não é compatível com a área "${overlappingArea.title}" (${TIER_INFO[overlappingArea.tier].label}).`,
            'warning'
          );
          return;
        }
        targetTask = selectedTask;
      }

      payload = {
        date,
        title: taskBlockTitle.trim() || targetTask.title,
        startTime: hasSpecificTime ? startTime : '',
        endTime: hasSpecificTime ? endTime : '',
        tier: targetTask.energyTier,
        obligation,
        layer,
        allocationType: 'TASK',
        linkedTaskId: targetTask.id,
        linkedProgressId: undefined,
      };
    }

    if (!payload) return;

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

  const durationMins = hasSpecificTime
    ? Math.max(0, timeStringToMinutes(endTime) - timeStringToMinutes(startTime))
    : 0;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-cozy-card border border-cozy-border rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-cozy-border flex items-center justify-between bg-cozy-bg/60">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-cozy-lavender/15 text-cozy-lavender border border-cozy-lavender/30">
                {editingBlock ? 'Editar Alocação' : 'Novo Bloco na Régua'}
              </span>
              {editingBlock?.routineOriginId && (
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-cozy-sky/15 text-cozy-sky border border-cozy-sky/30">
                  Originado da Rotina (altera só este dia)
                </span>
              )}
            </div>
            <h3 className="text-lg font-extrabold text-cozy-text mt-1">
              Configurar Horário • {formatDateBR(date)}
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
          {/* Shared Time / Obligation / Layer Row */}
          <div className="bg-cozy-bg/70 p-3.5 rounded-2xl border border-cozy-border space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-[11px] font-bold text-cozy-subtext uppercase flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-cozy-lavender" />
                Horário do Evento
              </span>
              <button
                type="button"
                onClick={() => setHasSpecificTime((prev) => !prev)}
                className={`px-3 py-1 rounded-full text-[11px] font-bold border transition-colors ${
                  hasSpecificTime
                    ? 'bg-cozy-lavender/15 text-cozy-lavender border-cozy-lavender/40 hover:bg-cozy-lavender/25'
                    : 'bg-cozy-sky/20 text-cozy-sky border-cozy-sky/40 hover:bg-cozy-sky/30'
                }`}
              >
                {hasSpecificTime
                  ? '🕒 Com horário definido'
                  : '📅 Sem horário específico (só a data)'}
              </button>
            </div>

            {!hasSpecificTime && (
              <div className="p-2.5 rounded-xl bg-cozy-sky/10 border border-dashed border-cozy-sky/35 text-xs text-cozy-sky font-medium leading-relaxed">
                Evento sem horário especificado — ficará visível no calendário e exibirá &ldquo;É hoje&rdquo; no Meu Dia na data marcada.
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
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
                  Término {hasSpecificTime ? `(${durationMins}m)` : '(Sem hora)'}
                </label>
                <input
                  type="time"
                  disabled={!hasSpecificTime}
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-cozy-card border border-cozy-border text-sm font-bold text-cozy-text focus:outline-none focus:border-cozy-lavender disabled:opacity-40"
                />
              </div>
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
                  Empilhamento
                </label>
                <button
                  type="button"
                  onClick={() => setLayer((prev) => (prev === 0 ? 1 : 0))}
                  className={`w-full px-3 py-2 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${
                    layer === 1
                      ? 'bg-cozy-lavender/20 text-cozy-lavender border-cozy-lavender/40'
                      : 'bg-cozy-card text-cozy-subtext border-cozy-border hover:text-cozy-text'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  {layer === 1 ? 'Sobreposto (2ª)' : 'Base (Principal)'}
                </button>
              </div>
            </div>
          </div>

          {/* Overlapping Área do Dia Indicator */}
          {overlappingArea && (
            <div className="p-3 rounded-2xl bg-cozy-lavender/10 border border-cozy-lavender/30 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs">
                <Lock className="w-4 h-4 text-cozy-lavender shrink-0" />
                <div>
                  <span className="font-bold text-cozy-text">
                    Horário dentro da área &ldquo;{overlappingArea.title}&rdquo;
                  </span>
                  <p className="text-[11px] text-cozy-subtext">
                    Apenas progressos e tarefas compatíveis com{' '}
                    <span className="font-bold text-cozy-lavender">
                      {TIER_INFO[overlappingArea.tier].icon} {TIER_INFO[overlappingArea.tier].label}
                    </span>{' '}
                    podem ser alocados aqui.
                  </p>
                </div>
              </div>
              <span
                className={`text-[11px] font-bold px-2.5 py-1 rounded-full border shrink-0 ${
                  TIER_INFO[overlappingArea.tier].badgeCls
                }`}
              >
                {TIER_INFO[overlappingArea.tier].icon} {TIER_INFO[overlappingArea.tier].label}
              </span>
            </div>
          )}

          {/* 2-Tab Switcher */}
          <div className="grid grid-cols-2 gap-2 p-1.5 bg-cozy-bg rounded-2xl border border-cozy-border">
            <button
              type="button"
              onClick={() => setActiveTab('PROGRESS')}
              className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'PROGRESS'
                  ? 'bg-cozy-sage/20 text-cozy-sage border border-cozy-sage/40 shadow-sm'
                  : 'text-cozy-subtext hover:text-cozy-text'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              <span>Alocar Progresso</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('TASK')}
              className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'TASK'
                  ? 'bg-cozy-sky/20 text-cozy-sky border border-cozy-sky/40 shadow-sm'
                  : 'text-cozy-subtext hover:text-cozy-text'
              }`}
            >
              <CheckSquare className="w-4 h-4" />
              <span>Alocar Tarefa</span>
            </button>
          </div>

          {/* TAB 1: ALOCAR PROGRESSO */}
          {activeTab === 'PROGRESS' && (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-cozy-subtext block mb-1.5">
                  Selecionar Progresso ou Subprogresso
                </label>
                {availableProgresses.length === 0 ? (
                  <div className="p-4 rounded-2xl bg-cozy-bg border border-cozy-border text-xs text-cozy-subtext text-center">
                    {overlappingArea
                      ? `Nenhum progresso em aberto compatível com "${TIER_INFO[overlappingArea.tier].label}".`
                      : 'Todos os progressos foram concluídos ou nenhum foi criado ainda.'}
                  </div>
                ) : (
                  <select
                    value={selectedProgressId}
                    onChange={(e) => handleSelectProgress(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-cozy-bg border border-cozy-border text-sm font-semibold text-cozy-text focus:outline-none focus:border-cozy-sage"
                  >
                    <option value="">Escolha um progresso / subprogresso...</option>
                    {availableProgresses.map((p) => (
                      <option key={p.id} value={p.id}>
                        {getProgressLabel(p.id)} (
                        {p.type === 'TIME'
                          ? p.isUnlimited
                            ? 'Tempo Ilimitado'
                            : 'Tempo'
                          : p.type === 'TASKS'
                            ? 'Tarefas'
                            : 'Checkpoint'}
                        )
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="text-xs font-bold text-cozy-subtext block mb-1.5">
                  Título do Bloco na Agenda / Meu Dia
                </label>
                <input
                  type="text"
                  value={progressBlockTitle}
                  onChange={(e) => setProgressBlockTitle(e.target.value)}
                  placeholder="Ex: Revisão Matemática — Exercícios"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-cozy-bg border border-cozy-border text-sm text-cozy-text focus:outline-none focus:border-cozy-sage"
                />
              </div>

              {selectedProgress && (
                <div className="p-4 rounded-2xl bg-cozy-bg/80 border border-cozy-sage/30 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-bold text-cozy-sage">
                      <Target className="w-4 h-4" />
                      <span>Ajustar Meta Diária deste Progresso</span>
                    </div>
                    <span className="text-[11px] text-cozy-subtext">
                      {selectedProgress.type === 'TIME' && selectedProgress.spentTodaySeconds !== undefined
                        ? `Feito hoje: ${formatSecondsToHuman(selectedProgress.spentTodaySeconds)}`
                        : selectedProgress.todayCompleted !== undefined
                          ? `Feito hoje: ${selectedProgress.todayCompleted}`
                          : ''}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      min={0}
                      value={dailyTargetInput}
                      onChange={(e) => setDailyTargetInput(e.target.value)}
                      placeholder={
                        selectedProgress.type === 'TIME'
                          ? 'Minutos por dia (vazio = sem limite diário)'
                          : 'Quantidade diária (vazio = livre)'
                      }
                      className="flex-1 px-3 py-2 rounded-xl bg-cozy-card border border-cozy-border text-sm font-bold text-cozy-text focus:outline-none focus:border-cozy-sage"
                    />
                    <span className="text-xs font-bold text-cozy-subtext">
                      {selectedProgress.type === 'TIME' ? 'minutos / dia' : 'unid / dia'}
                    </span>
                  </div>
                  {selectedProgress.type === 'TIME' && durationMins > 0 && (
                    <button
                      type="button"
                      onClick={() => setDailyTargetInput(String(durationMins))}
                      className="text-[11px] font-semibold text-cozy-sage hover:underline"
                    >
                      Usar duração do bloco ({durationMins} min) como meta diária
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: ALOCAR TAREFA */}
          {activeTab === 'TASK' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setTaskMode('EXISTING')}
                  className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                    taskMode === 'EXISTING'
                      ? 'bg-cozy-sky/15 text-cozy-sky border-cozy-sky/40'
                      : 'bg-cozy-bg text-cozy-subtext border-cozy-border hover:text-cozy-text'
                  }`}
                >
                  Selecionar Tarefa Existente
                </button>
                <button
                  type="button"
                  onClick={() => setTaskMode('NEW')}
                  className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                    taskMode === 'NEW'
                      ? 'bg-cozy-sky/15 text-cozy-sky border-cozy-sky/40'
                      : 'bg-cozy-bg text-cozy-subtext border-cozy-border hover:text-cozy-text'
                  }`}
                >
                  + Criar Nova Tarefa
                </button>
              </div>

              {taskMode === 'EXISTING' ? (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-bold text-cozy-subtext block mb-1.5">
                      Tarefa
                    </label>
                    <div className="flex items-center gap-2">
                      <select
                        value={selectedTaskId}
                        onChange={(e) => handleSelectTask(e.target.value)}
                        className="flex-1 px-3.5 py-2.5 rounded-xl bg-cozy-bg border border-cozy-border text-sm font-semibold text-cozy-text focus:outline-none focus:border-cozy-sky"
                      >
                        <option value="">Escolha uma tarefa...</option>
                        {sortedTasks.map((t) => (
                          <option key={t.id} value={t.id}>
                            [{t.priority}] {t.isCompleted ? '✓ ' : ''}
                            {t.title} ({t.durationMinutes}m)
                            {t.date ? ` • ${formatDateBR(t.date)}` : ''}
                          </option>
                        ))}
                      </select>
                      {selectedTask && (
                        <button
                          type="button"
                          onClick={() =>
                            requestConfirm(
                              'Excluir Tarefa?',
                              `Deseja excluir permanentemente a tarefa "${selectedTask.title}" e todos os blocos ligados a ela?`,
                              () => {
                                const taskIdToRemove = selectedTask.id;
                                setSelectedTaskId('');
                                setTaskBlockTitle('');
                                deleteTask(taskIdToRemove);
                              }
                            )
                          }
                          className="p-2.5 rounded-xl bg-cozy-rose/15 text-cozy-rose border border-cozy-rose/30 hover:bg-cozy-rose/25 transition-colors shrink-0"
                          title="Excluir esta tarefa permanentemente"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-cozy-subtext block mb-1.5">
                      Título do Bloco (opcional)
                    </label>
                    <input
                      type="text"
                      value={taskBlockTitle}
                      onChange={(e) => setTaskBlockTitle(e.target.value)}
                      placeholder="Mesmo título da tarefa"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-cozy-bg border border-cozy-border text-sm text-cozy-text focus:outline-none focus:border-cozy-sky"
                    />
                  </div>

                  {selectedTask && (
                    <div className="p-4 rounded-2xl bg-cozy-bg/80 border border-cozy-sky/30 space-y-3">
                      {/* Tag de Energia da Tarefa Existente */}
                      <div>
                        <span className="text-[11px] font-bold text-cozy-subtext block mb-1.5">
                          Tag de Energia da Tarefa:
                        </span>
                        <div className="flex items-center gap-2 flex-wrap">
                          {(['FOCUS', 'TRANSIT', 'BACKGROUND'] as EnergyTier[]).map((tierKey) => {
                            const active = selectedTask.energyTier === tierKey;
                            const blocked = Boolean(overlappingArea && overlappingArea.tier !== tierKey);
                            return (
                              <button
                                key={tierKey}
                                type="button"
                                disabled={blocked}
                                onClick={() => updateTask(selectedTask.id, { energyTier: tierKey })}
                                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all ${
                                  active
                                    ? TIER_INFO[tierKey].badgeCls
                                    : 'bg-cozy-card text-cozy-subtext border-cozy-border hover:text-cozy-text'
                                } ${blocked ? 'opacity-40 cursor-not-allowed' : ''}`}
                              >
                                {TIER_INFO[tierKey].icon} {TIER_INFO[tierKey].label}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-cozy-sky">
                          Subitens desta Tarefa ({selectedTask.subitems?.length || 0})
                        </span>
                      </div>
                      <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                        {(selectedTask.subitems || []).map((sub) => (
                          <div
                            key={sub.id}
                            className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl bg-cozy-card border border-cozy-border text-xs"
                          >
                            <button
                              type="button"
                              onClick={() => toggleTaskSubitem(selectedTask.id, sub.id)}
                              className="flex items-center gap-2 text-left flex-1 min-w-0"
                            >
                              <span
                                className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 ${
                                  sub.isCompleted
                                    ? 'bg-cozy-sage border-cozy-sage text-cozy-bg'
                                    : 'border-cozy-border'
                                }`}
                              >
                                {sub.isCompleted && <Check className="w-3 h-3 stroke-[3]" />}
                              </span>
                              <span
                                className={`whitespace-normal break-words leading-snug ${
                                  sub.isCompleted
                                    ? 'line-through text-cozy-subtext'
                                    : 'text-cozy-text font-medium'
                                }`}
                              >
                                {sub.title}
                              </span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveSubitemFromExistingTask(sub.id)}
                              className="text-cozy-subtext hover:text-cozy-rose p-1"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                      <div className="flex items-center gap-2 pt-1">
                        <input
                          type="text"
                          value={newSubitemText}
                          onChange={(e) => setNewSubitemText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddSubitemToExistingTask();
                            }
                          }}
                          placeholder="Adicionar subitem..."
                          className="flex-1 px-3 py-1.5 rounded-xl bg-cozy-card border border-cozy-border text-xs text-cozy-text focus:outline-none focus:border-cozy-sky"
                        />
                        <button
                          type="button"
                          onClick={handleAddSubitemToExistingTask}
                          className="px-3 py-1.5 rounded-xl bg-cozy-sky/20 text-cozy-sky border border-cozy-sky/30 text-xs font-bold hover:bg-cozy-sky/30"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3 bg-cozy-bg/60 p-4 rounded-2xl border border-cozy-border">
                  <div>
                    <label className="text-xs font-bold text-cozy-subtext block mb-1">
                      Título da Nova Tarefa
                    </label>
                    <input
                      type="text"
                      value={newTaskTitle}
                      onChange={(e) => {
                        setNewTaskTitle(e.target.value);
                        setTaskBlockTitle(e.target.value);
                      }}
                      placeholder="Ex: Entregar relatório mensal"
                      className="w-full px-3.5 py-2 rounded-xl bg-cozy-card border border-cozy-border text-sm text-cozy-text focus:outline-none focus:border-cozy-sky"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-bold text-cozy-subtext block mb-1">
                        Prioridade
                      </label>
                      <select
                        value={newTaskPriority}
                        onChange={(e) => setNewTaskPriority(e.target.value as Priority)}
                        className="w-full px-3 py-2 rounded-xl bg-cozy-card border border-cozy-border text-xs font-bold text-cozy-text"
                      >
                        <option value="P1">P1 — Crítica</option>
                        <option value="P2">P2 — Alta</option>
                        <option value="P3">P3 — Normal</option>
                        <option value="P4">P4 — Baixa</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-cozy-subtext block mb-1">
                        Tag de Energia {overlappingArea ? '(Travada pela área)' : ''}
                      </label>
                      <select
                        value={overlappingArea ? overlappingArea.tier : newTaskTier}
                        disabled={Boolean(overlappingArea)}
                        onChange={(e) => setNewTaskTier(e.target.value as EnergyTier)}
                        className="w-full px-3 py-2 rounded-xl bg-cozy-card border border-cozy-border text-xs font-bold text-cozy-text disabled:opacity-75"
                      >
                        <option value="FOCUS">🧠 Focado</option>
                        <option value="TRANSIT">🎧 Baixo Foco</option>
                        <option value="BACKGROUND">🫧 Segundo Plano</option>
                      </select>
                    </div>
                  </div>

                  {/* Subitems builder */}
                  <div className="pt-1 space-y-2">
                    <label className="text-[11px] font-bold text-cozy-subtext block">
                      Subitens da Tarefa ({newTaskSubitems.length})
                    </label>
                    {newTaskSubitems.map((sub) => (
                      <div
                        key={sub.id}
                        className="flex items-center justify-between px-3 py-1.5 rounded-xl bg-cozy-card border border-cozy-border text-xs"
                      >
                        <span className="text-cozy-text">{sub.title}</span>
                        <button
                          type="button"
                          onClick={() =>
                            setNewTaskSubitems((prev) => prev.filter((i) => i.id !== sub.id))
                          }
                          className="text-cozy-subtext hover:text-cozy-rose"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                    <div className="flex items-center gap-2">
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
                        placeholder="Adicionar etapa/subitem..."
                        className="flex-1 px-3 py-1.5 rounded-xl bg-cozy-card border border-cozy-border text-xs text-cozy-text focus:outline-none focus:border-cozy-sky"
                      />
                      <button
                        type="button"
                        onClick={handleAddDraftSubitem}
                        className="px-3 py-1.5 rounded-xl bg-cozy-sky/20 text-cozy-sky border border-cozy-sky/30 text-xs font-bold"
                      >
                        + Subitem
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Google Calendar Style Recurrence (new blocks only) */}
          {!editingBlock && (
            <div className="p-4 rounded-2xl bg-cozy-bg/70 border border-cozy-border space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 text-xs font-bold text-cozy-text">
                  <Repeat className="w-4 h-4 text-cozy-lavender" />
                  <span>Repetição (Estilo Agenda)</span>
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
                    <span className="text-xs text-cozy-subtext font-semibold">Repetir a cada</span>
                    <input
                      type="number"
                      min={1}
                      max={30}
                      value={recInterval}
                      onChange={(e) => setRecInterval(Math.max(1, Number(e.target.value) || 1))}
                      className="w-16 px-2.5 py-1 rounded-xl bg-cozy-card border border-cozy-border text-xs font-bold text-cozy-text text-center"
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
                      <div className="flex items-center gap-1.5 flex-wrap">
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
                              className={`w-8 h-8 rounded-full text-xs font-extrabold border transition-all ${
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
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => setRecEndType('NEVER')}
                        className={`px-3 py-1.5 rounded-xl border text-xs font-bold text-left ${
                          recEndType === 'NEVER'
                            ? 'bg-cozy-lavender/15 border-cozy-lavender text-cozy-lavender'
                            : 'bg-cozy-card border-cozy-border text-cozy-subtext'
                        }`}
                      >
                        Nunca (até 8 sem.)
                      </button>

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
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl border ${
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
                        <span className="text-[11px] text-cozy-subtext">Após</span>
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
                          className="w-12 bg-cozy-bg border border-cozy-border rounded-lg px-1.5 py-0.5 text-xs font-bold text-cozy-text text-center"
                        />
                        <span className="text-[11px] text-cozy-subtext">x</span>
                      </div>
                    </div>
                  </div>

                  <p className="text-[11px] text-cozy-lavender font-semibold">
                    Serão criados {recurrencePreviewCount} bloco(s) na agenda a partir de{' '}
                    {formatDateBR(date)}.
                  </p>
                </div>
              )}
            </div>
          )}

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
                <span>Arraste as bordas na régua para redimensionar depois</span>
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
