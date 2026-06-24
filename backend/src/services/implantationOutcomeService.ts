import { AppError } from '../errors/AppError.js';
import { updateMeetingNotes } from '../integrations/hubspot.js';
import { logger } from '../lib/logger.js';
import { getImplanterForEmail } from '../lib/roles.js';
import { insertAuditLog } from '../repositories/auditRepository.js';
import {
  type Implantation,
  findById,
  markAttended,
  markNoShow,
} from '../repositories/implantationRepository.js';

export interface ImplantationOutcomeResult {
  booking: Implantation;
}

function notFound(): AppError {
  return new AppError({
    code: 'IMPLANTATION_NOT_FOUND',
    statusCode: 404,
    publicMessage: 'Agendamento não encontrado.',
  });
}

function invalidTransition(): AppError {
  return new AppError({
    code: 'INVALID_TRANSITION',
    statusCode: 409,
    publicMessage: 'Transição de status inválida.',
  });
}

// Só o implantador dono do agendamento registra o desfecho (autorização
// horizontal: um implantador não age no agendamento de outro).
function ensureOwner(booking: Implantation, actorEmail: string): void {
  if (getImplanterForEmail(actorEmail) !== booking.implanter) {
    throw new AppError({
      code: 'FORBIDDEN',
      statusCode: 403,
      publicMessage: 'Ação permitida apenas ao implantador responsável.',
    });
  }
}

export async function attendImplantation(
  id: string,
  actorEmail: string,
  notes: string | null,
): Promise<ImplantationOutcomeResult> {
  const booking = await findById(id);
  if (!booking) throw notFound();
  ensureOwner(booking, actorEmail);

  const updated = await markAttended(id, notes);
  if (!updated) throw invalidTransition();

  await insertAuditLog({
    actorEmail,
    action: 'implantation.attended',
    metadata: { implantationId: id, from: booking.status, to: 'compareceu' },
  });

  // Grava a observação na reunião do HubSpot (a mesma para todos os que
  // compareceram — o front envia o mesmo texto a cada participante).
  // Best-effort: a falha aqui não desfaz o desfecho já registrado.
  if (updated.hubspotMeetingId && notes) {
    try {
      await updateMeetingNotes(updated.hubspotMeetingId, notes);
    } catch (err) {
      logger.warn({ err, implantationId: id }, 'hubspot meeting notes update pending');
    }
  }

  return { booking: updated };
}

export async function noShowImplantation(
  id: string,
  actorEmail: string,
): Promise<ImplantationOutcomeResult> {
  const booking = await findById(id);
  if (!booking) throw notFound();
  ensureOwner(booking, actorEmail);

  const updated = await markNoShow(id);
  if (!updated) throw invalidTransition();

  await insertAuditLog({
    actorEmail,
    action: 'implantation.no_show',
    metadata: { implantationId: id, from: booking.status, to: 'no_show' },
  });

  return { booking: updated };
}
