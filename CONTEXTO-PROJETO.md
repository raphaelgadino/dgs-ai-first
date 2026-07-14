# NovaTech Assistant

## Contexto do Projeto

O NovaTech Assistant é uma solução de atendimento orientada por conhecimento interno, criada para responder dúvidas operacionais com base em documentos oficiais da empresa. A proposta central é reduzir respostas livres e inconsistentes do modelo de IA, substituindo texto genérico por uma saída estruturada, validável e auditável.

O foco do projeto é segurança operacional: a resposta gerada precisa estar ancorada em uma fonte válida, respeitar regras de negócio conhecidas e, quando houver qualquer dúvida, devolver uma saída segura em vez de propagar informação incorreta para o atendimento.

## Proposta Técnica

A solução foi desenhada com uma abordagem de defesa em profundidade:

1. O modelo de IA gera a resposta em formato estruturado.
2. Um schema valida o formato esperado e impede respostas fora do contrato.
3. Um validador determinístico aplica regras adicionais de produto.
4. Em caso de falha, a execução retorna uma resposta segura e rastreável.

Essa estratégia foi escolhida para separar claramente o papel do prompt, que orienta o modelo, do papel do código, que decide se a resposta pode ou não seguir adiante.

## O Que Foi Implementado

### 1. Contrato de resposta estruturada

Foi definido um schema para padronizar a saída do assistente com três campos principais:

- `answer`: texto em linguagem natural para o atendente
- `source_document`: identificador do documento de origem
- `confidence_score`: nível de confiança da resposta

Esse contrato força previsibilidade no consumo da resposta e permite validação automática antes da entrega ao usuário final.

### 2. Lista de fontes permitidas

A validação passou a restringir o documento de origem a um conjunto conhecido de referências válidas. Isso reduz o risco de alucinação de fonte, em que o modelo inventa um documento para dar aparência de autoridade à resposta.

### 3. Validação determinística com guardrails

Foi criado um validador responsável por aplicar três camadas de proteção:

- validação do formato da resposta
- validação da fonte citada
- validação de uma regra crítica de negócio sobre carga perigosa e devolução

Se qualquer uma dessas etapas falhar, a resposta é bloqueada e substituída por uma alternativa segura.

### 4. Resposta segura de fallback

Quando a validação falha, o sistema não tenta corrigir a resposta de forma implícita. Ele devolve uma mensagem padronizada, com baixa confiança e fonte neutra, para evitar que uma resposta inadequada chegue ao atendente.

### 5. Auditoria por log

O fluxo registra as validações e os motivos de rejeição em log estruturado. Isso facilita rastreabilidade, revisão técnica e investigação de incidentes sem expor dados sensíveis.

## Execução Realizada

Na prática, a implementação ficou organizada em dois blocos:

- o schema define o contrato de entrada e saída esperada
- o validador aplica as regras de produto e decide se a resposta é aceita ou rejeitada

O fluxo final segue esta lógica:

1. Receber a resposta bruta do modelo.
2. Validar a estrutura.
3. Confirmar se a fonte está na lista permitida.
4. Verificar a regra de negócio relacionada a cargas perigosas e devolução.
5. Aceitar a resposta somente se todas as verificações passarem.
6. Caso contrário, retornar fallback seguro e registrar o motivo.

## Resultado Esperado

Com essa execução, o projeto passa a operar com um comportamento mais previsível e mais seguro para uso em atendimento. O objetivo não é apenas produzir uma boa resposta, mas garantir que a resposta esteja dentro de regras verificáveis e compatíveis com a operação da empresa.

## Observações de Qualidade

A revisão técnica identificou pontos de endurecimento importantes para produção, especialmente na validação do schema, na restrição de campos aceitos e na robustez da regra de negócio. Esses pontos reforçam a direção do projeto: quanto mais crítico o fluxo, mais a resposta precisa depender de validação determinística e não apenas da instrução dada ao modelo.

## Estado Atual

O projeto já possui a base conceitual e operacional do fluxo de resposta segura. A arquitetura está preparada para evoluir para testes automatizados, integração com endpoints e ampliação de regras sem perder o contrato central de segurança e rastreabilidade.