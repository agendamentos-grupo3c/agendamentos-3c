// Mapeia códigos de erro de login (vindos do backend via ?error=) para mensagens
// claras em pt-BR. Códigos desconhecidos caem na mensagem genérica.
const MESSAGES: Record<string, string> = {
  AUTH_DOMAIN_FORBIDDEN: 'Acesso restrito a colaboradores Grupo 3C.',
  AUTH_NOT_ALLOWLISTED: 'Acesso restrito a colaboradores Grupo 3C.',
  AUTH_EMAIL_NOT_VERIFIED: 'Seu e-mail Google não está verificado.',
  AUTH_NOT_CONFIGURED: 'Login indisponível no momento. Tente novamente mais tarde.',
};

const GENERIC = 'Não foi possível concluir o login. Tente novamente.';

export function loginErrorMessage(code: string | undefined): string | null {
  if (!code) return null;
  return MESSAGES[code] ?? GENERIC;
}
