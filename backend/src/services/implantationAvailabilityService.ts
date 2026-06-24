import {
  IMPLANTATION,
  IMPLANTATION_SLOT_LABELS,
  SEGMENT_IMPLANTERS,
  type Implanter,
  type ImplantationSlotKind,
  type Segment,
} from '../config/constants.js';
import {
  generateImplantationSlots,
  spDateString,
  type ImplantationSlot,
} from '../lib/implantationPolicy.js';
import { encodeImplantationToken } from '../lib/slotToken.js';
import { listInactiveSubjects } from '../repositories/agendaRepository.js';
import { countsForWindow, lastImplanterForSegment } from '../repositories/implantationRepository.js';

export interface AvailableImplantationSlot {
  token: string;
  dateLabel: string;
  timeLabel: string;
  kind: ImplantationSlotKind;
  kindLabel: string;
  remaining: number;
  capacity: number;
  startISO: string;
}

// O implantador é OMITIDO de propósito: o vendedor escolhe só o horário (evita
// favoritismo). "best" = horários do próximo da vez (rodízio); "others" = demais
// elegíveis, revelados sob demanda quando o próximo da vez não tem o horário.
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

const countKey = (implanter: Implanter, date: string, kind: ImplantationSlotKind): string =>
  `${implanter}|${date}|${kind}`;

// Rodízio por alternância: o próximo da vez é o elegível diferente do último
// agendado no segmento. Sem histórico (ou segmento de 1 implantador) → o primeiro.
function pickPreferred(eligible: Implanter[], last: Implanter | null): Implanter {
  if (eligible.length === 1) return eligible[0]!;
  return eligible.find((i) => i !== last) ?? eligible[0]!;
}

export async function getImplantationAvailability(
  now: Date,
  segment: Segment,
): Promise<ImplantationAvailability> {
  // Implantadores com agenda pausada saem da lista de elegíveis.
  const inactive = await listInactiveSubjects();
  const eligible = SEGMENT_IMPLANTERS[segment].filter((i) => !inactive.has(i));
  if (eligible.length === 0) return { best: [], others: [] };
  const last = eligible.length > 1 ? await lastImplanterForSegment(segment) : null;
  const preferred = pickPreferred(eligible, last);

  const generated = eligible.map((implanter) => ({
    implanter,
    slots: generateImplantationSlots(now, implanter),
  }));

  const allDates = generated.flatMap((g) => g.slots.map((s) => spDateString(s.start)));
  const counts =
    allDates.length === 0
      ? []
      : await countsForWindow(
          eligible,
          allDates.reduce((a, b) => (a < b ? a : b)),
          allDates.reduce((a, b) => (a > b ? a : b)),
        );

  const countMap = new Map<string, number>();
  for (const c of counts) countMap.set(countKey(c.implanter, c.slotDate, c.slotKind), c.count);

  const toAvailable = (implanter: Implanter, slots: ImplantationSlot[]): AvailableImplantationSlot[] =>
    slots
      .map((slot) => ({
        slot,
        remaining: slot.capacity - (countMap.get(countKey(implanter, spDateString(slot.start), slot.kind)) ?? 0),
      }))
      .filter(({ remaining }) => remaining > 0)
      .map(({ slot, remaining }) => ({
        token: encodeImplantationToken({
          implanter,
          kind: slot.kind,
          startISO: slot.start.toISOString(),
          endISO: slot.end.toISOString(),
        }),
        dateLabel: dateLabelFmt.format(slot.start),
        timeLabel: `${timeLabelFmt.format(slot.start)}–${timeLabelFmt.format(slot.end)}`,
        kind: slot.kind,
        kindLabel: IMPLANTATION_SLOT_LABELS[slot.kind],
        remaining,
        capacity: slot.capacity,
        startISO: slot.start.toISOString(),
      }));

  const preferredSlots = generated.find((g) => g.implanter === preferred)?.slots ?? [];
  const best = toAvailable(preferred, preferredSlots);
  const others = generated
    .filter((g) => g.implanter !== preferred)
    .flatMap((g) => toAvailable(g.implanter, g.slots));

  return { best, others };
}
