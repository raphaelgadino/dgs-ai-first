import { z } from 'zod';
import { pino } from 'pino';
import {
  AssistantResponseSchema,
  AssistantResponse,
  isValidSourceDocument,
  ValidSourceDocument,
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
 * IMPORTANTE: Este é código determinístico, complementar ao prompt probabilístico.
 * O prompt instrui o modelo; este validador REJEITA respostas que não seguem as regras.
 */

// Logger para auditoria
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname',
    },
  },
});

/**
 * Resultado da validação
 */
export interface ValidationResult {
  isValid: boolean;
  response: AssistantResponse;
  violations: string[];
  reason?: string; // Motivo da rejeição (se isValid=false)
}

/**
 * Resposta padrão segura quando validação falha
 */
const SAFE_FALLBACK_RESPONSE: AssistantResponse = {
  answer:
    'Desculpe, ocorreu um erro ao processar sua pergunta. Nosso sistema de qualidade rejeitou a resposta gerada. Por favor, reformule sua pergunta ou contate o supervisor.',
  source_document: '-',
  confidence_score: 'low',
};

/**
 * GUARDRAIL 1: Validação de Schema Zod
 * Verifica se a resposta está no formato correto e todos os campos obrigatórios estão presentes.
 * Rejeita se:
 * - source_document está vazio, null, ou undefined
 * - answer está ausente ou muito curto
 * - confidence_score tem valor inválido
 */
function validateSchemaStructure(response: unknown): {
  isValid: boolean;
  errors: string[];
  parsed?: AssistantResponse;
} {
  try {
    const parsed = AssistantResponseSchema.parse(response);
    return { isValid: true, errors: [], parsed };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors = error.errors.map(
        (e) => `Campo ${e.path.join('.')}: ${e.message}`
      );
      return { isValid: false, errors };
    }
    return {
      isValid: false,
      errors: ['Erro ao validar resposta contra schema'],
    };
  }
}

/**
 * GUARDRAIL 2: Validação de Referência de Documento
 * Verifica se o source_document citado é um dos documentos válidos da NovaTech.
 * Rejeita se a fonte é fictícia ou desconhecida (proteção contra alucinação de fonte).
 * 
 * Exceção: "-" é permitido quando confidence_score é "low" (resposta não encontrada).
 */
function validateSourceDocument(response: AssistantResponse): {
  isValid: boolean;
  reason?: string;
} {
  const { source_document, confidence_score } = response;

  // Caso especial: "-" é permitido para respostas de baixa confiança
  if (source_document === '-' && confidence_score === 'low') {
    return { isValid: true };
  }

  // Validar se é um documento conhecido
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
 * GUARDRAIL 3: Validação de Regras de Negócio — Cargas Perigosas e Devolução
 * 
 * Regra: Respostas que mencionam AMBOS "carga perigosa" E "devolução" devem CONTER
 * a negativa explícita (ex: "não pode", "não é possível", "não são elegíveis").
 * 
 * Fundamento: POL-001 seção 3.2 — cargas perigosas (classes 1-6) NÃO são elegíveis
 * para devolução. Uma resposta que afirme o contrário viola a política.
 * 
 * Rejeita se:
 * - Menciona "carga perigosa" e "devolução" (case-insensitive)
 * - Mas NÃO menciona negativa ("não", "não é", "não pode", "não são elegíveis", etc)
 * 
 * Nota: Este guardrail é ESPECÍFICO e pode parecer restritivo. É intencional.
 * Protege contra a falha mais crítica: dizer ao atendente que pode devolver carga perigosa.
 */
function validateDangerousGoodsRule(response: AssistantResponse): {
  isValid: boolean;
  reason?: string;
} {
  const answer = response.answer.toLowerCase();

  // Verificar se menciona AMBOS "carga perigosa" e "devolução"
  const mentionsDangerousGoods =
    answer.includes('carga perigosa') ||
    answer.includes('carga classe') ||
    answer.includes('explosivo') ||
    answer.includes('inflamável') ||
    answer.includes('tóxico') ||
    answer.includes('classe 1') ||
    answer.includes('classe 2') ||
    answer.includes('classe 3') ||
    answer.includes('classe 4') ||
    answer.includes('classe 5') ||
    answer.includes('classe 6') ||
    answer.includes('antt');

  const mentionsReturn =
    answer.includes('devolução') ||
    answer.includes('devolver') ||
    answer.includes('retorn');

  if (!mentionsDangerousGoods || !mentionsReturn) {
    // Guardrail não se aplica — a resposta não fala de ambos os tópicos
    return { isValid: true };
  }

  // Ambos os tópicos foram mencionados. Verificar se há negativa.
  const negationPatterns = [
    'não pode',
    'não são elegíveis',
    'não é possível',
    'não é permitido',
    'impossível',
    'não devem',
    'não é permitida',
    'proibido',
    'exceção',
    'excluída',
    'exclud',
    'gestão de riscos',
    'procedimento especial',
    'não pelo processo padrão',
    'não pelo procedimento padrão',
  ];

  const hasNegation = negationPatterns.some((pattern) =>
    answer.includes(pattern)
  );

  if (!hasNegation) {
    return {
      isValid: false,
      reason:
        'Guardrail violado: Resposta menciona carga perigosa + devolução mas não contém negativa clara. ' +
        'Conforme POL-001 seção 3.2, cargas perigosas NÃO são elegíveis para devolução. ' +
        'A resposta foi bloqueada para evitar orientação incorreta ao atendente.',
    };
  }

  return { isValid: true };
}

/**
 * Validador Principal
 * 
 * Orquestração dos 3 guardrails + retorno de resposta segura.
 * 
 * Fluxo:
 * 1. Validar schema (formato)
 * 2. Validar referência de documento
 * 3. Validar regra de negócio (cargas perigosas)
 * 4. Se tudo passou: retornar resposta validada
 * 5. Se falhou: logar violação, retornar resposta segura
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
        responseSnapshot: String(response).substring(0, 200),
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
        sourceDocument: parsedResponse.source_document,
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

  // --- GUARDRAIL 3: Business Rule Validation (Dangerous Goods + Returns) ---
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
  logger.info(
    {
      ...logContext,
      sourceDocument: parsedResponse.source_document,
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
 * Wrapper para o uso em Azure Functions
 * Recebe raw JSON (pode conter erro de parsing), valida e retorna
 * AssistantResponse garantida ou fallback seguro.
 */
export async function validateAndNormalizeResponse(
  responseJson: unknown,
  queryId?: string
): Promise<AssistantResponse> {
  const result = await validateResponse(responseJson, queryId);
  return result.response;
}
