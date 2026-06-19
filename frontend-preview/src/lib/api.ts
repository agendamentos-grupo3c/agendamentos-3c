// PREVIEW: mock em memória (sem backend, sem autenticação). Mesma interface do
// api real, mas resolve tudo localmente para testar a UI isoladamente.

export type Role = 'integrator' | 'seller';

export interface ApiUser {
  email: string;
  name: string;
  role: Role;
}

export interface AvailableSlot {
  token: string;
  dateLabel: string;
  timeLabel: string;
  startISO: string;
}

export interface Availability {
  alana: AvailableSlot[];
  guilherme: AvailableSlot[];
}

export interface SubmitPayload {
  companyName: string;
  clientName: string;
  integrationSummary: string;
  crmName: string;
  clientEmail: string;
  phone: string;
  slotToken: string;
}

export interface SubmitResponse {
  card: { id: string; status: string; scheduledAt: string | null; meetingUrl: string | null };
  pending: string[];
}

export type CardStatus = 'kickoff' | 'compareceu' | 'no_show' | 'orcamento_enviado';

export interface CardSummary {
  id: string;
  companyName: string;
  clientName: string;
  status: CardStatus;
  scheduledAt: string | null;
  meetingUrl: string | null;
  requiredIntegration: string | null;
  budget: string | null;
  productionDeadline: string | null;
}

export interface BudgetFields {
  requiredIntegration: string;
  budget: string;
  productionDeadline: string;
}

export interface OutcomeResponse {
  card: CardSummary;
  pending: string[];
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code?: string,
  ) {
    super(code ?? `HTTP ${status}`);
    this.name = 'ApiError';
  }
}

// Pequeno atraso para exercitar estados de carregamento.
const delay = <T,>(value: T, ms = 250): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(value), ms));

// ---- Dados fake ----
function mockSlots(): Availability {
  const make = (startISO: string, dateLabel: string, timeLabel: string): AvailableSlot => ({
    token: `mock-${startISO}`,
    dateLabel,
    timeLabel,
    startISO,
  });
  return {
    alana: [
      make('2026-06-19T12:15:00.000Z', 'sex, 19/06', '09:15–09:45'),
      make('2026-06-19T13:00:00.000Z', 'sex, 19/06', '10:00–10:30'),
      make('2026-06-22T13:45:00.000Z', 'seg, 22/06', '10:45–11:15'),
    ],
    guilherme: [
      make('2026-06-19T17:00:00.000Z', 'sex, 19/06', '14:00–14:30'),
      make('2026-06-22T19:15:00.000Z', 'seg, 22/06', '16:15–16:45'),
      make('2026-06-22T20:00:00.000Z', 'seg, 22/06', '17:00–17:30'),
    ],
  };
}

let cards: CardSummary[] = [
  {
    id: '11111111-1111-1111-1111-111111111111',
    companyName: 'Acme Cobranças',
    clientName: 'Maria Souza',
    status: 'kickoff',
    scheduledAt: '2026-06-19T12:15:00.000Z',
    meetingUrl: 'https://meet.google.com/abc-defg-hij',
    requiredIntegration: null,
    budget: null,
    productionDeadline: null,
  },
  {
    id: '22222222-2222-2222-2222-222222222222',
    companyName: 'Beta Vendas',
    clientName: 'João Lima',
    status: 'compareceu',
    scheduledAt: '2026-06-17T13:00:00.000Z',
    meetingUrl: 'https://meet.google.com/xyz-uvwx-yz',
    requiredIntegration: null,
    budget: null,
    productionDeadline: null,
  },
  {
    id: '33333333-3333-3333-3333-333333333333',
    companyName: 'Gama SAC',
    clientName: 'Ana Prado',
    status: 'orcamento_enviado',
    scheduledAt: '2026-06-15T17:00:00.000Z',
    meetingUrl: null,
    requiredIntegration: 'Integração via API REST com o CRM',
    budget: 'R$ 8.500',
    productionDeadline: '3 semanas',
  },
  {
    id: '44444444-4444-4444-4444-444444444444',
    companyName: 'Delta Crédito',
    clientName: 'Carlos Dias',
    status: 'no_show',
    scheduledAt: '2026-06-12T13:45:00.000Z',
    meetingUrl: null,
    requiredIntegration: null,
    budget: null,
    productionDeadline: null,
  },
];

function findCard(id: string): CardSummary {
  const card = cards.find((c) => c.id === id);
  if (!card) throw new ApiError(404, 'CARD_NOT_FOUND');
  return card;
}

export const api = {
  loginUrl: (): string => '#',

  getMe: (): Promise<ApiUser> => {
    // PREVIEW: papel controlado por localStorage (alternável no header).
    const stored = typeof window !== 'undefined' ? localStorage.getItem('demo-role') : null;
    const role: Role = stored === 'seller' ? 'seller' : 'integrator';
    return delay({ email: 'demo@grupo-3c.com', name: 'Usuário Demo', role }, 150);
  },

  getAvailability: (): Promise<Availability> => delay(mockSlots()),

  submit: (payload: SubmitPayload, _idempotencyKey?: string): Promise<SubmitResponse> => {
    const card: CardSummary = {
      id: crypto.randomUUID(),
      companyName: payload.companyName,
      clientName: payload.clientName,
      status: 'kickoff',
      scheduledAt: payload.slotToken.replace('mock-', ''),
      meetingUrl: 'https://meet.google.com/demo-link',
      requiredIntegration: null,
      budget: null,
      productionDeadline: null,
    };
    cards = [card, ...cards];
    return delay({
      card: {
        id: card.id,
        status: card.status,
        scheduledAt: card.scheduledAt,
        meetingUrl: card.meetingUrl,
      },
      pending: [],
    });
  },

  listCards: (): Promise<CardSummary[]> => delay(cards.map((c) => ({ ...c }))),

  markAttended: (id: string): Promise<OutcomeResponse> => {
    const card = findCard(id);
    card.status = 'compareceu';
    return delay({ card: { ...card }, pending: [] });
  },

  markNoShow: (id: string): Promise<OutcomeResponse> => {
    const card = findCard(id);
    card.status = 'no_show';
    return delay({ card: { ...card }, pending: [] });
  },

  sendBudget: (id: string, fields: BudgetFields): Promise<OutcomeResponse> => {
    const card = findCard(id);
    card.status = 'orcamento_enviado';
    card.requiredIntegration = fields.requiredIntegration;
    card.budget = fields.budget;
    card.productionDeadline = fields.productionDeadline;
    return delay({ card: { ...card }, pending: [] });
  },

  logout: (): Promise<void> => delay(undefined),
};
