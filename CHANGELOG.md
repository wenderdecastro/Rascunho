# Changelog

Todas as alterações notáveis do **CozyFlow** são documentadas neste arquivo, seguindo o padrão [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e versionamento semântico ([SemVer](https://semver.org/lang/pt-BR/)).

---

## [1.2.0] - 2026-11-14

### Added
- **Régua Vertical Dividida em 2 Colunas (25% em Meu Dia e Agenda):**
  - Coluna esquerda dedicada a **Áreas do Dia** em baixa opacidade (`Áreas (Só hoje)`), permitindo criar, redimensionar, mover ou remover áreas exclusivamente para a data selecionada (`dayOverrides[date].customRoutineAreas`) sem alterar a rotina semanal base, além do botão **Restaurar áreas**.
  - Coluna direita dedicada a **Blocos de Atividade** (`Atividades`), separando visual e funcionalmente turnos/contextos de blocos executáveis.
- **Recorrência Estilo Google Agenda (`RecurrenceRule` + `expandRecurrenceDates`):**
  - Suporte a repetição **Diária**, **Semanal** (com seleção de dias da semana `D S T Q Q S S`), **Mensal** e **Personalizada** (`interval`), com término **Nunca (até 8 semanas)**, **Em data específica** ou **Após N ocorrências** ao criar **Blocos de Atividade** ou **Tarefas compatíveis na Rotina**.
- **Painel de Tarefas Compatíveis por Tag de Energia na Rotina (`RotinaView`):**
  - Criação e visualização de tarefas compatíveis agrupadas por Tag de Energia e com recorrência diretamente na aba **Rotina**, sem criação de blocos de atividade nessa aba.

### Changed
- **Estritamente 3 Tags de Energia (`EnergyTier`):** unificado em **`FOCUS`** (`🧠 Focado`), **`TRANSIT`** (`🎧 Baixo Foco`) e **`BACKGROUND`** (`🫧 Segundo Plano`). Removida a 4ª tag (`REST`) da interface e tipos, mantendo normalização retrocompatível para dados pré-existentes no `localStorage`.
- **Áreas do Dia 100% Genéricas:** removidos os presets fixos (`Trabalho`, `Faculdade`, `Transporte`) e os checkboxes de elegibilidade nas tarefas; áreas agora recebem nome livre, **Obrigatoriedade** (`MANDATORY` | `FLEXIBLE`) e 1 das 3 Tags de Energia, definindo compatibilidade exclusivamente pela correspondência de `EnergyTier`.
- **Modal `BlockAllocationModal` Simplificado em 2 Abas:** mantidas apenas **`Alocar Progresso`** e **`Alocar Tarefa`** (removida a aba **`Alocar Tempo`**). Quando o horário se sobrepõe a uma Área do Dia, o modal filtra e trava a compatibilidade pela Tag de Energia da área.
- **Proporção 75% / 25% Unificada (`MeuDiaView` e `AgendaView`):** em desktop (`lg:col-span-9` + `lg:col-span-3`), ambas as abas reservam 25% de largura horizontal para a régua interativa dividida.

---

## [1.1.0] - 2026-11-14

### Added
- **Squad Multi-Agente de Desenvolvimento & Validação:**
  - Definições persistentes em `.agents/agents/` para `pm`, `pa`, `designer`, `dev`, `reviewer` e `qa`.
  - Governança do projeto em `AGENTS.md` e fluxo de validação completo em `.agents/skills/validacao-squad/SKILL.md`.
- **Áreas do Dia na Rotina (`RoutineAreaType`):** configuração de turnos/contextos semanais (`WORK`, `COLLEGE`, `COMMUTE`, `CUSTOM`) exibidos ao fundo das réguas verticais com baixa opacidade e borda tracejada.
- **Auto-Distribuição Inteligente (`autoDistributeTasksForDate`):** distribuição automática de tarefas pendentes (`P1 > P2 > P3 > P4`) respeitando os checkboxes de elegibilidade (`eligibleWork`, `eligibleCollege`, `eligibleCommute`), mantendo tarefas sem seleção restritas a blocos livres fora de Trabalho e Faculdade.
- **Progressos Ilimitados & Subprogressos Hierárquicos:** suporte a metas contínuas sem teto global (`isUnlimited: true`), meta diária ajustável em tempo real e subprogressos vinculados (`parentId`) com rolagem e soma automática ao objetivo pai.
- **Modal de Alocação em 3 Abas (`BlockAllocationModal`):** alocação rápida por **Progresso**, **Tarefa** (com criação e subitens) ou **Tempo** (com tag de energia/foco).
- **Gestão Tática no Meu Dia:** card **Tarefas de Hoje** (concluir, alternar elegibilidade, criar e excluir), botões de editar/excluir no card de **Atividade Atual** e botão **Ocultar hoje** para áreas de rotina com restauração no próprio dia.
- **Feedback Não-Bloqueante (`ToastBanner`):** componente animado conectado a `showToast` / `dismissToast` no `AppContext`.

### Changed
- **Cozy Dark Mode & Layout Desktop-First (`max-w-[1920px]`):** interface integralmente em tema escuro acolhedor (`#12161A` / `#1C2129` / `#2A323F`).
- **Réguas Verticais Interativas (`InteractiveVerticalRuler` e `RotinaView`):** criação por arraste em espaço vazio, movimentação (drag), redimensionamento (resize) e indicador visual do horário atual em todas as réguas; na Agenda, divisão ampla (~75% calendário mensal / máx. 25% régua vertical) exibindo todas as atividades sem truncar em `+n`.
- **Navegação Animada (`Navbar` + `App`):** indicador deslizante (`layoutId`) e transições suaves entre as 5 abas (`Meu Dia`, `Agenda`, `Rotina`, `Progressos`, `Configurações`).

### Fixed
- **Exclusão de itens na aba Meu Dia:** corrigido o bug de dupla confirmação aninhada entre componentes de UI e ações do `AppContext` (fazendo `requestConfirm` fechar antes de `onConfirm()` e tornando `deleteEffectiveBlock`, `deleteRoutineBlock`, `deleteTask` e `deleteProgressBar` mutações síncronas com limpeza de blocos/filhos órfãos).
- **Fuso horário local:** adicionados `formatLocalDateString`, `addDaysToDateString` e `formatDateBR` em `src/utils/helpers.ts`, eliminando deslocamentos causados por `.toISOString()` após as 21h.
- **Performance & Recursos:** encerrado intervalo ocioso de `1000ms` quando não há cronômetro rodando (`hasActiveOrPausedTimer`), otimizados listeners de drag com refs e reutilizado um `AudioContext` singleton (`getSharedAudioContext`).
- **Consistência de Reset:** `resetProgress` agora deduz corretamente o tempo do dia do total acumulado e do histórico, inclusive no progresso pai.

---

## [1.0.0] - 2026-11-08

### Added
- Versão inicial do MVP CozyFlow com as abas **Meu Dia**, **Agenda**, **Rotina**, **Progressos** e **Configurações**, além de **Modo Canto Flutuante (PiP)** e **Sino Tibetano** via Web Audio API.
