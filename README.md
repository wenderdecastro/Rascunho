# 🌸 CozyFlow — v1.1.0

> Um aplicativo SaaS de planejamento temporal, rotina contextual e gestão de objetivos que une clareza operacional à estética acolhedora e anti-burnout **Cozy Dark Mode** (Desktop-First).

---

## ✨ Funcionalidades Principais (`v1.1.0`)

### 1. ☀️ Meu Dia (`MEU_DIA`)
* **Atividade Atual Automática:** Sincronizada pelo horário real com o bloco ou área da rotina vigente.
* **Pausas Adaptativas & Regra dos 10 Minutos:** Tarefas de até 30 minutos rodam sem alertas; atividades longas sugerem pausa após 45 min contínuos. Inclui pausa rápida e verificação gentil de hiper-foco (90 min).
* **Régua Vertical Interativa (`InteractiveVerticalRuler`):** Crie blocos arrastando em horários vagos, mova ou redimensione blocos apenas para hoje e oculte áreas da rotina pontualmente (**Ocultar hoje** + restauração) sem alterar a rotina semanal.
* **Card "Tarefas de Hoje":** Crie, conclua, alterne checkboxes de elegibilidade, gerencie subitens e exclua tarefas diretamente na tela principal.
* **Modo SOS Reversível ("Dia Deu Ruim"):** Recolhe blocos flexíveis e congela metas com opção de desfazer quando quiser, além de fechamento noturno suave.

### 2. 🗓️ Agenda (`AGENDA`)
* **Layout Amplo 75% / 25%:** Calendário mensal expandido exibindo **todas** as atividades do dia (sem truncamento `+n`), ao lado da régua vertical interativa (máx. 25% da largura).
* **Previsão do Clima Mental (`getDayBurnoutForecast`):** Classificação diária baseada na capacidade configurada (`dayHoursConfigs`), mesclando intervalos sobrepostos e desconsiderando blocos de descanso (`REST`).
* **Auto-Distribuição Inteligente (`autoDistributeTasksForDate`):** Aloca tarefas pendentes por prioridade (`P1 > P2 > P3 > P4`) em 1 clique com feedback via `ToastBanner`.

### 3. 🔄 Rotina Semanal — Áreas do Dia (`ROTINA`)
* **7 Réguas Verticais Simultâneas (Dom–Sáb):** Visualize todos os dias lado a lado com marcador de horário atual.
* **Configuração de Partes do Dia (`RoutineAreaType`):** Defina faixas translúcidas ao fundo para **Trabalho (`WORK`)**, **Faculdade (`COLLEGE`)**, **Transporte (`COMMUTE`)** ou **Personalizada (`CUSTOM`)**.
* **Regras de Elegibilidade:** Tarefas com `eligibleWork`, `eligibleCollege` ou `eligibleCommute` são distribuídas nas respectivas áreas; tarefas sem seleção vão apenas para janelas livres fora de Trabalho e Faculdade.

### 4. 📈 Progressos & Subprogressos (`PROGRESSOS`)
* **Por Tempo:** Criação por **Tempo Total**, **Ciclo (`dias × horas/dia`)** ou **Tempo Ilimitado (`♾️`)**, com barra dupla (progresso histórico tonal + meta diária ajustável).
* **Subprogressos Hierárquicos (`parentId`):** Crie subprogressos vinculados ao objetivo pai mantendo a mesma categoria e consolidando o tempo total automaticamente.
* **Por Tarefas Ponderadas & Checkpoints:** Subtarefas com peso percentual e metas diárias/totais com confete ao concluir.

### 5. ⚙️ Configurações (`CONFIGURACOES`) & Modo Canto (PiP)
* **Carga Horária Semanal:** Ajuste o início e fim do dia útil para cada dia da semana (`dayHoursConfigs`).
* **Mini-Player Flutuante (`MiniPlayerPiP`):** Card compacto para acompanhar o cronômetro enquanto navega pelas abas.

---

## 🤖 Squad Multi-Agente & Governança

O desenvolvimento e a validação contínua do CozyFlow são estruturados com **6 agentes especializados** configurados em [AGENTS.md](AGENTS.md) e `.agents/agents/`:

| Agente | Função no Squad | Definição |
| :--- | :--- | :--- |
| **`pm`** | Product Manager — Escopo, visão do produto, priorização e releases | [`.agents/agents/pm.md`](.agents/agents/pm.md) |
| **`pa`** | Product Analyst — Regras de negócio, cálculos de capacidade e critérios de aceite | [`.agents/agents/pa.md`](.agents/agents/pa.md) |
| **`designer`** | UI/UX Designer — Design System Cozy Dark, ergonomia 1920px e micro-interações | [`.agents/agents/designer.md`](.agents/agents/designer.md) |
| **`dev`** | Desenvolvedor — Implementação React/TS preservando `localStorage` (`cozyflow_dark_v4_*`) | [`.agents/agents/dev.md`](.agents/agents/dev.md) |
| **`reviewer`** | Code Reviewer — Auditoria técnica, estado, datas locais e performance | [`.agents/agents/reviewer.md`](.agents/agents/reviewer.md) |
| **`qa`** | QA Engineer — Validação de build (`tsc` + `vite build`), fluxos das 5 abas e aprovação | [`.agents/agents/qa.md`](.agents/agents/qa.md) |

Fluxo completo disponível na skill [`.agents/skills/validacao-squad/SKILL.md`](.agents/skills/validacao-squad/SKILL.md) e histórico de versões em [`CHANGELOG.md`](CHANGELOG.md).

---

## 🛠️ Stack & Comandos

* **Frontend:** React 18, TypeScript 5, Vite 5, Tailwind CSS 3, Framer Motion 14, Lucide React
* **Persistência:** `localStorage` retrocompatível (`cozyflow_dark_v4_*`)

```bash
# Iniciar servidor de desenvolvimento (http://localhost:5173/)
npm run dev

# Verificar tipagem TypeScript
npx tsc --noEmit

# Gerar build de produção
npm run build
```
