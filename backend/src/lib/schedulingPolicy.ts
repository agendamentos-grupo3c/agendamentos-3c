import { SCHEDULING } from '../config/constants.js';

export type Collaborator = 'alana' | 'guilherme';

export interface Slot {
  start: Date;
  end: Date;
}

// Brasil não observa horário de verão desde 2019 → offset fixo -03:00.
const OFFSET = '-03:00';
const DAY_MS = 24 * 60 * 60 * 1000;

const dateFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: SCHEDULING.TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const weekdayFmt = new Intl.DateTimeFormat('en-US', {
  timeZone: SCHEDULING.TIMEZONE,
  weekday: 'short',
});

const WEEKEND = new Set(['Sat', 'Sun']);

// Função pura: dado o instante atual, gera os slots candidatos (futuros, dentro
// da janela de dias, respeitando fins de semana). A disponibilidade real
// (freeBusy) é aplicada por quem chama — aqui não há I/O.
export function generateSlots(now: Date, collaborator: Collaborator): Slot[] {
  const templates = SCHEDULING.SLOTS[collaborator];
  const minStart = now.getTime() + SCHEDULING.MIN_LEAD_MINUTES * 60_000;
  const slots: Slot[] = [];

  for (let offset = 0; offset < SCHEDULING.DAYS_AHEAD; offset++) {
    const dayInstant = new Date(now.getTime() + offset * DAY_MS);
    if (!SCHEDULING.INCLUDE_WEEKENDS && WEEKEND.has(weekdayFmt.format(dayInstant))) continue;

    const date = dateFmt.format(dayInstant); // YYYY-MM-DD em America/Sao_Paulo
    for (const [start, end] of templates) {
      const startDate = new Date(`${date}T${start}:00${OFFSET}`);
      const endDate = new Date(`${date}T${end}:00${OFFSET}`);
      if (startDate.getTime() <= minStart) continue;
      slots.push({ start: startDate, end: endDate });
    }
  }
  return slots;
}
