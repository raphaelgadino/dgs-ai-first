import { z } from 'zod';

/**
 * Schema Zod para Structured Output do Assistente NovaTech
 * 
 * Define o formato obrigatório que todas as respostas do LLM devem seguir.
 * O modelo é instruído a responder SEMPRE neste formato JSON.
 * Respostas que não correspondem a este schema são rejeitadas antes de
 * serem enviadas ao atendente.
 */

export const AssistantResponseSchema = z.object(
  {
    /**
     * answer: A resposta em linguagem natural para a pergunta do atendente.
     * Campo obrigatório. Deve ser conciso e basear-se unicamente nos chunks recuperados.
     */
    answer: z
      .string()
      .min(10, 'Resposta muito curta — mínimo 10 caracteres')
      .max(2000, 'Resposta muito longa — máximo 2000 caracteres')
      .describe('Resposta estruturada em português para a pergunta do atendente'),

    /**
     * source_document: Identificador do documento de origem da resposta.
     * Campo OBRIGATÓRIO e NUNCA deve estar vazio ou ser null.
     * Deve ser um dos identificadores válidos da NovaTech: POL-001, PROC-042, PROC-042-v2, SLA-2024, FAQ-Atendimento.
     * Se a resposta não puder ser fundamentada em um documento, usar "-" e marcar confidence_score como "low".
     */
    source_document: z
      .string()
      .min(1, 'Fonte não pode estar vazia')
      .describe('Identificador do documento que fundamenta a resposta (ex: POL-001, PROC-042, SLA-2024)'),

    /**
     * confidence_score: Nível de confiança da resposta.
     * Campo obrigatório. Valores permitidos: "high", "medium", "low".
     * "high": resposta é direta no documento, sem interpretação
     * "medium": resposta requer pequena interpretação ou síntese de múltiplos chunks
     * "low": resposta é parcial, incompleta, ou o documento é desatualizado
     */
    confidence_score: z
      .enum(['high', 'medium', 'low'])
      .describe('Confiança na resposta: high, medium, ou low'),
  },
  {
    description: 'Formato de resposta estruturada do assistente NovaTech',
  }
);

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

export type ValidSourceDocument = typeof VALID_SOURCE_DOCUMENTS[number];

/**
 * Verifica se um source_document é válido
 */
export const isValidSourceDocument = (doc: string): doc is ValidSourceDocument => {
  return VALID_SOURCE_DOCUMENTS.includes(doc as ValidSourceDocument);
};
