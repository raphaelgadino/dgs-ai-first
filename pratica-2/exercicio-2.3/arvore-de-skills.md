# Árvore de Skills — NovaTech Assistant

Definição da hierarquia de skills do projeto seguindo **Foundation → Domain → Artifact**. As pastas já existem em `skills/` (Anexo C); este documento define **o que cada skill é, o que contém e como as camadas se compõem**.

## Princípio organizador: composição

As três camadas não são só uma gaveta de assuntos — elas têm uma relação de dependência:

- **Foundation** = "como escrevemos qualquer coisa neste repo". Convenções globais, agnósticas de camada. Não sabem o que é um endpoint ou um card; sabem o que é um erro bem tratado, um log estruturado, um tipo em modo estrito.
- **Domain** = "como fazemos X nesta arquitetura". Padrões por camada (endpoint, serviço de busca, teste, componente React). Cada skill de Domain **assume** as Foundation e diz como aplicá-las naquela camada.
- **Artifact** = "receita para gerar Y". Passo a passo executável que **compõe** skills de Domain + Foundation para produzir um artefato concreto (um endpoint RAG novo, um teste de integração, um card).

Regra prática: um Artifact nunca redefine o que uma Foundation já diz — ele **referencia**. Se `create-rag-endpoint` precisa explicar tratamento de erro, ele aponta para `foundation/error-handling.md` em vez de repetir. Isso mantém a convenção em um único lugar.

---

## Árvore

```
skills/
├── foundation/
│   ├── typescript-conventions.md      # modo estrito, tipos, naming, fronteiras de módulo
│   ├── error-handling.md              # custom errors, erro→HTTP, throw vs return
│   ├── logging.md                     # pino, log estruturado, correlação por requestId
│   ├── env-config.md                  # carregar/validar env, fail-fast, segredos
│   └── project-structure.md           # onde cada coisa vive, regras de import
│
├── domain/
│   ├── azure-functions-endpoint.md    # estrutura handler/validator/response-builder
│   ├── azure-openai-integration.md    # completion + embedding, retry/backoff, budget
│   ├── azure-ai-search-integration.md # busca de chunks, metadado de vigência
│   ├── rag-prompt-assembly.md         # montar prompt dentro do context budget
│   ├── testing-patterns.md            # unit/integration/e2e, mocks (msw), fixtures
│   ├── react-components.md            # organização do painel, pages vs components
│   ├── teams-bot-cards.md             # lógica do bot + Adaptive Cards
│   └── ingestion-pipeline.md          # extractor → chunker → embedder → indexer
│
└── artifact/
    ├── create-rag-endpoint.md         # gerar um endpoint RAG completo
    ├── create-integration-test.md     # gerar um teste de integração com mocks
    ├── create-react-card.md           # gerar um card do painel web
    ├── create-service-client.md       # gerar um cliente de serviço Azure novo
    └── create-adr.md                  # gerar um ADR a partir do template
```

---

## Foundation — convenções globais

Aplicam-se a todo o código, independente de camada. São a base referenciada por todas as outras skills.

- **`typescript-conventions.md`** — Regras de `strict: true`: proibição de `any` implícito e de casts que anulam segurança de tipos; uso de `readonly`, discriminated unions e literais de union onde cabível; convenção de nomes (camelCase para valores, PascalCase para tipos); fronteiras de módulo (o que pode importar de `shared/`). É a base de QE-01 e de todo tipo do domínio.
- **`error-handling.md`** — Hierarquia de custom errors (`ValidationError`, `SearchError`, `CompletionError`, `ContextBudgetExceededError`), mapeamento erro→status HTTP, quando lançar vs retornar, proibição de engolir erro silenciosamente. Base de `errors.ts`.
- **`logging.md`** — Configuração do `pino`, formato JSON, correlação por `requestId`, níveis por ambiente, e a regra dura: nunca logar segredo ou PII. Base de `logger.ts`.
- **`env-config.md`** — Padrão de carregamento e validação de variáveis de ambiente com fail-fast na inicialização, tratamento de segredos (nunca em log/erro). Base de `config.ts`.
- **`project-structure.md`** — Mapa de onde cada coisa vive (`functions/` vs `services/` vs `shared/`), regras de import entre camadas, convenção de slug para pastas e arquivos. É a skill que orienta *onde* criar um artefato novo.

## Domain — padrões por camada

Cada skill descreve o padrão canônico de uma camada e quais Foundation ela aplica.

