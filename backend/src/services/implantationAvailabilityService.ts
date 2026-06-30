import {
  IMPLANTATION,
  IMPLANTATION_CAPACITY,
  PRODUCT_DURATION_MIN,
  SEGMENT_IMPLANTERS,
  kindForSegment,
  type Implanter,
  type ImplantationProduct,
  type Segment,
} from '../config/constants.js';
import { getBusyIntervals, getImplanterCalendarId, type BusyInterval } from '../integrations/googleCalendar.js';
import {
  implantationDays,
  optionsForDay,
  type ExistingSession,
  type SlotOption,
} from '../lib/implantationPolicy.js';
import { logger } from '../lib/logger.js';
import { encodeImplantationToken } from '../lib/slotToken.js';
import { listInactiveSubjects } from '../repositories/agendaRepository.js';
import { lastImplanterForSegment, listSessions } from '../repositories/implantationRepository.js';

export interface AvailableImplantationSlot {
  token: string;
  dateLabel: string;
  timeLabel: string;
  remaining: number;
  capacity: number;
  startISO: string;
}

// O implantador é OMITIDO de propósito (anti-favoritismo): "best" = horários do
// próximo da vez (rodízio); "others" = demais elegíveis, revelados sob demanda.
export interface ImplantationAvailability {
  best: AvailableImplantationSlot[];
  others: AvailableImplantationSlot[];
}

const dateLabelFmt = new Intl.DateTimeFormat('pt-BR', {
  timeZone: IMPLANTATION.TIMEZONE,
  weekday: 'short',
  day: '2-digit',
  month: '2-digit',
});

const timeLabelFmt = new Intl.DateTimeFormat('pt-BR', {
  timeZone: IMPLANTATION.TIMEZONE,
  hour: '2-digit',
  minute: '2-digit',
});

// Rodízio: o próximo da vez é o elegível diferente do último agendado no
// segmento. Sem histórico (ou segmento de 1 implantador) → o primeiro.
function pickPreferred(eligible: Implanter[], last: Implanter | null): Implanter {
  if (eligible.length === 1) return eligible[0]!;
  return eligible.find((i) => i !== last) ?? eligible[0]!;
}

function toSlot(implanter: Implanter, product: ImplantationProduct, opt: SlotOption): AvailableImplantationSlot {
  const start = new Date(opt.startISO);
  const end = new Date(opt.endISO);
  return {
    token: encodeImplantationToken({ implanter, product, startISO: opt.startISO, endISO: opt.endISO }),
    dateLabel: dateLabelFmt.format(start),
    timeLabel: `${timeLabelFmt.format(start)}–${timeLabelFmt.format(end)}`,
    remaining: opt.remaining,
    capacity: opt.capacity,
    startISO: opt.startISO,
  };
}

export async function getImplantationAvailability(
  now: Date,
  segment: Segment,
  product: ImplantationProduct,
): Promise<ImplantationAvailability> {
  const inactive = await listInactiveSubjects();
  const eligible = SEGMENT_IMPLANTERS[segment].filter((i) => !inactive.has(i));
  if (eligible.length === 0) return { best: [], others: [] };

  const kind = kindForSegment(segment);
  const capacity = IMPLANTATION_CAPACITY[kind];
  const durationMin = PRODUCT_DURATION_MIN[product];

  const days = implantationDays(now);
  if (days.length === 0) return { best: [], others: [] };

  // Agenda real de cada implantador (freeBusy). Se a leitura falhar, o implantador
  // é EXCLUÍDO (fail-closed): melhor não oferecer horários do que oferecer ocupado.
  const rangeStart = new Date(`${days[0]!}T00:00:00-03:00`);
  const rangeEnd = new Date(`${days[days.length - 1]!}T23:59:59-03:00`);
  const busyByImplanter = new Map<Implanter, BusyInterval[]>();
  await Promise.all(
    eligible.map(async (imp) => {
      try {
        busyByImplanter.set(imp, await getBusyIntervals(getImplanterCalendarId(imp), rangeStart, rangeEnd));
      } catch (err) {
        logger.warn({ err, implanter: imp }, 'implantation availability: freeBusy indisponível — implantador omitido');
      }
    }),
  );
  const readable = eligible.filter((i) => busyByImplanter.has(i));
  if (readable.length === 0) return { best: [], others: [] };

  const sessions = await listSessions(readable, days[0]!, days[days.length - 1]!);
  // Sessões por implantador (normaliza horário para ISO e deriva o tipo).
  const byImplanter = new Map<Implanter, ExistingSession[]>();
  for (const s of sessions) {
    const list = byImplanter.get(s.implanter) ?? [];
    list.push({
      startISO: new Date(s.scheduledStart).toISOString(),
      endISO: new Date(s.scheduledEnd).toISOString(),
      product: s.product,
      kind: s.individual ? 'individual' : 'coletiva',
      count: s.count,
    });
    byImplanter.set(s.implanter, list);
  }

  const slotsFor = (implanter: Implanter): AvailableImplantationSlot[] => {
    const existing = byImplanter.get(implanter) ?? [];
    const busy = busyByImplanter.get(implanter) ?? [];
    return days
      .flatMap((date) => optionsForDay(now, date, product, durationMin, kind, capacity, existing, busy))
      .map((opt) => toSlot(implanter, product, opt));
  };

  const last = readable.length > 1 ? await lastImplanterForSegment(segment) : null;
  const preferred = pickPreferred(readable, last);

  return {
    best: slotsFor(preferred),
    others: readable.filter((i) => i !== preferred).flatMap(slotsFor),
  };
}
