import type { Implanter, ImplantationProduct, Segment } from '../config/constants.js';
import { query, withTransaction } from '../lib/db.js';

export type ImplantationStatus = 'agendado' | 'compareceu' | 'no_show';

export interface Implantation {
  id: string;
  companyName: string;
  clientName: string;
  clientEmail: string;
  clientPhoneE164: string;
  clientId: string | null;
  segment: Segment;
  implanter: Implanter;
  slotDate: string;
  product: ImplantationProduct | null;
  scheduledStart: string;
  scheduledEnd: string;
  googleEventId: string | null;
  meetingUrl: string | null;
  status: ImplantationStatus;
  attendanceNotes: string | null;
  meetingLink: string | null;
  meetingLinkNotifiedAt: string | null;
  sellerEmail: string;
  sellerName: string | null;
  idempotencyKey: string | null;
  n8nNotifiedAt: string | null;
  hubspotMeetingId: string | null;
}

const COLUMNS = `
  id,
  company_name AS "companyName",
  client_name AS "clientName",
  client_email AS "clientEmail",
  client_phone_e164 AS "clientPhoneE164",
  client_id AS "clientId",
  segment,
  implanter,
  slot_date AS "slotDate",
  product,
  scheduled_start AS "scheduledStart",
  scheduled_end AS "scheduledEnd",
  google_event_id AS "googleEventId",
  meeting_url AS "meetingUrl",
  status,
  attendance_notes AS "attendanceNotes",
  meeting_link AS "meetingLink",
  meeting_link_notified_at AS "meetingLinkNotifiedAt",
  seller_email AS "sellerEmail",
  seller_name AS "sellerName",
  idempotency_key AS "idempotencyKey",
  n8n_notified_at AS "n8nNotifiedAt",
  hubspot_meeting_id AS "hubspotMeetingId"
`;

export const UNIQUE_CONSTRAINTS = {
  IDEMPOTENCY: 'implantations_idempotency_key_unique',
} as const;

export function uniqueViolationConstraint(err: unknown): string | null {
  if (err && typeof err === 'object' && 'code' in err && err.code === '23505') {
    return 'constraint' in err && typeof err.constraint === 'string' ? err.constraint : '';
  }
  return null;
}

export interface InsertImplantationInput {
  companyName: string;
  clientName: string;
  clientEmail: string;
  clientPhoneE164: string;
  clientId: string;
  segment: Segment;
  implanter: Implanter;
  slotDate: string;
  product: ImplantationProduct;
  scheduledStart: string;
  scheduledEnd: string;
  sellerEmail: string;
  sellerName: string;
  idempotencyKey: string;
}

interface SessionRow {
  scheduled_start: string;
  scheduled_end: string;
  product: ImplantationProduct;
  individual: boolean;
  count: number;
}

// Reserva à prova de corrida: advisory lock por (implantador, dia) e então
// decide ENTRAR numa sessão existente (mesmo horário/produto/tipo, com vaga) ou
// ABRIR uma nova (sem sobreposição com outras sessões). Retorna null se não der.
export async function insertWithCapacity(
  input: InsertImplantationInput,
  capacity: number,
): Promise<Implantation | null> {
  return withTransaction(async (client) => {
    const lockKey = `${input.implanter}|${input.slotDate}`;
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [lockKey]);

    const { rows: sessions } = await client.query<SessionRow>(
      `SELECT scheduled_start, scheduled_end, product::text AS product,
              bool_or(segment = 'enterprise') AS individual, count(*)::int AS count
         FROM implantations
         WHERE implanter = $1 AND slot_date = $2
         GROUP BY scheduled_start, scheduled_end, product`,
      [input.implanter, input.slotDate],
    );

    const start = new Date(input.scheduledStart).getTime();
    const end = new Date(input.scheduledEnd).getTime();
    const wantIndividual = input.segment === 'enterprise';

    const at = sessions.find((s) => new Date(s.scheduled_start).getTime() === start);
    if (at) {
      // Entrar numa sessão existente: produto e tipo precisam casar e ter vaga.
      if (at.product !== input.product) return null;
      if (Boolean(at.individual) !== wantIndividual) return null;
      if (at.count >= capacity) return null;
    } else {
      // Abrir nova sessão: não pode sobrepor nenhuma sessão do dia.
      const overlaps = sessions.some((s) => {
        const ss = new Date(s.scheduled_start).getTime();
        const se = new Date(s.scheduled_end).getTime();
        return start < se && ss < end;
      });
      if (overlaps) return null;
    }

    const { rows } = await client.query<Implantation>(
      `INSERT INTO implantations
         (company_name, client_name, client_email, client_phone_e164, client_id,
          segment, implanter, slot_date, product, scheduled_start, scheduled_end,
          seller_email, seller_name, idempotency_key, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'agendado')
       RETURNING ${COLUMNS}`,
      [
        input.companyName,
        input.clientName,
        input.clientEmail,
        input.clientPhoneE164,
        input.clientId,
        input.segment,
        input.implanter,
        input.slotDate,
        input.product,
        input.scheduledStart,
        input.scheduledEnd,
        input.sellerEmail,
        input.sellerName,
        input.idempotencyKey,
      ],
    );
    return rows[0]!;
  });
}

export async function findByIdempotencyKey(key: string): Promise<Implantation | null> {
  const { rows } = await query<Implantation>(
    `SELECT ${COLUMNS} FROM implantations WHERE idempotency_key = $1`,
    [key],
  );
  return rows[0] ?? null;
}

export async function findById(id: string): Promise<Implantation | null> {
  const { rows } = await query<Implantation>(
    `SELECT ${COLUMNS} FROM implantations WHERE id = $1`,
    [id],
  );
  return rows[0] ?? null;
}

