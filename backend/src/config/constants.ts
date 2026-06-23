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
  ALLOWED_METHODS: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
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

// Rótulos pt-BR por status (uso interno/UI).
export const STATUS_LABELS: Record<CardStatus, string> = {
  kickoff: 'Kickoff',
  compareceu: 'Compareceu',
  no_show: 'No-show',
  orcamento_enviado: 'Orçamento enviado',
};

// Tipo de demanda (seletor do formulário → custom field do ClickUp).
export const DEMAND_TYPES = ['automacao', 'integracao'] as const;
export type DemandType = (typeof DEMAND_TYPES)[number];

// Integração ClickUp (funil automações/integrações). Lista vem de CLICKUP_LIST_ID.
// Nossos status → status da lista; null = sem reflexo no ClickUp.
export const CLICKUP_STATUS: Record<CardStatus, string | null> = {
  kickoff: 'kickoff',
  compareceu: null,
  no_show: 'no show',
  orcamento_enviado: 'orçamento enviado',
};

// Status da lista do ClickUp ao excluir um agendamento (deve casar EXATAMENTE
// com o nome da etapa "cancelado" na lista).
export const CLICKUP_CANCELED_STATUS = 'cancelado';

export const CLICKUP = {
  FIELDS: {
    companyName: '8aaeec62-53f9-4462-b3c4-ccfe9014c459',
    clientName: 'ecf03b49-61a9-426d-998c-417167b6c85b',
    phone: 'df7b081a-1a7d-4cfc-a11a-93b2a324ee23',
    description: 'e40d9541-62e1-4d43-961a-78765b5ec620',
    requesterEmail: '9c8355ce-abef-4c36-8e07-366f4023218e',
    requesterName: '24a69984-522d-42cd-a7c7-4d8db779e943',
    clientId: 'd97ccd9f-fec4-4df9-b187-84cc75ad84af',
    budget: '44e502fd-4f2b-4c1e-9bf4-7e919b7e33c0',
    demandType: '02137d9f-3d47-4fa0-a673-eb6b87b39007',
  },
  DEMAND_TYPE_OPTION: {
    automacao: 'c6456e35-cd31-4911-8c2c-6925ca1e4879',
    integracao: '06b27c32-3a29-4f51-8d68-77f2f374bc0a',
  },
  // ID de usuário no ClickUp de cada integrador, usado como "responsável"
  // (assignee) da task. Trocado quando o card é reagendado para o outro.
  INTEGRATOR_USER_ID: {
    alana: 230612467,
    guilherme: 302428138,
  },
} as const;

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
  // Janela: hoje + DAYS_AHEAD dias corridos (ex.: hoje 22 → até 25). A regra de
  // antecedência por meio-período (em schedulingPolicy) exclui o mesmo dia.
  DAYS_AHEAD: 3,
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

// ===========================================================================
// Implantação (time de Implantação) — fluxo distinto do de Integrações.
// ===========================================================================

export const IMPLANTERS = ['gabrielle', 'bryan', 'wagner'] as const;
export type Implanter = (typeof IMPLANTERS)[number];

export const IMPLANTER_LABELS: Record<Implanter, string> = {
  gabrielle: 'Gabrielle',
  bryan: 'Bryan',
  wagner: 'Wagner',
};

export const SEGMENTS = ['enterprise', 'middle', 'small'] as const;
export type Segment = (typeof SEGMENTS)[number];

export const SEGMENT_LABELS: Record<Segment, string> = {
  enterprise: 'Enterprise',
  middle: 'Middle',
  small: 'Small',
};

// Segmento → implantadores que atendem (ordem = ordem de exibição das colunas).
export const SEGMENT_IMPLANTERS: Record<Segment, Implanter[]> = {
  enterprise: ['gabrielle'],
  middle: ['gabrielle', 'bryan'],
  small: ['bryan', 'wagner'],
};

export const IMPLANTATION_SLOT_KINDS = ['coletiva_manha', 'individual', 'coletiva_tarde'] as const;
export type ImplantationSlotKind = (typeof IMPLANTATION_SLOT_KINDS)[number];

export const IMPLANTATION_SLOT_LABELS: Record<ImplantationSlotKind, string> = {
  coletiva_manha: 'Coletiva (manhã)',
  individual: 'Individual',
  coletiva_tarde: 'Coletiva (tarde)',
};

export interface ImplantationSlotTemplate {
  kind: ImplantationSlotKind;
  start: string; // HH:MM em America/Sao_Paulo
  end: string;
  capacity: number;
  // Restringe o slot a um implantador específico (individual = só Gabrielle).
  onlyImplanter?: Implanter;
}

// Horários fixos diários. Coletivas têm 8 vagas; individual tem 1 e é exclusiva
// da Gabrielle. A disponibilidade real (vagas restantes) vem do nosso banco.
export const IMPLANTATION_SLOTS: ImplantationSlotTemplate[] = [
  { kind: 'coletiva_manha', start: '09:40', end: '11:10', capacity: 8 },
  { kind: 'individual', start: '13:20', end: '14:50', capacity: 1, onlyImplanter: 'gabrielle' },
  { kind: 'coletiva_tarde', start: '15:30', end: '17:10', capacity: 8 },
];

export const IMPLANTATION = {
  TIMEZONE: 'America/Sao_Paulo',
  // Quantos dias ÚTEIS exibir: hoje + 2 dias úteis.
  WEEKDAYS_AHEAD: 3,
} as const;
