# TypeScript Conventions (Foundation Core)

**Quando usar:** sempre que for escrever, revisar ou refatorar qualquer codigo TypeScript neste repositorio.
**Camada:** Foundation
**Compõe:** base obrigatoria para todas as skills de Domain e Artifact.

## Contexto

Esta e a skill Foundation mais importante porque define a linguagem comum de implementacao.
Sem ela, as demais skills geram artefatos inconsistentes entre si.

No catalogo de skills, `typescript-conventions` aparece com frequencia **Muito alta** e consumo por `G` (geracao) e `R` (revisao). Isso significa que toda task deve iniciar por estas regras antes de aplicar regras de endpoint, RAG, teste ou UI.

## Regras Prescritivas

1. Use TypeScript com `strict: true` como regra nao negociavel.
2. Nunca introduza `any` implicito ou explicito sem justificativa tecnica e aprovacao explicita do TL.
3. Prefira modelagem por tipos explicitos de dominio (`type`/`interface`) em vez de objetos anonimos espalhados.
4. Use `readonly` para dados imutaveis (params, DTOs, contratos de resposta e config carregada).
5. Use unions literais e discriminated unions para estados/fluxos em vez de booleans vagos.
6. Proiba cast inseguro que "burla" o compilador (`as any`, double-cast, non-null assertion sem garantia).
7. Nomes: `camelCase` para valores/funcoes, `PascalCase` para tipos/classes.
8. Separe fronteiras de modulo: shared utilitario em `src/shared`, regra de negocio em `src/services`, handler fino em `src/functions`.
9. Funcoes devem ter assinatura clara (entrada/saida tipadas); nao retorne `unknown` sem parser/validator.
10. Erros de tipo nao sao "ruido": ajuste o modelo, nao silencie o compilador.

## DO / DON'T (Exemplos Concretos)

### 1) Contrato de dominio explicito

DO

```ts
type CustomerTier = "Gold" | "Silver" | "Standard";

interface QueryRequest {
  readonly question: string;
  readonly customerTier: CustomerTier;
}

function buildQueryPayload(input: QueryRequest): QueryRequest {
  return {
    question: input.question.trim(),
    customerTier: input.customerTier,
  };
}
```

DON'T

```ts
function buildQueryPayload(input: any) {
  return {
    question: input.question,
    customerTier: input.tier,
  };
}
```

### 2) Discriminated union para fluxo

DO

```ts
type RetrievalResult =
  | { status: "ok"; chunks: readonly string[] }
  | { status: "no_coverage"; reason: string };

function toHttpStatus(result: RetrievalResult): number {
  return result.status === "ok" ? 200 : 404;
}
```

DON'T

```ts
type RetrievalResult = {
  success: boolean;
  chunks?: string[];
  reason?: string;
};

function toHttpStatus(result: RetrievalResult): number {
  return result.success ? 200 : 404;
}
```

### 3) Narrowing seguro para erro

DO

```ts
function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "Unexpected error";
}
```

DON'T

```ts
function toErrorMessage(error: unknown): string {
  return (error as any).message;
}
```

### 4) Fronteira de modulo respeitada

DO

```ts
// src/functions/query/handler.ts
import { executeQuery } from "../../services/query/execute-query";
import type { QueryRequest } from "../../shared/types/query";
```

DON'T

```ts
// src/functions/query/handler.ts
import { privateSearchClient } from "../../services/search/internal/private-client";
```

## Anti-padroes

1. **Type erasure por pressa**: usar `as any` para "fazer passar".
   Consequencia: regressao silenciosa em runtime e perda de confianca no contrato.
2. **Modelagem generica demais**: `Record<string, unknown>` para tudo.
   Consequencia: codigo sem semantica de negocio e sem autocomplete util.
3. **Boolean flags ambiguas**: `isValid`, `isDone`, `hasData` sem contexto.
   Consequencia: estados invalidos e branchings confusos.
4. **Acoplamento entre camadas**: handler acessando detalhe interno de client/adapter.
   Consequencia: quebra de encapsulamento e alto custo de manutencao.
5. **Ignorar erros de compilacao com cast** em vez de corrigir tipos.
   Consequencia: defeitos tardios e testes mais caros.

## Checklist Rapido de Aplicacao

- Todo input/output publico esta tipado explicitamente?
- Existe `any` ou cast inseguro introduzido?
- O modelo representa o dominio (nao apenas a forma dos dados)?
- Fronteiras de import respeitam `functions -> services -> shared`?
- O compilador ficou limpo sem "silenciamento" artificial?

Se alguma resposta for "nao", ajuste antes de prosseguir para skills de Domain ou Artifact.