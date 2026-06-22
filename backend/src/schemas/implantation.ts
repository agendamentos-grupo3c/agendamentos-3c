import { z } from 'zod';

import { FORM, SEGMENTS } from '../config/constants.js';
import { isValidBrPhone } from '../lib/phone.js';

// Dados do lead de implantação (entrada manual; HubSpot fica para depois).
export const implantationFormSchema = z.object({
  companyName: z.string().trim().min(1, 'Informe o nome da empresa.').max(FORM.TEXT_MAX),
  clientName: z.string().trim().min(1, 'Informe o nome do cliente.').max(FORM.TEXT_MAX),
  clientEmail: z.string().trim().toLowerCase().email('E-mail do cliente inválido.').max(FORM.TEXT_MAX),
  phone: z.string().trim().refine(isValidBrPhone, 'Telefone inválido. Informe DDD + número.'),
  segment: z.enum(SEGMENTS),
});

export const implantationSubmitSchema = implantationFormSchema.extend({
  slotToken: z.string().min(1),
});

// Observações da reunião (preenchidas ao marcar "compareceu").
export const implantationAttendedSchema = z.object({
  notes: z.string().trim().max(FORM.SUMMARY_MAX).optional(),
});

export type ImplantationSubmitInput = z.infer<typeof implantationSubmitSchema>;
export type ImplantationAttendedInput = z.infer<typeof implantationAttendedSchema>;
