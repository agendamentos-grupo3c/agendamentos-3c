import type { CardStatus, DemandType } from '../config/constants.js';
import { query } from '../lib/db.js';
import type { Collaborator } from '../lib/schedulingPolicy.js';

export interface Card {
  id: string;
  companyName: string;
  clientName: string;
  integrationSummary: string;
  crmName: string;
  clientEmail: string;
  clientPhoneE164: string;
  clientId: string | null;
  sellerEmail: string;
  sellerName: string | null;
  assignedTo: Collaborator;
  scheduledAt: string | null;
  googleEventId: string | null;
  meetingUrl: string | null;
  status: CardStatus;
  requiredIntegration: string | null;
  budget: string | null;
  productionDeadline: string | null;
  demandType: DemandType | null;
  idempotencyKey: string | null;
  slackNotifiedAt: string | null;
  whatsappSentAt: string | null;
  clickupSyncedAt: string | null;
  clickupTaskId: string | null;
}

const COLUMNS = `
  id,
  company_name AS "companyName",
  client_name AS "clientName",
  integration_summary AS "integrationSummary",
  crm_name AS "crmName",
  client_email AS "clientEmail",
  client_phone_e164 AS "clientPhoneE164",
  client_id AS "clientId",
  seller_email AS "sellerEmail",
  seller_name AS "sellerName",
  assigned_to AS "assignedTo",
  scheduled_at AS "scheduledAt",
  google_event_id AS "googleEventId",
  meeting_url AS "meetingUrl",
  status,
  required_integration AS "requiredIntegration",
  budget AS "budget",
  production_deadline AS "productionDeadline",
  demand_type AS "demandType",
  idempotency_key AS "idempotencyKey",
  slack_notified_at AS "slackNotifiedAt",
  whatsapp_sent_at AS "whatsappSentAt",
  clickup_synced_at AS "clickupSyncedAt",
  clickup_task_id AS "clickupTaskId"
`;

export interface InsertCardInput {
  companyName: string;
  clientName: string;
  integrationSummary: string;
  crmName: string;
  clientEmail: string;
  clientPhoneE164: string;
  clientId: string;
  sellerEmail: string;
  sellerName: string;
  assignedTo: Collaborator;
  scheduledAt: string;
  demandType: DemandType;
  idempotencyKey: string;
}

export const UNIQUE_CONSTRAINTS = {
  SLOT: 'cards_collaborator_slot_unique',
  IDEMPOTENCY: 'cards_idempotency_key_unique',
} as const;

export function uniqueViolationConstraint(err: unknown): string | null {
  if (err && typeof err === 'object' && 'code' in err && err.code === '23505') {
    return 'constraint' in err && typeof err.constraint === 'string' ? err.constraint : '';
  }
  return null;
}

export async function insertCard(input: InsertCardInput): Promise<Card> {
  const { rows } = await query<Card>(
    `INSERT INTO cards
       (company_name, client_name, integration_summary, crm_name, client_email,
        client_phone_e164, client_id, seller_email, seller_name, assigned_to,
        scheduled_at, demand_type, idempotency_key, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'kickoff')
     RETURNING ${COLUMNS}`,
    [
      input.companyName,
      input.clientName,
      input.integrationSummary,
      input.crmName,
      input.clientEmail,
      input.clientPhoneE164,
      input.clientId,
      input.sellerEmail,
      input.sellerName,
      input.assignedTo,
      input.scheduledAt,
      input.demandType,
      input.idempotencyKey,
    ],
  );
  return rows[0]!;
}

export async function findByIdempotencyKey(key: string): Promise<Card | null> {
  const { rows } = await query<Card>(
    `SELECT ${COLUMNS} FROM cards WHERE idempotency_key = $1`,
    [key],
  );
  return rows[0] ?? null;
}

export async function findById(id: string): Promise<Card | null> {
  const { rows } = await query<Card>(`SELECT ${COLUMNS} FROM cards WHERE id = $1`, [id]);
  return rows[0] ?? null;
}

export async function deleteCard(id: string): Promise<void> {
  await query(`DELETE FROM cards WHERE id = $1`, [id]);
}

export async function setEvent(
  id: string,
  event: { eventId: string; meetUrl?: string },
): Promise<Card> {
  const { rows } = await query<Card>(
    `UPDATE cards SET google_event_id = $2, meeting_url = $3 WHERE id = $1 RETURNING ${COLUMNS}`,
    [id, event.eventId, event.meetUrl ?? null],
  );
  return rows[0]!;
}

const DISPATCH_COLUMN = {
  slack: 'slack_notified_at',
  whatsapp: 'whatsapp_sent_at',
  clickup: 'clickup_synced_at',
} as const;

export type DispatchChannel = keyof typeof DISPATCH_COLUMN;

export async function markDispatched(id: string, channel: DispatchChannel): Promise<void> {
  // Coluna vem de um whitelist fixo — sem interpolação de entrada do usuário.
  await query(`UPDATE cards SET ${DISPATCH_COLUMN[channel]} = now() WHERE id = $1`, [id]);
}

export async function setClickupTaskId(id: string, taskId: string): Promise<void> {
  await query(`UPDATE cards SET clickup_task_id = $2 WHERE id = $1`, [id, taskId]);
}

export async function listBySeller(sellerEmail: string): Promise<Card[]> {
  const { rows } = await query<Card>(
    `SELECT ${COLUMNS} FROM cards WHERE seller_email = $1 ORDER BY created_at DESC`,
    [sellerEmail],
  );
  return rows;
}

export async function listByCollaborator(collaborator: Collaborator): Promise<Card[]> {
  const { rows } = await query<Card>(
    `SELECT ${COLUMNS} FROM cards WHERE assigned_to = $1 ORDER BY created_at DESC`,
    [collaborator],
  );
  return rows;
}

// Transição atômica: o WHERE com o status de origem garante que mudanças
// concorrentes/estados inválidos não passem (retorna null se não atualizou).
export async function transitionStatus(
  id: string,
  from: CardStatus,
  to: CardStatus,
): Promise<Card | null> {
  const { rows } = await query<Card>(
    `UPDATE cards SET status = $3 WHERE id = $1 AND status = $2 RETURNING ${COLUMNS}`,
    [id, from, to],
  );
  return rows[0] ?? null;
}

export async function saveBudgetAndSend(
  id: string,
  fields: { requiredIntegration: string; budget: number; productionDeadline: string },
): Promise<Card | null> {
  const { rows } = await query<Card>(
    `UPDATE cards
       SET required_integration = $2, budget = $3, production_deadline = $4,
           status = 'orcamento_enviado'
     WHERE id = $1 AND status = 'compareceu'
     RETURNING ${COLUMNS}`,
    // Coluna budget é text; guardamos o número canônico como string.
    [id, fields.requiredIntegration, String(fields.budget), fields.productionDeadline],
  );
  return rows[0] ?? null;
}
