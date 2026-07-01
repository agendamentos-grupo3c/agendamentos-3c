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
  // ClickUp (Slack/WhatsApp são tratados pelo n8n reagindo à lista).
  CLICKUP_API_TOKEN: z.string().optional(),
  CLICKUP_LIST_ID: z.string().optional(),

  // --- Implantação ---
  // Agendas dos implantadores (e-mails). A conta agendamentos@ precisa de acesso
  // de edição a todas (para adicionar convidados aos eventos de treinamento).
  CALENDAR_GABRIELLE_ID: z.string().optional(),
  CALENDAR_BRYAN_ID: z.string().optional(),
  CALENDAR_WAGNER_ID: z.string().optional(),
  // Webhook do n8n da implantação (legado): a implantação migra para o HubSpot;
  // mantido apenas como fallback durante a transição.
  N8N_IMPLANTACAO_WEBHOOK: z.string().url().optional(),
  // Webhook do n8n da integração (kickoff). Hoje o n8n é acionado pelo webhook do
  // ClickUp; esta var separa o endpoint de integração do de implantação.
  N8N_INTEGRACAO_WEBHOOK: z.string().url().optional(),
  // Webhook do n8n que gera a proposta no ClickSign + boleto a partir do
  // orçamento de integração (e move o ClickUp/Slack do lado do n8n).
  N8N_CLICKSIGN_WEBHOOK: z.string().url().optional(),
  // Chave máquina-a-máquina: o n8n usa no header X-Api-Key para chamar
  // POST /integracao/atribuir (distribuição Alana/Guilherme). Sem ela, a rota 401.
  INTEGRACAO_API_KEY: z.string().min(16).optional(),
  // HubSpot (implantação): Private App token usado para criar a meeting e
  // atualizar suas observações. Exigido quando a Fase A do HubSpot entrar.
  HUBSPOT_TOKEN: z.string().optional(),
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
