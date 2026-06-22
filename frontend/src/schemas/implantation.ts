import { z } from 'zod';

import { isValidBrPhone } from '@/lib/phone';

// Espelha backend/src/schemas/implantation.ts (entrada manual do lead).
const TEXT_MAX = 200;

export const implantationFormSchema = z.object({
  companyName: z.string().trim().min(1, 'Informe o nome da empresa.').max(TEXT_MAX),
  clientName: z.string().trim().min(1, 'Informe o nome do cliente.').max(TEXT_MAX),
  clientEmail: z.string().trim().toLowerCase().email('E-mail do cliente inválido.').max(TEXT_MAX),
  clientId: z.string().trim().min(1, 'Informe o ID do cliente.').max(TEXT_MAX),
  phone: z.string().trim().refine(isValidBrPhone, 'Telefone inválido. Informe DDD + número.'),
  segment: z.enum(['enterprise', 'middle', 'small', 'evolux']),
});

export type ImplantationFormValues = z.infer<typeof implantationFormSchema>;