- **`azure-functions-endpoint.md`** — Anatomia de um HTTP trigger (Azure Functions v4): separação `handler.ts` (orquestração) / `validator.ts` (Zod) / `response-builder.ts` (montagem da resposta), geração e propagação de `requestId`, mapeamento de erro para status. *Compõe:* error-handling, logging, typescript-conventions.
- **`azure-openai-integration.md`** — Padrão dos serviços que falam com o Azure OpenAI (completion GPT-4o e embedding): interface do cliente, retry com backoff exponencial em erros transitórios, ciência do context budget (ADR-0002). *Compõe:* error-handling, env-config, logging.
- **`azure-ai-search-integration.md`** — Padrão de recuperação de chunks (top-k), leitura do metadado de vigência e como sinalizar documentos obsoletos sem excluí-los (ADR-0003). *Compõe:* error-handling, env-config.
- **`rag-prompt-assembly.md`** — Como montar o prompt final combinando system prompt (`/prompts/system-prompt.md`) + chunks + histórico (≤ 3 turnos) dentro do budget (~4K + ~8K, ADR-0002) e como priorizar a versão mais recente em documentos contraditórios (ADR-0003). *Compõe:* typescript-conventions; consome saída de azure-ai-search-integration.
- **`testing-patterns.md`** — Fronteira entre `unit/` (tudo mockado), `integration/` (mocks de API externa via msw, integração entre módulos internos) e `e2e/` (fluxo completo, usar com cautela por consumo de tokens); uso das `fixtures/` (`chunks.ts`, `queries.ts`, `expected-responses.ts`). *Compõe:* project-structure.
- **`react-components.md`** — Organização do painel web: separação `pages/` vs `components/`, gerência de estado, padrões de card do dashboard de métricas/histórico. *Compõe:* typescript-conventions.
- **`teams-bot-cards.md`** — Padrão da lógica do bot (Bot Framework) e a construção de Adaptive Cards (`response-card`, `feedback-card`) para respostas no Teams. *Compõe:* typescript-conventions, error-handling.
- **`ingestion-pipeline.md`** — Padrão dos estágios `extractor → chunker → embedder → indexer`, incluindo o overlap de chunking e o problema conhecido de chunking em tabelas (ADR-0004). *Compõe:* error-handling, logging, env-config.

## Artifact — receitas de geração

Cada skill é um passo a passo que produz um artefato concreto compondo Domain + Foundation. É o nível que uma IA (Copilot/agente) executa para gerar código consistente.

- **`create-rag-endpoint.md`** — Receita completa para um endpoint RAG novo: criar tipos → validator (Zod) → serviço de busca → prompt-builder → completion → response-builder → handler → testes. *Compõe:* azure-functions-endpoint, azure-openai-integration, azure-ai-search-integration, rag-prompt-assembly, testing-patterns (o Query Endpoint / `tasks.md` é a instância de referência desta receita).
- **`create-integration-test.md`** — Receita para um teste de integração: definir cenário (feliz + falhas), montar mocks de API externa (msw), usar fixtures, asserções sobre integração entre módulos. *Compõe:* testing-patterns, project-structure.
- **`create-react-card.md`** — Receita para um card do painel web: estrutura do componente, props tipadas, estado, integração com dados do dashboard. *Compõe:* react-components, typescript-conventions.
- **`create-service-client.md`** — Receita para um cliente de serviço Azure novo (além dos existentes): interface, retry/backoff, encapsulamento de erro, config via env. *Compõe:* azure-openai-integration ou azure-ai-search-integration (como referência), error-handling, env-config, logging.
- **`create-adr.md`** — Receita para registrar uma decisão arquitetural usando `docs/adr/template.md` e a nomenclatura `NNNN-titulo.md` (Contexto, Decisão, Consequências, Alternativas). *Compõe:* project-structure.

---

## Convenção para escrever cada skill

Nome do arquivo = slug em kebab-case, `.md` (ex.: `error-handling.md`). Cada skill deve começar por um cabeçalho que deixe claro **quando** ela é acionada — isso é o que permite a uma IA escolher a skill certa:

```markdown
# <Nome da skill>

**Quando usar:** <gatilho — a situação concreta em que esta skill se aplica>
**Camada:** Foundation | Domain | Artifact
**Compõe:** <skills referenciadas, se houver>

## Padrão
<o conteúdo: regras, passos ou receita>

## Exemplo
<trecho mínimo e correto>

## Anti-padrões
<o que não fazer, com o porquê>
```

A seção "Quando usar" é o análogo da *description* de uma skill: precisa ser específica o bastante para disparar no contexto certo e não em falso.

## Extensões previstas (adicionar quando houver demanda real)

Para não sobre-engenheirar agora, ficam fora da árvore inicial e entram quando uma task pedir:

- **Domain `infra-bicep.md`** — convenções de módulos Bicep e parâmetros por ambiente (`dev`/`staging`/`prod`). Só faz sentido quando a fase de infra sair do estado narrativo.
- **Domain `mcp-servers.md`** — padrões de escopo e configuração dos MCP servers locais (`filesystem`, `git`, `memory`) do `.mcp/mcp.json`.
- **Artifact `create-adaptive-card.md`** — receita dedicada a cards do Teams, caso `create-react-card` fique grande demais tentando cobrir web e Teams juntos.
- **Artifact `create-unit-test.md`** — se valer separar a receita de teste unitário da de integração.

Cada uma dessas segue a mesma regra de composição: nasce referenciando Foundation, nunca reescrevendo.