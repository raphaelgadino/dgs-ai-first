# Tasks — Query Endpoint

Derivado de `specs/query-endpoint/plan.md`. Cada task é atômica (idealmente um PR pequeno).

**Legenda de estimativa:** P = Pequeno (≤ meio dia) · M = Médio (~1 dia) · G = Grande (2+ dias)

**Escopo:** cobre o fluxo do plano — `POST /api/query` → embedding da pergunta → busca top-5 no Azure AI Search → montagem do prompt (respeitando o context budget da ADR-0002) → GPT-4o → resposta com `source_document`. Retry com backoff, validação Zod e logging com pino conforme decisões técnicas.

---

## QE-01 — Tipos de domínio do endpoint
**Descrição:** Definir os tipos TypeScript do endpoint em `src/shared/types.ts`: `QueryRequest`, `QueryResponse`, `Chunk`, `SourceDocument` e `ConversationTurn` (histórico).
**Critérios de aceite:**
- Tipos exportados de `src/shared/types.ts` e compilando sob `strict: true` sem erros.
- `QueryResponse` inclui o campo `source_document`.
- `Chunk` carrega metadado de vigência (ver ADR-0003) e referência ao documento de origem.
**Dependências:** —
**Estimativa:** P

## QE-02 — Configuração de ambiente
**Descrição:** Carregar e validar variáveis de ambiente em `src/shared/config.ts` (endpoint/chave do Azure OpenAI, deployment do modelo e do embedding, endpoint/chave e nome do índice do Azure AI Search).
**Critérios de aceite:**
- `config.ts` valida a presença das variáveis na inicialização e falha rápido (fail-fast) com mensagem clara se algo faltar.
- Nenhuma chave/segredo é exposto em log ou mensagem de erro.
**Dependências:** —
**Estimativa:** P

## QE-03 — Custom errors
**Descrição:** Classes de erro em `src/shared/errors.ts`: `ValidationError`, `SearchError`, `CompletionError`, `ContextBudgetExceededError`, com mapeamento para status HTTP.
**Critérios de aceite:**
- Cada erro carrega `code` e `statusCode` (ex.: `ValidationError` → 400, `SearchError`/`CompletionError` → 502/503).
- Teste unitário cobrindo o mapeamento erro → status.
**Dependências:** —
**Estimativa:** P

## QE-04 — Logger estruturado
**Descrição:** Configurar `pino` em `src/shared/logger.ts` com logging estruturado e correlação por request (`requestId`).
**Critérios de aceite:**
- Logs em JSON, nível configurável por env.
- Cada log de request inclui `requestId`; nenhum segredo ou PII é logado.
**Dependências:** QE-02
**Estimativa:** P

## QE-05 — Validação de input (Zod)
**Descrição:** Schema Zod em `src/functions/query/validator.ts` para o corpo do `POST /api/query`: `pergunta` obrigatória (com limites de tamanho) e `historico` opcional limitado a 3 turnos (ADR-0002).
**Critérios de aceite:**
- Input inválido é rejeitado com 400 (via `ValidationError`) e mensagem descritiva.
- Histórico acima de 3 turnos é truncado aos 3 mais recentes (regra explicitada em comentário/teste).
- Testes unitários para casos válidos e inválidos.
**Dependências:** QE-01, QE-03
**Estimativa:** M

## QE-06 — Utilitário de retry com backoff exponencial
**Descrição:** Wrapper genérico em `src/services/` para reexecutar chamadas Azure com backoff exponencial + jitter e teto de tentativas.
**Critérios de aceite:**
- Reintenta apenas em erros transitórios (429, 5xx, timeout); não reintenta em 4xx não transitórios.
- Respeita o número máximo de tentativas configurável.
- Testado com mocks simulando falha transitória e falha permanente.
**Dependências:** QE-03
**Estimativa:** M

## QE-07 — Serviço de embedding da pergunta
**Descrição:** Em `src/services/completion.ts` (ou módulo dedicado de embedding), gerar o embedding da pergunta via Azure OpenAI.
**Critérios de aceite:**
- Recebe a pergunta e retorna o vetor de embedding.
- Usa o retry de QE-06; falhas encapsuladas em `CompletionError`.
- Teste unitário com cliente Azure mockado.
**Dependências:** QE-02, QE-03, QE-06
**Estimativa:** M

## QE-08 — Serviço de busca (top-5 chunks)
**Descrição:** Em `src/services/search.ts`, buscar os top-5 chunks no Azure AI Search a partir do embedding.
**Critérios de aceite:**
- Retorna 5 `Chunk` com metadados (vigência e `source_document`).
- Usa o retry de QE-06; falhas encapsuladas em `SearchError`.
- Teste unitário com cliente Azure AI Search mockado (índice vazio → resultado vazio tratado).
**Dependências:** QE-01, QE-02, QE-06, QE-07
**Estimativa:** G

