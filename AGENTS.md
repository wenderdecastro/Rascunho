---
trigger: always_on
---

# Governança Multi-Agente & Engenharia — Rascunho

Este repositório adota um fluxo de trabalho estruturado com **6 agentes especializados** definidos em `.agents/agents/`:

| Agente | Papel | Responsabilidade Principal |
| :--- | :--- | :--- |
| **`pm`** | Product Manager | Visão do produto, priorização, coerência entre as 5 abas e validação de release (`CHANGELOG.md`). |
| **`pa`** | Product Analyst | Regras de negócio (`calculateRealCapacity`, `getDayBurnoutForecast`, áreas genéricas pelas 3 Tags de Energia `FOCUS`/`TRANSIT`/`BACKGROUND`, recorrência `RecurrenceRule`, overrides diários isolados `customRoutineAreas`, subprogressos e pausas adaptativas). |
| **`designer`** | UI/UX Designer | Identidade *Cozy Pastel Dark Mode*, layout *Desktop-First* (`max-w-[1920px]`), régua vertical dividida de até `25%` na Agenda e no Meu Dia, zero truncamento `+n` e zero `alert()`/`confirm()` nativos. |
| **`dev`** | Desenvolvedor | Implementação React + TypeScript + Tailwind + Framer Motion preservando `localStorage` e performance. |
| **`reviewer`** | Code Reviewer | Auditoria de estado, prevenção de duplicidade de confirmação, fuso horário local, cleanups e tipagem. |
| **`qa`** | QA Engineer | Execução de `npx tsc --noEmit && npm run build`, verificação de rotas/fluxos nas 5 abas e aprovação final de versão. |

---

## Pipeline Obrigatório de Desenvolvimento e Validação
1. **Concepção e Critérios (`pm` + `pa` + `designer`):** Toda nova feature ou mudança de UX passa pela validação de escopo, regras de negócio e design.
2. **Construção (`dev`):** Implementação modular com verificação de tipos (`npx tsc --noEmit`).
3. **Auditoria de Código (`reviewer`):** Revisão obrigatória antes da homologação.
4. **Homologação (`qa`):** Compilação limpa (`npx tsc --noEmit && npm run build`), verificação do servidor (`http://localhost:5173/`) e conferência dos fluxos críticos.
5. **Versionamento (`pm` + `qa`):** Bump de versão SemVer em `package.json`, entrada em `CHANGELOG.md`, commit convencional e tag Git `vX.Y.Z`.

Para orquestrar uma validação completa com todo o time, utilize a skill **`validacao-squad`** em `.agents/skills/validacao-squad/SKILL.md`.

---

## Invariantes Técnicas Críticas
1. **Preservação do `localStorage`:** NUNCA alterar, limpar ou quebrar o schema das chaves `cozyflow_dark_v4_progress`, `cozyflow_dark_v4_routine`, `cozyflow_dark_v4_scheduled`, `cozyflow_dark_v4_tasks`, `cozyflow_dark_v4_overrides` e `cozyflow_dark_v4_day_hours`.
2. **Datas Locais:** Utilizar exclusivamente `formatLocalDateString`, `addDaysToDateString` e `formatDateBR` (`src/utils/helpers.ts`). Nunca usar `.toISOString().split('T')[0]` para datas de calendário.
3. **Confirmações e Toasts:** Ações destrutivas chamam `requestConfirm` na UI e funções síncronas no `AppContext` (evitando modais duplos); notificações usam `showToast` / `ToastBanner`.
4. **Performance:** Não manter timers de `1000ms` ativos quando nenhum cronômetro estiver em execução (`hasActiveOrPausedTimer`).
