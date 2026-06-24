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
  companyId: string;
  welcomeStageId: string;
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
        return {
          dealId,
          contactId: assocIds(contacts)[0] ?? null,
          companyId: company.id,
          welcomeStageId: deal.properties.dealstage,
        };
      }
    }
  }
  return null;
}

// Atualiza a observação (corpo) da reunião — usado no pós-reunião. A mesma
// observação é gravada na meeting de cada participante que compareceu.
export async function updateMeetingNotes(meetingId: string, body: string): Promise<void> {
  await hsFetch(
    `/engagements/v1/engagements/${meetingId}`,
    { method: 'PATCH', body: JSON.stringify({ metadata: { body } }) },
    'HUBSPOT_MEETING_UPDATE_FAILED',
  );
}

// Move o deal para outra etapa (ex.: Boas Vindas → Implantação após agendar).
export async function moveDealToStage(dealId: string, dealstage: string): Promise<void> {
  await hsFetch(
    `/crm/v3/objects/deals/${dealId}`,
    { method: 'PATCH', body: JSON.stringify({ properties: { dealstage } }) },
    'HUBSPOT_DEAL_STAGE_FAILED',
  );
}

export async function findOwnerIdByEmail(email: string): Promise<string | null> {
  const j = (await hsFetch(
    `/crm/v3/owners?email=${encodeURIComponent(email)}`,
    { method: 'GET' },
    'HUBSPOT_OWNER_FAILED',
  )) as { results?: { id: string }[] };
  return j.results?.[0]?.id ?? null;
}

export interface CreateMeetingInput {
  title: string;
  startISO: string;
  endISO: string;
  ownerId: string | null;
  dealId: string;
  contactId: string | null;
  companyId: string;
}

// Cria uma MEETING (a "reunião" de verdade) pela API de engagements e associa ao
// deal, à empresa e ao contato. O objeto de Meetings não é exposto na API v3
// deste portal (sem scope), mas a API de engagements cria a mesma reunião.
export async function createMeeting(input: CreateMeetingInput): Promise<{ meetingId: string }> {
  const start = new Date(input.startISO).getTime();
  const end = new Date(input.endISO).getTime();

  const body: Record<string, unknown> = {
    engagement: { active: true, type: 'MEETING', timestamp: start },
    associations: {
      contactIds: input.contactId ? [Number(input.contactId)] : [],
      dealIds: [Number(input.dealId)],
      companyIds: [Number(input.companyId)],
    },
    metadata: {
      startTime: start,
      endTime: end,
      title: input.title,
      meetingOutcome: 'SCHEDULED',
    },
  };
  // Organizador = vendedor logado, quando ele for um owner do HubSpot.
  if (input.ownerId) (body.engagement as Record<string, unknown>).ownerId = Number(input.ownerId);

  const created = (await hsFetch(
    '/engagements/v1/engagements',
    { method: 'POST', body: JSON.stringify(body) },
    'HUBSPOT_MEETING_FAILED',
  )) as { engagement?: { id: number } };

  return { meetingId: String(created.engagement?.id) };
}
