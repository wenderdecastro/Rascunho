import React, { useMemo, useState } from 'react';
import { useApp, getTodayDateString, PRIORITY_WEIGHT } from '../context/AppContext';
import { ScheduledBlock } from '../types';
import {
  formatSecondsToTimer,
  formatSecondsToHuman,
  minutesToTimeString,
  timeStringToMinutes,
  formatDateBR,
} from '../utils/helpers';
import { InteractiveVerticalRuler } from './InteractiveVerticalRuler';
import { BlockAllocationModal } from './BlockAllocationModal';
import {
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  LifeBuoy,
  Moon,
  X,
  Plus,
  Undo2,
  CheckSquare,
  Check,
  Wand2,
  Trash2,
  Edit2,
  Calendar as CalendarIcon,
  Clock,
} from 'lucide-react';

export const MeuDiaView: React.FC = () => {
  const {
    currentActiveSchedule,
    playProgress,
    pauseProgress,
    resumeFromPause,
    resetProgress,
    tasks,
    scheduledBlocks,
    dayOverrides,
    triggerSOS,
    undoSOS,
    closeNightCheckOut,
    adaptivePauseAlert,
    dismissAdaptivePause,
    inactivityAlert,
    dismissInactivityAlert,
    toggleTaskSubitem,
    toggleTask,
    updateTask,
    deleteTask,
    deleteEffectiveBlock,
    autoDistributeTasksForDate,
    setSelectedDate,
    setActiveTab,
    requestConfirm,
    showToast,
  } = useApp();

  const todayStr = getTodayDateString();
  const dayOverride = dayOverrides[todayStr];
  const isSOSActive = dayOverride?.isSOSActive;

  const [showNightModal, setShowNightModal] = useState(false);
  const [discardTaskIds, setDiscardTaskIds] = useState<string[]>([]);
  const [pushTaskIds, setPushTaskIds] = useState<string[]>([]);

  // Interactive Ruler Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [modalStartTime, setModalStartTime] = useState('14:00');
  const [modalEndTime, setModalEndTime] = useState('15:00');
  const [modalInitialTab, setModalInitialTab] = useState<'PROGRESS' | 'TASK' | undefined>(
    undefined
  );
  const [editingBlock, setEditingBlock] = useState<ScheduledBlock | null>(null);

  const todayTasks = useMemo(
    () =>
      tasks
        .filter((t) => !t.date || t.date === todayStr)
        .sort((a, b) => {
          if (a.isCompleted !== b.isCompleted) return a.isCompleted ? 1 : -1;
          return PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority];
        }),
    [tasks, todayStr]
  );

  const uncompletedTasks = useMemo(
    () => todayTasks.filter((t) => !t.isCompleted),
    [todayTasks]
  );

  // Active Progress & Block strictly derived from current real time
  const { block: activeBlock, progress: activeProgress, isFreeSlot, currentTimeStr } =
    currentActiveSchedule;
  const isRunning = activeProgress?.isRunning && !activeProgress?.isPaused;
  const isPaused = activeProgress?.isPaused;

  const activeTask = activeBlock?.linkedTaskId
    ? tasks.find((t) => t.id === activeBlock.linkedTaskId)
    : undefined;

  const upcomingNonRecurringEvents = useMemo(() => {
    const nowMin = timeStringToMinutes(currentTimeStr);
    const todayNoonMs = new Date(`${todayStr}T12:00:00`).getTime();
    const linkedBlockTaskKeys = new Set<string>();

    interface CountdownEventItem {
      id: string;
      title: string;
      date: string;
      startTime?: string;
      endTime?: string;
      tier: ScheduledBlock['tier'];
      countdownLabel: string;
      countdownKind: 'TODAY_UNTIMED' | 'TODAY_HOURS' | 'TODAY_ACTIVE' | 'DAYS';
      sourceLabel: 'Bloco' | 'Tarefa';
    }

    const items: CountdownEventItem[] = [];

    scheduledBlocks.forEach((b) => {
      if (b.isCancelledToday || b.date < todayStr) return;
      const isRecurring = Boolean(
        b.recurringSeriesId || (b.recurrence && b.recurrence.frequency !== 'NONE')
      );
      if (isRecurring) return;
      if (b.linkedTaskId) {
        const linked = tasks.find((t) => t.id === b.linkedTaskId);
        if (linked?.isCompleted) return;
        linkedBlockTaskKeys.add(`${b.date}::${b.linkedTaskId}`);
      }
      if (b.isCompleted) return;

      const hasTime = Boolean(b.startTime);
      let countdownLabel = 'É hoje';
      let countdownKind: CountdownEventItem['countdownKind'] = 'TODAY_UNTIMED';

      if (b.date > todayStr) {
        const targetNoonMs = new Date(`${b.date}T12:00:00`).getTime();
        const diffDays = Math.round((targetNoonMs - todayNoonMs) / (24 * 60 * 60 * 1000));
        countdownLabel = diffDays === 1 ? 'Falta 1 dia' : `Faltam ${diffDays} dias`;
        countdownKind = 'DAYS';
      } else if (hasTime) {
        const sMin = timeStringToMinutes(b.startTime);
        const eMin = b.endTime ? timeStringToMinutes(b.endTime) : sMin + 60;
        if (nowMin >= eMin) return; // Event today already finished
        if (nowMin >= sMin) {
          countdownLabel = 'Agora';
          countdownKind = 'TODAY_ACTIVE';
        } else {
          const diffMin = sMin - nowMin;
          const hrs = Math.floor(diffMin / 60);
          const mins = diffMin % 60;
          if (hrs === 0) {
            countdownLabel = `Faltam ${mins} min (< 1h)`;
          } else if (mins === 0) {
            countdownLabel = hrs === 1 ? 'Falta 1 hora' : `Faltam ${hrs} horas`;
          } else {
            countdownLabel = hrs === 1 ? `Falta 1h ${mins}min` : `Faltam ${hrs}h ${mins}min`;
          }
          countdownKind = 'TODAY_HOURS';
        }
      }

      items.push({
        id: `blk-${b.id}`,
        title: b.title,
        date: b.date,
        startTime: b.startTime || undefined,
        endTime: b.endTime || undefined,
        tier: b.tier,
        countdownLabel,
        countdownKind,
        sourceLabel: 'Bloco',
      });
    });

    tasks.forEach((t) => {
      if (t.isCompleted || !t.date || t.date < todayStr) return;
      const isRecurring = Boolean(
        t.recurringSeriesId || (t.recurrence && t.recurrence.frequency !== 'NONE')
      );
      if (isRecurring) return;
      if (linkedBlockTaskKeys.has(`${t.date}::${t.id}`)) return;

      let countdownLabel = 'É hoje';
      let countdownKind: CountdownEventItem['countdownKind'] = 'TODAY_UNTIMED';
      if (t.date > todayStr) {
        const targetNoonMs = new Date(`${t.date}T12:00:00`).getTime();
        const diffDays = Math.round((targetNoonMs - todayNoonMs) / (24 * 60 * 60 * 1000));
        countdownLabel = diffDays === 1 ? 'Falta 1 dia' : `Faltam ${diffDays} dias`;
        countdownKind = 'DAYS';
      }

      items.push({
        id: `tsk-${t.id}`,
        title: t.title,
        date: t.date,
        tier: t.energyTier,
        countdownLabel,
        countdownKind,
        sourceLabel: 'Tarefa',
      });
    });

    return items.sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      const aMin = a.startTime ? timeStringToMinutes(a.startTime) : 24 * 60 + 1;
      const bMin = b.startTime ? timeStringToMinutes(b.startTime) : 24 * 60 + 1;
      return aMin - bMin;
    });
  }, [scheduledBlocks, tasks, todayStr, currentTimeStr]);

  const handleOpenNightCheckout = () => {
    setDiscardTaskIds([]);
    setPushTaskIds([]);
    setShowNightModal(true);
  };

  const handleConfirmNightCheckout = () => {
    closeNightCheckOut(todayStr, discardTaskIds, pushTaskIds);
    setShowNightModal(false);
    showToast('Noite encerrada com leveza! Pendências atualizadas.', 'success');
  };

  const handleDragCreate = (
    startTime: string,
    endTime: string,
    preferredTab?: 'PROGRESS' | 'TASK'
  ) => {
    setEditingBlock(null);
    setModalStartTime(startTime);
    setModalEndTime(endTime);
    setModalInitialTab(preferredTab);
    setModalOpen(true);
  };

  const handleSelectBlock = (block: ScheduledBlock) => {
    setEditingBlock(block);
    setModalStartTime(block.startTime);
    setModalEndTime(block.endTime);
    setModalInitialTab(undefined);
    setModalOpen(true);
  };

  const getTierBadge = (tier: ScheduledBlock['tier']) => {
    switch (tier) {
      case 'FOCUS':
        return {
          cls: 'bg-cozy-lavender/15 text-cozy-lavender border-cozy-lavender/30',
          label: '🧠 Focado',
        };
      case 'TRANSIT':
        return {
          cls: 'bg-cozy-butter/15 text-cozy-butter border-cozy-butter/30',
          label: '🎧 Baixo Foco',
        };
      case 'BACKGROUND':
        return {
          cls: 'bg-cozy-sky/15 text-cozy-sky border-cozy-sky/30',
          label: '🫧 Segundo Plano',
        };
    }
  };

  return (
    <div className="p-6 md:p-10 max-w-[1920px] w-full mx-auto space-y-6 text-cozy-text">
      {/* Adaptive Pause Alert */}
      {adaptivePauseAlert?.show && (
        <div className="p-4 rounded-3xl bg-cozy-butter-light border border-cozy-butter flex items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🍵</span>
            <div>
              <h4 className="font-bold text-xs text-cozy-butter uppercase tracking-wider">
                Sugestão de Pausa Consciente
              </h4>
              <p className="text-sm font-semibold mt-0.5">{adaptivePauseAlert.message}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (activeProgress) pauseProgress(activeProgress.id);
                dismissAdaptivePause();
              }}
              className="px-3 py-1.5 rounded-full bg-cozy-butter text-cozy-bg font-bold text-xs hover:brightness-110 transition-all shadow-sm"
            >
              Aceitar Pausa
            </button>
            <button
              onClick={dismissAdaptivePause}
              className="p-1 rounded-full text-cozy-subtext hover:bg-white/10"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Inactivity Alert */}
      {inactivityAlert && (
        <div className="p-4 rounded-3xl bg-cozy-peach-light border border-cozy-peach flex items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🧘</span>
            <div>
              <h4 className="font-bold text-xs text-cozy-peach uppercase tracking-wider">
                Verificação de Hiperfoco (90 min)
              </h4>
              <p className="text-sm">
                O timer está rodando há 90 min sem cliques. Você ainda está focado ou esqueceu o timer ativo?
              </p>
            </div>
          </div>
          <button
            onClick={dismissInactivityAlert}
            className="px-4 py-1.5 rounded-full bg-cozy-peach text-cozy-bg font-bold text-xs hover:brightness-110 transition-all shadow-sm"
          >
            Continuo Focado! ✨
          </button>
        </div>
      )}

      {/* SOS Active Banner with UNDO option */}
      {isSOSActive && (
        <div className="p-4 rounded-3xl bg-cozy-sage-light border border-cozy-sage/40 flex items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🌱</span>
            <div>
              <h4 className="font-bold text-xs text-cozy-sage uppercase tracking-wider">
                Modo Cuidado Pessoal Ativado (&quot;Dia Deu Ruim&quot;)
              </h4>
              <p className="text-xs text-cozy-subtext mt-0.5">
                Suas tarefas flexíveis foram ocultadas apenas hoje e suas metas diárias foram congeladas sem quebrar seu histórico.
              </p>
            </div>
          </div>

          <button
            onClick={() => undoSOS(todayStr)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-cozy-card border border-cozy-border text-xs font-bold text-cozy-text hover:bg-cozy-hover transition-colors"
          >
            <Undo2 className="w-3.5 h-3.5 text-cozy-sage" />
            <span>Desfazer SOS</span>
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-cozy-border">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold tracking-tight font-sans">
              Meu Dia: Hoje ☀️
            </h1>
            <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-cozy-card border border-cozy-border text-cozy-subtext">
              {formatDateBR(todayStr)} • {currentTimeStr}
            </span>
          </div>
          <p className="text-sm text-cozy-subtext mt-0.5">
            Ajuste os blocos somente de hoje sem alterar sua rotina fixa semanal. Arraste na régua para criar ou redimensionar.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => {
              const res = autoDistributeTasksForDate(todayStr);
              showToast(res.message, res.scheduledCount > 0 ? 'success' : 'info');
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-full font-bold text-xs bg-cozy-lavender/15 border border-cozy-lavender/40 text-cozy-lavender hover:bg-cozy-lavender/25 transition-all shadow-sm"
            title="Distribuir tarefas elegíveis nas áreas de Trabalho, Faculdade e Transporte de hoje"
          >
            <Wand2 className="w-3.5 h-3.5" />
            <span>Distribuir Tarefas Hoje</span>
          </button>

          <button
            onClick={() => {
              const nowMin = Math.floor(timeStringToMinutes(currentTimeStr) / 15) * 15;
              handleDragCreate(
                minutesToTimeString(nowMin),
                minutesToTimeString(Math.min(23 * 60, nowMin + 60))
              );
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-full font-bold text-xs bg-cozy-card border border-cozy-border text-cozy-text hover:bg-cozy-hover transition-colors shadow-sm"
          >
            <Plus className="w-3.5 h-3.5 text-cozy-lavender" />
            <span>Adicionar Bloco Hoje</span>
          </button>

          {isSOSActive ? (
            <button
              onClick={() => undoSOS(todayStr)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-full font-bold text-xs bg-cozy-card border border-cozy-sage text-cozy-sage hover:bg-cozy-sage-light transition-all shadow-cozy-pill"
            >
              <Undo2 className="w-3.5 h-3.5" />
              <span>Desfazer Modo SOS</span>
            </button>
          ) : (
            <button
              onClick={() => triggerSOS(todayStr)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-full font-bold text-xs bg-cozy-peach-light text-cozy-peach border border-cozy-peach/40 hover:bg-cozy-peach hover:text-cozy-bg transition-all shadow-cozy-pill"
            >
              <LifeBuoy className="w-3.5 h-3.5" />
              <span>Dia Deu Ruim (SOS)</span>
            </button>
          )}

          <button
            onClick={handleOpenNightCheckout}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-full font-bold text-xs bg-cozy-lavender text-cozy-bg hover:brightness-110 transition-all shadow-cozy-pill"
          >
            <Moon className="w-3.5 h-3.5" />
            <span>Encerrar o Dia</span>
          </button>
        </div>
      </div>

      {/* Main Screen Layout: Left 60% (Atividade Atual + Eventos Não Recorrentes + Tarefas) + Right 40% Interactive Ruler */}
      <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-6 items-start">
        {/* Left Columns (60%) */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
          {/* Subcolumn 1: ATIVIDADE ATUAL + EVENTOS NÃO RECORRENTES */}
          <div className="space-y-6">
          {/* ATIVIDADE ATUAL */}
          <div className="bg-cozy-card rounded-3xl p-6 border border-cozy-border shadow-cozy space-y-5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-cozy-subtext flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-cozy-sage animate-pulse" />
                Atividade Atual (Hora Real: {currentTimeStr})
              </span>
              <div className="flex items-center gap-1.5 shrink-0">
                {!isFreeSlot && activeBlock && (
                  <>
                    <button
                      type="button"
                      onClick={() => handleSelectBlock(activeBlock)}
                      className="p-1.5 rounded-xl bg-cozy-bg border border-cozy-border text-cozy-subtext hover:text-cozy-lavender hover:border-cozy-lavender/40 transition-colors"
                      title="Editar bloco atual"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        requestConfirm(
                          'Remover bloco atual',
                          `Deseja remover "${activeBlock.title}" (${activeBlock.startTime} - ${activeBlock.endTime}) de hoje?`,
                          () => deleteEffectiveBlock(todayStr, activeBlock)
                        )
                      }
                      className="p-1.5 rounded-xl bg-cozy-bg border border-cozy-border text-cozy-subtext hover:text-cozy-rose hover:border-cozy-rose/40 hover:bg-cozy-rose/10 transition-colors"
                      title="Remover bloco atual de hoje"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cozy-bg text-cozy-subtext border border-cozy-border">
                  Automático
                </span>
              </div>
            </div>

            {!isFreeSlot && activeBlock ? (
              <div className="space-y-4">
                <div>
                  <h3 className="font-extrabold text-xl text-cozy-text leading-tight">
                    {activeBlock.title}
                  </h3>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <span
                      className={`text-xs px-2.5 py-0.5 rounded-full font-bold border ${
                        getTierBadge(activeBlock.tier).cls
                      }`}
                    >
                      {getTierBadge(activeBlock.tier).label}
                    </span>
                    <span className="text-xs font-mono text-cozy-subtext">
                      {activeBlock.startTime} - {activeBlock.endTime}
                    </span>
                  </div>
                </div>

                {activeProgress ? (
                  <div className="p-5 rounded-3xl bg-cozy-bg border border-cozy-border text-center space-y-2">
                    <div className="text-4xl font-extrabold font-mono text-cozy-text tracking-tight">
                      {formatSecondsToTimer(activeProgress.spentTodaySeconds || 0)}
                    </div>
                    <div className="text-xs text-cozy-subtext">
                      {activeProgress.targetDailySeconds
                        ? `Meta de hoje: ${formatSecondsToHuman(activeProgress.targetDailySeconds)}`
                        : 'Sem meta diária definida'}
                    </div>

                    {activeProgress.targetDailySeconds && (
                      <div className="pt-2 space-y-1.5">
                        <div className="w-full h-2 rounded-full bg-cozy-card overflow-hidden">
                          <div
                            className="h-full rounded-full bg-cozy-sage transition-all duration-300"
                            style={{
                              width: `${Math.min(
                                100,
                                Math.round(
                                  ((activeProgress.spentTodaySeconds || 0) /
                                    activeProgress.targetDailySeconds) *
                                    100
                                )
                              )}%`,
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ) : activeTask ? (
                  <div className="p-4 rounded-3xl bg-cozy-bg border border-cozy-border space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-cozy-sky flex items-center gap-1.5">
                        <CheckSquare className="w-4 h-4" />
                        Tarefa Alocada [{activeTask.priority}]
                      </span>
                      <button
                        onClick={() => toggleTask(activeTask.id)}
                        className={`px-2.5 py-1 rounded-xl text-[11px] font-bold border transition-all ${
                          activeTask.isCompleted
                            ? 'bg-cozy-sage/20 text-cozy-sage border-cozy-sage/40'
                            : 'bg-cozy-card text-cozy-subtext border-cozy-border hover:text-cozy-text'
                        }`}
                      >
                        {activeTask.isCompleted ? '✓ Concluída' : 'Marcar Feita'}
                      </button>
                    </div>
                    {activeTask.subitems && activeTask.subitems.length > 0 && (
                      <div className="space-y-1.5">
                        {activeTask.subitems.map((sub) => (
                          <button
                            key={sub.id}
                            onClick={() => toggleTaskSubitem(activeTask.id, sub.id)}
                            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-cozy-card border border-cozy-border text-xs text-left hover:bg-cozy-hover"
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
                              className={
                                sub.isCompleted ? 'line-through text-cozy-subtext' : 'text-cozy-text'
                              }
                            >
                              {sub.title}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-5 rounded-3xl bg-cozy-bg border border-cozy-border text-center">
                    <div className="text-xs font-bold text-cozy-subtext">
                      Bloco de Tempo em Andamento
                    </div>
                    <p className="text-xs text-cozy-subtext mt-1">
                      {activeBlock.title} ({activeBlock.startTime} - {activeBlock.endTime})
                    </p>
                  </div>
                )}

                {activeProgress && activeProgress.type === 'TIME' && (
                  <div className="flex items-center justify-center gap-3 pt-1">
                    {isRunning ? (
                      <button
                        onClick={() => pauseProgress(activeProgress.id)}
                        className="flex items-center gap-2 px-6 py-3 rounded-full bg-cozy-butter text-cozy-bg hover:brightness-110 font-extrabold text-sm transition-all shadow-cozy-pill"
                      >
                        <Pause className="w-4 h-4" />
                        <span>Pausar</span>
                      </button>
                    ) : (
                      <button
                        onClick={() =>
                          isPaused
                            ? resumeFromPause(activeProgress.id)
                            : playProgress(activeProgress.id)
                        }
                        className="flex items-center gap-2 px-6 py-3 rounded-full bg-cozy-sage text-cozy-bg hover:brightness-110 font-extrabold text-sm transition-all shadow-cozy-pill"
                      >
                        <Play className="w-4 h-4 fill-current ml-0.5" />
                        <span>{isPaused ? 'Retomar' : 'Iniciar Foco'}</span>
                      </button>
                    )}

                    <button
                      onClick={() => resetProgress(activeProgress.id)}
                      className="p-3 rounded-full bg-cozy-bg border border-cozy-border text-cozy-subtext hover:bg-cozy-hover transition-all"
                      title="Resetar tempo de hoje"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            ) : currentActiveSchedule.currentArea ? (
              <div className="p-7 rounded-3xl bg-cozy-bg border-2 border-dashed border-cozy-lavender/40 text-center space-y-3">
                <span className="text-3xl">
                  {currentActiveSchedule.currentArea.tier === 'FOCUS'
                    ? '🧠'
                    : currentActiveSchedule.currentArea.tier === 'TRANSIT'
                      ? '🎧'
                      : '🫧'}
                </span>
                <div>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-cozy-lavender/15 text-cozy-lavender border border-cozy-lavender/30 text-[11px] font-bold mb-1">
                    <span>Área da Rotina Ativa</span>
                  </div>
                  <h4 className="font-extrabold text-base text-cozy-text">
                    {currentActiveSchedule.currentArea.title}
                  </h4>
                  <p className="text-xs font-mono text-cozy-subtext mt-0.5">
                    {currentActiveSchedule.currentArea.startTime} -{' '}
                    {currentActiveSchedule.currentArea.endTime}
                  </p>
                </div>
                <p className="text-xs text-cozy-subtext max-w-xs mx-auto leading-relaxed">
                  Você está na sua área de{' '}
                  <strong className="text-cozy-text">
                    {currentActiveSchedule.currentArea.title}
                  </strong>
                  , mas ainda não alocou uma tarefa específica para este momento.
                </p>
                <div className="flex items-center justify-center gap-2 pt-1">
                  <button
                    onClick={() => {
                      const nowMin = Math.floor(timeStringToMinutes(currentTimeStr) / 15) * 15;
                      handleDragCreate(
                        minutesToTimeString(nowMin),
                        minutesToTimeString(Math.min(23 * 60, nowMin + 45)),
                        'TASK'
                      );
                    }}
                    className="px-4 py-2 rounded-full bg-cozy-lavender text-cozy-bg font-extrabold text-xs hover:brightness-110 transition-all shadow-cozy-pill inline-flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Alocar Tarefa nesta Área</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-8 rounded-3xl bg-cozy-bg border border-cozy-border border-dashed text-center space-y-3">
                <span className="text-3xl">🌿</span>
                <h4 className="font-bold text-base text-cozy-text">Horário Livre Agora</h4>
                <p className="text-xs text-cozy-subtext max-w-xs mx-auto leading-relaxed">
                  Nenhum compromisso está agendado para este momento ({currentTimeStr}).
                  Aproveite para descansar ou aloque um novo bloco diretamente na régua ao lado.
                </p>
                <button
                  onClick={() => {
                    const nowMin = Math.floor(timeStringToMinutes(currentTimeStr) / 15) * 15;
                    handleDragCreate(
                      minutesToTimeString(nowMin),
                      minutesToTimeString(Math.min(23 * 60, nowMin + 60))
                    );
                  }}
                  className="mt-1 px-4 py-2 rounded-full bg-cozy-lavender text-cozy-bg font-bold text-xs hover:brightness-110 transition-all shadow-cozy-pill inline-flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Agendar para Agora</span>
                </button>
              </div>
            )}
          </div>

          {/* EVENTOS NÃO RECORRENTES DA AGENDA */}
          <div className="bg-cozy-card rounded-3xl p-5 border border-cozy-border shadow-cozy space-y-3.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <CalendarIcon className="w-4 h-4 text-cozy-lavender shrink-0" />
                <h3 className="text-sm font-extrabold text-cozy-text whitespace-normal break-words leading-tight">
                  Eventos Não Recorrentes da Agenda
                </h3>
              </div>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-cozy-bg border border-cozy-border text-cozy-subtext shrink-0">
                {upcomingNonRecurringEvents.length}
              </span>
            </div>

            {upcomingNonRecurringEvents.length === 0 ? (
              <div className="p-4 rounded-2xl bg-cozy-bg border border-dashed border-cozy-border text-center text-xs text-cozy-subtext leading-relaxed">
                Nenhum evento pontual (não recorrente) agendado a partir de hoje.
              </div>
            ) : (
              <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
                {upcomingNonRecurringEvents.map((ev) => {
                  const badgeCls =
                    ev.countdownKind === 'TODAY_ACTIVE'
                      ? 'bg-cozy-sage/20 text-cozy-sage border-cozy-sage/40'
                      : ev.countdownKind === 'TODAY_HOURS'
                        ? 'bg-cozy-peach/20 text-cozy-peach border-cozy-peach/40'
                        : ev.countdownKind === 'TODAY_UNTIMED'
                          ? 'bg-cozy-butter/20 text-cozy-butter border-cozy-butter/40'
                          : 'bg-cozy-lavender/15 text-cozy-lavender border-cozy-lavender/35';

                  return (
                    <button
                      key={ev.id}
                      type="button"
                      onClick={() => {
                        setSelectedDate(ev.date);
                        setActiveTab('AGENDA');
                      }}
                      title="Abrir esta data na Agenda"
                      className="w-full text-left p-3 rounded-2xl bg-cozy-bg border border-cozy-border hover:border-cozy-lavender/50 transition-colors flex items-start justify-between gap-2.5"
                    >
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="text-xs font-extrabold text-cozy-text whitespace-normal break-words leading-snug">
                          {ev.title}
                        </div>
                        <div className="flex items-center gap-2 flex-wrap text-[10px] font-mono text-cozy-subtext">
                          <span>{formatDateBR(ev.date)}</span>
                          {ev.startTime ? (
                            <span className="inline-flex items-center gap-1">
                              <Clock className="w-2.5 h-2.5" />
                              {ev.startTime}
                              {ev.endTime ? `–${ev.endTime}` : ''}
                            </span>
                          ) : (
                            <span className="italic opacity-80">Sem horário específico</span>
                          )}
                        </div>
                      </div>

                      <span
                        className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full border shrink-0 whitespace-nowrap ${badgeCls}`}
                      >
                        {ev.countdownLabel}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          </div>

          {/* TAREFAS DO DIA PANEL (Gerenciamento rápido, tags de energia e exclusão) */}
          <div className="bg-cozy-card rounded-3xl p-5 border border-cozy-border shadow-cozy space-y-3.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <CheckSquare className="w-4 h-4 text-cozy-sky" />
                <h3 className="text-sm font-extrabold text-cozy-text">
                  Tarefas de Hoje ({uncompletedTasks.length} pendentes)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  const nowMin = Math.floor(timeStringToMinutes(currentTimeStr) / 15) * 15;
                  handleDragCreate(
                    minutesToTimeString(nowMin),
                    minutesToTimeString(Math.min(23 * 60, nowMin + 45)),
                    'TASK'
                  );
                }}
                className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-cozy-sky/15 text-cozy-sky border border-cozy-sky/30 text-[11px] font-bold hover:bg-cozy-sky/25 transition-colors"
              >
                <Plus className="w-3 h-3" />
                <span>Nova Tarefa</span>
              </button>
            </div>

            {todayTasks.length === 0 ? (
              <div className="p-5 rounded-2xl bg-cozy-bg border border-dashed border-cozy-border text-center text-xs text-cozy-subtext">
                Nenhuma tarefa para hoje. Crie ou aloque uma tarefa clicando em &quot;+ Nova Tarefa&quot;.
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
                {todayTasks.map((task) => (
                  <div
                    key={task.id}
                    className={`p-3 rounded-2xl bg-cozy-bg border border-cozy-border space-y-2 transition-opacity ${
                      task.isCompleted ? 'opacity-55' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => toggleTask(task.id)}
                        className="flex items-start gap-2 text-left min-w-0 flex-1"
                      >
                        <span
                          className={`mt-0.5 w-4 h-4 rounded-md border flex items-center justify-center shrink-0 transition-colors ${
                            task.isCompleted
                              ? 'bg-cozy-sage border-cozy-sage text-cozy-bg'
                              : 'border-cozy-border hover:border-cozy-sky'
                          }`}
                        >
                          {task.isCompleted && <Check className="w-3 h-3 stroke-[3]" />}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span
                              className={`text-[10px] font-extrabold px-1.5 py-0.2 rounded ${
                                task.priority === 'P1'
                                  ? 'bg-cozy-rose/20 text-cozy-rose'
                                  : task.priority === 'P2'
                                    ? 'bg-cozy-peach/20 text-cozy-peach'
                                    : 'bg-cozy-card text-cozy-subtext'
                              }`}
                            >
                              {task.priority}
                            </span>
                            <span
                              className={`text-xs font-bold leading-snug ${
                                task.isCompleted
                                  ? 'line-through text-cozy-subtext'
                                  : 'text-cozy-text'
                              }`}
                            >
                              {task.title}
                            </span>
                            <span className="text-[10px] font-mono text-cozy-subtext">
                              ({task.durationMinutes}m)
                            </span>
                          </div>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          requestConfirm(
                            'Excluir Tarefa?',
                            `Remover permanentemente a tarefa "${task.title}" e eventuais blocos dela na régua?`,
                            () => deleteTask(task.id)
                          )
                        }
                        className="p-1.5 rounded-lg text-cozy-subtext hover:text-cozy-rose hover:bg-cozy-rose/10 transition-colors shrink-0"
                        title="Excluir tarefa"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Tag de Energia da Tarefa */}
                    <div className="flex items-center gap-1.5 flex-wrap pl-6">
                      {(
                        [
                          {
                            id: 'FOCUS',
                            label: '🧠 Focado',
                            activeCls: 'bg-cozy-lavender/20 text-cozy-lavender border-cozy-lavender/40',
                          },
                          {
                            id: 'TRANSIT',
                            label: '🎧 Baixo Foco',
                            activeCls: 'bg-cozy-butter/20 text-cozy-butter border-cozy-butter/40',
                          },
                          {
                            id: 'BACKGROUND',
                            label: '🫧 Segundo Plano',
                            activeCls: 'bg-cozy-sky/20 text-cozy-sky border-cozy-sky/40',
                          },
                        ] as const
                      ).map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => updateTask(task.id, { energyTier: opt.id })}
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border transition-colors ${
                            task.energyTier === opt.id
                              ? opt.activeCls
                              : 'bg-cozy-card text-cozy-subtext border-cozy-border opacity-70 hover:opacity-100'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>

                    {/* Compact clickable subitems */}
                    {task.subitems && task.subitems.length > 0 && (
                      <div className="space-y-1 pl-6 pt-0.5">
                        {task.subitems.map((sub) => (
                          <button
                            key={sub.id}
                            type="button"
                            onClick={() => toggleTaskSubitem(task.id, sub.id)}
                            className="w-full flex items-center gap-1.5 text-[11px] text-left text-cozy-subtext hover:text-cozy-text"
                          >
                            <span
                              className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${
                                sub.isCompleted
                                  ? 'bg-cozy-sage border-cozy-sage text-cozy-bg'
                                  : 'border-cozy-border bg-cozy-card'
                              }`}
                            >
                              {sub.isCompleted && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                            </span>
                            <span className={sub.isCompleted ? 'line-through opacity-70' : ''}>
                              {sub.title}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column (40%): INTERACTIVE 2-SIDE VERTICAL RULER FOR TODAY */}
        <div>
          <InteractiveVerticalRuler
            dateStr={todayStr}
            onSelectBlock={handleSelectBlock}
            onDragCreate={handleDragCreate}
            hourHeight={56}
            title="Régua de Hoje"
            subtitle="Áreas (só hoje) • Atividades"
            headerRight={
              <button
                onClick={() => {
                  const nowMin = Math.floor(timeStringToMinutes(currentTimeStr) / 15) * 15;
                  handleDragCreate(
                    minutesToTimeString(nowMin),
                    minutesToTimeString(Math.min(23 * 60, nowMin + 60))
                  );
                }}
                className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-cozy-lavender/20 text-cozy-lavender border border-cozy-lavender/30 text-xs font-bold hover:bg-cozy-lavender/30 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Novo Bloco</span>
              </button>
            }
          />
        </div>
      </div>

      {/* 3-Tab Block Allocation Modal */}
      <BlockAllocationModal
        isOpen={modalOpen}
        date={todayStr}
        initialStartTime={modalStartTime}
        initialEndTime={modalEndTime}
        initialTab={modalInitialTab}
        editingBlock={editingBlock}
        onClose={() => setModalOpen(false)}
      />

      {/* Night Checkout Modal */}
      {showNightModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-cozy-card rounded-3xl p-6 max-w-lg w-full border border-cozy-border shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-cozy-border">
              <div className="flex items-center gap-2">
                <span className="text-2xl">🌙</span>
                <div>
                  <h3 className="font-extrabold text-base text-cozy-text">
                    Encerramento Gentileza da Noite
                  </h3>
                  <p className="text-xs text-cozy-subtext">
                    Decida sem culpa o que fazer com pendências de hoje.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowNightModal(false)}
                className="p-1.5 rounded-full text-cozy-subtext hover:bg-cozy-hover"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 my-4">
              <div className="p-3.5 rounded-2xl bg-cozy-sage-light/40 border border-cozy-sage/30 flex items-center gap-3">
                <Sparkles className="w-5 h-5 text-cozy-sage flex-shrink-0" />
                <p className="text-xs text-cozy-sage font-medium">
                  Parabéns por hoje! Você não precisa carregar o peso do que não deu tempo de fazer.
                </p>
              </div>

              {uncompletedTasks.length === 0 ? (
                <div className="p-6 text-center text-xs text-cozy-subtext italic bg-cozy-bg rounded-2xl border border-cozy-border">
                  Todas as tarefas de hoje foram concluídas! Durma com a mente tranquila 🌸
                </div>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  <span className="text-xs font-bold block">
                    Tarefas Pendentes ({uncompletedTasks.length}):
                  </span>
                  {uncompletedTasks.map((task) => {
                    const isDiscarded = discardTaskIds.includes(task.id);
                    const isPushed = pushTaskIds.includes(task.id);

                    return (
                      <div
                        key={task.id}
                        className="p-3 rounded-2xl bg-cozy-bg border border-cozy-border flex items-center justify-between gap-2"
                      >
                        <span className="text-xs font-medium whitespace-normal break-words leading-snug min-w-0 flex-1">
                          {task.title}
                        </span>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setDiscardTaskIds((prev) =>
                                isDiscarded
                                  ? prev.filter((id) => id !== task.id)
                                  : [...prev, task.id]
                              );
                              setPushTaskIds((prev) => prev.filter((id) => id !== task.id));
                            }}
                            className={`px-2.5 py-1 rounded-xl text-[11px] font-bold border transition-all ${
                              isDiscarded
                                ? 'bg-cozy-peach-light text-cozy-peach border-cozy-peach'
                                : 'bg-cozy-card text-cozy-subtext border-cozy-border hover:bg-cozy-hover'
                            }`}
                          >
                            Descartar sem culpa 🍃
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setPushTaskIds((prev) =>
                                isPushed
                                  ? prev.filter((id) => id !== task.id)
                                  : [...prev, task.id]
                              );
                              setDiscardTaskIds((prev) => prev.filter((id) => id !== task.id));
                            }}
                            className={`px-2.5 py-1 rounded-xl text-[11px] font-bold border transition-all ${
                              isPushed
                                ? 'bg-cozy-lavender text-cozy-bg border-cozy-lavender'
                                : 'bg-cozy-card text-cozy-subtext border-cozy-border hover:bg-cozy-hover'
                            }`}
                          >
                            Jogar p/ Amanhã ➡️
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowNightModal(false)}
                className="px-4 py-2 rounded-full text-xs font-bold text-cozy-subtext hover:bg-cozy-hover"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={handleConfirmNightCheckout}
                className="px-5 py-2 rounded-full text-xs font-bold bg-cozy-lavender text-cozy-bg hover:brightness-110 shadow-cozy-pill"
              >
                Finalizar Noite Tranquila ✨
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
