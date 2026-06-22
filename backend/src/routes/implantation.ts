import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { SEGMENTS } from '../config/constants.js';
import { AppError } from '../errors/AppError.js';
import { getImplanterForEmail } from '../lib/roles.js';
import { decodeImplantationToken } from '../lib/slotToken.js';
import { requireAuth } from '../middlewares/requireAuth.js';
import { requireImplanter } from '../middlewares/requireImplanter.js';
import {
  type Implantation,
  listByImplanter,
  listBySeller,
} from '../repositories/implantationRepository.js';
import { implantationAttendedSchema, implantationSubmitSchema } from '../schemas/implantation.js';
import { getImplantationAvailability } from '../services/implantationAvailabilityService.js';
import { attendImplantation, noShowImplantation } from '../services/implantationOutcomeService.js';
import { bookImplantation } from '../services/implantationService.js';

const paramsSchema = z.object({ id: z.string().uuid() });
const availabilityQuerySchema = z.object({ segment: z.enum(SEGMENTS) });

// Menor dado possível ao front — sem e-mails de agenda/IDs de evento internos.
function toPublic(b: Implantation) {
  return {
    id: b.id,
    companyName: b.companyName,
    clientName: b.clientName,
    clientEmail: b.clientEmail,
    segment: b.segment,
    implanter: b.implanter,
    slotKind: b.slotKind,
    scheduledStart: b.scheduledStart,
    meetingUrl: b.meetingUrl,
    status: b.status,
    attendanceNotes: b.attendanceNotes,
  };
}

function parseId(params: unknown): string {
  const parsed = paramsSchema.safeParse(params);
  if (!parsed.success) {
    throw new AppError({
      code: 'IMPLANTATION_NOT_FOUND',
      statusCode: 404,
      publicMessage: 'Agendamento não encontrado.',
    });
  }
  return parsed.data.id;
}

export async function implantationRoutes(app: FastifyInstance): Promise<void> {
  // Disponibilidade por segmento (filtra os implantadores que atendem).
  app.get('/implantation/availability', { preHandler: requireAuth }, async (req) => {
    const parsed = availabilityQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw new AppError({ code: 'BAD_REQUEST', statusCode: 400, publicMessage: 'Segmento inválido.' });
    }
    return getImplantationAvailability(new Date(), parsed.data.segment);
  });

  // Agendar a implantação (idempotente; limite agressivo).
  app.post(
    '/implantation',
    {
      preHandler: [requireAuth, app.csrfProtection],
      config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
    },
    async (req, reply) => {
      const idempotencyKey = req.headers['idempotency-key'];
      if (typeof idempotencyKey !== 'string' || idempotencyKey.length === 0) {
        throw new AppError({
          code: 'IDEMPOTENCY_KEY_REQUIRED',
          statusCode: 400,
          publicMessage: 'Requisição inválida.',
        });
      }

      const parsed = implantationSubmitSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new AppError({ code: 'BAD_REQUEST', statusCode: 400, publicMessage: 'Dados inválidos.' });
      }

      const slot = decodeImplantationToken(parsed.data.slotToken);
      if (!slot) {
        throw new AppError({
          code: 'INVALID_SLOT',
          statusCode: 400,
          publicMessage: 'Horário inválido. Recarregue a agenda e tente novamente.',
        });
      }

      const result = await bookImplantation({
        sellerEmail: req.user!.email,
        sellerName: req.user!.name,
        idempotencyKey,
        form: {
          companyName: parsed.data.companyName,
          clientName: parsed.data.clientName,
          clientEmail: parsed.data.clientEmail,
          phone: parsed.data.phone,
          clientId: parsed.data.clientId,
          segment: parsed.data.segment,
        },
        slot,
      });

      return reply.status(201).send({ booking: toPublic(result.booking), pending: result.pending });
    },
  );

  // Implantador vê os agendamentos da sua coluna; vendedor vê os que criou.
  app.get('/implantation/bookings', { preHandler: requireAuth }, async (req) => {
    const email = req.user!.email;
    const implanter = getImplanterForEmail(email);
    const list = implanter ? await listByImplanter(implanter) : await listBySeller(email);
    return list.map(toPublic);
  });

  // Desfechos: somente implantadores (a trava do dono está no service).
  app.post(
    '/implantation/:id/attended',
    { preHandler: [requireAuth, app.csrfProtection, requireImplanter] },
    async (req) => {
      const id = parseId(req.params);
      const parsed = implantationAttendedSchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        throw new AppError({ code: 'BAD_REQUEST', statusCode: 400, publicMessage: 'Dados inválidos.' });
      }
      const result = await attendImplantation(id, req.user!.email, parsed.data.notes ?? null);
      return { booking: toPublic(result.booking) };
    },
  );

  app.post(
    '/implantation/:id/no-show',
    { preHandler: [requireAuth, app.csrfProtection, requireImplanter] },
    async (req) => {
      const id = parseId(req.params);
      const result = await noShowImplantation(id, req.user!.email);
      return { booking: toPublic(result.booking) };
    },
  );
}
