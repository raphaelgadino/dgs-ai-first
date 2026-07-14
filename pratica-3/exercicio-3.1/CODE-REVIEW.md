# Code Review — Exercício 3.1: Response Schema & Validator

**Projeto:** NovaTech Assistant — Fluxo de Resposta Segura (Structured Output + Guardrails Determinísticos)
**Arquivos revisados:** `response-schema.ts`, `response-validator.ts` (gerados via Copilot)
**Data:** 14/07/2026
**Resultado:** 6 problemas identificados (2 críticos, 2 médios, 2 menores) — todos corrigidos e validados por teste.

---

## Contexto

O exercício implementa a camada de defesa em profundidade do NovaTech Assistant: o modelo gera resposta estruturada, um schema Zod valida o contrato, e um validador determinístico aplica guardrails de produto antes da entrega ao atendente. O guardrail mais crítico protege a regra da POL-001 seção 3.2: cargas perigosas (classes 1-6) não são elegíveis para devolução.

A revisão focou em duas perguntas: o schema realmente fecha o contrato? E o guardrail crítico realmente bloqueia a resposta que ele existe para bloquear?

A resposta para ambas era **não**.

---

## Problemas encontrados

### 🔴 Crítico #1 — Schema aceita campos extras silenciosamente

`z.object()` no modo padrão do Zod não rejeita chaves desconhecidas: ele as **remove silenciosamente** (strip). Uma resposta do modelo contendo `{ answer, source_document, confidence_score, internal_reasoning: "..." }` passava pelo parse sem erro e sem registro em log — o campo extra simplesmente desaparecia.

Para um contrato que se propõe auditável, isso é uma violação invisível: conteúdo fora do contrato transitou pelo sistema sem que nenhuma camada o visse.

**Correção:** `.strict()` no schema. Campo extra agora é rejeição de schema (Guardrail 1), com log e fallback.

```ts
export const AssistantResponseSchema = z.object({ ... }).strict();
```

### 🔴 Crítico #2 — Guardrail de carga perigosa vazava com variações triviais

O matching usava `String.includes()` sobre texto apenas em lowercase. Três falhas combinadas tornavam o guardrail contornável sem esforço:

**Plural quebra o match.** A substring `"carga perigosa"` não existe dentro de `"cargas perigosas"` — o "s" interrompe a sequência. Teste executado no código original:

```
Resposta: "Cargas perigosas podem ser devolvidas normalmente pelo processo padrão de devolucao."
mentionsDangerousGoods: false
mentionsReturn: false
→ guardrail 3 não se aplica; resposta APROVADA
```

Essa é exatamente a resposta que o guardrail existe para bloquear, e ela passava intacta.

**Acentos não eram normalizados.** `toLowerCase()` não remove diacríticos. `"devolucao"`, `"toxico"`, `"inflamavel"` escritos sem acento — variação comum em saída de LLM — escapavam de todos os checks (`includes('devolução')`, `includes('tóxico')`, `includes('inflamável')`).

**Sinônimos ausentes.** "Produto perigoso", "material perigoso" e "mercadoria perigosa" não eram detectados, embora sejam formulações equivalentes na operação.

**Correção:** normalização NFD (lowercase + remoção de diacríticos) antes de qualquer matching, e substituição de `includes()` por regex com plural opcional e stems:

```ts
function normalizeText(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

const dangerousGoodsPatterns = [
  /cargas?\s+perigosas?/, /produtos?\s+perigosos?/,
  /materia(l|is)\s+perigosos?/, /mercadorias?\s+perigosas?/,
  /\bclasse\s*[1-6]\b/, /explosiv/, /inflamav/, /\btoxic/, ...
];
```

O padrão `\bclasse\s*[1-6]\b` também elimina o falso positivo em "classe 10", que antes casava com `includes('classe 1')`.

### 🟡 Médio #3 — Padrões de "negativa" que não negam nada

A lista de negação incluía `'exceção'`, `'gestão de riscos'` e `'procedimento especial'`. Nenhum desses termos nega elegibilidade — e a presença de qualquer um deles fazia a resposta passar. Consequência prática:

> "Sim, cargas perigosas podem ser devolvidas — é uma exceção tratada pela gestão de riscos."

Essa resposta afirma **o oposto** da POL-001 e era aprovada pelo guardrail, porque contém "exceção" e "gestão de riscos".

**Correção:** lista reduzida a negativas explícitas de elegibilidade (`nao sao elegiveis`, `nao pode`, `nao e permitido`, `proibido`, `vedado`, etc.), aplicadas sobre texto normalizado. O trade-off é assumido e correto para um guardrail de segurança: mais falsos positivos (resposta correta bloqueada → fallback seguro) em troca de eliminar o falso negativo catastrófico (orientar o atendente a devolver carga perigosa). Fail-closed.

