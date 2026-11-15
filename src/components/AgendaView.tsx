import React, { useState } from 'react';
import { useApp, getTodayDateString } from '../context/AppContext';
import { ScheduledBlock } from '../types';
import { getDayBurnoutForecast, formatDateBR } from '../utils/helpers';
import { InteractiveVerticalRuler } from './InteractiveVerticalRuler';
import { BlockAllocationModal } from './BlockAllocationModal';
import { ChevronLeft, ChevronRight, Plus, Calendar as CalendarIcon, Wand2 } from 'lucide-react';

export const AgendaView: React.FC = () => {
  const {
    selectedDate,
    setSelectedDate,
    routineBlocks,
    scheduledBlocks,
    progressBars,
    dayHoursConfigs,
    getEffectiveBlocksForDate,
    autoDistributeTasksForDate,
    showToast,
  } = useApp();

  const [currentMonthDate, setCurrentMonthDate] = useState<Date>(
    () => new Date(selectedDate + 'T00:00:00')
  );

  // Modal state for 3-tab BlockAllocationModal
  const [modalOpen, setModalOpen] = useState(false);
  const [modalStartTime, setModalStartTime] = useState('09:00');
  const [modalEndTime, setModalEndTime] = useState('10:00');
  const [editingBlock, setEditingBlock] = useState<ScheduledBlock | null>(null);

  const todayStr = getTodayDateString();
  const year = currentMonthDate.getFullYear();
  const month = currentMonthDate.getMonth();
  const monthName = currentMonthDate.toLocaleString('pt-BR', {
    month: 'long',
    year: 'numeric',
  });

  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const prevMonth = () => setCurrentMonthDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentMonthDate(new Date(year, month + 1, 1));
  const goToToday = () => {
    setSelectedDate(todayStr);
    setCurrentMonthDate(new Date(todayStr + 'T00:00:00'));
  };

  const handleDragCreate = (startTime: string, endTime: string) => {
    setEditingBlock(null);
    setModalStartTime(startTime);
    setModalEndTime(endTime);
    setModalOpen(true);
  };

  const handleSelectBlock = (block: ScheduledBlock) => {
    setEditingBlock(block);
    setModalStartTime(block.startTime);
    setModalEndTime(block.endTime);
    setModalOpen(true);
  };

  const selectedEffectiveBlocks = getEffectiveBlocksForDate(selectedDate);

  return (
    <div className="p-6 md:p-10 max-w-[1920px] w-full mx-auto space-y-6 text-cozy-text">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-cozy-border">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight font-sans flex items-center gap-2.5">
            <CalendarIcon className="w-6 h-6 text-cozy-lavender" />
            <span>Agenda Mensal &amp; Régua de Alocação</span>
          </h1>
          <p className="text-sm text-cozy-subtext mt-0.5">
            Selecione um dia no calendário grande e arraste na régua vertical ao lado para alocar progressos, tarefas ou blocos de tempo.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => {
              const res = autoDistributeTasksForDate(selectedDate);
              showToast(res.message, res.scheduledCount > 0 ? 'success' : 'info');
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-cozy-card border border-cozy-sky/40 text-cozy-sky hover:bg-cozy-sky/15 text-xs font-bold transition-all shadow-sm"
            title="Distribui automaticamente tarefas elegíveis nas áreas do dia selecionado"
          >
            <Wand2 className="w-3.5 h-3.5" />
            <span>Distribuir Tarefas no Dia</span>
          </button>
          <button
            onClick={goToToday}
            className="px-4 py-2 rounded-full bg-cozy-card border border-cozy-border text-xs font-bold text-cozy-text hover:bg-cozy-hover transition-colors"
          >
            Ir para Hoje
          </button>
          <button
            onClick={() => handleDragCreate('09:00', '10:30')}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-cozy-lavender text-cozy-bg hover:brightness-110 font-extrabold text-xs transition-all shadow-cozy-pill"
          >
            <Plus className="w-4 h-4" />
            <span>Alocar Bloco</span>
          </button>
        </div>
      </div>

      {/* 2-Column Split: Large Monthly Calendar (~75%) + Encurted Vertical Day Ruler (max 25%) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT: LARGE MONTHLY CALENDAR (9 Cols = ~75% width) */}
        <div className="lg:col-span-9 xl:col-span-9 bg-cozy-card rounded-3xl p-6 border border-cozy-border shadow-cozy space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-cozy-border">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-cozy-lavender block">
                Visão Mensal
              </span>
              <h2 className="text-xl font-extrabold text-cozy-text capitalize mt-0.5">
                {monthName}
              </h2>
            </div>

            <div className="flex items-center gap-1.5 p-1.5 bg-cozy-bg rounded-full border border-cozy-border">
              <button
                onClick={prevMonth}
                className="p-2 rounded-full hover:bg-cozy-hover text-cozy-subtext hover:text-cozy-text transition-colors"
                title="Mês anterior"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={nextMonth}
                className="p-2 rounded-full hover:bg-cozy-hover text-cozy-subtext hover:text-cozy-text transition-colors"
                title="Próximo mês"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Weekday Headers */}
          <div className="grid grid-cols-7 gap-2 text-center text-xs font-extrabold text-cozy-subtext uppercase tracking-wider">
            {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((d) => (
              <div key={d} className="py-1.5">
                {d}
              </div>
            ))}
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-2">
            {Array.from({ length: firstDayOfMonth }).map((_, i) => (
              <div
                key={`empty-${i}`}
                className="min-h-[120px] rounded-2xl bg-cozy-bg/25 border border-cozy-border/30 opacity-40"
              />
            ))}

            {Array.from({ length: daysInMonth }).map((_, i) => {
              const dayNum = i + 1;
              const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(
                dayNum
              ).padStart(2, '0')}`;
              const isSelected = selectedDate === dateStr;
              const isToday = dateStr === todayStr;

              const dayExplicitBlocks = scheduledBlocks.filter((b) => b.date === dateStr);
              const dayAllBlocks = getEffectiveBlocksForDate(dateStr);

              // Do NOT display sun icon by default on empty dates unless selected or has scheduled events
              const shouldShowWeather = dayExplicitBlocks.length > 0 || isSelected;
              const forecast = shouldShowWeather
                ? getDayBurnoutForecast(
                    routineBlocks,
                    scheduledBlocks,
                    progressBars,
                    dateStr,
                    dayHoursConfigs
                  )
                : null;

              return (
                <button
                  key={dayNum}
                  type="button"
                  onClick={() => setSelectedDate(dateStr)}
                  className={`min-h-[120px] p-2 rounded-2xl border text-left transition-all flex flex-col justify-between gap-1.5 overflow-hidden ${
                    isSelected
                      ? 'border-cozy-lavender bg-cozy-lavender/10 ring-2 ring-cozy-lavender/60 shadow-cozy-pill'
                      : isToday
                        ? 'border-cozy-peach/60 bg-cozy-peach/5 hover:bg-cozy-hover'
                        : 'border-cozy-border bg-cozy-bg/70 hover:bg-cozy-hover'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span
                      className={`text-xs font-mono font-extrabold px-1.5 py-0.5 rounded-lg leading-none ${
                        isToday
                          ? 'bg-cozy-peach text-cozy-bg'
                          : isSelected
                            ? 'text-cozy-lavender'
                            : 'text-cozy-text'
                      }`}
                    >
                      {dayNum}
                    </span>
                    {forecast && (
                      <span title={forecast.label} className="text-sm leading-none">
                        {forecast.icon}
                      </span>
                    )}
                  </div>

                  {/* All activities for this day visible without +n truncation */}
                  <div className="space-y-1 w-full max-h-28 overflow-y-auto pr-0.5">
                    {dayAllBlocks.map((blk) => (
                      <div
                        key={blk.id}
                        title={`${blk.startTime} - ${blk.endTime}: ${blk.title}`}
                        className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md truncate border ${
                          blk.tier === 'FOCUS'
                            ? 'bg-cozy-lavender/15 text-cozy-lavender border-cozy-lavender/25'
                            : blk.tier === 'TRANSIT'
                              ? 'bg-cozy-butter/15 text-cozy-butter border-cozy-butter/25'
                              : blk.tier === 'BACKGROUND'
                                ? 'bg-cozy-sky/15 text-cozy-sky border-cozy-sky/25'
                                : 'bg-cozy-sage/15 text-cozy-sage border-cozy-sage/25'
                        }`}
                      >
                        <span className="font-mono text-[9px] mr-1 opacity-75">{blk.startTime}</span>
                        <span>{blk.title}</span>
                      </div>
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* RIGHT: INTERACTIVE VERTICAL RULER (3 Cols = at most 25% width) */}
        <div className="lg:col-span-3 xl:col-span-3">
          <InteractiveVerticalRuler
            dateStr={selectedDate}
            onSelectBlock={handleSelectBlock}
            onDragCreate={handleDragCreate}
            hourHeight={52}
            title={`Dia: ${formatDateBR(selectedDate)}`}
            subtitle={`${selectedEffectiveBlocks.length} atividade(s)`}
            headerRight={
              <button
                onClick={() => handleDragCreate('09:00', '10:30')}
                className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-cozy-lavender/20 text-cozy-lavender border border-cozy-lavender/30 text-xs font-bold hover:bg-cozy-lavender/30 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Novo</span>
              </button>
            }
          />
        </div>
      </div>

      {/* 3-Tab Allocation Modal */}
      <BlockAllocationModal
        isOpen={modalOpen}
        date={selectedDate}
        initialStartTime={modalStartTime}
        initialEndTime={modalEndTime}
        editingBlock={editingBlock}
        onClose={() => setModalOpen(false)}
      />
    </div>
  );
};
