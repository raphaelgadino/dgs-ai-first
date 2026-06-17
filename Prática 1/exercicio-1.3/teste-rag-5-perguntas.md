# Teste do pipeline RAG com 5 perguntas do Anexo B

Data do teste: 2026-06-17

Base usada: `chroma_db`

Comando de ingestao executado antes dos testes:

```powershell
cd "C:\git\dgs-ai-first\Prática 1\exercicio-1.3"
.\.venv\Scripts\python.exe .\rag_pipeline.py ingest
```

Resultado da ingestao:

```json
{
  "documents": 5,
  "chunks": 37,
  "avg_tokens_per_chunk": 96
}
```

Observacao: a ordem abaixo e a ordem retornada pelo pipeline. O campo `score` e o score de similaridade exibido pela funcao de busca.

## Comandos para executar as cinco perguntas

```powershell
cd "C:\git\dgs-ai-first\Prática 1\exercicio-1.3"

.\.venv\Scripts\python.exe .\rag_pipeline.py search "Qual o prazo de devolução?" --top-k 4
.\.venv\Scripts\python.exe .\rag_pipeline.py search "Posso devolver carga perigosa?" --top-k 4
.\.venv\Scripts\python.exe .\rag_pipeline.py search "Qual o SLA do cliente Gold?" --top-k 4
.\.venv\Scripts\python.exe .\rag_pipeline.py search "Frete para 600kg para Manaus?" --top-k 4
.\.venv\Scripts\python.exe .\rag_pipeline.py search "Qual o multiplicador para o Sudeste?" --top-k 4
```

## 1. Qual o prazo de devolucao?

Gabarito do Anexo B:

- Devem ser recuperados: `POL-001-A`, `POL-001-B`
- Podem aparecer: `POL-001-C`

Chunks recuperados:

| Ordem | Chunk recuperado | Correspondencia Anexo B | Score | Correto? |
|---:|---|---|---:|---|
| 1 | `POL-001-politica-devolucao-005` - secao 3.2 Excecoes ao prazo geral | `POL-001-B` | 0.0748 | Sim |
| 2 | `POL-001-politica-devolucao-008` - secao 3.5 Custos de devolucao | `POL-001-D` | 0.0947 | Parcial, relacionado a prazo expirado, mas nao esta no gabarito principal |
| 3 | `POL-001-politica-devolucao-004` - secao 3.1 Prazo geral | `POL-001-A` | 0.1071 | Sim |
| 4 | `POL-001-politica-devolucao-006` - secao 3.3 Procedimento de devolucao | `POL-001-C` | 0.0846 | Sim, relevancia menor permitida |

Analise: o pipeline recuperou os dois chunks obrigatorios (`POL-001-A` e `POL-001-B`) e tambem o chunk permitido (`POL-001-C`). Resultado correto, com um chunk extra sobre custos.

## 2. Posso devolver carga perigosa?

Gabarito do Anexo B:

- Deve ser recuperado: `POL-001-B`
- Podem aparecer: `FAQ-03`, `POL-001-A`

Chunks recuperados:

| Ordem | Chunk recuperado | Correspondencia Anexo B | Score | Correto? |
|---:|---|---|---:|---|
| 1 | `POL-001-politica-devolucao-005` - secao 3.2 Excecoes ao prazo geral | `POL-001-B` | 0.0965 | Sim |
| 2 | `FAQ-atendimento-002` - Item 3 sobre devolucao de carga perigosa | `FAQ-03` | 0.1438 | Sim, relevancia menor permitida |
| 3 | `POL-001-politica-devolucao-008` - secao 3.5 Custos de devolucao | `POL-001-D` | 0.1105 | Parcial, nao esperado pelo gabarito |
| 4 | `PROC-042-v2-frete-especial-revisado-006` - secao 4 Condicoes especiais | Fora do gabarito | 0.0999 | Nao |

Analise: o resultado principal esta correto, pois `POL-001-B` veio em primeiro lugar. O `FAQ-03` tambem e aceitavel como apoio. Os demais chunks indicam ruido no top-k.

## 3. Qual o SLA do cliente Gold?

Gabarito do Anexo B:

- Deve ser recuperado: `SLA-2024-B`
- Podem aparecer: `SLA-2024-A`, `SLA-2024-C`

Chunks recuperados:

| Ordem | Chunk recuperado | Correspondencia Anexo B | Score | Correto? |
|---:|---|---|---:|---|
| 1 | `SLA-2024-tabela-sla-clientes-003` - secao 2 Tabela de SLAs | `SLA-2024-B` | 0.1093 | Sim |
| 2 | `SLA-2024-tabela-sla-clientes-006` - secao 5 Medicao e reportes | Fora do gabarito | 0.1127 | Parcial, fala de SLA, mas nao responde a pergunta |
| 3 | `FAQ-atendimento-009` - Item 41 sobre SLA de resposta e resolucao | Fora do gabarito | 0.1305 | Parcial, relacionado ao tema, mas nao esperado |
| 4 | `SLA-2024-tabela-sla-clientes-005` - secao 4 Penalidades | `SLA-2024-E` | 0.1196 | Parcial, relacionado a SLA, mas nao esperado |

Analise: o chunk obrigatorio (`SLA-2024-B`) foi recuperado em primeiro lugar. O restante do top-k traz contexto de SLA, mas nao os chunks opcionais esperados pelo gabarito (`SLA-2024-A` e `SLA-2024-C`).

## 4. Frete para 600kg para Manaus?

Gabarito do Anexo B:

- Devem ser recuperados: `PROC-042v2-B`, `PROC-042v2-A`
- Pode aparecer: `PROC-042-B` como versao antiga, com risco de contradicao

Chunks recuperados:

| Ordem | Chunk recuperado | Correspondencia Anexo B | Score | Correto? |
|---:|---|---|---:|---|
| 1 | `PROC-042-frete-especial-v1-003` - formula de calculo v1 | `PROC-042-A` | 0.1373 | Parcial, mas e versao antiga |
| 2 | `PROC-042-v2-frete-especial-revisado-003` - formula de calculo v2 | `PROC-042v2-A` | 0.1261 | Sim |
| 3 | `PROC-042-v2-frete-especial-revisado-004` - multiplicadores regionais v2 | `PROC-042v2-B` | 0.0855 | Sim |
| 4 | `PROC-042-frete-especial-v1-004` - multiplicadores regionais v1 | `PROC-042-B` | 0.0787 | Sim, relevancia menor permitida, mas com risco de contradicao |

Analise: o pipeline recuperou os dois chunks obrigatorios da v2, mas tambem trouxe a v1 antes da v2. Para resposta final ao usuario, o prompt deve priorizar a versao revisada (`PROC-042-v2`) e tratar a v1 como informacao historica ou conflitante.

## 5. Qual o multiplicador para o Sudeste?

Gabarito do Anexo B:

- Deve ser recuperado: `PROC-042v2-B`
- Pode aparecer: `PROC-042-B` como versao antiga, com contradicao 1.0 vs 1.1

Chunks recuperados:

| Ordem | Chunk recuperado | Correspondencia Anexo B | Score | Correto? |
|---:|---|---|---:|---|
| 1 | `PROC-042-v2-frete-especial-revisado-003` - formula de calculo v2 | `PROC-042v2-A` | 0.1474 | Parcial, relacionado ao calculo, mas nao contem o multiplicador regional |
| 2 | `PROC-042-frete-especial-v1-003` - formula de calculo v1 | `PROC-042-A` | 0.1363 | Parcial, versao antiga e sem multiplicador regional detalhado |
| 3 | `PROC-042-v2-frete-especial-revisado-004` - multiplicadores regionais v2 | `PROC-042v2-B` | 0.1451 | Sim |
| 4 | `PROC-042-frete-especial-v1-004` - multiplicadores regionais v1 | `PROC-042-B` | 0.1308 | Sim, relevancia menor permitida, mas com contradicao |

Analise: o chunk obrigatorio (`PROC-042v2-B`) foi recuperado, mas ficou na terceira posicao. Ha risco de o LLM usar a versao antiga se o prompt nao orientar a priorizar documentos revisados mais recentes.

## Resumo da avaliacao

| Pergunta | Resultado geral | Observacao principal |
|---|---|---|
| Qual o prazo de devolucao? | Correto | Recuperou `POL-001-A`, `POL-001-B` e `POL-001-C` |
| Posso devolver carga perigosa? | Correto com ruido | `POL-001-B` veio em primeiro; `FAQ-03` tambem apareceu |
| Qual o SLA do cliente Gold? | Correto com ruido | `SLA-2024-B` veio em primeiro, mas os opcionais esperados nao vieram |
| Frete para 600kg para Manaus? | Parcialmente correto | Recuperou v2, mas trouxe v1 antes, gerando risco de contradicao |
| Qual o multiplicador para o Sudeste? | Parcialmente correto | Recuperou `PROC-042v2-B`, mas apenas na terceira posicao |

Conclusao: o pipeline atende ao objetivo minimo do exercicio, pois recupera os chunks obrigatorios nas cinco perguntas testadas. Os principais pontos de melhoria estao no ranqueamento quando ha documentos com versoes diferentes e na reducao de chunks relacionados, mas que nao respondem diretamente a pergunta.