export interface SessionAggregate {
  implanter: Implanter;
  scheduledStart: string;
  scheduledEnd: string;
  product: ImplantationProduct;
  individual: boolean;
  count: number;
}

// Sessões existentes (agrupadas por implantador + horário + produto) na janela —
// base do cálculo de disponibilidade (entrar numa sessão ou abrir nova).
export async function listSessions(
  implanters: Implanter[],
  fromDate: string,
  toDate: string,
): Promise<SessionAggregate[]> {
  const { rows } = await query<SessionAggregate>(
    `SELECT implanter, scheduled_start AS "scheduledStart", scheduled_end AS "scheduledEnd",
            product::text AS product, bool_or(segment = 'enterprise') AS individual, count(*)::int AS count
       FROM implantations
       WHERE implanter::text = ANY($1) AND slot_date >= $2 AND slot_date <= $3 AND product IS NOT NULL
       GROUP BY implanter, scheduled_start, scheduled_end, product`,
    [implanters, fromDate, toDate],
  );
  return rows;
}

// Implantador da reserva mais recente do segmento — base do rodízio (alterna a
// partir do último agendado).
export async function lastImplanterForSegment(segment: Segment): Promise<Implanter | null> {
  const { rows } = await query<{ implanter: Implanter }>(
    `SELECT implanter FROM implantations WHERE segment = $1 ORDER BY created_at DESC LIMIT 1`,
    [segment],
  );
  return rows[0]?.implanter ?? null;
}

export async function listByImplanter(implanter: Implanter): Promise<Implantation[]> {
  const { rows } = await query<Implantation>(
    `SELECT ${COLUMNS} FROM implantations WHERE implanter = $1 ORDER BY scheduled_start DESC`,
    [implanter],
  );
  return rows;
}

// Todas as reservas de uma mesma sessão (implantador + horário de início) —
// base do resumo da reunião (quem compareceu / não).
export async function listBySessionStart(
  implanter: Implanter,
  scheduledStart: string,
): Promise<Implantation[]> {
  const { rows } = await query<Implantation>(
    `SELECT ${COLUMNS} FROM implantations
       WHERE implanter = $1 AND scheduled_start = $2
       ORDER BY created_at`,
    [implanter, scheduledStart],
  );
  return rows;
}

export async function countForSession(
  implanter: Implanter,
  scheduledStart: string,
): Promise<number> {
  const { rows } = await query<{ n: number }>(
    `SELECT count(*)::int AS n FROM implantations
       WHERE implanter = $1 AND scheduled_start = $2`,
    [implanter, scheduledStart],
  );
  return rows[0]?.n ?? 0;
}

export async function listBySeller(sellerEmail: string): Promise<Implantation[]> {
  const { rows } = await query<Implantation>(
    `SELECT ${COLUMNS} FROM implantations WHERE seller_email = $1 ORDER BY scheduled_start DESC`,
    [sellerEmail],
  );
  return rows;
}

export async function setEvent(
  id: string,
  eventId: string,
  meetUrl: string | null,
): Promise<Implantation> {
  const { rows } = await query<Implantation>(
    `UPDATE implantations SET google_event_id = $2, meeting_url = $3 WHERE id = $1 RETURNING ${COLUMNS}`,
    [id, eventId, meetUrl],
  );
  return rows[0]!;
}

export async function markN8nNotified(id: string): Promise<void> {
  await query(`UPDATE implantations SET n8n_notified_at = now() WHERE id = $1`, [id]);
}

// Guarda o id da meeting criada no HubSpot (para atualizar observações depois).
export async function setHubspotMeetingId(id: string, meetingId: string): Promise<Implantation> {
  const { rows } = await query<Implantation>(
    `UPDATE implantations SET hubspot_meeting_id = $2 WHERE id = $1 RETURNING ${COLUMNS}`,
    [id, meetingId],
  );
  return rows[0]!;
}

// Transições atômicas: o WHERE com status de origem 'agendado' barra estados
// inválidos e corrida (retorna null se não atualizou).
export async function markAttended(id: string, notes: string | null): Promise<Implantation | null> {
  const { rows } = await query<Implantation>(
    `UPDATE implantations SET status = 'compareceu', attendance_notes = $2
       WHERE id = $1 AND status = 'agendado' RETURNING ${COLUMNS}`,
    [id, notes],
  );
  return rows[0] ?? null;
}

export async function markNoShow(id: string): Promise<Implantation | null> {
  const { rows } = await query<Implantation>(
    `UPDATE implantations SET status = 'no_show'
       WHERE id = $1 AND status = 'agendado' RETURNING ${COLUMNS}`,
    [id],
  );
  return rows[0] ?? null;
}

// Grava o link da reunião (pós-reunião) APENAS nos participantes que
// compareceram da sessão; o disparo (HubSpot/n8n) trata-se à parte.
export async function setSessionMeetingLink(
  implanter: Implanter,
  scheduledStart: string,
  link: string,
): Promise<Implantation[]> {
  const { rows } = await query<Implantation>(
    `UPDATE implantations SET meeting_link = $3
       WHERE implanter = $1 AND scheduled_start = $2 AND status = 'compareceu'
       RETURNING ${COLUMNS}`,
    [implanter, scheduledStart, link],
  );
  return rows;
}

// Marca o envio do link concluído (idempotência do disparo de e-mail/HubSpot).
export async function markSessionMeetingLinkNotified(
  implanter: Implanter,
  scheduledStart: string,
): Promise<void> {
  await query(
    `UPDATE implantations SET meeting_link_notified_at = now()
       WHERE implanter = $1 AND scheduled_start = $2 AND status = 'compareceu'`,
    [implanter, scheduledStart],
  );
}
