import type { Implanter, ImplantationSlotKind, Segment } from '../config/constants.js';
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
  slotKind: ImplantationSlotKind;
  scheduledStart: string;
  scheduledEnd: string;
  googleEventId: string | null;
  meetingUrl: string | null;
  status: ImplantationStatus;
  attendanceNotes: string | null;
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
  slot_kind AS "slotKind",
  scheduled_start AS "scheduledStart",
  scheduled_end AS "scheduledEnd",
  google_event_id AS "googleEventId",
  meeting_url AS "meetingUrl",
  status,
  attendance_notes AS "attendanceNotes",
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
  slotKind: ImplantationSlotKind;
  scheduledStart: string;
  scheduledEnd: string;
  sellerEmail: string;
  sellerName: string;
  idempotencyKey: string;
}

// Reserva à prova de corrida: trava lógica por (implantador, dia, slot) com
// advisory lock transacional, conta as reservas existentes e só insere se
// houver vaga. Retorna null se o slot lotou (capacidade atingida).
export async function insertWithCapacity(
  input: InsertImplantationInput,
  capacity: number,
): Promise<Implantation | null> {
  return withTransaction(async (client) => {
    const lockKey = `${input.implanter}|${input.slotDate}|${input.slotKind}`;
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [lockKey]);

    const { rows: counted } = await client.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM implantations
         WHERE implanter = $1 AND slot_date = $2 AND slot_kind = $3`,
      [input.implanter, input.slotDate, input.slotKind],
    );
    if ((counted[0]?.n ?? 0) >= capacity) return null;

    const { rows } = await client.query<Implantation>(
      `INSERT INTO implantations
         (company_name, client_name, client_email, client_phone_e164, client_id,
          segment, implanter, slot_date, slot_kind, scheduled_start, scheduled_end,
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
        input.slotKind,
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

export interface SlotCount {
  implanter: Implanter;
  slotDate: string;
  slotKind: ImplantationSlotKind;
  count: number;
}

// Contagem de reservas por (implantador, dia, slot) na janela — base do placar
// de vagas restantes.
export async function countsForWindow(
  implanters: Implanter[],
  fromDate: string,
  toDate: string,
): Promise<SlotCount[]> {
  // slot_date::text garante 'YYYY-MM-DD' (o pg converteria `date` para Date, o
  // que quebrava a chave de contagem usada no cálculo de vagas).
  const { rows } = await query<SlotCount>(
    `SELECT implanter, slot_date::text AS "slotDate", slot_kind AS "slotKind", count(*)::int AS count
       FROM implantations
       WHERE implanter::text = ANY($1) AND slot_date >= $2 AND slot_date <= $3
       GROUP BY implanter, slot_date, slot_kind`,
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
