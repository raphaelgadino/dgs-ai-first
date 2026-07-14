import { z } from 'zod';
import { pino } from 'pino';
import {
  AssistantResponseSchema,
  AssistantResponse,
  isValidSourceDocument,
  canonicalSourceDocument,
  VALID_SOURCE_DOCUMENTS,
} from './response-schema';

/**
 * Response Validator — Harness de Validação Determinística
 *
 * Responsabilidades:
 * 1. Validar a resposta do modelo contra o schema Zod (structured output)
 * 2. Aplicar guardrails determinísticos de produto
 * 3. Retornar resposta segura em caso de violação
 * 4. Registrar tudo em logs (audit trail)
 *
 * CORREÇÕES aplicadas no code review:
 * - Guardrail 3 agora normaliza acentos e usa regex com stems/plural
 *   ("cargas perigosas", "devolucao" sem acento, "produto perigoso" etc.)
 * - Padrões de negação enfraquecidos removidos ("exceção", "gestão de riscos",
 *   "procedimento especial" NÃO contam mais como negativa — permitiam bypass
 *   afirmativo). Fail-closed: na dúvida, bloqueia.
 * - Snapshot de log usa JSON.stringify (antes: "[object Object]").
 * - error.issues (canônico) em vez de error.errors.
 * - pino-pretty apenas fora de produção.
 */

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  // CORREÇÃO #6: pretty-print só em dev; em produção, JSON puro (estruturado)
  ...(process.env.NODE_ENV !== 'production'
    ? {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
          },
        },
      }
    : {}),
});

export interface ValidationResult {
  isValid: boolean;
  response: AssistantResponse;
  violations: string[];
  reason?: string;
}

const SAFE_FALLBACK_RESPONSE: AssistantResponse = {
  answer:
    'Desculpe, ocorreu um erro ao processar sua pergunta. Nosso sistema de qualidade rejeitou a resposta gerada. Por favor, reformule sua pergunta ou contate o supervisor.',
  source_document: '-',
  confidence_score: 'low',
};

/**
 * Normalização de texto para matching determinístico:
 * lowercase + remoção de diacríticos (NFD).
 * "Devolução" -> "devolucao", "INFLAMÁVEL" -> "inflamavel".
 * Sem isso, qualquer resposta escrita sem acento escapava do guardrail 3.
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Serialização segura para snapshot de auditoria.
 * CORREÇÃO #4: String({}) produz "[object Object]" — o audit trail não
 * registrava nada útil. Truncamento em 200 chars mantido (limita PII em log).
 */
function safeSnapshot(value: unknown, maxLength = 200): string {
  try {
    return JSON.stringify(value)?.substring(0, maxLength) ?? 'undefined';
  } catch {
    return '[unserializable]';
  }
}

/**
 * GUARDRAIL 1: Validação de Schema Zod
 */
function validateSchemaStructure(response: unknown): {
  isValid: boolean;
  errors: string[];
  parsed?: AssistantResponse;
} {
  const result = AssistantResponseSchema.safeParse(response);
  if (result.success) {
    return { isValid: true, errors: [], parsed: result.data };
  }
  // CORREÇÃO #6: .issues é o campo canônico (compatível Zod 3 e 4)
  const errors = result.error.issues.map(
    (e) => `Campo ${e.path.join('.') || '(raiz)'}: ${e.message}`
  );
  return { isValid: false, errors };
}

/**
 * GUARDRAIL 2: Validação de Referência de Documento
 * Exceção: "-" é permitido quando confidence_score é "low".
 */
function validateSourceDocument(response: AssistantResponse): {
  isValid: boolean;
  reason?: string;
} {
  const { source_document, confidence_score } = response;

  if (source_document.trim() === '-' && confidence_score === 'low') {
    return { isValid: true };
  }

  if (!isValidSourceDocument(source_document)) {
    return {
      isValid: false,
      reason: `Documento '${source_document}' não está na lista de fontes válidas. Documentos aceitos: ${VALID_SOURCE_DOCUMENTS.join(
        ', '
      )}. Esta resposta foi rejeitada por possível alucinação de fonte.`,
    };
  }

  return { isValid: true };
}

/**
 * GUARDRAIL 3: Regra de Negócio — Cargas Perigosas e Devolução
 *
 * Fundamento: POL-001 seção 3.2 — cargas perigosas (classes 1-6) NÃO são
 * elegíveis para devolução.
 *
 * CORREÇÃO #2 — cobertura de variações:
 * - Regex com plural opcional: /cargas? perigosas?/ pega "cargas perigosas"
 *   (antes, includes('carga perigosa') falhava no plural: o "s" quebra o match).
 * - Texto normalizado sem acentos: "devolucao", "toxico", "inflamavel" agora
 *   são detectados.
 * - Sinônimos: produto/material/mercadoria perigoso(a).
 * - \bclasse\s*[1-6]\b evita falso match em "classe 10" ou "classes 16".
 *
 * CORREÇÃO #3 — negação estrita (fail-closed):
 * Removidos os padrões que NÃO negam nada: "exceção", "gestão de riscos",
 * "procedimento especial". Com eles, a resposta "Sim, cargas perigosas podem
 * ser devolvidas — é uma exceção tratada pela gestão de riscos" PASSAVA,
 * afirmando exatamente o oposto da política. O custo de removê-los é mais
 * falso positivo (resposta correta bloqueada → fallback), que é o modo de
 * falha aceitável num guardrail de segurança. O modo de falha inaceitável é
 * orientar o atendente a devolver carga perigosa.
 *
 * LIMITAÇÃO CONHECIDA (documentar, não esconder): matching lexical não entende
 * escopo da negação. "Não há impedimento para devolver carga perigosa" contém
 * "nao ha impedimento"... que não está na lista e seria bloqueada (ok,
 * fail-closed), mas frases adversariais com "não pode" fora de contexto ainda
 * podem passar. Para produção, a evolução é um verificador semântico
 * (LLM-as-judge) ATRÁS deste guardrail lexical, nunca no lugar dele.
 */
