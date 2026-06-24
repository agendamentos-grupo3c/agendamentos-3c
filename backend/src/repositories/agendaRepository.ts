import { query } from '../lib/db.js';

// Sujeitos com agenda PAUSADA (active=false). Ausência de linha = ativa.
export async function listInactiveSubjects(): Promise<Set<string>> {
  const { rows } = await query<{ subject: string }>(
    `SELECT subject FROM agenda_status WHERE active = false`,
  );
  return new Set(rows.map((r) => r.subject));
}

export async function isSubjectActive(subject: string): Promise<boolean> {
  const { rows } = await query<{ active: boolean }>(
    `SELECT active FROM agenda_status WHERE subject = $1`,
    [subject],
  );
  return rows[0]?.active !== false;
}

export async function getActiveFlags(subjects: string[]): Promise<Map<string, boolean>> {
  const map = new Map<string, boolean>();
  if (subjects.length === 0) return map;
  const { rows } = await query<{ subject: string; active: boolean }>(
    `SELECT subject, active FROM agenda_status WHERE subject = ANY($1)`,
    [subjects],
  );
  for (const r of rows) map.set(r.subject, r.active);
  return map;
}

export async function upsertActive(
  subject: string,
  active: boolean,
  updatedBy: string,
): Promise<void> {
  await query(
    `INSERT INTO agenda_status (subject, active, updated_at, updated_by)
       VALUES ($1, $2, now(), $3)
     ON CONFLICT (subject) DO UPDATE SET active = $2, updated_at = now(), updated_by = $3`,
    [subject, active, updatedBy],
  );
}

export interface AgendaLogEntry {
  actorEmail: string;
  action: string;
  metadata: unknown;
  createdAt: string;
}

// Histórico de pausa/reativação (admins). Reaproveita o audit_log.
export async function listAgendaLog(): Promise<AgendaLogEntry[]> {
  const { rows } = await query<AgendaLogEntry>(
    `SELECT actor_email AS "actorEmail", action, metadata, created_at AS "createdAt"
       FROM audit_log
       WHERE action IN ('agenda.paused', 'agenda.resumed')
       ORDER BY created_at DESC
       LIMIT 200`,
  );
  return rows;
}
