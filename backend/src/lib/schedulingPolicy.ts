import { SCHEDULING } from '../config/constants.js';

export type Collaborator = 'alana' | 'guilherme';

export interface Slot {
  start: Date;
  end: Date;
}

// Brasil não observa horário de verão desde 2019 → offset fixo -03:00.
const OFFSET = '-03:00';
const DAY_MS = 24 * 60 * 60 * 1000;
const NOON_HOUR = 12;

// Antecedência mínima: o slot precisa estar pelo menos 2 meios-períodos à frente
// do período atual. Isso exclui o mesmo dia e garante meio período de folga
// (Alana atende de manhã, Guilherme à tarde):
//   - agora de manhã  → libera a partir do dia seguinte de manhã (Alana) e tarde
//     (Guilherme);
//   - agora à tarde   → libera o dia seguinte à tarde (Guilherme), mas NÃO o dia
//     seguinte de manhã (Alana) — falta meio período.
const MIN_PERIODS_AHEAD = 2;

const dateFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: SCHEDULING.TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const hourFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: SCHEDULING.TIMEZONE,
  hour: '2-digit',
  hourCycle: 'h23',
});

const weekdayFmt = new Intl.DateTimeFormat('en-US', {
  timeZone: SCHEDULING.TIMEZONE,
  weekday: 'short',
});

const WEEKEND = new Set(['Sat', 'Sun']);

// Índice absoluto de meio-período: dois por dia (manhã = 0, tarde = 1), contados
// no fuso de São Paulo. Permite comparar antecedência sem ambiguidade.
function periodIndex(instant: Date): number {
  const dateSP = dateFmt.format(instant);
  const hourSP = Number(hourFmt.format(instant));
  const dayNumber = Math.floor(Date.parse(`${dateSP}T00:00:00${OFFSET}`) / DAY_MS);
  return dayNumber * 2 + (hourSP < NOON_HOUR ? 0 : 1);
}

// Função pura: dado o instante atual, gera os slots candidatos respeitando a
// janela (hoje + DAYS_AHEAD dias), fins de semana e a antecedência mínima por
// meio-período. A disponibilidade real (freeBusy) é aplicada por quem chama.
export function generateSlots(now: Date, collaborator: Collaborator): Slot[] {
  const templates = SCHEDULING.SLOTS[collaborator];
  const minPeriod = periodIndex(now) + MIN_PERIODS_AHEAD;
  const slots: Slot[] = [];

  for (let offset = 0; offset <= SCHEDULING.DAYS_AHEAD; offset++) {
    const dayInstant = new Date(now.getTime() + offset * DAY_MS);
    if (!SCHEDULING.INCLUDE_WEEKENDS && WEEKEND.has(weekdayFmt.format(dayInstant))) continue;

    const date = dateFmt.format(dayInstant); // YYYY-MM-DD em America/Sao_Paulo
    for (const [start, end] of templates) {
      const startDate = new Date(`${date}T${start}:00${OFFSET}`);
      const endDate = new Date(`${date}T${end}:00${OFFSET}`);
      if (periodIndex(startDate) < minPeriod) continue;
      slots.push({ start: startDate, end: endDate });
    }
  }
  return slots;
}
