// Client HTTP tipado para a API (backend). Sempre com credentials para enviar o
// cookie de sessão httpOnly. Nenhum segredo aqui — só a URL pública da API.

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3333';

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

  logout: (): Promise<void> => csrfPost<void>('/auth/logout'),
};