function validateDangerousGoodsRule(response: AssistantResponse): {
  isValid: boolean;
  reason?: string;
} {
  const answer = normalizeText(response.answer);

  const dangerousGoodsPatterns: RegExp[] = [
    /cargas?\s+perigosas?/,
    /produtos?\s+perigosos?/,
    /materia(l|is)\s+perigosos?/,
    /mercadorias?\s+perigosas?/,
    /cargas?\s+classe/,
    /\bclasse\s*[1-6]\b/,
    /explosiv/,
    /inflamav/,
    /\btoxic/,
    /corrosiv/,
    /radioativ/,
    /\bantt\b/,
  ];

  const returnPatterns: RegExp[] = [/devolu/, /devolv/, /retorn/];

  const mentionsDangerousGoods = dangerousGoodsPatterns.some((p) => p.test(answer));
  const mentionsReturn = returnPatterns.some((p) => p.test(answer));

  if (!mentionsDangerousGoods || !mentionsReturn) {
    // Guardrail não se aplica — a resposta não fala de ambos os tópicos
    return { isValid: true };
  }

  // Ambos os tópicos presentes: exigir negativa EXPLÍCITA de elegibilidade.
  // (Padrões já normalizados: sem acento, lowercase.)
  const negationPatterns: RegExp[] = [
    /nao\s+(e|sao|serao?|esta[oa]?)?\s*elegive(l|is)/,
    /nao\s+pode(m|ra|rao)?\b/,
    /nao\s+e\s+possivel/,
    /nao\s+e\s+permitid[oa]/,
    /nao\s+sao\s+permitid[oa]s/,
    /nao\s+deve(m|ra|rao)?\b/,
    /nao\s+se\s+aplica/,
    /impossivel/,
    /proibid[oa]s?/,
    /vedad[oa]s?/,
    /exclud?id[oa]s?\s+d[ao]\s+(processo|politica|devolucao)/,
  ];

  const hasNegation = negationPatterns.some((p) => p.test(answer));

  if (!hasNegation) {
    return {
      isValid: false,
      reason:
        'Guardrail violado: Resposta menciona carga perigosa + devolução mas não contém negativa explícita de elegibilidade. ' +
        'Conforme POL-001 seção 3.2, cargas perigosas NÃO são elegíveis para devolução. ' +
        'A resposta foi bloqueada para evitar orientação incorreta ao atendente.',
    };
  }

  return { isValid: true };
}

/**
 * Validador Principal — orquestração dos 3 guardrails + fallback seguro.
 * (Mantido async para compatibilidade com o call-site em Azure Functions,
 * embora hoje nada seja awaited — futuro LLM-as-judge será assíncrono.)
 */
export async function validateResponse(
  response: unknown,
  queryId?: string
): Promise<ValidationResult> {
  const logContext = { queryId: queryId || 'unknown-query' };

  // --- GUARDRAIL 1: Schema Validation ---
  const schemaValidation = validateSchemaStructure(response);
  if (!schemaValidation.isValid) {
    const reason = `Schema validation failed: ${schemaValidation.errors.join('; ')}`;
    logger.warn(
      {
        ...logContext,
        violations: schemaValidation.errors,
        responseSnapshot: safeSnapshot(response),
      },
      reason
    );
    return {
      isValid: false,
      response: SAFE_FALLBACK_RESPONSE,
      violations: schemaValidation.errors,
      reason,
    };
  }

  const parsedResponse = schemaValidation.parsed as AssistantResponse;
  const violations: string[] = [];

  // --- GUARDRAIL 2: Document Reference Validation ---
  const docValidation = validateSourceDocument(parsedResponse);
  if (!docValidation.isValid) {
    violations.push(docValidation.reason || 'Invalid source document');
    logger.warn(
      {
        ...logContext,
        violations,
        // Snapshot truncado: campo vem do modelo e pode conter conteúdo arbitrário
        sourceDocument: safeSnapshot(parsedResponse.source_document, 100),
      },
      'Document reference validation failed'
    );
    return {
      isValid: false,
      response: SAFE_FALLBACK_RESPONSE,
      violations,
      reason: docValidation.reason,
    };
  }

  // --- GUARDRAIL 3: Business Rule (Dangerous Goods + Returns) ---
  const ruleValidation = validateDangerousGoodsRule(parsedResponse);
  if (!ruleValidation.isValid) {
    violations.push(ruleValidation.reason || 'Business rule violation');
    logger.warn(
      {
        ...logContext,
        violations,
        sourceDocument: parsedResponse.source_document,
        answerLength: parsedResponse.answer.length,
      },
      'Business rule validation failed: dangerous goods + return rule'
    );
    return {
      isValid: false,
      response: SAFE_FALLBACK_RESPONSE,
      violations,
      reason: ruleValidation.reason,
    };
  }

  // --- ALL VALIDATIONS PASSED ---
  const canonical = canonicalSourceDocument(parsedResponse.source_document);
  logger.info(
    {
      ...logContext,
      sourceDocument: canonical ?? parsedResponse.source_document,
      confidence: parsedResponse.confidence_score,
    },
    'Response validation passed'
  );

  return {
    isValid: true,
    response: parsedResponse,
    violations: [],
  };
}

/**
 * Wrapper para uso em Azure Functions.
 */
export async function validateAndNormalizeResponse(
  responseJson: unknown,
  queryId?: string
): Promise<AssistantResponse> {
  const result = await validateResponse(responseJson, queryId);
  return result.response;
}
