# Tarefa 4 — Análise crítica das respostas (Rodada 1)

| #  | Pergunta                 | Correta? | Citou fonte? | Respeitou guardrails? | Onde errou / observações |
|----|--------------------------|----------|--------------|-----------------------|--------------------------|
| 1  | Devolução carga perigosa | Sim      | Sim          | Sim                   | Esperado: **NÃO pode devolver** (exceção do POL-001) — respondido corretamente |
| 2  | SLA cliente Gold         | Sim      | Sim          | Sim                   | Esperado: resolução em **24h** — respondido corretamente |
| 3  | Frete 600kg Manaus       | Sim      | Sim          | Sim                   | Esperado: multiplicador **1.8**, mas **falta o valor base** — assistente informou o multiplicador e declarou a ausência do valor base, sem inventar número |

## Conclusões
- Padrões de falha observados: nenhuma falha na Rodada 1 — as três respostas corresponderam ao comportamento esperado (incluindo a exceção da carga perigosa e a recusa em calcular o frete sem o valor base).
- Quais guardrails falharam e por quê: nenhum. Os guardrails de citação de fonte, de não inventar valores e de tratar exceções foram respeitados em todas as respostas.
- O que precisa ser reforçado no prompt (entra na Tarefa 5): como o v1 já atingiu o resultado esperado, a Rodada 2 serve para validar a robustez (ex: reformular as perguntas, testar variações de fraseado e sessões com múltiplas perguntas) em vez de corrigir falhas.
