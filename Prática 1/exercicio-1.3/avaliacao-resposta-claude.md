# Avaliação da resposta gerada no Claude

## Pergunta testada

"Posso devolver carga perigosa?"

## Como o prompt foi gerado

O prompt foi montado pelo pipeline RAG com o comando:

```powershell
cd "C:\git\dgs-ai-first\Prática 1\exercicio-1.3"
.\.venv\Scripts\python.exe .\rag_pipeline.py prompt "Posso devolver carga perigosa?" --top-k 4
```

O comando `prompt` não executa a geração da resposta. Ele apenas monta o contexto final com system prompt, chunks recuperados e pergunta do atendente. A resposta abaixo foi gerada manualmente no Claude, conforme solicitado no enunciado do exercício.

## Resposta gerada pelo Claude

> Não, carga perigosa não é elegível para devolução pelo processo padrão. Conforme a POL-001 — Política de Devolução de Mercadorias, seção 3.2 (Exceções ao prazo geral), as cargas perigosas classificadas nas classes 1 a 6 da ANTT (explosivos, gases, líquidos inflamáveis, sólidos inflamáveis, oxidantes/peróxidos e substâncias tóxicas/infectantes), conforme Resolução ANTT nº 5.947/2021, estão entre as categorias não elegíveis ao processo padrão.
>
> No entanto, isso não significa que a devolução seja impossível. O cliente deve entrar em contato com o setor de Gestão de Riscos (ramal 4500) para tratamento individual do caso (fonte: POL-001, seção 3.2). O material de apoio interno (FAQ-Atendimento, Item 3) reforça que o caso deve ser encaminhado a esse setor, que pode avaliar exceções, devendo o atendente orientar o cliente quanto à necessidade de tratamento especial.
>
> Fontes citadas: POL-001 (seção 3.2) e FAQ-Atendimento (Item 3).

## Chunks que sustentaram a resposta

| Chunk recuperado | Correspondência no Anexo B | Papel na resposta |
|---|---|---|
| `POL-001-politica-devolucao-005` | `POL-001-B` | Fonte formal principal: define que cargas perigosas não são elegíveis ao processo padrão. |
| `FAQ-atendimento-002` | `FAQ-03` | Apoio informal: reforça encaminhamento para Gestão de Riscos/ramal 4500. |

## Avaliação

| Critério | Resultado | Justificativa |
|---|---|---|
| Correção factual | Correta | A resposta afirma que carga perigosa não é elegível para devolução pelo processo padrão, conforme `POL-001`, seção 3.2. |
| Uso dos chunks recuperados | Correto | A resposta usa o chunk formal `POL-001-B` como base principal e usa o `FAQ-03` apenas como apoio informal. |
| Citação de fonte | Correta | A resposta cita `POL-001`, seção 3.2, e `FAQ-Atendimento`, Item 3. |
| Respeito aos guardrails | Correto | A resposta não inventa prazo, valor ou autorização automática. Ela deixa claro que o caso exige tratamento individual por Gestão de Riscos. |
| Tratamento de fonte informal | Adequado | O FAQ foi usado como reforço operacional, mas a regra principal ficou baseada na política oficial `POL-001`. |

## Conclusão

A resposta está correta. Ela respeita os guardrails definidos para o assistente porque usa apenas informações presentes nos chunks recuperados, cita as fontes, não inventa regra nova e diferencia a política oficial do material informal de apoio.

O principal ponto positivo é que o Claude não interpretou o FAQ como autorização automática para devolução. Ele manteve a regra correta: cargas perigosas não seguem o processo padrão e devem ser encaminhadas para Gestão de Riscos pelo ramal 4500.

## Observação crítica

Mesmo com a resposta correta, existe um risco importante: o `FAQ-Atendimento` menciona que Gestão de Riscos pode avaliar exceções. Como o FAQ é uma fonte informal, o assistente deve sempre priorizar a política oficial (`POL-001`) e tratar o FAQ apenas como apoio operacional. Em produção, seria recomendável marcar documentos informais com menor prioridade ou exigir validação quando a resposta depender deles.