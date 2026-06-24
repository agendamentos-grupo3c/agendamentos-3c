import { HUBSPOT } from '../config/constants.js';
import { env } from '../config/env.js';
import { AppError } from '../errors/AppError.js';

function getToken(): string {
  const token = env.HUBSPOT_TOKEN;
  if (!token) {
    throw new AppError({
      code: 'HUBSPOT_NOT_CONFIGURED',
      statusCode: 503,
      publicMessage: 'Integração indisponível no momento.',
      message: 'HUBSPOT_TOKEN ausente.',
    });
  }
  return token;
}

async function hsFetch(path: string, init: RequestInit, code: string): Promise<unknown> {
  const res = await fetch(`${HUBSPOT.API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${getToken()}`,
      'Content-Type': 'application/json',
      ...init.headers,
    },
  });
  if (!res.ok) {
    throw new AppError({
      code,
      statusCode: 502,
      publicMessage: 'Integração indisponível no momento.',
      message: `HubSpot ${path} respondeu ${res.status}`,
    });
  }
  return res.status === 204 ? null : res.json();
}

interface SearchResult {
  total?: number;
  results?: { id: string; properties?: Record<string, string | null> }[];
}
interface AssocResult {
  results?: { toObjectId?: number | string; id?: string }[];
}

const assocIds = (j: AssocResult): string[] =>
  (j.results ?? []).map((r) => String(r.toObjectId ?? r.id)).filter(Boolean);

export interface WelcomeDeal {
  dealId: string;
  contactId: string | null;
}

// Resolve o lead a partir do ID 3C: empresa (por id_3c) → deal numa etapa
// "Boas Vindas" de um dos funis → contato do deal. Retorna null se não houver
// lead elegível (base da validação do formulário e do alvo da reunião).
export async function findWelcomeDeal(id3c: string): Promise<WelcomeDeal | null> {
  const search = (await hsFetch(
    '/crm/v3/objects/companies/search',
    {
      method: 'POST',
      body: JSON.stringify({
        filterGroups: [
          { filters: [{ propertyName: HUBSPOT.COMPANY_ID_3C_PROPERTY, operator: 'EQ', value: id3c }] },
        ],
        properties: ['name', HUBSPOT.COMPANY_ID_3C_PROPERTY],
        limit: 5,
      }),
    },
    'HUBSPOT_COMPANY_SEARCH_FAILED',
  )) as SearchResult;

  const welcome: readonly string[] = HUBSPOT.WELCOME_STAGE_IDS;

  for (const company of search.results ?? []) {
    const deals = (await hsFetch(
      `/crm/v3/objects/companies/${company.id}/associations/deals`,
      { method: 'GET' },
      'HUBSPOT_ASSOC_FAILED',
    )) as AssocResult;

    for (const dealId of assocIds(deals)) {
      const deal = (await hsFetch(
        `/crm/v3/objects/deals/${dealId}?properties=dealstage`,
        { method: 'GET' },
        'HUBSPOT_DEAL_FAILED',
      )) as { properties?: { dealstage?: string } };

      if (deal.properties?.dealstage && welcome.includes(deal.properties.dealstage)) {
        const contacts = (await hsFetch(
          `/crm/v3/objects/deals/${dealId}/associations/contacts`,
          { method: 'GET' },
          'HUBSPOT_ASSOC_FAILED',
        )) as AssocResult;
        return { dealId, contactId: assocIds(contacts)[0] ?? null };
      }
    }
  }
  return null;
}

export async function findOwnerIdByEmail(email: string): Promise<string | null> {
  const j = (await hsFetch(
    `/crm/v3/owners?email=${encodeURIComponent(email)}`,
    { method: 'GET' },
    'HUBSPOT_OWNER_FAILED',
  )) as { results?: { id: string }[] };
  return j.results?.[0]?.id ?? null;
}

export interface CreateAppointmentInput {
  name: string;
  startISO: string;
  endISO: string;
  ownerId: string | null;
  dealId: string;
  contactId: string | null;
}

// Cria o Appointment (a "reunião" neste portal) e associa ao deal e ao contato.
// O HubSpot calcula a duração; o organizador (vendedor) vai em hubspot_owner_id
// quando ele for um owner.
export async function createAppointment(input: CreateAppointmentInput): Promise<{ appointmentId: string }> {
  const properties: Record<string, string> = {
    hs_appointment_name: input.name,
    hs_appointment_start: input.startISO,
    hs_appointment_end: input.endISO,
  };
  if (input.ownerId) properties.hubspot_owner_id = input.ownerId;

  const created = (await hsFetch(
    '/crm/v3/objects/appointments',
    { method: 'POST', body: JSON.stringify({ properties }) },
    'HUBSPOT_APPOINTMENT_FAILED',
  )) as { id: string };

  // Associações via v4 (associação default — comprovadamente aceita).
  await hsFetch(
    `/crm/v4/objects/appointments/${created.id}/associations/default/deals/${input.dealId}`,
    { method: 'PUT' },
    'HUBSPOT_APPOINTMENT_ASSOC_FAILED',
  );
  if (input.contactId) {
    await hsFetch(
      `/crm/v4/objects/appointments/${created.id}/associations/default/contacts/${input.contactId}`,
      { method: 'PUT' },
      'HUBSPOT_APPOINTMENT_ASSOC_FAILED',
    );
  }

  return { appointmentId: created.id };
}
