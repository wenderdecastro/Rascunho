import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AppProvider, useApp } from './context/AppContext';
import { Navbar } from './components/Navbar';
import { MeuDiaView } from './components/MeuDiaView';
import { AgendaView } from './components/AgendaView';
import { RotinaView } from './components/RotinaView';
import { ProgressosView } from './components/ProgressosView';
import { ConfiguracoesView } from './components/ConfiguracoesView';
import { MiniPlayerPiP } from './components/MiniPlayerPiP';
import { ConfirmModal } from './components/ConfirmModal';
import { ToastBanner } from './components/ToastBanner';

const MainContent: React.FC = () => {
  const { activeTab } = useApp();

  return (
    <main className="min-h-[calc(100vh-65px)] pb-12 w-full overflow-x-hidden">
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
        >
          {activeTab === 'MEU_DIA' && <MeuDiaView />}
          {activeTab === 'AGENDA' && <AgendaView />}
          {activeTab === 'ROTINA' && <RotinaView />}
          {activeTab === 'PROGRESSOS' && <ProgressosView />}
          {activeTab === 'CONFIGURACOES' && <ConfiguracoesView />}
        </motion.div>
      </AnimatePresence>
    </main>
  );
};

export const App: React.FC = () => {
  return (
    <AppProvider>
      <div className="min-h-screen bg-cozy-bg text-cozy-text flex flex-col antialiased selection:bg-cozy-lavender selection:text-cozy-bg w-full">
        <Navbar />
        <MainContent />
        <MiniPlayerPiP />
        <ConfirmModal />
        <ToastBanner />
      </div>
    </AppProvider>
  );
};

export default App;
