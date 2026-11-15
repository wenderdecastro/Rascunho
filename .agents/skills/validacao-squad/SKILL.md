---
name: validacao-squad
description: >-
  Orquestra o Squad completo do Rascunho (pm, pa, designer, dev, reviewer e qa)
  para planejar, implementar, auditar, validar e versionar qualquer nova feature,
  bugfix ou release do aplicativo.
---

# Fluxo de Validação do Squad Rascunho

Use esta skill sempre que o usuário pedir uma nova funcionalidade, correção, auditoria completa de qualidade ou novo release versionado no **Rascunho**.

## Integrantes do Squad (`invoke_subagent`)
- **`pm`** — Alinhamento à visão do produto, escopo e priorização.
- **`pa`** — Regras de negócio, fórmulas (`calculateRealCapacity`, `getDayBurnoutForecast`), elegibilidade, subprogressos e critérios de aceite.
- **`designer`** — Design System *Cozy Pastel Dark Mode*, ergonomia *Desktop-First* (`max-w-[1920px]`), réguas verticais e feedback (`ToastBanner` / `ConfirmModal`).
- **`dev`** — Implementação em React + TypeScript mantendo 100% de compatibilidade com `localStorage` (`cozyflow_dark_v4_*`).
- **`reviewer`** — Auditoria de código, estado, fuso horário local e performance.
- **`qa`** — Compilação (`npx tsc --noEmit && npm run build`), verificação de servidor/fluxos e aprovação de release.

---

## Etapas do Fluxo

### Fase 1 — Definição & Alinhamento (Paralelo)
Acione `pm`, `pa` e `designer` informando a demanda:
1. **`pm`** valida aderência ao produto e priorização.
2. **`pa`** especifica regras de negócio e critérios de aceite testáveis (Dado/Quando/Então).
3. **`designer`** define ou aprova layout, tokens Cozy Dark e micro-interações.

*(Para hotfixes urgentes de bug óbvio, pode-se executar a Fase 1 de forma resumida ou pós-correção para evitar regressão de regra/UX).*

### Fase 2 — Implementação
Acione **`dev`** com os requisitos consolidados da Fase 1:
- Deve preservar `STORAGE_KEY = 'cozyflow_dark_v4'` e seus sufixos.
- Deve validar com `npx tsc --noEmit` ao concluir.

### Fase 3 — Revisão Técnica
Acione **`reviewer`** sobre os arquivos modificados:
- Caso retorne `SOLICITA ALTERAÇÕES`, devolva para **`dev`** corrigir antes do QA.
- Só avance quando retornar `APROVADO NO REVIEW`.

### Fase 4 — Garantia de Qualidade (QA)
Acione **`qa`** para:
1. Rodar `export PATH="$HOME/.local/node/bin:$PATH" && npx tsc --noEmit && npm run build`.
2. Conferir o checklist das 5 abas e o diff do código.
3. Emitir `STATUS QA: APROVADO`.

### Fase 5 — Versionamento (SemVer + Git)
Após `APROVADO` do **`qa`** e **`pm`**:
1. Atualizar `"version"` em `package.json` (`MAJOR.MINOR.PATCH`).
2. Registrar as mudanças em `CHANGELOG.md` (seções `Added`, `Changed`, `Fixed`).
3. Criar commit convencional e tag anotada (`git tag -a vX.Y.Z -m "..."`).
