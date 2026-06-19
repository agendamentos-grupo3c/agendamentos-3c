// Validação e normalização de telefone brasileiro.
// Aceita fixo (10 dígitos: DDD + 8) e celular (11 dígitos: DDD + 9).

const DDD_MIN = 11;
const DDD_MAX = 99;

export function onlyDigits(value: string): string {
  return value.replace(/\D/g, '');
}

export function isValidBrPhone(raw: string): boolean {
  const digits = onlyDigits(raw);
  if (digits.length !== 10 && digits.length !== 11) return false;

  const ddd = Number(digits.slice(0, 2));
  if (ddd < DDD_MIN || ddd > DDD_MAX) return false;

  const subscriber = digits.slice(2);
  if (digits.length === 11) {
    // Celular: o número começa com 9.
    return subscriber.startsWith('9');
  }
  // Fixo: primeiro dígito entre 2 e 8.
  const first = subscriber.charCodeAt(0);
  return first >= '2'.charCodeAt(0) && first <= '8'.charCodeAt(0);
}

// Normaliza para E.164 (+55DDDNNNNNNNNN) antes de enviar ao WhatsApp.
export function toE164(raw: string): string {
  if (!isValidBrPhone(raw)) {
    throw new Error('Telefone brasileiro inválido.');
  }
  return `+55${onlyDigits(raw)}`;
}
