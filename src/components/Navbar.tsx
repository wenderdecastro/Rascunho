import React from 'react';
import { motion } from 'framer-motion';
import { useApp, getTodayDateString } from '../context/AppContext';
import { calculateRealCapacity } from '../utils/helpers';
import {
  Sun,
  Calendar,
  Clock,
  BarChart3,
  Sparkles,
  Maximize2,
  Settings
} from 'lucide-react';

export const Navbar: React.FC = () => {
  const {
    activeTab,
    setActiveTab,
    selectedDate,
    routineBlocks,
    scheduledBlocks,
    progressBars,
    tasks,
    dayHoursConfigs,
    setIsPiPMode
  } = useApp();

  const todayStr = getTodayDateString();
  const capacity = calculateRealCapacity(
    routineBlocks,
    scheduledBlocks,
    progressBars,
    tasks,
    selectedDate || todayStr,
    dayHoursConfigs
  );

  return (
    <header className="sticky top-0 z-30 bg-cozy-bg/95 backdrop-blur-md border-b border-cozy-border px-6 md:px-10 py-3">
      <div className="max-w-[1920px] w-full mx-auto flex items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-cozy-lavender/30 via-cozy-sage/20 to-cozy-peach/30 flex items-center justify-center text-xl shadow-cozy-pill border border-cozy-border">
            🌸
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-lg text-cozy-text tracking-tight font-sans">
                CozyFlow
              </span>
              <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-cozy-lavender-light text-cozy-lavender border border-cozy-lavender/30">
                Dark Mode
              </span>
            </div>
            <p className="text-xs text-cozy-subtext hidden sm:block">
              Seu planejamento acolhedor e sem culpa
            </p>
          </div>
        </div>

        {/* Main Navigation Pills with Dynamic Sliding Highlight */}
        <nav className="relative flex items-center p-1 bg-cozy-card rounded-full border border-cozy-border shadow-inner">
          {(
            [
              { id: 'MEU_DIA', label: 'Meu Dia', icon: <Sun className="w-4 h-4 text-cozy-butter" /> },
              { id: 'AGENDA', label: 'Agenda', icon: <Calendar className="w-4 h-4 text-cozy-sky" /> },
              { id: 'ROTINA', label: 'Rotina', icon: <Clock className="w-4 h-4 text-cozy-lavender" /> },
              { id: 'PROGRESSOS', label: 'Progressos', icon: <BarChart3 className="w-4 h-4 text-cozy-peach" /> },
              { id: 'CONFIGURACOES', label: 'Configurações', icon: <Settings className="w-4 h-4 text-cozy-sage" /> },
            ] as const
          ).map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative z-10 flex items-center gap-2 px-4 py-2 rounded-full text-xs transition-colors duration-200 ${
                  isActive
                    ? 'text-cozy-text font-bold'
                    : 'text-cozy-subtext hover:text-cozy-text font-semibold'
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="activeNavPill"
                    transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                    className="absolute inset-0 bg-cozy-hover rounded-full border border-cozy-border shadow-cozy-pill -z-10"
                  />
                )}
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Real Capacity & Utilities */}
        <div className="flex items-center gap-2.5">
          {/* Calculadora de Capacidade Real */}
          <div
            title={capacity.message}
            className={`hidden md:flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs border transition-all cursor-help ${
              capacity.status === 'CRITICAL'
                ? 'bg-cozy-peach-light text-cozy-peach border-cozy-peach/40 animate-pulse'
                : capacity.status === 'WARNING'
                ? 'bg-cozy-butter-light text-cozy-butter border-cozy-butter/40'
                : 'bg-cozy-sage-light text-cozy-sage border-cozy-sage/40'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span className="font-semibold">
              Livre: {capacity.freeHoursFormatted}
            </span>
            <span className="opacity-40">|</span>
            <span>Metas: {capacity.plannedHoursFormatted}</span>
          </div>

          {/* Floating PiP Mini-Dock toggle */}
          <button
            onClick={() => setIsPiPMode(true)}
            title="Modo Canto Flutuante"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-cozy-card border border-cozy-border text-cozy-text hover:bg-cozy-hover shadow-cozy-pill transition-all"
          >
            <Maximize2 className="w-3.5 h-3.5 text-cozy-lavender" />
            <span className="hidden lg:inline">Modo Canto</span>
          </button>
        </div>
      </div>
    </header>
  );
};
