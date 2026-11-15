import React from 'react';
import { useApp } from '../context/AppContext';
import { timeStringToMinutes, formatSecondsToHuman } from '../utils/helpers';
import { Settings, Clock, Sparkles, Check } from 'lucide-react';

const WEEKDAYS = [
  { id: 1, name: 'Segunda-feira' },
  { id: 2, name: 'Terça-feira' },
  { id: 3, name: 'Quarta-feira' },
  { id: 4, name: 'Quinta-feira' },
  { id: 5, name: 'Sexta-feira' },
  { id: 6, name: 'Sábado' },
  { id: 0, name: 'Domingo' }
];

export const ConfiguracoesView: React.FC = () => {
  const { dayHoursConfigs, updateDayHoursConfig } = useApp();

  return (
    <div className="p-6 md:p-10 max-w-[1920px] w-full mx-auto space-y-6 text-cozy-text">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-cozy-border">
        <div>
          <div className="flex items-center gap-2">
            <Settings className="w-6 h-6 text-cozy-sage" />
            <h1 className="text-2xl font-extrabold tracking-tight font-sans">
              Configurações & Horários da Semana ⚙️
            </h1>
          </div>
          <p className="text-sm text-cozy-subtext mt-1">
            Defina quantas horas úteis tem cada dia da sua semana para calibrar as réguas da Agenda, Rotina e a Calculadora de Capacidade Real.
          </p>
        </div>
      </div>

      {/* Weekday Hours Grid */}
      <div className="bg-cozy-card rounded-3xl p-6 border border-cozy-border shadow-cozy space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-cozy-text">
              Duração Ativa por Dia da Semana
            </h2>
            <p className="text-xs text-cozy-subtext">
              Ajuste o horário em que você acorda/começa o dia e o horário em que encerra suas atividades.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {WEEKDAYS.map(day => {
            const config =
              dayHoursConfigs.find(c => c.dayOfWeek === day.id) || {
                dayOfWeek: day.id,
                startHour: '07:00',
                endHour: '23:00'
              };

            const startMin = timeStringToMinutes(config.startHour);
            const endMin = timeStringToMinutes(config.endHour);
            const durationMin = Math.max(0, endMin - startMin);

            return (
              <div
                key={day.id}
                className="bg-cozy-bg rounded-2xl p-4 border border-cozy-border shadow-sm space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-sm text-cozy-text">{day.name}</span>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-cozy-sage-light text-cozy-sage border border-cozy-sage/30">
                    {formatSecondsToHuman(durationMin * 60)} úteis
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-cozy-subtext block mb-1">
                      Início do Dia
                    </label>
                    <input
                      type="time"
                      value={config.startHour}
                      onChange={e =>
                        updateDayHoursConfig(day.id, e.target.value, config.endHour)
                      }
                      className="w-full px-3 py-1.5 rounded-xl border border-cozy-border bg-cozy-card text-xs font-mono text-cozy-text focus:outline-none focus:ring-1 focus:ring-cozy-lavender"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-cozy-subtext block mb-1">
                      Fim do Dia
                    </label>
                    <input
                      type="time"
                      value={config.endHour}
                      onChange={e =>
                        updateDayHoursConfig(day.id, config.startHour, e.target.value)
                      }
                      className="w-full px-3 py-1.5 rounded-xl border border-cozy-border bg-cozy-card text-xs font-mono text-cozy-text focus:outline-none focus:ring-1 focus:ring-cozy-lavender"
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Tip Banner */}
        <div className="p-4 rounded-2xl bg-cozy-lavender-light/40 border border-cozy-lavender/30 flex items-center gap-3">
          <Sparkles className="w-5 h-5 text-cozy-lavender flex-shrink-0" />
          <p className="text-xs text-cozy-subtext leading-relaxed">
            Esses horários são salvos automaticamente e garantem que as janelas livres da rotina e o cálculo de sobrecarga reflitam exatamente o seu ritmo de vida real.
          </p>
        </div>
      </div>
    </div>
  );
};
