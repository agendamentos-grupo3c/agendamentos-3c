import { AppError } from '../errors/AppError.js';
import { getAgendaSubjectsForEmail } from '../lib/roles.js';
import { getActiveFlags, upsertActive } from '../repositories/agendaRepository.js';
import { insertAuditLog } from '../repositories/auditRepository.js';

export interface AgendaState {
  ownsAgenda: boolean;
  active: boolean;
}

export async function getAgendaState(email: string): Promise<AgendaState> {
  const subjects = getAgendaSubjectsForEmail(email);
  if (subjects.length === 0) return { ownsAgenda: false, active: true };
  const flags = await getActiveFlags(subjects);
  const active = subjects.every((s) => flags.get(s) !== false);
  return { ownsAgenda: true, active };
}

// Pausa/reativa a própria agenda (todos os sujeitos que a pessoa possui).
export async function toggleAgenda(email: string): Promise<AgendaState> {
  const subjects = getAgendaSubjectsForEmail(email);
  if (subjects.length === 0) {
    throw new AppError({
      code: 'NO_AGENDA',
      statusCode: 403,
      publicMessage: 'Você não possui uma agenda para pausar.',
    });
  }

  const flags = await getActiveFlags(subjects);
  const currentlyActive = subjects.every((s) => flags.get(s) !== false);
  const target = !currentlyActive;

  for (const subject of subjects) await upsertActive(subject, target, email);

  await insertAuditLog({
    actorEmail: email,
    action: target ? 'agenda.resumed' : 'agenda.paused',
    metadata: { subjects },
  });

  return { ownsAgenda: true, active: target };
}
