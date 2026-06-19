// Constantes de configuração — sem números/strings mágicos espalhados pelo código.

export const SERVER = {
  DEFAULT_PORT: 3333,
  DEFAULT_HOST: '0.0.0.0',
} as const;

// Rate limit global. Login e submit terão limites mais agressivos por rota
// (Passos 4 e 8).
export const RATE_LIMIT = {
  GLOBAL_MAX: 100,
  GLOBAL_WINDOW: '1 minute',
} as const;

export const CORS = {
  ALLOWED_METHODS: ['GET', 'POST', 'PATCH', 'OPTIONS'],
  // Idempotency-Key (Passo 8) e X-CSRF-Token (Passo 4) já liberados aqui.
  ALLOWED_HEADERS: ['Content-Type', 'Idempotency-Key', 'X-CSRF-Token'],
} as const;

export const DB = {
  POOL_MAX: 10,
  IDLE_TIMEOUT_MS: 30_000,
  CONNECT_TIMEOUT_MS: 10_000,
} as const;

// Colaboradores do time de integrações (coluna da agenda / dono do card).
export const COLLABORATORS = ['alana', 'guilherme'] as const;

// Estados do card (máquina de estados — seção 7.8 do documento mestre).
export const CARD_STATUSES = ['kickoff', 'compareceu', 'no_show', 'orcamento_enviado'] as const;

export type CardStatus = (typeof CARD_STATUSES)[number];

// Rótulos pt-BR por status (Slack/ClickUp). Ajuste os nomes do ClickUp para
// casarem com os status configurados na lista, se necessário.
export const STATUS_LABELS: Record<CardStatus, string> = {
  kickoff: 'Kickoff',
  compareceu: 'Compareceu',
  no_show: 'No-show',
  orcamento_enviado: 'Orçamento enviado',
};

export const AUTH = {
  SESSION_COOKIE: '3c_session',
  SESSION_TTL_SECONDS: 60 * 60 * 12, // 12h
  // Cookies de transação OAuth (curta duração, só durante o login).
  STATE_COOKIE: 'oauth_state',
  NONCE_COOKIE: 'oauth_nonce',
  VERIFIER_COOKIE: 'oauth_verifier',
  OAUTH_TX_TTL_SECONDS: 60 * 10, // 10 min para concluir o login
  SCOPES: ['openid', 'email', 'profile'],
  // Caminho no front para onde redirecionar falhas de login (com ?error=).
  FRONTEND_LOGIN_PATH: '/login',
} as const;

export const GOOGLE = {
  AUTH_ENDPOINT: 'https://accounts.google.com/o/oauth2/v2/auth',
  TOKEN_ENDPOINT: 'https://oauth2.googleapis.com/token',
  JWKS_URI: 'https://www.googleapis.com/oauth2/v3/certs',
  ISSUERS: ['https://accounts.google.com', 'accounts.google.com'],
} as const;

// Limites dos campos do formulário (seção 7.2).
export const FORM = {
  TEXT_MAX: 200,
  SUMMARY_MAX: 5000,
} as const;

// Agendamento (seção 7.4). Slots fixos por colaborador; Alana de manhã,
// Guilherme à tarde. Horários em America/Sao_Paulo. Tudo configurável aqui.
export const SCHEDULING = {
  TIMEZONE: 'America/Sao_Paulo',
  DAYS_AHEAD: 3,
  MIN_LEAD_MINUTES: 0,
  INCLUDE_WEEKENDS: false,
  SLOTS: {
    alana: [
      ['09:15', '09:45'],
      ['10:00', '10:30'],
      ['10:45', '11:15'],
      ['11:30', '12:00'],
    ],
    guilherme: [
      ['14:00', '14:30'],
      ['15:30', '16:00'],
      ['16:15', '16:45'],
      ['17:00', '17:30'],
    ],
  },
} as const;
