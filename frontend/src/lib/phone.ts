// Validação e máscara de telefone brasileiro (espelha a lógica do backend).
// Fixo: 10 dígitos (DDD + 8). Celular: 11 dígitos (DDD + 9).

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
    return subscriber.startsWith('9');
  }
  const first = subscriber.charCodeAt(0);
  return first >= '2'.charCodeAt(0) && first <= '8'.charCodeAt(0);
}

// Formata enquanto o usuário digita: "DD NNNNN-NNNN" (cel) ou "DD NNNN-NNNN" (fixo).
export function maskBrPhone(raw: string): string {
  const d = onlyDigits(raw).slice(0, 11);
  if (d.length <= 2) return d;

  const ddd = d.slice(0, 2);
  const rest = d.slice(2);
  if (rest.length <= 4) return `${ddd} ${rest}`;
  if (d.length <= 10) return `${ddd} ${rest.slice(0, 4)}-${rest.slice(4)}`;
  return `${ddd} ${rest.slice(0, 5)}-${rest.slice(5)}`;
}
