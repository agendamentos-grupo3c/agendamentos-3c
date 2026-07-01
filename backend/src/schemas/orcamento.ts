import { z } from 'zod';

import { FORM } from '../config/constants.js';
import { isValidBrPhone } from '../lib/phone.js';

const onlyDigits = (s: string): string => s.replace(/\D/g, '');

// Valida CNPJ por dígito verificador (mod 11) — não só o comprimento.
function isValidCnpj(raw: string): boolean {
  const c = onlyDigits(raw);
  if (c.length !== 14 || /^(\d)\1{13}$/.test(c)) return false;
  const check = (len: number): number => {
    let sum = 0;
    let pos = len - 7;
    for (let i = 0; i < len; i++) {
      sum += Number(c.charAt(i)) * pos--;
      if (pos < 2) pos = 9;
    }
    const r = sum % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return check(12) === Number(c.charAt(12)) && check(13) === Number(c.charAt(13));
}

// Tetos de sanidade: barram orçamento/boleto absurdo por erro de digitação ou
// abuso (o preço já é recomputado no servidor, isto limita a magnitude).
const escopoSchema = z.object({
  pilares: z.object({
    mailing: z.boolean(),
    qualif: z.boolean(),
    screenpop: z.boolean(),
    click2call: z.boolean(),
  }),
  funis: z.number().int().min(1).max(20),
  qualifs: z.number().int().min(1).max(100),
  sdrs: z.number().int().min(1).max(1000),
  campos: z.number().int().min(0).max(100),
  url: z.boolean(),
});

export const orcamentoSubmitSchema = z
  .object({
    // Contratante (base do ClickSign)
    contratanteNome: z.string().trim().min(1, 'Informe o nome do contratante.').max(FORM.TEXT_MAX),
    contratanteEmail: z.string().trim().toLowerCase().email('E-mail inválido.').max(FORM.TEXT_MAX),
    contratanteTelefone: z.string().trim().refine(isValidBrPhone, 'Telefone inválido.'),
    empresa: z.string().trim().min(1, 'Informe a empresa.').max(FORM.TEXT_MAX),
    cnpj: z.string().trim().refine(isValidCnpj, 'CNPJ inválido (14 dígitos).'),
    idHubspot: z.string().trim().max(FORM.TEXT_MAX).optional(),
    idNegocio: z.string().trim().max(FORM.TEXT_MAX).optional(),
    clienteRef: z.string().trim().max(FORM.TEXT_MAX).optional(),
    // Proposta
    crm: z.string().trim().min(1).max(FORM.TEXT_MAX),
    escopo: escopoSchema,
    // Desconto: % ou R$. A regra (teto OU cortesia total) é validada no service.
    desconto: z
      .object({ tipo: z.enum(['percentual', 'valor']), valor: z.number().int().min(0).max(1_000_000) })
      .optional(),
    formaPagamento: z.enum(['avista', 'parcelado']),
    parcelas: z.number().int().min(1).max(48).optional(),
    descricao: z.string().trim().max(FORM.SUMMARY_MAX).optional(),
    observacoes: z.string().trim().max(FORM.SUMMARY_MAX).optional(),
  })
  .refine((d) => d.formaPagamento !== 'parcelado' || (d.parcelas ?? 0) >= 2, {
    message: 'Informe o número de parcelas (>= 2).',
    path: ['parcelas'],
  });

export type OrcamentoSubmitInput = z.infer<typeof orcamentoSubmitSchema>;
