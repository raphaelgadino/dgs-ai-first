# Pipeline RAG mínimo - Exercício 1.3

Este projeto implementa as 3 etapas pedidas:

1. Ingestão de documentos do Anexo A.
2. Busca vetorial por similaridade, com rerank lexical simples.
3. Montagem do prompt final para uso no LLM.

## Estratégia de chunking

Estratégia adotada: chunking por seção Markdown + quebra por parágrafo quando a seção fica grande.

Justificativa:
- Os documentos da NovaTech já vêm organizados por seções de negócio (ex.: prazo, exceções, multiplicadores), então chunk por seção preserva contexto sem misturar assuntos.
- Dividir por parágrafo dentro da seção reduz risco de perder informação quando o bloco é muito extenso.
- Overlap de 1 parágrafo reduz perda de contexto nas fronteiras entre chunks.
- Tamanho-alvo de ~220 tokens por chunk favorece recuperação precisa para perguntas curtas de atendimento.

## Estrutura

- `rag_pipeline.py`: implementação do pipeline.
- `requirements.txt`: dependências Python.
- `teste-rag-5-perguntas.md`: evidência dos testes de retrieval com 5 perguntas do Anexo B.
- `avaliacao-resposta-claude.md`: avaliação da resposta gerada manualmente no Claude.
- `entrega-exercicio-1.3.md`: relatório consolidado da entrega.
- `chroma_db/`: base local gerada após ingestão.

Por padrão, a ingestão ignora arquivos auxiliares que começam com `anexo-`, para não indexar o gabarito do Anexo B nem a versão consolidada do Anexo A. Entram na base somente os documentos operacionais individuais: POL-001, PROC-042, PROC-042-v2, SLA-2024 e FAQ-atendimento.

## Preparar ambiente (Windows PowerShell)

### 1. Ir para a pasta do exercício

```powershell
cd "C:\git\dgs-ai-first\Prática 1\exercicio-1.3"
```

### 2. Criar ambiente virtual

```powershell
py -3 -m venv .venv
```

Se o comando `py` não existir, tente:

```powershell
python -m venv .venv
```

### 3. Ativar ambiente virtual

```powershell
.\.venv\Scripts\Activate.ps1
```

Se der erro de execução de script:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\.venv\Scripts\Activate.ps1
```

### 4. Atualizar pip e instalar dependências

```powershell
python -m pip install --upgrade pip
python -m pip install -r .\requirements.txt
```

### 5. Validar instalação rápida

```powershell
python -c "import chromadb, torch; from sentence_transformers import SentenceTransformer; print('OK')"
```

## Como usar

### Ingestão

```powershell
python .\rag_pipeline.py ingest
```

**Primeira execução:** Leva 2-5 minutos na primeira vez (o modelo de embeddings é baixado). Execuções seguintes são rápidas. O modelo padrão é `paraphrase-multilingual-MiniLM-L12-v2`, melhor para perguntas e documentos em português do que o `all-MiniLM-L6-v2`.

Saída esperada (exemplo):

```
📁 Lendo 5 documento(s)...
Chunking: 100%|████████| 5/5 [00:02<00:00,  2.50it/s]
🔤 Gerando embeddings para 37 chunks...
Batches: 100%|████████| 2/2 [00:15<00:00,  2.34it/s]
💾 Limpando banco anterior...
📤 Armazenando chunks no ChromaDB...
{
  "documents": 5,
  "chunks": 37,
  "avg_tokens_per_chunk": 96
}
```

### Busca

```powershell
python .\rag_pipeline.py search "Posso devolver carga perigosa?" --top-k 4
```

### Montagem de prompt

```powershell
python .\rag_pipeline.py prompt "Qual o SLA do cliente Gold?" --top-k 4
```

## Troubleshooting rápido

- Erro `Microsoft Visual C++ ... required`: mantenha `chromadb` em versão recente (já definido) e use Python 3.10/3.11/3.12.
- Busca retorna `[]`: execute primeiro `ingest` e confirme que gerou chunks.
- Modelo de embeddings demora no primeiro uso: normal, ele é baixado uma vez.
- **Nunca interrompa durante ingestão (Ctrl+C):** deixe terminar completamente. Se interromper, remova `chroma_db/` e execute ingestão novamente.
- Se o Windows disser que `chroma.sqlite3` está em uso, feche o terminal/processo Python anterior ou use um diretório novo: `python .\rag_pipeline.py --persist-dir .\chroma_db_novo ingest`.
