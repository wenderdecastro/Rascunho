import React, { useState, useEffect, useMemo } from 'react';
import { useApp, PRIORITY_WEIGHT } from '../context/AppContext';
import {
  EnergyTier,
  Obligation,
  Priority,
  ScheduledBlock,
  TaskItem,
  TaskSubItem,
} from '../types';
import { formatSecondsToHuman, timeStringToMinutes, formatDateBR } from '../utils/helpers';
import {
  X,
  BarChart3,
  CheckSquare,
  Clock,
  Plus,
  Trash2,
  ShieldAlert,
  Sparkles,
  Layers,
  Check,
  Target,
  Brain,
  Headphones,
  Wind,
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

type ModalTab = 'PROGRESS' | 'TASK' | 'TIME';

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

  const [activeTab, setActiveTab] = useState<ModalTab>('TIME');
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
  const [newTaskTier, setNewTaskTier] = useState<'FOCUS' | 'TRANSIT' | 'BACKGROUND'>('FOCUS');
  const [newTaskSubitems, setNewTaskSubitems] = useState<TaskSubItem[]>([]);
  const [newTaskSubitemDraft, setNewTaskSubitemDraft] = useState<string>('');
  const [newTaskEligibleWork, setNewTaskEligibleWork] = useState<boolean>(false);
  const [newTaskEligibleCollege, setNewTaskEligibleCollege] = useState<boolean>(false);
  const [newTaskEligibleCommute, setNewTaskEligibleCommute] = useState<boolean>(false);

  // Tab 3: Tempo
  const [timeBlockTitle, setTimeBlockTitle] = useState<string>('');
  const [timeBlockTier, setTimeBlockTier] = useState<EnergyTier>('FOCUS');

  const availableProgresses = useMemo(
    () => progressBars.filter((p) => !p.isCompleted),
    [progressBars]
  );

  const sortedTasks = useMemo(
    () =>
      [...tasks].sort((a, b) => {
        if (a.isCompleted !== b.isCompleted) return a.isCompleted ? 1 : -1;
        return PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority];
      }),
    [tasks]
  );

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

    if (editingBlock) {
      setStartTime(editingBlock.startTime);
      setEndTime(editingBlock.endTime);
      setObligation(editingBlock.obligation);
      setLayer(editingBlock.layer === 1 ? 1 : 0);

      if (editingBlock.linkedProgressId || editingBlock.allocationType === 'PROGRESS') {
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
      } else if (editingBlock.linkedTaskId || editingBlock.allocationType === 'TASK') {
        setActiveTab('TASK');
        setTaskMode('EXISTING');
        setSelectedTaskId(editingBlock.linkedTaskId || '');
        setTaskBlockTitle(editingBlock.title);
      } else {
        setActiveTab('TIME');
        setTimeBlockTitle(editingBlock.title);
        setTimeBlockTier(editingBlock.tier);
      }
    } else {
      setStartTime(initialStartTime);
      setEndTime(initialEndTime);
      setObligation('FLEXIBLE');
      setLayer(0);
      setActiveTab(initialTab || 'TIME');

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
      setNewTaskEligibleWork(false);
      setNewTaskEligibleCollege(false);
      setNewTaskEligibleCommute(false);

      setTimeBlockTitle('');
      setTimeBlockTier('FOCUS');
    }
  }, [isOpen, editingBlock, initialStartTime, initialEndTime, initialTab]);

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
    if (endMin <= startMin) {
      showToast('O horário de término precisa ser posterior ao horário de início.', 'warning');
      return;
    }

    let payload: Omit<ScheduledBlock, 'id'> | null = null;

    if (activeTab === 'PROGRESS') {
      if (!selectedProgress) {
        showToast('Selecione um progresso para alocar neste horário.', 'warning');
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
        startTime,
        endTime,
        tier: selectedProgress.energyTier,
        obligation,
        layer,
        allocationType: 'PROGRESS',
        linkedProgressId: selectedProgress.id,
        linkedTaskId: undefined,
        color: selectedProgress.color,
      };
    } else if (activeTab === 'TASK') {
      let targetTask: TaskItem | undefined;
      if (taskMode === 'NEW') {
        if (!newTaskTitle.trim()) {
          showToast('Digite o título da nova tarefa.', 'warning');
          return;
        }
        const durationMinutes = Math.max(15, endMin - startMin);
        targetTask = addTask({
          title: newTaskTitle.trim(),
          priority: newTaskPriority,
          obligation,
          energyTier: newTaskTier,
          isCompleted: false,
          durationMinutes,
          date,
          subitems: newTaskSubitems,
          eligibleWork: newTaskEligibleWork,
          eligibleCollege: newTaskEligibleCollege,
          eligibleCommute: newTaskEligibleCommute,
        });
      } else {
        if (!selectedTask) {
          showToast('Selecione uma tarefa existente ou crie uma nova.', 'warning');
          return;
        }
        targetTask = selectedTask;
      }

      payload = {
        date,
        title: taskBlockTitle.trim() || targetTask.title,
        startTime,
        endTime,
        tier: targetTask.energyTier,
        obligation,
        layer,
        allocationType: 'TASK',
        linkedTaskId: targetTask.id,
        linkedProgressId: undefined,
      };
    } else {
      // TIME allocation
      if (!timeBlockTitle.trim()) {
        showToast('Digite um título para o bloco de tempo.', 'warning');
        return;
      }
      payload = {
        date,
        title: timeBlockTitle.trim(),
        startTime,
        endTime,
        tier: timeBlockTier,
        obligation,
        layer,
        allocationType: 'TIME',
        linkedProgressId: undefined,
        linkedTaskId: undefined,
      };
    }

    if (!payload) return;

    if (editingBlock) {
      updateEffectiveBlock(date, editingBlock, payload);
    } else {
      addScheduledBlock(payload);
    }
    onClose();
  };

  const handleDelete = () => {
    if (!editingBlock) return;
    requestConfirm(
      'Remover bloco do dia',
      `Deseja remover "${editingBlock.title}" (${editingBlock.startTime} - ${editingBlock.endTime}) apenas deste dia? Se veio da rotina semanal, a sua rotina base continuará intacta.`,
      () => {
        deleteEffectiveBlock(date, editingBlock);
        onClose();
      }
    );
  };

  const durationMins = Math.max(0, timeStringToMinutes(endTime) - timeStringToMinutes(startTime));

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
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-cozy-bg/70 p-3.5 rounded-2xl border border-cozy-border">
            <div>
              <label className="text-[11px] font-bold text-cozy-subtext uppercase block mb-1">
                Início
              </label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-cozy-card border border-cozy-border text-sm font-bold text-cozy-text focus:outline-none focus:border-cozy-lavender"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-cozy-subtext uppercase block mb-1">
                Término ({durationMins}m)
              </label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-cozy-card border border-cozy-border text-sm font-bold text-cozy-text focus:outline-none focus:border-cozy-lavender"
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

          {/* 3-Tab Switcher */}
          <div className="grid grid-cols-3 gap-2 p-1.5 bg-cozy-bg rounded-2xl border border-cozy-border">
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
            <button
              type="button"
              onClick={() => setActiveTab('TIME')}
              className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'TIME'
                  ? 'bg-cozy-peach/20 text-cozy-peach border border-cozy-peach/40 shadow-sm'
                  : 'text-cozy-subtext hover:text-cozy-text'
              }`}
            >
              <Clock className="w-4 h-4" />
              <span>Alocar Tempo</span>
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
                    Todos os progressos foram concluídos ou nenhum foi criado ainda.
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
                      {/* Elegibilidade da Tarefa Existente */}
                      <div>
                        <span className="text-[11px] font-bold text-cozy-subtext block mb-1">
                          Elegibilidade para Áreas da Rotina:
                        </span>
                        <div className="flex items-center gap-3 flex-wrap">
                          <label className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selectedTask.eligibleWork || false}
                              onChange={(e) => updateTask(selectedTask.id, { eligibleWork: e.target.checked })}
                              className="rounded border-cozy-border"
                            />
                            <span>💼 Trabalho</span>
                          </label>
                          <label className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selectedTask.eligibleCollege || false}
                              onChange={(e) => updateTask(selectedTask.id, { eligibleCollege: e.target.checked })}
                              className="rounded border-cozy-border"
                            />
                            <span>🎓 Faculdade</span>
                          </label>
                          <label className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selectedTask.eligibleCommute || false}
                              onChange={(e) => updateTask(selectedTask.id, { eligibleCommute: e.target.checked })}
                              className="rounded border-cozy-border"
                            />
                            <span>🚌 Transporte</span>
                          </label>
                        </div>
                        <p className="text-[10px] text-cozy-subtext mt-1">
                          {!selectedTask.eligibleWork && !selectedTask.eligibleCollege && !selectedTask.eligibleCommute
                            ? '🌿 Livre/Pessoal: só será distribuída automaticamente em blocos livres.'
                            : 'Elegível para auto-distribuição nas áreas marcadas.'}
                        </p>
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
                                className={`truncate ${
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
                        Tag de Foco
                      </label>
                      <select
                        value={newTaskTier}
                        onChange={(e) =>
                          setNewTaskTier(e.target.value as 'FOCUS' | 'TRANSIT' | 'BACKGROUND')
                        }
                        className="w-full px-3 py-2 rounded-xl bg-cozy-card border border-cozy-border text-xs font-bold text-cozy-text"
                      >
                        <option value="FOCUS">🧠 Focado</option>
                        <option value="TRANSIT">🎧 Baixo Foco</option>
                        <option value="BACKGROUND">🫧 Segundo Plano</option>
                      </select>
                    </div>
                  </div>

                  {/* Elegibilidade da Nova Tarefa */}
                  <div className="p-3 rounded-xl bg-cozy-card border border-cozy-border space-y-1.5">
                    <span className="text-[11px] font-bold text-cozy-subtext block">
                      Elegibilidade para Áreas da Rotina:
                    </span>
                    <div className="flex items-center gap-3 flex-wrap">
                      <label className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer">
                        <input
                          type="checkbox"
                          checked={newTaskEligibleWork}
                          onChange={(e) => setNewTaskEligibleWork(e.target.checked)}
                          className="rounded border-cozy-border"
                        />
                        <span>💼 Trabalho</span>
                      </label>
                      <label className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer">
                        <input
                          type="checkbox"
                          checked={newTaskEligibleCollege}
                          onChange={(e) => setNewTaskEligibleCollege(e.target.checked)}
                          className="rounded border-cozy-border"
                        />
                        <span>🎓 Faculdade</span>
                      </label>
                      <label className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer">
                        <input
                          type="checkbox"
                          checked={newTaskEligibleCommute}
                          onChange={(e) => setNewTaskEligibleCommute(e.target.checked)}
                          className="rounded border-cozy-border"
                        />
                        <span>🚌 Transporte</span>
                      </label>
                    </div>
                    <p className="text-[10px] text-cozy-subtext">
                      {!newTaskEligibleWork && !newTaskEligibleCollege && !newTaskEligibleCommute
                        ? '🌿 Sem marcações: só pode ser distribuída em blocos livres (fora de trabalho/faculdade).'
                        : 'Elegível para auto-distribuição nas áreas correspondentes.'}
                    </p>
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

          {/* TAB 3: ALOCAR TEMPO */}
          {activeTab === 'TIME' && (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-cozy-subtext block mb-1.5">
                  Título do Bloco de Tempo
                </label>
                <input
                  type="text"
                  value={timeBlockTitle}
                  onChange={(e) => setTimeBlockTitle(e.target.value)}
                  placeholder="Ex: Deep Work, Leitura, Reunião, Treino..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-cozy-bg border border-cozy-border text-sm text-cozy-text focus:outline-none focus:border-cozy-peach"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-cozy-subtext block mb-2">
                  Tag do Bloco
                </label>
                <div className="grid grid-cols-3 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setTimeBlockTier('FOCUS')}
                    className={`p-3 rounded-2xl border text-left transition-all ${
                      timeBlockTier === 'FOCUS'
                        ? 'bg-cozy-lavender/15 border-cozy-lavender text-cozy-text shadow-sm'
                        : 'bg-cozy-bg border-cozy-border text-cozy-subtext hover:text-cozy-text'
                    }`}
                  >
                    <Brain className="w-4 h-4 text-cozy-lavender mb-1" />
                    <div className="text-xs font-bold">Focado</div>
                    <div className="text-[10px] text-cozy-subtext mt-0.5">Alta concentração</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTimeBlockTier('TRANSIT')}
                    className={`p-3 rounded-2xl border text-left transition-all ${
                      timeBlockTier === 'TRANSIT'
                        ? 'bg-cozy-butter/15 border-cozy-butter text-cozy-text shadow-sm'
                        : 'bg-cozy-bg border-cozy-border text-cozy-subtext hover:text-cozy-text'
                    }`}
                  >
                    <Headphones className="w-4 h-4 text-cozy-butter mb-1" />
                    <div className="text-xs font-bold">Baixo Foco</div>
                    <div className="text-[10px] text-cozy-subtext mt-0.5">Transporte / leve</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTimeBlockTier('BACKGROUND')}
                    className={`p-3 rounded-2xl border text-left transition-all ${
                      timeBlockTier === 'BACKGROUND'
                        ? 'bg-cozy-sky/15 border-cozy-sky text-cozy-text shadow-sm'
                        : 'bg-cozy-bg border-cozy-border text-cozy-subtext hover:text-cozy-text'
                    }`}
                  >
                    <Wind className="w-4 h-4 text-cozy-sky mb-1" />
                    <div className="text-xs font-bold">Segundo Plano</div>
                    <div className="text-[10px] text-cozy-subtext mt-0.5">Passivo / paralelo</div>
                  </button>
                </div>
              </div>
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
