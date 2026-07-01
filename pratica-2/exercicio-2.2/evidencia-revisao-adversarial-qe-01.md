# Evidencia de Revisao Adversarial - QE-01

## Metadados
- Exercicio: 2.2
- Task revisada: QE-01 - Tipos de dominio do endpoint
- Arquivo avaliado: src/shared/types.ts
- Data: 2026-07-01
- Revisor (papel): Tech Lead (revisao critica e adversarial)

## Escopo da revisao
Revisao tecnica do arquivo `src/shared/types.ts` com foco em:
- Criterios de aceite da QE-01
- Aderencia ao fluxo do Query Endpoint
- Impacto nas dependencias QE-05, QE-08, QE-09 e QE-11
- Robustez de tipagem com `strict: true`

## Referencias consideradas
- Plan do Query Endpoint (trecho do exercicio)
- Tasks do Query Endpoint em `pratica-2/exercicio-2.2/tasks.md`
- ADR-0002 (context budget e historico limitado a 3 turnos)
- ADR-0003 (vigencia e documentos contraditorios)
- `tsconfig.json` com `strict: true`

## Evidencia tecnica executada
Comando executado para validar compilacao em modo estrito:

```powershell
Set-Location "c:/git/dgs-ai-first/pratica-2/novatech-assistant"
npx tsc --noEmit
```

Resultado: comando sem erros.

## Veredito
**Reprovado.**

Justificativa: criterios basicos foram majoritariamente atendidos, porem ha lacunas de modelagem de tipos que criam risco real para QE-08, QE-09 e QE-11 (relevancia de chunk, semantica de vigencia e contrato de fonte na resposta).

## Checklist de aceite (QE-01)
1. Tipos `QueryRequest`, `QueryResponse`, `Chunk`, `SourceDocument`, `ConversationTurn` exportados de `src/shared/types.ts`
- Status: **Cumprido**
- Evidencia: tipos presentes e exportados no arquivo revisado.

2. Compila sob `strict: true` sem erros
- Status: **Cumprido**
- Evidencia: `strict: true` em `tsconfig.json` e `npx tsc --noEmit` sem erro.

3. `QueryResponse` inclui o campo `source_document`
- Status: **Cumprido**
- Evidencia: campo existe no tipo de resposta.

4. `Chunk` carrega metadado de vigencia e referencia ao documento de origem
- Status: **Parcial**
- Evidencia: referencia ao documento existe; vigencia esta indireta via `SourceDocument`, mas sem modelagem semantica forte para priorizacao deterministica de versao.

## Achados por severidade

### Bloqueador
1. `Chunk.score` opcional enfraquece corte deterministico por relevancia
- Local: `src/shared/types.ts` (`Chunk.score?: number`)
- Problema: score opcional permite chunks sem relevancia numerica no pipeline.
- Impacto: QE-09 exige reducao deterministica do contexto ao estourar budget; sem score obrigatorio, corte/ordenacao tende a ficar inconsistente.
- Correcao sugerida: tornar `score` obrigatorio (`score: number`).

### Maior
2. Ambiguidade de contrato em `source_document`
- Local: `src/shared/types.ts` (`QueryResponse.source_document: SourceDocument[]`)
- Problema: nome singular com cardinalidade de lista.
- Impacto: risco de divergencia entre response-builder (QE-11), schema Zod e consumidores do endpoint.
- Correcao sugerida: explicitar cardinalidade no contrato (ou renomear para plural, ou manter singular com semantica documentada e teste de contrato).

3. Vigencia sem estado semantico explicito
- Local: `src/shared/types.ts` (`VigenciaMetadata.vigente: boolean`)
- Problema: booleano isolado pode gerar interpretacoes diferentes na regra de contradicao.
- Impacto: ADR-0003 pede priorizacao da versao mais recente e marcacao de obsoleto; sem status explicito, implementacao pode variar entre modulos.
- Correcao sugerida: adicionar `status` literal (`"vigente" | "obsoleto"`) mantendo datas para ordenacao.

### Menor / Nitpick
4. Consistencia de nomenclatura entre campos de dominio
- Local: `src/shared/types.ts`
- Problema: mistura de convencoes/idiomas nos nomes.
- Impacto: aumenta custo de manutencao e risco de mapeamento incorreto.
- Correcao sugerida: padronizar naming por camada e documentar DTO de borda quando necessario.

5. Imutabilidade nao reforcada nos payloads
- Local: `src/shared/types.ts`
- Problema: ausencia de `readonly` em estruturas de request/response e metadados.
- Impacto: permite mutacao acidental durante orquestracao.
- Correcao sugerida: aplicar `readonly` onde apropriado.

## Riscos para tasks dependentes
- QE-05: baixo risco direto (historico limitado a 3 turnos ja esta bem alinhado no tipo).
- QE-08: risco alto se `score` permanecer opcional, com retorno de chunks sem base de rank confiavel.
- QE-09: risco alto de corte de contexto nao deterministico e priorizacao inconsistente em documentos contraditorios.
- QE-11: risco medio-alto de contrato ambiguo para `source_document` no response builder e no schema de output.

## Diff sugerido (objetivo)
```ts
export type VigenciaStatus = "vigente" | "obsoleto";

export interface VigenciaMetadata {
  readonly inicio: EpochMillis;
  readonly fim?: EpochMillis | null;
  readonly versao?: string;
  readonly status: VigenciaStatus;
}

export interface Chunk {
  readonly id: string;
  readonly content: string;
  readonly score: number;
  readonly source_document: SourceDocument;
}
```

## Conclusao
A QE-01 atende o baseline de compilacao e existencia de tipos, mas nao esta pronta para aprovacao sem ajustes de modelagem que reduzam ambiguidade e preservem determinismo no pipeline de RAG.
