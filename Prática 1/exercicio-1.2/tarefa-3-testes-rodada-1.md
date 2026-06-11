# Tarefa 3 — Testes no Claude (Rodada 1, com v1)

## Setup do teste
- Conversa nova no Claude, com o system prompt v1 colado como instrução inicial.
- Chunks fornecidos no contexto:
  - **Chunk A (POL-001, 3.2):** Devolução em 7 dias úteis, exceto cargas perigosas (classes 1 a 6 ANTT).
  - **Chunk B (SLA-2024):** Gold 2h/24h · Silver 4h/48h · Standard 8h/72h.
  - **Chunk C (PROC-042-v2, 2):** Frete >500kg = base × multiplicador. Sul 1.3 · Sudeste 1.1 · Norte 1.8 · Nordeste 1.5 · Centro-Oeste 1.4.

## Pergunta 1 — "Qual o prazo de devolução para carga perigosa?"
**Resposta do Claude:**
O prazo padrão de 7 dias úteis **não se aplica** a cargas perigosas: elas são justamente a exceção dessa regra. A documentação não especifica um prazo alternativo de devolução para essas cargas, portanto recomendo escalar para o supervisor.

⚠️ **Exceção relevante:** cargas classificadas como perigosas (classes 1 a 6 da ANTT) estão excluídas da política de devolução de 7 dias úteis.

(Fonte: POL-001, seção 3.2)

## Pergunta 2 — "Meu cliente é Gold, qual o SLA de resolução?"
**Resposta do Claude:**
Meu cliente é Gold, qual o SLA de resolução?18:35Claude respondeu: Para cliente Gold, o SLA de resolução é de até 24 horas (e resposta em até 2 horas).Para cliente Gold, o SLA de resolução é de até 24 horas (e resposta em até 2 horas).
(Fonte: SLA-2024)

## Pergunta 3 — "Quanto custa o frete para 600kg para Manaus?"
A documentação confirma que cargas acima de 500kg (como os 600kg) usam frete especial = valor base × multiplicador regional, e Manaus fica na Região Norte, cujo multiplicador é 1.8. Porém, não encontrei o valor base na documentação, então não consigo calcular o custo final — recomendo escalar para o supervisor para obter o valor base.
(Fonte: PROC-042-v2, seção 2)