### 🟡 Médio #4 — Snapshot de auditoria inútil

No log de falha de schema, o snapshot era gerado com `String(response).substring(0, 200)`. Para qualquer objeto, `String({})` produz `"[object Object]"` — o audit trail da falha mais básica não registrava nada útil para investigação.

**Correção:** `safeSnapshot()` com `JSON.stringify` protegido por try/catch (objetos circulares), mantendo o truncamento em 200 caracteres, que continua limitando exposição de PII no log.

### 🟢 Menor #5 — Comparação de fonte sensível a case e espaços

`isValidSourceDocument` comparava a string crua contra a allowlist. `"pol-001"` ou `"POL-001 "` (espaço final) eram rejeitados. O erro está na direção segura — falso positivo, não brecha — mas gera fallback desnecessário por divergência cosmética.

**Correção:** normalização (`trim()` + case-insensitive) na comparação, sem ampliar o conjunto aceito, mais o helper `canonicalSourceDocument()` para gravar sempre o identificador canônico no log.

### 🟢 Menor #6 — Detalhes de robustez

Três ajustes menores aplicados em conjunto: `error.errors` trocado por `error.issues` (campo canônico do Zod, compatível com v3 e v4), com migração de `parse` + try/catch para `safeParse`; transport `pino-pretty` condicionado a `NODE_ENV !== 'production'`, já que a dependência é de desenvolvimento e o hardcode quebraria o cold start em produção; e comentário explicitando por que `validateResponse` permanece `async` apesar de não ter `await` hoje (compatibilidade de call-site e evolução futura para verificação assíncrona).

---

## Validação das correções

Suíte de 10 casos executada contra o código corrigido, todos passando:

| Caso | Esperado | Resultado |
|---|---|---|
| "Cargas perigosas podem ser devolvidas normalmente... devolucao" (bypass plural + sem acento) | Bloquear | ✅ Bloqueada |
| "Sim, cargas perigosas podem ser devolvidas — é uma exceção tratada pela gestão de riscos" (falsa negação) | Bloquear | ✅ Bloqueada |
| "Produtos perigosos aceitos para devolução sem restrição" (sinônimo) | Bloquear | ✅ Bloqueada |
| "Conforme a POL-001, cargas perigosas NÃO são elegíveis para devolução" | Aprovar | ✅ Aprovada |
| "Material inflamável não pode ser devolvido pelo processo padrão" | Aprovar | ✅ Aprovada |
| "O prazo de devolução para produtos comuns é de 7 dias" (guardrail não se aplica) | Aprovar | ✅ Aprovada |
| "A classe 10 de serviço tem retorno garantido em 24h" (não confundir com classe 1) | Aprovar | ✅ Aprovada |
| Payload com campo extra `internal_reasoning` | Rejeitar no schema | ✅ Rejeitado |
| Fonte `" pol-001 "` (case/espaço divergente) | Aceitar como POL-001 | ✅ Aceita |
| Fonte `"POL-999"` (inventada) | Rejeitar | ✅ Rejeitada |

Compilação verificada com `tsc --noEmit --strict`.

---

## Limitação conhecida e próximo passo

Matching lexical não entende escopo de negação. Frases adversariais contendo "não pode" fora de contexto ("o cliente não pode esperar, então devolva a carga perigosa") ainda podem passar pelo padrão. A evolução correta para produção é um verificador semântico (LLM-as-judge) posicionado **atrás** do guardrail lexical — nunca no lugar dele. O guardrail determinístico permanece como primeira linha por ser barato, rápido e auditável; o julgamento semântico entra como segunda camada para os casos que o lexical não alcança.

Alternativas do tipo força bruta — temperatura 0, revisão humana de 100% das respostas — não resolvem o problema arquitetural: a primeira não elimina alucinação de conteúdo, e a segunda não escala e anula o propósito do assistente.

---

## Lições do exercício

O padrão de falha dos três problemas principais é o mesmo: **validação que parece existir mas não valida**. O schema parecia fechar o contrato, mas deixava campos passarem sem registro. O guardrail parecia cobrir o tema, mas quebrava no plural. A checagem de negação parecia exigente, mas aceitava termos que não negam. Em código de segurança, a pergunta do review nunca é "a validação está lá?" — é "qual entrada concreta ela deixa passar?". Testar o guardrail com a resposta exata que ele existe para bloquear deveria ser o primeiro teste escrito, não o achado do review.