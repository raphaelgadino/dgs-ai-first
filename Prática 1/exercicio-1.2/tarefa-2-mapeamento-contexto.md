# Tarefa 2 — Mapeamento de contexto estático vs dinâmico

## Tabela de anatomia do contexto
> Regra prática: ~0,75 palavra por token.

| Parte do contexto                             | Tipo (estático/dinâmico) | Muda por query? | Tokens estimados     | Observações                                                            |
|-----------------------------------------------|:------------------------:|:---------------:|:--------------------:|------------------------------------------------------------------------|
| System prompt (identidade + regras + formato) | Estático                 | Não             | ~550                 | Português com acentos aumenta a granularidade e, portanto, o nº de tokens |
| Chunks recuperados (A/B/C…)                   | Dinâmico                 | Sim             | ~65–80 / 50–60 / 50–65 | Um valor por chunk (A / B / C)                                       |
| Pergunta do atendente                         | Dinâmico                 | Sim             | ~10–40               | —                                                                      |
| Histórico da conversa                         | Dinâmico (cresce)        | Sim             | ~4.500               | Sem contar os tokens do system prompt da plataforma                    |
| **Total estimado por query**                  | —                        | —               | **~700**             | —                                                                      |

