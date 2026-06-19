import { z } from 'zod';

import { FORM } from '../config/constants.js';
import { isValidBrPhone } from '../lib/phone.js';

// Schema compartilhado dos dados do cliente (seção 7.2). O front espelha este
// schema; o telefone é validado nas duas pontas e normalizado para E.164 só no
// backend, na hora de enviar ao WhatsApp (Passo 8).
export const clientFormSchema = z.object({
  companyName: z.string().trim().min(1, 'Informe o nome da empresa.').max(FORM.TEXT_MAX),
  clientName: z.string().trim().min(1, 'Informe o nome do cliente.').max(FORM.TEXT_MAX),
  integrationSummary: z
    .string()
    .trim()
    .min(1, 'Descreva o que precisam com a integração.')
    .max(FORM.SUMMARY_MAX),
  crmName: z.string().trim().min(1, 'Informe o nome do CRM.').max(FORM.TEXT_MAX),
  clientEmail: z.string().trim().toLowerCase().email('E-mail do cliente inválido.').max(FORM.TEXT_MAX),
  phone: z.string().trim().refine(isValidBrPhone, 'Telefone inválido. Informe DDD + número.'),
});

export type ClientFormInput = z.infer<typeof clientFormSchema>;

// Payload do submit (Passo 8): dados do formulário + token opaco do slot.
export const submitSchema = clientFormSchema.extend({
  slotToken: z.string().min(1),
});

export type SubmitInput = z.infer<typeof submitSchema>;
