import React from 'react';
import { useApp } from '../context/AppContext';
import { AlertTriangle, X } from 'lucide-react';

export const ConfirmModal: React.FC = () => {
  const { confirmDialog, closeConfirmDialog } = useApp();

  if (!confirmDialog?.isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-cozy-card rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-cozy-border animate-in zoom-in-95 duration-150 text-cozy-text">
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2.5 rounded-2xl bg-cozy-peach-light text-cozy-peach border border-cozy-peach/30">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-base">{confirmDialog.title}</h3>
            <span className="text-[11px] text-cozy-subtext">Confirmação de Ação</span>
          </div>
        </div>

        <p className="text-xs text-cozy-subtext my-4 leading-relaxed">
          {confirmDialog.message}
        </p>

        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            onClick={closeConfirmDialog}
            className="px-4 py-2 rounded-full text-xs font-bold text-cozy-subtext hover:bg-cozy-hover transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={confirmDialog.onConfirm}
            className="px-4 py-2 rounded-full text-xs font-bold bg-cozy-peach text-cozy-bg hover:bg-cozy-peach-dark transition-all shadow-cozy-pill"
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
};