## QE-09 — Prompt builder com context budget
**Descrição:** Em `src/services/prompt-builder.ts`, montar o prompt final combinando system prompt (`/prompts/system-prompt.md`) + chunks + histórico + pergunta, respeitando o budget da ADR-0002 (~4K system + ~8K chunks + pergunta + histórico ≤ 3 turnos).
**Critérios de aceite:**
- Carrega o system prompt versionado de `/prompts/system-prompt.md`.
- Se a soma estimada de tokens estourar o budget, reduz de forma determinística (ex.: descarta chunks menos relevantes) ou lança `ContextBudgetExceededError`.
- Prioriza a versão mais recente em documentos contraditórios (ADR-0003).
- Teste unitário verificando o corte de contexto ao exceder o budget.
**Dependências:** QE-01, QE-08
**Estimativa:** G

## QE-10 — Serviço de completion (GPT-4o)
**Descrição:** Em `src/services/completion.ts`, enviar o prompt montado ao GPT-4o (Azure OpenAI) e retornar a resposta.
**Critérios de aceite:**
- Envia o prompt e retorna o texto gerado.
- Usa o retry de QE-06; falhas encapsuladas em `CompletionError`.
- Teste unitário com cliente Azure OpenAI mockado.
**Dependências:** QE-02, QE-03, QE-06, QE-09
**Estimativa:** M

## QE-11 — Response builder (resposta + fonte)
**Descrição:** Em `src/functions/query/response-builder.ts`, montar a `QueryResponse` com a resposta do modelo e o(s) `source_document` correspondente(s) aos chunks usados.
**Critérios de aceite:**
- Resposta inclui `source_document` derivado dos chunks efetivamente enviados ao modelo.
- Formato validável pelo schema de output (Zod) de QE-05.
- Teste unitário cobrindo a montagem da fonte.
**Dependências:** QE-01, QE-08, QE-10
**Estimativa:** M

## QE-12 — Handler HTTP (orquestração)
**Descrição:** Em `src/functions/query/handler.ts`, implementar o HTTP trigger (Azure Functions v4) que orquestra: validação → embedding → busca → prompt → completion → resposta, com logging e tratamento de erros.
**Critérios de aceite:**
- `POST /api/query` executa o fluxo completo e retorna 200 com `QueryResponse` no caminho feliz.
- Erros mapeados para o status correto (QE-03) e logados com `requestId` (QE-04).
- `requestId` gerado por request e propagado nos logs.
**Dependências:** QE-04, QE-05, QE-07, QE-08, QE-09, QE-10, QE-11
**Estimativa:** G

## QE-13 — Teste de integração do fluxo
**Descrição:** Em `tests/integration/`, testar o handler ponta a ponta com serviços Azure mockados (search + completion), usando fixtures de `tests/fixtures/`.
**Critérios de aceite:**
- Cenário feliz: pergunta → 200 com `source_document`.
- Cenários de falha: input inválido (400), falha de busca (502/503), estouro de budget.
- Usa `chunks.ts`, `queries.ts` e `expected-responses.ts` das fixtures.
**Dependências:** QE-12
**Estimativa:** M

## QE-14 — Teste E2E do endpoint
**Descrição:** Em `tests/e2e/`, exercitar o endpoint em ambiente local do Azure Functions (host rodando), validando contrato de request/response.
**Critérios de aceite:**
- Requisição real ao host local retorna resposta no formato esperado.
- Documentado como rodar localmente (variáveis, comando).
**Dependências:** QE-12, QE-13
**Estimativa:** M

---

## Ordem sugerida / grafo de dependências

```
QE-01 ─┐
QE-02 ─┤
QE-03 ─┼─> QE-05 ─┐
QE-04 ─┘          │
QE-03 ──> QE-06 ──┼─> QE-07 ──> QE-08 ──> QE-09 ──> QE-10 ──> QE-11 ──> QE-12 ──> QE-13 ──> QE-14
```

- **Onda 1 (paralelo):** QE-01, QE-02, QE-03, QE-04
- **Onda 2 (paralelo):** QE-05, QE-06
- **Onda 3 (sequencial):** QE-07 → QE-08 → QE-09 → QE-10 → QE-11 → QE-12
- **Onda 4:** QE-13 → QE-14

## Fora de escopo deste plano

`src/services/response-validator.ts` (harness de validação determinística) aparece na estrutura do repositório mas **não** é mencionado no `plan.md` do Query Endpoint. Se fizer parte deste endpoint, vale acrescentar uma task própria e ligá-la como dependência de QE-12; caso contrário, provavelmente pertence a outra spec.