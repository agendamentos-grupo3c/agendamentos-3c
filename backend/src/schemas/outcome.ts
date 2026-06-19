import { z } from 'zod';

import { FORM } from '../config/constants.js';

// Campos preenchidos quando o cliente compareceu (seção 7.6).
export const budgetSchema = z.object({
  requiredIntegration: z
    .string()
    .trim()
    .min(1, 'Informe a integração necessária.')
    .max(FORM.SUMMARY_MAX),
  budget: z.coerce.number().positive('Informe um valor de orçamento válido.'),
  productionDeadline: z.string().trim().min(1, 'Informe o prazo de produção.').max(FORM.TEXT_MAX),
});

export type BudgetInput = z.infer<typeof budgetSchema>;
