import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { EnergyTier, ProgressBarItem, ProgressType } from '../types';
import { formatSecondsToHuman, formatSecondsToTimer } from '../utils/helpers';
import {
  Plus,
  Play,
  Pause,
  RotateCcw,
  CheckCircle2,
  Sparkles,
  Trash2,
  X,
  Coffee,
  Edit2,
  Check,
  Infinity as InfinityIcon,
  FolderTree,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';

const TONAL_SHADES = [
  '#A78BFA',
  '#8B5CF6',
  '#C4B5FD',
  '#7C3AED',
  '#6D28D9',
  '#DDD6FE',
  '#9333EA',
];

const ENERGY_OPTIONS: Array<{
  value: 'FOCUS' | 'TRANSIT' | 'BACKGROUND';
  label: string;
  shortLabel: string;
  badgeCls: string;
  btnCls: string;
  hint: string;
}> = [
  {
    value: 'FOCUS',
    label: '🧠 Foco Total',
    shortLabel: '🧠 Foco',
    badgeCls: 'bg-cozy-lavender-light text-cozy-lavender border-cozy-lavender/30',
    btnCls: 'bg-cozy-lavender-light text-cozy-lavender border-cozy-lavender shadow-cozy-pill',
    hint: 'Exige Foco Total',
  },
  {
    value: 'TRANSIT',
    label: '🎧 Baixo Foco',
    shortLabel: '🎧 Baixo Foco',
    badgeCls: 'bg-cozy-butter/15 text-cozy-butter border-cozy-butter/35',
    btnCls: 'bg-cozy-butter/20 text-cozy-butter border-cozy-butter shadow-cozy-pill',
    hint: 'Baixo foco / Trânsito',
  },
  {
    value: 'BACKGROUND',
    label: '🫧 Segundo Plano',
    shortLabel: '🫧 2º Plano',
    badgeCls: 'bg-cozy-sky/15 text-cozy-sky border-cozy-sky/35',
    btnCls: 'bg-cozy-sky/20 text-cozy-sky border-cozy-sky shadow-cozy-pill',
    hint: 'Segundo plano / Passivo',
  },
];

export const ProgressosView: React.FC = () => {
  const {
    progressBars,
    createProgressBar,
    updateProgressBar,
    deleteProgressBar,
    playProgress,
    pauseProgress,
    resumeFromPause,
    resetProgress,
    incrementCheckpoint,
    toggleSubtask,
    requestConfirm,
  } = useApp();

  const [filter, setFilter] = useState<'ALL' | 'TIME' | 'TASKS' | 'CHECKPOINT'>('ALL');
  const [showModal, setShowModal] = useState(false);
  const [parentTarget, setParentTarget] = useState<ProgressBarItem | null>(null);
  const [collapsedParents, setCollapsedParents] = useState<Record<string, boolean>>({});

  // Editing daily target state
  const [editingDailyId, setEditingDailyId] = useState<string | null>(null);
  const [dailyHoursDraft, setDailyHoursDraft] = useState<number>(2);

  // New Progress Bar Form State
  const [newTitle, setNewTitle] = useState('');
  const [newType, setNewType] = useState<ProgressType>('TIME');
  const [newEnergy, setNewEnergy] = useState<'FOCUS' | 'TRANSIT' | 'BACKGROUND'>('FOCUS');
  const [newColor, setNewColor] = useState('#B49BFA');

  // Time-specific Form
  const [timeCreationMode, setTimeCreationMode] = useState<'TOTAL' | 'CYCLE' | 'UNLIMITED'>('TOTAL');
  const [totalHoursInput, setTotalHoursInput] = useState(40);
  const [dailyHoursInput, setDailyHoursInput] = useState(2);
  const [hasDailyLimitUnlimited, setHasDailyLimitUnlimited] = useState(true);
  const [cycleDaysInput, setCycleDaysInput] = useState(20);

  // Tasks-specific Form
  const [taskInputs, setTaskInputs] = useState<Array<{ title: string; weight: number }>>([
    { title: 'Primeira etapa', weight: 50 },
    { title: 'Segunda etapa', weight: 50 },
  ]);

  // Checkpoint-specific Form
  const [checkpointTotalN, setCheckpointTotalN] = useState(30);
  const [checkpointDailyM, setCheckpointDailyM] = useState(2);

  const rootBars = progressBars.filter((p) => {
    if (p.parentId) return false;
    if (filter === 'ALL') return true;
    return p.type === filter;
  });

  const openCreateModal = (parent?: ProgressBarItem) => {
    if (parent) {
      setParentTarget(parent);
      setNewType(parent.type); // Locked to same category!
      setNewEnergy(parent.energyTier);
      setNewColor(parent.color);
    } else {
      setParentTarget(null);
      setNewType('TIME');
      setNewEnergy('FOCUS');
      setNewColor('#B49BFA');
    }
    setNewTitle('');
    setTimeCreationMode('TOTAL');
    setTotalHoursInput(40);
    setDailyHoursInput(2);
    setHasDailyLimitUnlimited(true);
    setCycleDaysInput(20);
    setTaskInputs([
      { title: 'Primeira etapa', weight: 50 },
      { title: 'Segunda etapa', weight: 50 },
    ]);
    setCheckpointTotalN(30);
    setCheckpointDailyM(2);
    setShowModal(true);
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const effectiveType = parentTarget ? parentTarget.type : newType;

    if (effectiveType === 'TIME') {
      if (timeCreationMode === 'UNLIMITED') {
        createProgressBar({
          parentId: parentTarget?.id,
          title: newTitle.trim(),
          type: 'TIME',
          energyTier: newEnergy,
          color: newColor,
          isUnlimited: true,
          targetTotalSeconds: undefined,
          targetDailySeconds:
            hasDailyLimitUnlimited && dailyHoursInput > 0
              ? Math.round(dailyHoursInput * 3600)
              : undefined,
        });
      } else {
        const calculatedTotalHours =
          timeCreationMode === 'CYCLE' ? dailyHoursInput * cycleDaysInput : totalHoursInput;

        createProgressBar({
          parentId: parentTarget?.id,
          title: newTitle.trim(),
          type: 'TIME',
          energyTier: newEnergy,
          color: newColor,
          isUnlimited: false,
          targetTotalSeconds: Math.max(900, Math.round(calculatedTotalHours * 3600)),
          targetDailySeconds:
            dailyHoursInput > 0 ? Math.round(dailyHoursInput * 3600) : undefined,
        });
      }
    } else if (effectiveType === 'TASKS') {
      createProgressBar({
        parentId: parentTarget?.id,
        title: newTitle.trim(),
        type: 'TASKS',
        energyTier: newEnergy,
        color: newColor,
        subtasks: taskInputs
          .filter((t) => t.title.trim() !== '')
          .map((t, idx) => ({
            id: `sub-${Date.now()}-${idx}`,
            title: t.title.trim(),
            weightPercent: t.weight,
            isCompleted: false,
          })),
      });
    } else if (effectiveType === 'CHECKPOINT') {
      createProgressBar({
        parentId: parentTarget?.id,
        title: newTitle.trim(),
        type: 'CHECKPOINT',
        energyTier: newEnergy,
        color: newColor,
        totalGoal: Number(checkpointTotalN),
        dailyGoal: Number(checkpointDailyM),
        totalCompleted: 0,
        todayCompleted: 0,
      });
    }

    setNewTitle('');
    setParentTarget(null);
    setShowModal(false);
  };

  const handleSaveDailyTarget = (progressId: string) => {
    updateProgressBar(progressId, {
      targetDailySeconds:
        dailyHoursDraft > 0 ? Math.max(300, Math.round(dailyHoursDraft * 3600)) : undefined,
    });
    setEditingDailyId(null);
  };

  const handleDeleteWithConfirm = (item: ProgressBarItem) => {
    const childCount = progressBars.filter((c) => c.parentId === item.id).length;
    const msg =
      childCount > 0
        ? `Tem certeza que deseja excluir "${item.title}" e seus ${childCount} subprogressos vinculados?`
        : `Tem certeza que deseja excluir "${item.title}"? Todo o histórico deste objetivo será removido.`;
    requestConfirm('Excluir Progresso?', msg, () => deleteProgressBar(item.id));
  };

  const getEnergyMeta = (tier: EnergyTier) =>
    ENERGY_OPTIONS.find((e) => e.value === tier) || ENERGY_OPTIONS[0];

  const renderProgressBody = (p: ProgressBarItem, isChild = false) => {
    const isRunning = p.isRunning && !p.isPaused;
    const isPaused = p.isPaused;

    const spentTotal = p.spentTotalSeconds || 0;
    const spentToday = p.spentTodaySeconds || 0;
    const targetDaily = p.targetDailySeconds;
    const isUnlimited = !!p.isUnlimited || !p.targetTotalSeconds;
    const targetTotal = p.targetTotalSeconds || Math.max(spentTotal + (targetDaily || 3600), 3600);

    const currentTotalPercent = isUnlimited
      ? 100
      : Math.min(100, Math.round((spentTotal / targetTotal) * 100));

    const remainingDaily = targetDaily ? Math.max(0, targetDaily - spentToday) : 0;
    const projectedTotalPercent =
      !isUnlimited && targetDaily
        ? Math.min(100, Math.round(((spentTotal + remainingDaily) / targetTotal) * 100))
        : currentTotalPercent;
    const ghostWidthPercent = Math.max(0, projectedTotalPercent - currentTotalPercent);

    return (
      <>
        {/* 1. TYPE === TIME */}
        {p.type === 'TIME' && (
          <div className="space-y-3 my-2">
            {/* Upper Bar: Total Progress (or Accumulated Unlimited) */}
            <div>
              <div className="flex justify-between items-center text-xs mb-1.5 font-semibold text-cozy-text">
                <span className="text-cozy-subtext font-medium text-[11px] flex items-center gap-1.5">
                  {isUnlimited ? (
                    <>
                      <InfinityIcon className="w-3.5 h-3.5 text-cozy-lavender" />
                      <span>Tempo Contínuo (Sem Limite Total)</span>
                    </>
                  ) : (
                    <>
                      <span>Progresso Total</span>
                      <span className="text-[10px] text-cozy-lavender font-bold">
                        ({currentTotalPercent}%)
                      </span>
                    </>
                  )}
                </span>
                <span className="font-mono text-xs">
                  {isUnlimited
                    ? `${formatSecondsToHuman(spentTotal)} acumulados`
                    : `${formatSecondsToHuman(spentTotal)} / ${formatSecondsToHuman(targetTotal)}`}
                </span>
              </div>

              {/* Segmented Tonal Bar */}
              <div className="w-full h-3.5 rounded-full bg-cozy-bg border border-cozy-border flex overflow-hidden p-0.5 gap-0.5 relative">
                {p.history && p.history.length > 0 ? (
                  p.history.map((chunk, idx) => {
                    const denom = isUnlimited ? Math.max(spentTotal, 1) : targetTotal;
                    const chunkPercent = Math.min(100, ((chunk.seconds || 0) / denom) * 100);
                    const tone = chunk.colorTone || TONAL_SHADES[idx % TONAL_SHADES.length];

                    return (
                      <div
                        key={chunk.date + idx}
                        title={`${chunk.date}: ${formatSecondsToHuman(chunk.seconds)}`}
                        className="h-full rounded-sm transition-all duration-300"
                        style={{
                          width: `${chunkPercent}%`,
                          backgroundColor: tone,
                        }}
                      />
                    );
                  })
                ) : (
                  <div
                    className="h-full rounded-full bg-cozy-lavender transition-all duration-300"
                    style={{ width: isUnlimited ? (spentTotal > 0 ? '100%' : '0%') : `${currentTotalPercent}%` }}
                  />
                )}

                {!isUnlimited && ghostWidthPercent > 0 && (
                  <div
                    title={`Projeção: Ao cumprir a meta de hoje, a barra atingirá ${projectedTotalPercent}%`}
                    className="h-full rounded-sm bg-cozy-lavender/30 border border-dashed border-cozy-lavender transition-all duration-300"
                    style={{ width: `${ghostWidthPercent}%` }}
                  />
                )}
              </div>

              {!isUnlimited && targetDaily && (
                <div className="flex items-center justify-between text-[10px] text-cozy-subtext mt-1 font-medium">
                  <span className="flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-cozy-lavender" />
                    Hoje preencherá até:{' '}
                    <span className="text-cozy-lavender font-bold">{projectedTotalPercent}%</span>
                  </span>
                  <span>Falta hoje: {formatSecondsToHuman(remainingDaily)}</span>
                </div>
              )}
            </div>

            {/* Lower Sub-bar: Daily Progress + EDIT DAILY TARGET */}
            <div
              className={`${
                isChild ? 'p-2.5' : 'p-3.5'
              } rounded-2xl bg-cozy-bg border border-cozy-border space-y-2`}
            >
              <div className="flex justify-between items-center text-xs font-bold">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-cozy-subtext">
                    {targetDaily ? 'Meta de Hoje' : 'Tempo Hoje (Livre)'}
                  </span>
                  {editingDailyId === p.id ? (
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min="0"
                        step="0.25"
                        value={dailyHoursDraft}
                        onChange={(e) => setDailyHoursDraft(Number(e.target.value))}
                        className="w-14 px-1 py-0.5 text-xs bg-cozy-card border border-cozy-border rounded text-center text-cozy-text font-bold"
                        title="0 para remover meta diária"
                      />
                      <span className="text-[10px] text-cozy-subtext">h</span>
                      <button
                        onClick={() => handleSaveDailyTarget(p.id)}
                        className="p-1 rounded bg-cozy-sage text-cozy-bg hover:brightness-110"
                        title="Salvar meta diária (0 = livre)"
                      >
                        <Check className="w-3 h-3 stroke-[3]" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setEditingDailyId(p.id);
                        setDailyHoursDraft(
                          targetDaily ? Math.round((targetDaily / 3600) * 100) / 100 : 1
                        );
                      }}
                      className="text-[10px] text-cozy-lavender hover:underline flex items-center gap-0.5"
                      title="Ajustar meta diária"
                    >
                      <Edit2 className="w-2.5 h-2.5" />
                      <span>{targetDaily ? 'Ajustar' : 'Definir meta'}</span>
                    </button>
                  )}
                </div>

                <span className="font-mono text-cozy-text">
                  {targetDaily
                    ? `${formatSecondsToTimer(spentToday)} / ${formatSecondsToTimer(targetDaily)}`
                    : formatSecondsToTimer(spentToday)}
                </span>
              </div>

              {targetDaily && (
                <div className="w-full h-2 rounded-full bg-cozy-card overflow-hidden">
                  <div
                    className="h-full rounded-full bg-cozy-sage transition-all duration-300"
                    style={{
                      width: `${Math.min(100, Math.round((spentToday / targetDaily) * 100))}%`,
                    }}
                  />
                </div>
              )}

              <div className="flex items-center justify-between text-[10px] text-cozy-subtext font-medium">
                <span className="flex items-center gap-1">
                  <Coffee className="w-3 h-3 text-cozy-butter" />
                  Pausas hoje: {formatSecondsToHuman(p.pauseTodaySeconds || 0)}
                </span>
                {targetDaily && spentToday >= targetDaily && (
                  <span className="text-cozy-sage font-bold flex items-center gap-0.5">
                    <Sparkles className="w-3 h-3" /> Meta diária batida!
                  </span>
                )}
              </div>
            </div>

            {/* Footer Controls for Time Progress */}
            <div className="pt-2 border-t border-cozy-border/70 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {isRunning ? (
                  <button
                    onClick={() => pauseProgress(p.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-cozy-butter text-cozy-bg font-bold text-xs hover:brightness-110 transition-all shadow-cozy-pill"
                  >
                    <Pause className="w-3.5 h-3.5" />
                    <span>Pausar</span>
                  </button>
                ) : (
                  <button
                    onClick={() => (isPaused ? resumeFromPause(p.id) : playProgress(p.id))}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-cozy-sage text-cozy-bg font-bold text-xs hover:brightness-110 transition-all shadow-cozy-pill"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>{isPaused ? 'Retomar' : 'Iniciar Foco'}</span>
                  </button>
                )}

                <button
                  onClick={() => resetProgress(p.id)}
                  title="Resetar tempo do dia"
                  className="p-1.5 rounded-full text-cozy-subtext hover:bg-cozy-hover transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="text-xs font-mono font-bold text-cozy-text">
                {formatSecondsToTimer(spentToday)}
              </div>
            </div>
          </div>
        )}

        {/* 2. TYPE === TASKS */}
        {p.type === 'TASKS' && p.subtasks && (
          <div className="space-y-3 my-2">
            <div>
              <div className="flex justify-between items-center text-xs mb-1.5 font-semibold text-cozy-text">
                <span className="text-cozy-subtext text-[11px]">Progresso Ponderado</span>
                <span className="font-bold font-mono">
                  {p.subtasks
                    .filter((s) => s.isCompleted)
                    .reduce((acc, curr) => acc + curr.weightPercent, 0)}
                  %
                </span>
              </div>
              <div className="w-full h-3.5 rounded-full bg-cozy-bg border border-cozy-border flex overflow-hidden p-0.5 gap-0.5">
                {p.subtasks.map((sub) => (
                  <div
                    key={sub.id}
                    title={`${sub.title} (${sub.weightPercent}%) - ${
                      sub.isCompleted ? 'Concluída' : 'Pendente'
                    }`}
                    className={`h-full rounded-full transition-all duration-300 ${
                      sub.isCompleted
                        ? 'bg-cozy-sage'
                        : 'bg-cozy-card/80 border border-cozy-border'
                    }`}
                    style={{ width: `${sub.weightPercent}%` }}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-1.5 mt-2 max-h-40 overflow-y-auto pr-1">
              {p.subtasks.map((sub) => (
                <button
                  key={sub.id}
                  onClick={() => toggleSubtask(p.id, sub.id)}
                  className={`w-full flex items-center justify-between p-2 rounded-xl text-xs text-left transition-all ${
                    sub.isCompleted
                      ? 'bg-cozy-sage-light/40 line-through text-cozy-subtext'
                      : 'bg-cozy-bg hover:bg-cozy-hover text-cozy-text'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 transition-colors ${
                        sub.isCompleted
                          ? 'bg-cozy-sage border-cozy-sage text-cozy-bg'
                          : 'border-cozy-border bg-cozy-card'
                      }`}
                    >
                      {sub.isCompleted && <CheckCircle2 className="w-3.5 h-3.5 stroke-[3]" />}
                    </div>
                    <span className="font-medium whitespace-normal break-words leading-snug">{sub.title}</span>
                  </div>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-cozy-card border border-cozy-border shrink-0">
                    {sub.weightPercent}%
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 3. TYPE === CHECKPOINT */}
        {p.type === 'CHECKPOINT' && (
          <div className="space-y-3 my-2">
            <div>
              <div className="flex justify-between items-center text-xs mb-1 font-semibold text-cozy-text">
                <span className="text-cozy-subtext text-[11px]">Progresso Total (N)</span>
                <span className="font-mono">
                  {p.totalCompleted || 0} / {p.totalGoal || 1}
                </span>
              </div>
              <div className="w-full h-3 rounded-full bg-cozy-bg border border-cozy-border overflow-hidden">
                <div
                  className="h-full rounded-full bg-cozy-sky transition-all duration-300"
                  style={{
                    width: `${Math.min(
                      100,
                      Math.round(((p.totalCompleted || 0) / (p.totalGoal || 1)) * 100)
                    )}%`,
                  }}
                />
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-cozy-bg border border-cozy-border flex items-center justify-between">
              <div>
                <div className="text-[11px] font-medium text-cozy-subtext">Hoje (Meta M)</div>
                <div className="text-base font-extrabold text-cozy-text mt-0.5">
                  {p.todayCompleted || 0}{' '}
                  <span className="text-xs font-normal text-cozy-subtext">
                    / {p.dailyGoal} por dia
                  </span>
                </div>
              </div>

              <button
                onClick={() => incrementCheckpoint(p.id)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-2xl font-bold text-xs transition-all shadow-cozy-pill ${
                  (p.todayCompleted || 0) >= (p.dailyGoal || 1)
                    ? 'bg-cozy-butter-light text-cozy-butter hover:bg-cozy-butter hover:text-cozy-bg border border-cozy-butter/40'
                    : 'bg-cozy-sky text-cozy-bg hover:brightness-110'
                }`}
              >
                <Plus className="w-4 h-4" />
                <span>
                  {(p.todayCompleted || 0) >= (p.dailyGoal || 1) ? '+1 Extra' : '+1 Checkpoint'}
                </span>
              </button>
            </div>
          </div>
        )}
      </>
    );
  };

  return (
    <div className="p-6 md:p-10 max-w-[1920px] w-full mx-auto space-y-6 text-cozy-text">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-cozy-border">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight font-sans">
            Seus Progressos &amp; Objetivos 🌸
          </h1>
          <p className="text-sm text-cozy-subtext mt-0.5">
            Crie progressos ilimitados ou com meta, e adicione subprogressos da mesma categoria vinculados ao objetivo pai.
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Filter Pills */}
          <div className="flex items-center p-1 bg-cozy-card rounded-full border border-cozy-border text-xs font-semibold">
            <button
              onClick={() => setFilter('ALL')}
              className={`px-3 py-1.5 rounded-full transition-all ${
                filter === 'ALL'
                  ? 'bg-cozy-hover text-cozy-text border border-cozy-border shadow-cozy-pill'
                  : 'text-cozy-subtext'
              }`}
            >
              Todos ({progressBars.filter((p) => !p.parentId).length})
            </button>
            <button
              onClick={() => setFilter('TIME')}
              className={`px-3 py-1.5 rounded-full transition-all ${
                filter === 'TIME'
                  ? 'bg-cozy-hover text-cozy-text border border-cozy-border shadow-cozy-pill'
                  : 'text-cozy-subtext'
              }`}
            >
              Por Tempo
            </button>
            <button
              onClick={() => setFilter('TASKS')}
              className={`px-3 py-1.5 rounded-full transition-all ${
                filter === 'TASKS'
                  ? 'bg-cozy-hover text-cozy-text border border-cozy-border shadow-cozy-pill'
                  : 'text-cozy-subtext'
              }`}
            >
              Por Tarefas
            </button>
            <button
              onClick={() => setFilter('CHECKPOINT')}
              className={`px-3 py-1.5 rounded-full transition-all ${
                filter === 'CHECKPOINT'
                  ? 'bg-cozy-hover text-cozy-text border border-cozy-border shadow-cozy-pill'
                  : 'text-cozy-subtext'
              }`}
            >
              Checkpoints
            </button>
          </div>

          <button
            onClick={() => openCreateModal()}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-cozy-lavender text-cozy-bg font-extrabold text-xs hover:brightness-110 transition-all shadow-cozy-pill"
          >
            <Plus className="w-4 h-4" />
            <span>Novo Progresso</span>
          </button>
        </div>
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 items-start">
        {rootBars.map((p) => {
          const children = progressBars.filter((c) => c.parentId === p.id);
          const energyMeta = getEnergyMeta(p.energyTier);
          const isCollapsed = !!collapsedParents[p.id];

          return (
            <div
              key={p.id}
              className={`relative bg-cozy-card rounded-3xl p-5 border border-cozy-border shadow-cozy transition-all flex flex-col justify-between ${
                p.isCompleted ? 'opacity-50 border-dashed' : 'hover:border-cozy-subtext/40'
              }`}
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-cozy-bg text-cozy-subtext border border-cozy-border">
                      {p.type === 'TIME'
                        ? p.isUnlimited
                          ? 'Tempo Ilimitado ♾️'
                          : 'Tempo'
                        : p.type === 'TASKS'
                          ? 'Tarefas Ponderadas'
                          : 'Checkpoint'}
                    </span>
                    {children.length > 0 && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cozy-lavender/15 text-cozy-lavender border border-cozy-lavender/30 flex items-center gap-1">
                        <FolderTree className="w-3 h-3" />
                        {children.length} sub
                      </span>
                    )}
                  </div>
                  <h3 className="font-extrabold text-lg text-cozy-text mt-1.5 leading-snug whitespace-normal break-words">
                    {p.title}
                  </h3>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <span
                    title={energyMeta.hint}
                    className={`text-[11px] px-2 py-0.5 rounded-full font-semibold border ${energyMeta.badgeCls}`}
                  >
                    {energyMeta.shortLabel}
                  </span>

                  <button
                    onClick={() => openCreateModal(p)}
                    title="Criar subprogresso da mesma categoria"
                    className="flex items-center gap-1 px-2 py-1 rounded-full bg-cozy-lavender/15 text-cozy-lavender border border-cozy-lavender/30 text-[10px] font-extrabold hover:bg-cozy-lavender/25 transition-colors"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Sub</span>
                  </button>

                  <button
                    onClick={() => handleDeleteWithConfirm(p)}
                    title="Excluir progresso"
                    className="p-1.5 rounded-full text-cozy-subtext hover:text-cozy-rose hover:bg-cozy-rose/10 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Root Body */}
              {renderProgressBody(p, false)}

              {/* Nested Child Sub-progresses */}
              {children.length > 0 && (
                <div className="mt-4 pt-3 border-t border-cozy-border space-y-2.5">
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() =>
                        setCollapsedParents((prev) => ({ ...prev, [p.id]: !prev[p.id] }))
                      }
                      className="flex items-center gap-1.5 text-xs font-extrabold text-cozy-lavender hover:underline"
                    >
                      {isCollapsed ? (
                        <ChevronRight className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                      <span>Subprogressos de {p.title} ({children.length})</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => openCreateModal(p)}
                      className="text-[11px] font-bold text-cozy-subtext hover:text-cozy-lavender flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Adicionar</span>
                    </button>
                  </div>

                  {!isCollapsed && (
                    <div className="space-y-3 pl-3 border-l-2 border-cozy-lavender/40">
                      {children.map((child) => {
                        const childEnergy = getEnergyMeta(child.energyTier);
                        return (
                          <div
                            key={child.id}
                            className={`rounded-2xl p-3.5 bg-cozy-bg/70 border border-cozy-border/80 ${
                              child.isCompleted ? 'opacity-50 border-dashed' : ''
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2 mb-1.5">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="text-sm font-extrabold text-cozy-text whitespace-normal break-words leading-snug">
                                  {child.title}
                                </span>
                                {child.isUnlimited && (
                                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-cozy-lavender/15 text-cozy-lavender font-bold">
                                    ♾️
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <span
                                  className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold border ${childEnergy.badgeCls}`}
                                >
                                  {childEnergy.shortLabel}
                                </span>
                                <button
                                  onClick={() => handleDeleteWithConfirm(child)}
                                  className="p-1 rounded-full text-cozy-subtext hover:text-cozy-rose"
                                  title="Excluir subprogresso"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            </div>

                            {renderProgressBody(child, true)}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Modal: Novo Progresso ou Subprogresso */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          onClick={() => setShowModal(false)}
        >
          <div
            className="bg-cozy-card rounded-3xl p-6 max-w-lg w-full shadow-2xl border border-cozy-border max-h-[92vh] overflow-y-auto text-cozy-text"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-2xl bg-cozy-lavender-light text-cozy-lavender">
                  {parentTarget ? (
                    <FolderTree className="w-5 h-5" />
                  ) : (
                    <Sparkles className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <h3 className="font-extrabold text-lg">
                    {parentTarget ? `Novo Subprogresso` : 'Novo Progresso'}
                  </h3>
                  <p className="text-xs text-cozy-subtext">
                    {parentTarget
                      ? `Vinculado a "${parentTarget.title}" • Categoria: ${parentTarget.type}`
                      : 'Crie um objetivo por tempo (ilimitado ou com meta), tarefas ou checkpoints'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-1.5 rounded-full text-cozy-subtext hover:bg-cozy-hover transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-bold mb-1">
                  {parentTarget ? 'Título do Subprogresso' : 'Título do Objetivo'}
                </label>
                <input
                  type="text"
                  placeholder={
                    parentTarget
                      ? 'Ex: Matemática, Biologia, Física...'
                      : 'Ex: Estudar, TCC, Ler 20 Páginas...'
                  }
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-2xl border border-cozy-border bg-cozy-bg text-sm focus:outline-none focus:ring-2 focus:ring-cozy-lavender text-cozy-text"
                  required
                />
              </div>

              {/* Type selector (Locked if creating subprogress of parent) */}
              {!parentTarget && (
                <div>
                  <label className="block text-xs font-bold mb-1">Tipo de Barra</label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setNewType('TIME')}
                      className={`py-2 px-3 rounded-2xl text-xs font-bold border transition-all ${
                        newType === 'TIME'
                          ? 'bg-cozy-lavender text-cozy-bg border-cozy-lavender shadow-cozy-pill'
                          : 'border-cozy-border bg-cozy-bg text-cozy-subtext hover:bg-cozy-hover'
                      }`}
                    >
                      Por Tempo
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewType('TASKS')}
                      className={`py-2 px-3 rounded-2xl text-xs font-bold border transition-all ${
                        newType === 'TASKS'
                          ? 'bg-cozy-sage text-cozy-bg border-cozy-sage shadow-cozy-pill'
                          : 'border-cozy-border bg-cozy-bg text-cozy-subtext hover:bg-cozy-hover'
                      }`}
                    >
                      Por Tarefas
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewType('CHECKPOINT')}
                      className={`py-2 px-3 rounded-2xl text-xs font-bold border transition-all ${
                        newType === 'CHECKPOINT'
                          ? 'bg-cozy-sky text-cozy-bg border-cozy-sky shadow-cozy-pill'
                          : 'border-cozy-border bg-cozy-bg text-cozy-subtext hover:bg-cozy-hover'
                      }`}
                    >
                      Checkpoint
                    </button>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold mb-1">Tag de Atenção Exigida</label>
                <div className="grid grid-cols-3 gap-2">
                  {ENERGY_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setNewEnergy(opt.value)}
                      className={`py-2 px-2 rounded-2xl text-xs font-bold border transition-all flex items-center justify-center ${
                        newEnergy === opt.value
                          ? opt.btnCls
                          : 'border-cozy-border bg-cozy-bg text-cozy-subtext'
                      }`}
                    >
                      <span>{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {(parentTarget ? parentTarget.type : newType) === 'TIME' && (
                <div className="p-3.5 rounded-2xl bg-cozy-bg border border-cozy-border space-y-3">
                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setTimeCreationMode('TOTAL')}
                      className={`py-1.5 px-2 rounded-xl text-[11px] font-semibold ${
                        timeCreationMode === 'TOTAL'
                          ? 'bg-cozy-card shadow-sm font-bold text-cozy-text border border-cozy-border'
                          : 'text-cozy-subtext'
                      }`}
                    >
                      Meta Total
                    </button>
                    <button
                      type="button"
                      onClick={() => setTimeCreationMode('CYCLE')}
                      className={`py-1.5 px-2 rounded-xl text-[11px] font-semibold ${
                        timeCreationMode === 'CYCLE'
                          ? 'bg-cozy-card shadow-sm font-bold text-cozy-text border border-cozy-border'
                          : 'text-cozy-subtext'
                      }`}
                    >
                      N Horas / M Dias
                    </button>
                    <button
                      type="button"
                      onClick={() => setTimeCreationMode('UNLIMITED')}
                      className={`py-1.5 px-2 rounded-xl text-[11px] font-semibold flex items-center justify-center gap-1 ${
                        timeCreationMode === 'UNLIMITED'
                          ? 'bg-cozy-lavender/20 shadow-sm font-bold text-cozy-lavender border border-cozy-lavender/40'
                          : 'text-cozy-subtext'
                      }`}
                    >
                      <InfinityIcon className="w-3.5 h-3.5" />
                      <span>Sem Limite</span>
                    </button>
                  </div>

                  {timeCreationMode === 'UNLIMITED' ? (
                    <div className="space-y-3">
                      <p className="text-[11px] text-cozy-subtext">
                        Este progresso escala continuamente sem teto final (ideal para estudos gerais ou hábitos permanentes).
                      </p>
                      <label className="flex items-center gap-2 text-xs font-bold cursor-pointer">
                        <input
                          type="checkbox"
                          checked={hasDailyLimitUnlimited}
                          onChange={(e) => setHasDailyLimitUnlimited(e.target.checked)}
                          className="rounded border-cozy-border"
                        />
                        <span>Definir meta diária sugerida</span>
                      </label>
                      {hasDailyLimitUnlimited && (
                        <div>
                          <label className="text-[11px] font-bold text-cozy-subtext">
                            Meta Diária (Horas)
                          </label>
                          <input
                            type="number"
                            min="0.25"
                            step="0.25"
                            value={dailyHoursInput}
                            onChange={(e) => setDailyHoursInput(Number(e.target.value))}
                            className="w-full px-3 py-1.5 rounded-xl border border-cozy-border bg-cozy-card text-xs mt-1 text-cozy-text"
                          />
                        </div>
                      )}
                    </div>
                  ) : timeCreationMode === 'TOTAL' ? (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] font-bold text-cozy-subtext">
                          Meta Total (Horas)
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={totalHoursInput}
                          onChange={(e) => setTotalHoursInput(Number(e.target.value))}
                          className="w-full px-3 py-1.5 rounded-xl border border-cozy-border bg-cozy-card text-xs mt-1 text-cozy-text"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-bold text-cozy-subtext">
                          Meta Diária (Horas)
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="0.25"
                          value={dailyHoursInput}
                          onChange={(e) => setDailyHoursInput(Number(e.target.value))}
                          className="w-full px-3 py-1.5 rounded-xl border border-cozy-border bg-cozy-card text-xs mt-1 text-cozy-text"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] font-bold text-cozy-subtext">
                          Horas por Dia (N)
                        </label>
                        <input
                          type="number"
                          min="0.25"
                          step="0.25"
                          value={dailyHoursInput}
                          onChange={(e) => setDailyHoursInput(Number(e.target.value))}
                          className="w-full px-3 py-1.5 rounded-xl border border-cozy-border bg-cozy-card text-xs mt-1 text-cozy-text"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-bold text-cozy-subtext">
                          Quantidade de Dias (M)
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={cycleDaysInput}
                          onChange={(e) => setCycleDaysInput(Number(e.target.value))}
                          className="w-full px-3 py-1.5 rounded-xl border border-cozy-border bg-cozy-card text-xs mt-1 text-cozy-text"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {(parentTarget ? parentTarget.type : newType) === 'TASKS' && (
                <div className="p-3.5 rounded-2xl bg-cozy-bg border border-cozy-border space-y-2.5">
                  <label className="block text-xs font-bold">Tarefas e Pesos (%)</label>
                  {taskInputs.map((task, idx) => (
                    <div key={idx} className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Nome da etapa..."
                        value={task.title}
                        onChange={(e) => {
                          const updated = [...taskInputs];
                          updated[idx].title = e.target.value;
                          setTaskInputs(updated);
                        }}
                        className="flex-1 px-3 py-1.5 rounded-xl border border-cozy-border bg-cozy-card text-xs text-cozy-text"
                      />
                      <input
                        type="number"
                        min="1"
                        max="100"
                        placeholder="%"
                        value={task.weight}
                        onChange={(e) => {
                          const updated = [...taskInputs];
                          updated[idx].weight = Number(e.target.value);
                          setTaskInputs(updated);
                        }}
                        className="w-16 px-2 py-1.5 rounded-xl border border-cozy-border bg-cozy-card text-xs text-center font-bold text-cozy-text"
                      />
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => setTaskInputs([...taskInputs, { title: '', weight: 20 }])}
                    className="text-xs font-bold text-cozy-lavender hover:underline block pt-1"
                  >
                    + Adicionar outra etapa
                  </button>
                </div>
              )}

              {(parentTarget ? parentTarget.type : newType) === 'CHECKPOINT' && (
                <div className="p-3.5 rounded-2xl bg-cozy-bg border border-cozy-border grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-cozy-subtext">
                      Meta Total (N vezes)
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={checkpointTotalN}
                      onChange={(e) => setCheckpointTotalN(Number(e.target.value))}
                      className="w-full px-3 py-1.5 rounded-xl border border-cozy-border bg-cozy-card text-xs mt-1 text-cozy-text"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-cozy-subtext">
                      Limite Diário (M vezes)
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={checkpointDailyM}
                      onChange={(e) => setCheckpointDailyM(Number(e.target.value))}
                      className="w-full px-3 py-1.5 rounded-xl border border-cozy-border bg-cozy-card text-xs mt-1 text-cozy-text"
                    />
                  </div>
                </div>
              )}

              <div className="pt-2 flex justify-end gap-2">
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
                  {parentTarget ? 'Criar Subprogresso' : 'Criar Progresso'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
