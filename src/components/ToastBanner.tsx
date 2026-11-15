import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, AlertTriangle, Sparkles, X } from 'lucide-react';
import { useApp, ToastMessage } from '../context/AppContext';

const TOAST_STYLES: Record<
  ToastMessage['type'],
  {
    containerCls: string;
    iconCls: string;
    Icon: React.ComponentType<{ className?: string }>;
  }
> = {
  success: {
    containerCls: 'bg-cozy-card/95 border-cozy-sage/45 text-cozy-text',
    iconCls: 'bg-cozy-sage/20 text-cozy-sage border-cozy-sage/35',
    Icon: CheckCircle2,
  },
  warning: {
    containerCls: 'bg-cozy-card/95 border-cozy-butter/45 text-cozy-text',
    iconCls: 'bg-cozy-butter/20 text-cozy-butter border-cozy-butter/35',
    Icon: AlertTriangle,
  },
  info: {
    containerCls: 'bg-cozy-card/95 border-cozy-lavender/45 text-cozy-text',
    iconCls: 'bg-cozy-lavender/20 text-cozy-lavender border-cozy-lavender/35',
    Icon: Sparkles,
  },
};

export const ToastBanner: React.FC = () => {
  const { toast, dismissToast } = useApp();

  const style = toast ? TOAST_STYLES[toast.type] : null;

  return (
    <AnimatePresence>
      {toast && style && (
        <motion.div
          key={toast.id}
          initial={{ opacity: 0, y: 18, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.96 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          role="status"
          aria-live="polite"
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[65] max-w-md w-[calc(100%-2rem)] backdrop-blur-md rounded-2xl px-4 py-3 border shadow-2xl flex items-center gap-3 ${style.containerCls}`}
        >
          <div className={`p-2 rounded-xl border shrink-0 ${style.iconCls}`}>
            <style.Icon className="w-4 h-4" />
          </div>

          <p className="text-xs font-semibold text-cozy-text leading-snug flex-1">
            {toast.message}
          </p>

          <button
            type="button"
            onClick={dismissToast}
            title="Fechar notificação"
            aria-label="Fechar notificação"
            className="p-1.5 rounded-full text-cozy-subtext hover:text-cozy-text hover:bg-cozy-hover transition-colors shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
