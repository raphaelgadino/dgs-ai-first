import { z } from 'zod';

/**
 * Schema Zod para Structured Output do Assistente NovaTech
 *
 * Define o formato obrigatório que todas as respostas do LLM devem seguir.
 * Respostas que não correspondem a este schema são rejeitadas antes de
 * serem enviadas ao atendente.
 *
 * CORREÇÕES aplicadas no code review:
 * - .strict(): campos extras agora são REJEITADOS, não removidos silenciosamente.
 *   (O default do z.object() faz strip de chaves desconhecidas, o que viola
 *   o princípio de contrato auditável: nada deve passar sem ser visto.)
 * - source_document é normalizado (trim) antes da validação downstream.
 */

export const AssistantResponseSchema = z
  .object({
    /**
     * answer: A resposta em linguagem natural para a pergunta do atendente.
     * Campo obrigatório. Deve ser conciso e basear-se unicamente nos chunks recuperados.
     */
    answer: z
      .string()
      .trim()
      .min(10, 'Resposta muito curta — mínimo 10 caracteres')
      .max(2000, 'Resposta muito longa — máximo 2000 caracteres')
      .describe('Resposta estruturada em português para a pergunta do atendente'),

    /**
     * source_document: Identificador do documento de origem da resposta.
     * Campo OBRIGATÓRIO e NUNCA deve estar vazio ou ser null.
     * Deve ser um dos identificadores válidos da NovaTech (ver VALID_SOURCE_DOCUMENTS).
     * Se a resposta não puder ser fundamentada em um documento, usar "-" e
     * marcar confidence_score como "low".
     */
    source_document: z
      .string()
      .trim()
      .min(1, 'Fonte não pode estar vazia')
      .describe(
        'Identificador do documento que fundamenta a resposta (ex: POL-001, PROC-042, SLA-2024)'
      ),

    /**
     * confidence_score: Nível de confiança da resposta.
     * "high": resposta é direta no documento, sem interpretação
     * "medium": resposta requer pequena interpretação ou síntese de múltiplos chunks
     * "low": resposta é parcial, incompleta, ou o documento é desatualizado
     */
    confidence_score: z
      .enum(['high', 'medium', 'low'])
      .describe('Confiança na resposta: high, medium, ou low'),
  })
  .strict(); // CORREÇÃO #1: rejeita campos não previstos no contrato

export type AssistantResponse = z.infer<typeof AssistantResponseSchema>;

/**
 * Lista de documentos válidos da NovaTech
 * Usada para validação do campo source_document
 */
export const VALID_SOURCE_DOCUMENTS = [
  'POL-001',
  'PROC-042',
  'PROC-042-v2',
  'SLA-2024',
  'FAQ-Atendimento',
] as const;

export type ValidSourceDocument = (typeof VALID_SOURCE_DOCUMENTS)[number];

/**
 * Verifica se um source_document é válido.
 *
 * CORREÇÃO #5: comparação agora é case-insensitive e tolerante a espaços.
 * "pol-001" ou "POL-001 " eram rejeitados antes (falso positivo → fallback
 * desnecessário). A normalização não abre brecha: o conjunto aceito continua
 * sendo exatamente a allowlist.
 */
export const isValidSourceDocument = (doc: string): doc is ValidSourceDocument => {
  const normalized = doc.trim().toLowerCase();
  return VALID_SOURCE_DOCUMENTS.some((valid) => valid.toLowerCase() === normalized);
};

/**
 * Retorna a forma canônica do documento (ex: "pol-001" -> "POL-001"),
 * ou null se não for válido. Útil para gravar sempre o ID canônico no log.
 */
export const canonicalSourceDocument = (doc: string): ValidSourceDocument | null => {
  const normalized = doc.trim().toLowerCase();
  return (
    VALID_SOURCE_DOCUMENTS.find((valid) => valid.toLowerCase() === normalized) ?? null
  );
};
