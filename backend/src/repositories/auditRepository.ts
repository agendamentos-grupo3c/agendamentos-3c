import { query } from '../lib/db.js';

export interface AuditEntry {
  actorEmail: string;
  action: string;
  cardId?: string | null;
  fromStatus?: string | null;
  toStatus?: string | null;
  metadata?: Record<string, unknown> | null;
}

export async function insertAuditLog(entry: AuditEntry): Promise<void> {
  await query(
    `INSERT INTO audit_log (actor_email, action, card_id, from_status, to_status, metadata)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
    [
      entry.actorEmail,
      entry.action,
      entry.cardId ?? null,
      entry.fromStatus ?? null,
      entry.toStatus ?? null,
      entry.metadata ? JSON.stringify(entry.metadata) : null,
    ],
  );
}
