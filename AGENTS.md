# Agent Instructions

This repository is a training workspace made of scenario docs and staged exercises. Keep changes local and avoid duplicating material that already exists in the exercise docs.

## Where to Look

- [pratica-2/anexo-c-estrutura-repositorio.md](pratica-2/anexo-c-estrutura-repositorio.md) for the intended repo layout and documentation conventions.
- [pratica-3/exercicio-3.1/CODE-REVIEW.md](pratica-3/exercicio-3.1/CODE-REVIEW.md) and [pratica-3/exercicio-3.1/ENTREGAVEL-EXERCICIO-3.1.md](pratica-3/exercicio-3.1/ENTREGAVEL-EXERCICIO-3.1.md) for the quality bar in the TypeScript exercise.
- [pratica-3/exercicio-3.1/response-schema.ts](pratica-3/exercicio-3.1/response-schema.ts) and [pratica-3/exercicio-3.1/response-validator.ts](pratica-3/exercicio-3.1/response-validator.ts) for the active implementation pattern.
- [\.vscode/mcp.json](.vscode/mcp.json) for workspace support configuration only.

## Working Rules

- Prefer the existing guardrail-first flow in `pratica-3/exercicio-3.1`: validate schema first, then document/source checks, then business-rule checks, then return a safe fallback.
- Preserve the domain vocabulary already in use: `answer`, `source_document`, `confidence_score`, the valid source whitelist, and the `"-"` fallback for low-confidence responses.
- Keep TypeScript edits explicit and deterministic: named exports, explicit types/interfaces, small helpers, and direct validation logic over clever abstractions.
- Keep comments and docs concise and in Portuguese when touching the exercise files, matching the existing style.
- Do not invent build or test commands. This snapshot does not include a root `package.json` or `tsconfig.json`; if a task needs execution, inspect the relevant exercise folder first.

## Editing Boundaries

- Do not rewrite the scenario markdown unless the task is explicitly about that content.
- Link to existing documentation instead of copying it into instructions.
- If a change affects the validation flow, keep the fallback behavior and logging behavior intact unless the task explicitly asks otherwise.