# Riscos de seguranca no uso de MCP servers locais

Este documento registra riscos especificos do uso de MCP servers locais no projeto NovaTech Assistant e as mitigacoes recomendadas para o ambiente de desenvolvimento.

## Contexto

Os MCP servers locais previstos para o projeto sao:

- `filesystem`: acesso a codigo, specs, skills, documentacao NovaTech e corpus de chunks.
- `git`: leitura de historico, branches, diffs e estado do repositorio local.
- `memory`: memoria persistente de decisoes, linguagem ubiqua e contexto do projeto.
- `everything`: server local usado para aprendizado e validacao das primitivas MCP.

Como todos rodam na maquina do desenvolvedor, os riscos principais estao relacionados a escopo excessivo, permissao de escrita, exposicao de dados locais e confianca indevida em artefatos gerados por agentes.

## Risco 1: escopo amplo demais no filesystem server

**Cenario:** o `filesystem` server e configurado com acesso ao diretorio raiz do usuario, ao disco inteiro ou a uma pasta maior que o necessario, como `C:\git` ou `C:\Users\...`.

**Impacto:** o agente pode listar e ler arquivos fora do projeto, incluindo `.env`, chaves privadas, tokens, configuracoes pessoais, caches de ferramentas, credenciais de cloud ou documentos internos que nao pertencem ao exercicio.

**Mitigacoes:**

- Configurar o `filesystem` com least privilege, expondo apenas as pastas necessarias do projeto.
- Separar escopos de leitura e escrita:
  - leitura/escrita somente para `src/`, `specs/`, `skills/` e artefatos de exercicio;
  - leitura somente para `docs/novatech/` e `data/retrieval-corpus/`.
- Nunca apontar o server para `C:\`, `C:\Users`, home directory, pasta global de repositorios ou pastas com segredos.
- Manter `.env`, certificados, chaves e tokens fora dos escopos MCP.
- Revisar `.mcp/mcp.json` em todo change de escopo antes de usar o agente.

## Risco 2: escrita habilitada sem revisao humana

**Cenario:** o `filesystem` server permite escrita em muitas pastas, e o agente altera codigo, specs, prompts ou configuracoes sem checkpoint humano.

**Impacto:** o agente pode modificar arquivos criticos, apagar conteudo, inserir configuracoes inseguras, alterar prompts de guardrail, mudar specs aprovadas ou gerar codigo que passa despercebido antes de ser usado.

**Mitigacoes:**

- Restringir escrita a pastas onde o agente realmente precisa atuar.
- Tratar `docs/novatech/` e `data/retrieval-corpus/` como read-only, pois sao fontes de verdade para RAG e testes.
- Exigir validation gate humano antes de aceitar mudancas em `specs/`, `prompts/`, `.mcp/`, `infra/` e arquivos de configuracao.
- Usar `git diff` antes de qualquer commit ou entrega.
- Trabalhar em branch local de exercicio e evitar execucao automatica de comandos destrutivos.

## Risco 3: memoria persistente com dados sensiveis ou decisoes incorretas

**Cenario:** o `memory` server armazena informacoes sensiveis, dados de cliente, credenciais, ou decisoes temporarias que depois passam a ser reutilizadas como se fossem verdade do projeto.

**Impacto:** informacoes sensiveis podem persistir alem da sessao, e agentes futuros podem recuperar contexto obsoleto ou incorreto, contaminando specs, codigo e respostas do assistente.

**Mitigacoes:**

- Registrar na memoria apenas decisoes duraveis, linguagem ubiqua e convencoes tecnicas aprovadas.
- Nao armazenar tokens, senhas, dados pessoais, dados de cliente ou conteudo sigiloso.
- Incluir origem e data em decisoes relevantes para facilitar auditoria.
- Revisar periodicamente entradas da memoria e remover itens obsoletos.
- Para decisoes oficiais, preferir ADR em `docs/adr/`; a memoria deve apontar para o ADR, nao substitui-lo.

## Risco 4: exposicao de historico e diffs pelo git server

**Cenario:** o `git` server permite que o agente leia historico, reflog, diffs e branches locais, incluindo commits temporarios ou arquivos removidos que podem ter carregado segredos no passado.

**Impacto:** segredos acidentalmente commitados, mesmo que depois removidos, podem continuar acessiveis no historico local. O agente tambem pode usar informacao obsoleta de commits antigos como se fosse estado atual.

**Mitigacoes:**

- Rodar varreduras locais de segredos antes de habilitar o `git` server em repositorios reais.
- Nao usar commits temporarios para armazenar `.env`, dumps, tokens ou chaves.
- Quando houver vazamento, rotacionar o segredo e limpar o historico conforme processo aprovado.
- Instruir agentes a diferenciar estado atual (`HEAD`) de historico antigo.
- Limitar o uso do historico a auditoria, rastreabilidade e entendimento de mudancas.

## Risco 5: confianca excessiva em fonte local nao normativa

**Cenario:** o agente acessa `docs/novatech/` e `data/retrieval-corpus/`, mas trata documentos informais, como FAQ, com a mesma confianca de documentos normativos, como POL, PROC e SLA.

**Impacto:** respostas ou testes podem ser baseados em informacao informal, desatualizada ou contraditoria, causando falhas de guardrail. Exemplo: usar FAQ para contradizer a regra normativa de devolucao de carga perigosa.

**Mitigacoes:**

- Classificar fontes por autoridade: documentos normativos e contratuais acima de FAQ informal.
- Preservar metadados de versao, vigencia e classificacao documental no corpus.
- Quando houver contradicao, priorizar documento mais recente e/ou normativo, informando a existencia da versao anterior.
- Criar testes de retrieval para perguntas com contradicao conhecida, como PROC-042 v1 versus v2.
- Exigir citacao de fonte em toda resposta gerada pelo assistente.

## Controles recomendados

| Controle | Aplicacao pratica |
| --- | --- |
| Least privilege | Expor somente pastas necessarias no `.mcp/mcp.json`. |
| Read-only para fontes de verdade | `docs/novatech/` e `data/retrieval-corpus/` nao devem ser editaveis pelo agente. |
| Revisao humana | Mudancas em specs, prompts, MCP config e infra exigem validation gate. |
| Auditoria via Git | Conferir `git diff` antes de aceitar alteracoes geradas por agente. |
| Separacao de fontes | FAQ e documentos normativos devem ter niveis diferentes de confianca. |
| Higiene de segredos | Segredos nunca devem estar dentro dos escopos MCP nem no historico Git. |

## Conclusao

O uso de MCP servers locais e adequado para o exercicio porque evita dependencia de servicos externos e permite evidencias reais de leitura de documentos, corpus e historico Git. Ainda assim, a configuracao deve ser tratada como infraestrutura sensivel: escopos minimos, fontes read-only, revisao humana e auditoria local sao obrigatorios para reduzir risco de exposicao, alteracao indevida e uso de contexto incorreto.
