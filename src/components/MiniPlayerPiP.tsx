import React from 'react';
import { useApp } from '../context/AppContext';
import { formatSecondsToTimer } from '../utils/helpers';
import { Play, Pause, Minimize2 } from 'lucide-react';

export const MiniPlayerPiP: React.FC = () => {
  const {
    isPiPMode,
    setIsPiPMode,
    currentActiveSchedule,
    playProgress,
    pauseProgress,
    resumeFromPause
  } = useApp();

  if (!isPiPMode) return null;

  const { block: activeBlock, progress: current, isFreeSlot, currentTimeStr } = currentActiveSchedule;

  const isRunning = current?.isRunning && !current?.isPaused;
  const isPaused = current?.isPaused;

  const spentToday = current?.spentTodaySeconds || 0;
  const targetDaily = current?.targetDailySeconds || 7200;
  const dailyPercent = Math.min(100, Math.round((spentToday / targetDaily) * 100));

  return (
    <div className="fixed bottom-6 right-6 z-50 w-80 bg-cozy-card/95 backdrop-blur-md rounded-3xl p-4 shadow-2xl border border-cozy-border animate-in slide-in-from-bottom-5 duration-300 text-cozy-text">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-cozy-sage animate-ping" />
          <span className="text-[11px] font-bold text-cozy-subtext uppercase tracking-wider">
            Modo Foco Canto ({currentTimeStr})
          </span>
        </div>
        <button
          onClick={() => setIsPiPMode(false)}
          title="Fechar modo canto"
          className="p-1 rounded-full text-cozy-subtext hover:bg-cozy-hover transition-colors"
        >
          <Minimize2 className="w-4 h-4" />
        </button>
      </div>

      {/* Title & Tag */}
      <div className="mb-3">
        <h4 className="font-bold text-sm text-cozy-text truncate">
          {activeBlock ? activeBlock.title : current ? current.title : 'Horário Livre'}
        </h4>
        <span className="inline-block mt-0.5 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-cozy-lavender-light text-cozy-lavender">
          {activeBlock ? `${activeBlock.startTime} - ${activeBlock.endTime}` : 'Nenhum compromisso agora'}
        </span>
      </div>

      {/* Timer & Controls if progress active */}
      {current ? (
        <>
          <div className="flex items-center justify-between gap-3 mb-3 p-3 rounded-2xl bg-cozy-bg border border-cozy-border">
            <div>
              <div className="text-xl font-extrabold font-mono text-cozy-text tracking-tight">
                {formatSecondsToTimer(spentToday)}
              </div>
              <div className="text-[10px] text-cozy-subtext">
                Meta: {formatSecondsToTimer(targetDaily)}
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              {isRunning ? (
                <button
                  onClick={() => pauseProgress(current.id)}
                  className="p-2.5 rounded-full bg-cozy-butter text-cozy-bg hover:bg-cozy-butter-dark transition-all shadow-cozy-pill"
                  title="Pausar"
                >
                  <Pause className="w-4 h-4" />
                </button>
              ) : (
                <button
                  onClick={() => (isPaused ? resumeFromPause(current.id) : playProgress(current.id))}
                  className="p-2.5 rounded-full bg-cozy-sage text-cozy-bg hover:bg-cozy-sage-dark transition-all shadow-cozy-pill"
                  title="Play"
                >
                  <Play className="w-4 h-4 fill-current ml-0.5" />
                </button>
              )}
            </div>
          </div>

          {/* Micro Progress Bar */}
          <div className="space-y-1">
            <div className="flex justify-between text-[10px] font-bold text-cozy-subtext">
              <span>Hoje</span>
              <span>{dailyPercent}%</span>
            </div>
            <div className="w-full h-2 rounded-full bg-cozy-border overflow-hidden">
              <div
                className="h-full rounded-full bg-cozy-sage transition-all duration-300"
                style={{ width: `${dailyPercent}%` }}
              />
            </div>
          </div>
        </>
      ) : (
        <div className="p-3 text-center text-xs text-cozy-subtext italic bg-cozy-bg rounded-2xl border border-cozy-border">
          Horário livre no momento.
        </div>
      )}
    </div>
  );
};
