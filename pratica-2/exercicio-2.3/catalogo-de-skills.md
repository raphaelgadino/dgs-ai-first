# Catálogo de Skills — propriedade, consumo e frequência

Complementa `skills-tree.md`. Para cada skill: **frase-ativação** (o gatilho que um agente reconhece), **quem cria** (papel responsável pela autoria/manutenção), **quem consome** (papéis + agentes) e **frequência de uso estimada**.

**Papéis:** TL = Tech Lead · DS = Dev Sênior · DP = Dev Pleno · QA · PS = Product Specialist · DM = Delivery Manager
**Agentes:** G = geração de código (Copilot/Claude Code) · R = revisão crítica · T = testes
**Frequência:** Muito alta (quase toda task) · Alta (recorrente na camada) · Média (marcos específicos) · Baixa (pontual)

---

## Foundation

| Skill | Frase-ativação | Cria | Consome | Freq. |
|---|---|---|---|---|
| `typescript-conventions` | "Vou escrever ou revisar código TypeScript neste repo." | TL (com DS) | DP, DS, QA · G, R | Muito alta |
| `error-handling` | "Preciso lançar, tratar ou mapear um erro para a resposta." | TL | DP, DS · G, R | Muito alta |
| `logging` | "Vou adicionar logs ou instrumentar um fluxo." | TL (ou DS) | DP, DS · G, R | Alta |
| `env-config` | "Preciso ler ou validar uma variável de ambiente/config." | TL | DP, DS · G, R | Média |
| `project-structure` | "Onde crio este arquivo? Posso importar disto aqui?" | TL | DP, DS, QA · G, R | Alta |

## Domain

| Skill | Frase-ativação | Cria | Consome | Freq. |
|---|---|---|---|---|
| `azure-functions-endpoint` | "Vou criar ou alterar um endpoint HTTP (Azure Function)." | TL + DS | DP, DS · G, R | Alta (queda p/ Média após a API pronta) |
| `azure-openai-integration` | "Preciso chamar o Azure OpenAI (completion ou embedding)." | DS (aprov. TL) | DP, DS · G | Média |
| `azure-ai-search-integration` | "Vou recuperar chunks do Azure AI Search." | DS (aprov. TL) | DP, DS · G | Média |
| `rag-prompt-assembly` | "Preciso montar o prompt com chunks + system prompt dentro do budget." | TL (com PS) | DP, DS · G, R | Alta |
| `testing-patterns` | "Vou escrever um teste (unit/integration/e2e)." | QA + DS | DP, DS, QA · G, T | Muito alta |
| `react-components` | "Vou criar ou organizar um componente do painel web." | DS (com DP) | DP, DS · G | Média |
| `teams-bot-cards` | "Vou mexer no bot do Teams ou num Adaptive Card." | DS | DP, DS · G | Baixa |
| `ingestion-pipeline` | "Vou implementar ou ajustar um estágio do pipeline de ingestão." | DS + TL | DP, DS · G | Baixa (Média durante a fase de ingestão) |

## Artifact

| Skill | Frase-ativação | Cria | Consome | Freq. |
|---|---|---|---|---|
| `create-rag-endpoint` | "Crie um endpoint RAG completo do zero." | DS (aprov. TL) | DP · G (executor principal) | Baixa / alto leverage |
| `create-integration-test` | "Gere um teste de integração para este módulo." | QA + DS | DP, DS, QA · G, T | Alta |
| `create-react-card` | "Crie um card novo para o painel." | DS | DP · G | Média |
| `create-service-client` | "Crie um cliente para um serviço Azure novo." | DS | DP, DS · G | Baixa |
| `create-adr` | "Registre esta decisão arquitetural como ADR." | TL | TL, PS · G (rascunho), R | Média |

---

## Leituras da matriz

Alguns padrões que a tabela revela e que valem para governar a manutenção das skills:

O **Tech Lead é dono de toda a camada Foundation e da governança** (ADR, decisões arquiteturais de Domain). Faz sentido: são as convenções que, se divergirem, contaminam tudo abaixo. Revisão dessas skills deve passar por ele.

O **Dev Sênior concentra a autoria de Domain e Artifact** — ele é quem conhece os padrões de cada camada bem o suficiente para codificá-los em receita. O **Dev Pleno é majoritariamente consumidor**, sobretudo das skills Artifact, que existem justamente para ele (e o agente de geração) produzir código consistente sem reinventar o padrão.

O **agente de geração (G) é o consumidor universal** — aparece em praticamente todas as skills, porque é ele que traduz skill em código. Já o **agente de revisão (R) só consome skills que definem "certo vs. errado"** verificável (conventions, error-handling, endpoint, prompt-assembly, ADR); ele não precisa das receitas Artifact, e sim das regras que elas deveriam ter seguido.

**QA co-cria só as skills de teste** (`testing-patterns`, `create-integration-test`) — é onde a perspectiva de cenários de falha entra na autoria, não só no consumo.

**PS e DM quase não entram no ciclo de skills técnicas.** O PS aparece como co-autor de `rag-prompt-assembly` (o system prompt e o comportamento esperado são responsabilidade dele) e como consumidor de `create-adr`. O DM não cria nem consome skills diretamente — seu papel é de processo e cadência, fora desta matriz. Isso é esperado, não uma lacuna a corrigir.

As frequências mais altas (`typescript-conventions`, `error-handling`, `testing-patterns`) indicam **onde vale investir mais tempo de escrita e exemplos**: uma Foundation mal escrita cobra juros em toda task; uma Artifact de baixa frequência pode começar mais enxuta e amadurecer com o uso.