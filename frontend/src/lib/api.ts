// Client HTTP tipado para a API (backend). Sempre com credentials para enviar o
// cookie de sessão httpOnly. Nenhum segredo aqui — só a URL pública da API.

// Normaliza a URL da API: garante esquema absoluto e remove barra final. Sem o
// `https://`, o navegador trata "host:porta" como protocolo desconhecido e abre
// o seletor de apps do SO em vez de navegar até o backend (ex.: no login Google).
function normalizeBaseUrl(raw: string | undefined): string {
  const trimmed = (raw ?? 'http://localhost:3333').trim().replace(/\/+$/, '');
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed.replace(/^\/+/, '')}`;
}

const BASE_URL = normalizeBaseUrl(process.env.NEXT_PUBLIC_API_BASE_URL);

export type Role = 'integrator' | 'seller';

export type Implanter = 'gabrielle' | 'bryan' | 'wagner';

export interface ApiUser {
  email: string;
  name: string;
  role: Role;
  implanter: Implanter | null;
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
  clientId: string;
  phone: string;
  demandType: 'automacao' | 'integracao';
  slotToken: string;
}

export interface SubmitResponse {
  card: { id: string; status: string; scheduledAt: string | null; meetingUrl: string | null };
  pending: string[];
}

export type CardStatus = 'kickoff' | 'compareceu' | 'no_show' | 'orcamento_enviado';

export type Collaborator = 'alana' | 'guilherme';

export interface CardSummary {
  id: string;
  companyName: string;
  clientName: string;
  status: CardStatus;
  assignedTo: Collaborator;
  scheduledAt: string | null;
  meetingUrl: string | null;
  requiredIntegration: string | null;
  budget: string | null;
  productionDeadline: string | null;
}

export interface BudgetFields {
  requiredIntegration: string;
  budget: number;
  productionDeadline: string;
}

export interface OutcomeResponse {
  card: CardSummary;
  pending: string[];
}

// === Implantação ===

export type Segment = 'enterprise' | 'middle' | 'small';
export type ImplantationSlotKind = 'coletiva_manha' | 'individual' | 'coletiva_tarde';
export type ImplantationStatus = 'agendado' | 'compareceu' | 'no_show';

export interface ImplantationSlot {
  token: string;
  dateLabel: string;
  timeLabel: string;
  kind: ImplantationSlotKind;
  kindLabel: string;
  remaining: number;
  capacity: number;
  startISO: string;
}

// Implantador omitido de propósito (anti-favoritismo): "best" = horários do
// próximo da vez; "others" = demais elegíveis, revelados sob demanda.
export interface ImplantationAvailability {
  best: ImplantationSlot[];
  others: ImplantationSlot[];
}

export interface ImplantationPayload {
  companyName: string;
  clientName: string;
  clientEmail: string;
  clientId: string;
  phone: string;
  segment: Segment;
  slotToken: string;
}

export interface ImplantationBooking {
  id: string;
  companyName: string;
  clientName: string;
  clientEmail: string;
  segment: Segment;
  implanter: Implanter;
  slotKind: ImplantationSlotKind;
  scheduledStart: string;
  meetingUrl: string | null;
  status: ImplantationStatus;
  attendanceNotes: string | null;
}

export interface ImplantationSubmitResponse {
  booking: ImplantationBooking;
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

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    credentials: 'include',
    ...init,
  });

  if (!res.ok) {
    let code: string | undefined;
    try {
      const body = (await res.json()) as { error?: { code?: string } };
      code = body.error?.code;
    } catch {
      // resposta sem corpo JSON — mantém apenas o status
    }
    throw new ApiError(res.status, code);
  }

  if (res.status === 204) {
    return undefined as T;
  }
  return (await res.json()) as T;
}

// POST que altera estado: busca o token CSRF e o reenvia em X-CSRF-Token.
async function csrfPost<T>(path: string, body?: unknown, extraHeaders?: Record<string, string>): Promise<T> {
  const { csrfToken } = await request<{ csrfToken: string }>('/auth/csrf');
  return request<T>(path, {
    method: 'POST',
    headers: {
      'X-CSRF-Token': csrfToken,
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...extraHeaders,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

export const api = {
  // URL de início do login (navegação de página inteira, não fetch).
  loginUrl: (): string => `${BASE_URL}/auth/google/login`,

  getMe: (): Promise<ApiUser> => request<ApiUser>('/auth/me'),

  getAvailability: (): Promise<Availability> => request<Availability>('/availability'),

  submit: (payload: SubmitPayload, idempotencyKey: string): Promise<SubmitResponse> =>
    csrfPost<SubmitResponse>('/submit', payload, { 'Idempotency-Key': idempotencyKey }),

  listCards: (): Promise<CardSummary[]> => request<CardSummary[]>('/cards'),

  markAttended: (id: string): Promise<OutcomeResponse> =>
    csrfPost<OutcomeResponse>(`/cards/${id}/attended`),

  markNoShow: (id: string): Promise<OutcomeResponse> =>
    csrfPost<OutcomeResponse>(`/cards/${id}/no-show`),

  sendBudget: (id: string, fields: BudgetFields): Promise<OutcomeResponse> =>
    csrfPost<OutcomeResponse>(`/cards/${id}/budget`, fields),

  reschedule: (id: string, slotToken: string): Promise<OutcomeResponse> =>
    csrfPost<OutcomeResponse>(`/cards/${id}/reschedule`, { slotToken }),

  // --- Implantação ---
  getImplantationAvailability: (segment: Segment): Promise<ImplantationAvailability> =>
    request<ImplantationAvailability>(`/implantation/availability?segment=${segment}`),

  bookImplantation: (
    payload: ImplantationPayload,
    idempotencyKey: string,
  ): Promise<ImplantationSubmitResponse> =>
    csrfPost<ImplantationSubmitResponse>('/implantation', payload, {
      'Idempotency-Key': idempotencyKey,
    }),

  listImplantations: (): Promise<ImplantationBooking[]> =>
    request<ImplantationBooking[]>('/implantation/bookings'),

  implantationAttended: (id: string, notes: string): Promise<{ booking: ImplantationBooking }> =>
    csrfPost<{ booking: ImplantationBooking }>(`/implantation/${id}/attended`, { notes }),

  implantationNoShow: (id: string): Promise<{ booking: ImplantationBooking }> =>
    csrfPost<{ booking: ImplantationBooking }>(`/implantation/${id}/no-show`),

  logout: (): Promise<void> => csrfPost<void>('/auth/logout'),
};
