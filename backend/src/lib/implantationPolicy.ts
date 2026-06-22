import {
  IMPLANTATION,
  IMPLANTATION_SLOTS,
  type Implanter,
  type ImplantationSlotKind,
} from '../config/constants.js';

export interface ImplantationSlot {
  implanter: Implanter;
  kind: ImplantationSlotKind;
  start: Date;
  end: Date;
  capacity: number;
}

// Brasil não observa horário de verão desde 2019 → offset fixo -03:00.
const OFFSET = '-03:00';
const DAY_MS = 24 * 60 * 60 * 1000;

const dateFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: IMPLANTATION.TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const weekdayFmt = new Intl.DateTimeFormat('en-US', {
  timeZone: IMPLANTATION.TIMEZONE,
  weekday: 'short',
});

const WEEKEND = new Set(['Sat', 'Sun']);

// Data YYYY-MM-DD no fuso de São Paulo (usada como slot_date e p/ contagem).
export function spDateString(instant: Date): string {
  return dateFmt.format(instant);
}

// Função pura: gera os slots candidatos de um implantador para hoje + os
// próximos dias úteis (WEEKDAYS_AHEAD), omitindo horários já passados e o slot
// individual para quem não é o titular. A capacidade real (vagas) é aplicada
// por quem chama, contando as reservas no banco.
export function generateImplantationSlots(now: Date, implanter: Implanter): ImplantationSlot[] {
  const slots: ImplantationSlot[] = [];
  let weekdays = 0;

  // offset percorre dias corridos; só contamos dias úteis até o limite.
  for (let offset = 0; weekdays < IMPLANTATION.WEEKDAYS_AHEAD && offset < 14; offset++) {
    const dayInstant = new Date(now.getTime() + offset * DAY_MS);
    if (WEEKEND.has(weekdayFmt.format(dayInstant))) continue;
    weekdays++;

    const date = dateFmt.format(dayInstant);
    for (const tpl of IMPLANTATION_SLOTS) {
      if (tpl.onlyImplanter && tpl.onlyImplanter !== implanter) continue;
      const start = new Date(`${date}T${tpl.start}:00${OFFSET}`);
      const end = new Date(`${date}T${tpl.end}:00${OFFSET}`);
      if (start.getTime() <= now.getTime()) continue;
      slots.push({ implanter, kind: tpl.kind, start, end, capacity: tpl.capacity });
    }
  }
  return slots;
}
