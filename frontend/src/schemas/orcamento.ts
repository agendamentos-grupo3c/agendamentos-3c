import { z } from 'zod';

import { isValidBrPhone } from '@/lib/phone';

const cnpjDigits = (s: string): string => s.replace(/\D/g, '');

// Valida CNPJ por dígito verificador (mod 11), espelhando o backend.
function isValidCnpj(raw: string): boolean {
  const c = cnpjDigits(raw);
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

export const contratanteSchema = z
  .object({
    contratanteNome: z.string().trim().min(1, 'Informe o nome do contratante.'),
    contratanteEmail: z.string().trim().email('E-mail inválido.'),
    contratanteTelefone: z.string().trim().refine(isValidBrPhone, 'Telefone inválido.'),
    empresa: z.string().trim().min(1, 'Informe a empresa.'),
    cnpj: z.string().trim().refine(isValidCnpj, 'CNPJ inválido.'),
    idHubspot: z.string().trim().optional(),
    idNegocio: z.string().trim().optional(),
    formaPagamento: z.enum(['avista', 'parcelado']),
    parcelas: z.coerce.number().int().min(2, 'Mínimo 2 parcelas.').max(48).optional(),
    observacoes: z.string().trim().optional(),
  })
  .refine((d) => d.formaPagamento !== 'parcelado' || (d.parcelas ?? 0) >= 2, {
    message: 'Informe o número de parcelas (≥ 2).',
    path: ['parcelas'],
  });

export type ContratanteValues = z.infer<typeof contratanteSchema>;
