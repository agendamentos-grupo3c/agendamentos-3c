import { z } from 'zod';

import { isValidBrPhone } from '@/lib/phone';

// Espelha o schema do backend (backend/src/schemas/clientForm.ts).
const TEXT_MAX = 200;
const SUMMARY_MAX = 5000;

export const clientFormSchema = z.object({
  companyName: z.string().trim().min(1, 'Informe o nome da empresa.').max(TEXT_MAX),
  clientName: z.string().trim().min(1, 'Informe o nome do cliente.').max(TEXT_MAX),
  integrationSummary: z
    .string()
    .trim()
    .min(1, 'Descreva o que precisam com a integração.')
    .max(SUMMARY_MAX),
  crmName: z.string().trim().min(1, 'Informe o nome do CRM.').max(TEXT_MAX),
  clientEmail: z
    .string()
    .trim()
    .toLowerCase()
    .email('E-mail do cliente inválido.')
    .max(TEXT_MAX),
  clientId: z.string().trim().min(1, 'Informe o ID do cliente.').max(TEXT_MAX),
  phone: z.string().trim().refine(isValidBrPhone, 'Telefone inválido. Informe DDD + número.'),
  // O backend ainda distingue automação/integração; como o formulário unificou
  // em "Integrações/Automações", enviamos um valor fixo (sem expor a escolha).
  demandType: z.enum(['automacao', 'integracao']).default('integracao'),
});

export type ClientFormValues = z.infer<typeof clientFormSchema>;
