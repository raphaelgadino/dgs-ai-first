# Primeira Execução — O que Esperar

## ⏱️ Tempo estimado

- **Primeira ingestão:** 3-5 minutos (o modelo é baixado na primeira vez: ~400MB)
- **Ingestões subsequentes:** 20-30 segundos
- **Primeira busca:** 10 segundos (o modelo é carregado em memória)
- **Buscas subsequentes:** 1-2 segundos

## 📥 Durante a ingestão

Você verá:

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

**Não interrompa (Ctrl+C) durante essa etapa!** Se fizer, remova a pasta `chroma_db/` e rode novamente.

## 🔍 Durante a busca

Você verá:

```
🔍 Buscando chunks para: Sua pergunta aqui
✅ Recuperados 4 chunk(s)
```

A resposta é exibida em JSON com cada chunk anotado.

## 📋 Durante montagem de prompt

Você verá:

```
🔍 Buscando chunks para: Sua pergunta aqui
✅ Recuperados 4 chunk(s)
📋 Prompt montado com 4 chunk(s) (850 palavras)
```

Depois o prompt completo é exibido — pronto para colar no Claude!

## 🛠️ Se algo der errado

1. **ChromaDB corrompido:** `Remove-Item -Recurse -Force .\chroma_db` e rode `ingest` novamente
2. **Modelo não baixou:** Verifique conexão de internet e tente novamente
3. **Nenhum chunk recuperado:** Confirme que a ingestão completou (gerou chunks > 0)
