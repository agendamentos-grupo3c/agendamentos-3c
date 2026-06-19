import { z } from 'zod';

import { SERVER } from './constants.js';

// Validação e tipagem de TODAS as variáveis de ambiente, com falha cedo no boot.
// Segredos de integrações ainda não usados ficam opcionais e serão exigidos
// conforme cada passo do roadmap for implementado.

const isProduction = process.env.NODE_ENV === 'production';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().default(SERVER.DEFAULT_HOST),
  PORT: z.coerce.number().int().positive().default(SERVER.DEFAULT_PORT),
  FRONTEND_ORIGIN: z.string().url().default('http://localhost:3000'),

  // Em produção o segredo de sessão é obrigatório; em dev há um fallback
  // inseguro e explícito, que NUNCA deve ser usado fora de desenvolvimento.
  SESSION_SECRET: isProduction
    ? z.string().min(32)
    : z.string().min(1).default('dev-insecure-session-secret-change-me-please-32+'),

  // Neon (PostgreSQL). DATABASE_URL = endpoint pooled (aplicação);
  // DATABASE_URL_UNPOOLED = conexão direta, usada apenas pelas migrations.
  DATABASE_URL: z.string().url(),
  DATABASE_URL_UNPOOLED: z.string().url().optional(),

  // --- Controle de acesso (Passo 4) ---
  ALLOWED_DOMAIN: z.string().default('grupo-3c.com'),
  ALLOWLIST_EMAILS: z.string().optional(),

  // --- Integrações (Passos 4, 7, 8, 9) — exigidas quando cada passo chegar ---
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REDIRECT_URI: z.string().url().optional(),
  // Refresh token da conta agendamentos@ (escopo Calendar) — leitura/escrita
  // nas agendas compartilhadas da Alana e do Guilherme.
  GOOGLE_CALENDAR_REFRESH_TOKEN: z.string().optional(),
  CALENDAR_ALANA_ID: z.string().optional(),
  CALENDAR_GUILHERME_ID: z.string().optional(),
  SLACK_BOT_TOKEN: z.string().optional(),
  SLACK_CHANNEL_IDS: z.string().optional(),
  DIZPAROS_API_KEY: z.string().optional(),
  CLICKUP_API_TOKEN: z.string().optional(),
  CLICKUP_LIST_ID: z.string().optional(),
});

// Variáveis vazias (`CHAVE=`) são tratadas como não definidas, para que
// defaults e campos opcionais se apliquem como esperado.
const rawEnv = Object.fromEntries(
  Object.entries(process.env).map(([key, value]) => [key, value === '' ? undefined : value]),
);

const parsed = schema.safeParse(rawEnv);

if (!parsed.success) {
  // Mensagem clara com os campos inválidos, SEM expor os valores.
  const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
  throw new Error(`Variáveis de ambiente inválidas: ${issues}`);
}

export const env = {
  ...parsed.data,
  isProduction,
} as const;
