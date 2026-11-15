# Changelog

Todas as alterações notáveis do **CozyFlow** são documentadas neste arquivo, seguindo o padrão [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e versionamento semântico ([SemVer](https://semver.org/lang/pt-BR/)).

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
