# Entrega — Exercício 1.3: Pipeline RAG open-source

## Resumo da solução

Foi implementado um protótipo funcional de RAG usando ferramentas gratuitas/open-source:

- Python para orquestração do pipeline.
- ChromaDB como vector store local.
- `sentence-transformers` para geração de embeddings.
- Código manual para ingestão, busca, reranking simples e montagem do prompt.
- Claude usado manualmente para a etapa de geração, conforme solicitado no exercício.

## Evidências da implementação

| Item do enunciado | Evidência |
|---|---|
| Código do pipeline | `rag_pipeline.py` |
| Dependências | `requirements.txt` |
| Documentação de uso e estratégia de chunking | `README.md` |
| Guia de primeira execução | `PRIMEIRA_EXECUCAO.md` |
| Testes com 5 perguntas do Anexo B | `teste-rag-5-perguntas.md` |
| Avaliação da resposta gerada no Claude | `avaliacao-resposta-claude.md` |

## Como reproduzir

### 1. Preparar a pasta

```powershell
cd "C:\git\dgs-ai-first\Prática 1\exercicio-1.3"
```

### 2. Criar e preparar o ambiente virtual

```powershell
py -3 -m venv .venv
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install -r .\requirements.txt
```

Se o comando `py` não existir, usar:

```powershell
python -m venv .venv
```

### 3. Rodar ingestão

```powershell
.\.venv\Scripts\python.exe .\rag_pipeline.py ingest
```

Resultado validado:

```json
{
  "documents": 5,
  "chunks": 37,
  "avg_tokens_per_chunk": 96
}
```

### 4. Rodar as 5 buscas de avaliação

```powershell
.\.venv\Scripts\python.exe .\rag_pipeline.py search "Qual o prazo de devolução?" --top-k 4
.\.venv\Scripts\python.exe .\rag_pipeline.py search "Posso devolver carga perigosa?" --top-k 4
.\.venv\Scripts\python.exe .\rag_pipeline.py search "Qual o SLA do cliente Gold?" --top-k 4
.\.venv\Scripts\python.exe .\rag_pipeline.py search "Frete para 600kg para Manaus?" --top-k 4
.\.venv\Scripts\python.exe .\rag_pipeline.py search "Qual o multiplicador para o Sudeste?" --top-k 4
```

Os resultados completos, com chunks recuperados, comparação com gabarito e scores de similaridade, estão em `teste-rag-5-perguntas.md`.

### 5. Gerar prompt para o Claude

```powershell
.\.venv\Scripts\python.exe .\rag_pipeline.py prompt "Posso devolver carga perigosa?" --top-k 4
```

O prompt gerado deve ser colado manualmente no Claude. A avaliação da resposta obtida está em `avaliacao-resposta-claude.md`.

## Estratégia de chunking

A estratégia usada foi chunking por seção Markdown, com quebra por parágrafo quando a seção fica grande e overlap de 1 parágrafo.

Justificativa:

- Os documentos da NovaTech já são estruturados por seções de negócio, como prazos, exceções, fórmula de frete e tabela de SLA.
- Separar por seção preserva a unidade semântica da regra e evita misturar assuntos diferentes no mesmo chunk.
- A quebra por parágrafo reduz chunks grandes demais e melhora a precisão em perguntas curtas de atendimento.
- O overlap de 1 parágrafo reduz perda de contexto quando uma informação fica próxima da fronteira entre chunks.

## Resultado dos testes de retrieval

| Pergunta | Resultado geral | Observação principal |
|---|---|---|
| Qual o prazo de devolução? | Correto | Recuperou `POL-001-A`, `POL-001-B` e `POL-001-C`. |
| Posso devolver carga perigosa? | Correto com ruído | `POL-001-B` veio em primeiro; `FAQ-03` também apareceu. |
| Qual o SLA do cliente Gold? | Correto com ruído | `SLA-2024-B` veio em primeiro, mas os opcionais esperados não vieram. |
| Frete para 600kg para Manaus? | Parcialmente correto | Recuperou v2, mas trouxe v1 antes, gerando risco de contradição. |
| Qual o multiplicador para o Sudeste? | Parcialmente correto | Recuperou `PROC-042v2-B`, mas apenas na terceira posição. |

## Avaliação da geração no Claude

Pergunta usada: "Posso devolver carga perigosa?"

Conclusão: a resposta gerada no Claude foi correta. Ela informou que carga perigosa não é elegível para devolução pelo processo padrão, citou `POL-001`, seção 3.2, mencionou Gestão de Riscos/ramal 4500 e usou `FAQ-Atendimento`, Item 3, apenas como apoio informal.

## Problemas encontrados e propostas de correção

### Problema 1: versões antigas e novas aparecem juntas em perguntas de frete

Nas perguntas sobre frete, o pipeline recuperou chunks da `PROC-042` v1 e da `PROC-042-v2`. Isso é relevante para análise, mas perigoso para geração, porque o LLM pode misturar multiplicadores antigos e novos.

Correções propostas:

- Extrair metadados de versão, data de vigência e status do documento durante a ingestão.
- Priorizar documentos revisados/mais recentes no reranking quando houver conflito de versões.
- Incluir no prompt uma regra explícita: quando houver versões conflitantes, priorizar a mais recente e mencionar a contradição se ambas forem relevantes.

### Problema 2: chunks relacionados, mas não diretamente úteis, aparecem no top-k

Em perguntas de SLA e devolução, apareceram chunks sobre custos, penalidades, medição/reportes ou FAQ relacionado, mesmo quando a pergunta pedia uma regra específica.

Correções propostas:

- Melhorar o reranking lexical considerando termos da pergunta, seção e tipo de documento.
- Adicionar filtros por domínio quando a intenção for clara, por exemplo `sla`, `devolucao` ou `frete`.
- Testar `top-k` menor para perguntas simples e `top-k` maior apenas para perguntas multi-domínio.

### Problema 3: fonte informal pode influenciar resposta crítica

O `FAQ-Atendimento` é útil operacionalmente, mas não tem o mesmo peso de uma política oficial. Em perguntas críticas, como carga perigosa, ele deve apoiar a resposta, não substituir a fonte formal.

Correções propostas:

- Classificar documentos por confiabilidade: política/procedimento oficial acima de FAQ informal.
- Adicionar um campo `source_type` nos metadados dos chunks.
- Penalizar fontes informais no reranking quando houver fonte formal cobrindo a mesma pergunta.

## Conclusão final

O pipeline atende ao objetivo mínimo do exercício: ingere documentos, divide em chunks, gera embeddings, armazena no ChromaDB, busca chunks relevantes com score de similaridade e monta prompt pronto para envio ao Claude.

Os testes mostram que o protótipo funciona, mas também evidenciam problemas reais de RAG: ranqueamento imperfeito, documentos contraditórios e diferença de confiabilidade entre fontes formais e informais. Esses problemas reforçam que RAG é um sistema de engenharia de dados e curadoria de contexto, não apenas uma chamada de API para um LLM.