import {
  IMPLANTATION,
  IMPLANTATION_SLOT_LABELS,
  IMPLANTER_LABELS,
  SEGMENT_IMPLANTERS,
  type Implanter,
  type ImplantationSlotKind,
  type Segment,
} from '../config/constants.js';
import { generateImplantationSlots, spDateString } from '../lib/implantationPolicy.js';
import { encodeImplantationToken } from '../lib/slotToken.js';
import { countsForWindow } from '../repositories/implantationRepository.js';

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

export interface ImplanterAvailability {
  implanter: Implanter;
  label: string;
  slots: AvailableImplantationSlot[];
}

export interface ImplantationAvailability {
  implanters: ImplanterAvailability[];
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

// Disponibilidade por segmento: para cada implantador que atende, lista os slots
// futuros (hoje + dias úteis) com as vagas restantes (capacidade − reservas).
export async function getImplantationAvailability(
  now: Date,
  segment: Segment,
): Promise<ImplantationAvailability> {
  const implanters = SEGMENT_IMPLANTERS[segment];

  const generated = implanters.map((implanter) => ({
    implanter,
    slots: generateImplantationSlots(now, implanter),
  }));

  const allDates = generated.flatMap((g) => g.slots.map((s) => spDateString(s.start)));
  const counts =
    allDates.length === 0
      ? []
      : await countsForWindow(
          implanters,
          allDates.reduce((a, b) => (a < b ? a : b)),
          allDates.reduce((a, b) => (a > b ? a : b)),
        );

  const countMap = new Map<string, number>();
  for (const c of counts) countMap.set(countKey(c.implanter, c.slotDate, c.slotKind), c.count);

  const result: ImplanterAvailability[] = generated.map(({ implanter, slots }) => ({
    implanter,
    label: IMPLANTER_LABELS[implanter],
    slots: slots
      .map((slot) => {
        const used = countMap.get(countKey(implanter, spDateString(slot.start), slot.kind)) ?? 0;
        const remaining = slot.capacity - used;
        return { slot, remaining };
      })
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
      })),
  }));

  return { implanters: result };
}
