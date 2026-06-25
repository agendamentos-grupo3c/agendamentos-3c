import { IMPLANTATION, type ImplantationKind, type ImplantationProduct } from '../config/constants.js';

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

// Próximos dias ÚTEIS (hoje + WEEKDAYS_AHEAD), como 'YYYY-MM-DD'.
export function implantationDays(now: Date): string[] {
  const days: string[] = [];
  for (let offset = 0; days.length < IMPLANTATION.WEEKDAYS_AHEAD && offset < 14; offset++) {
    const day = new Date(now.getTime() + offset * DAY_MS);
    if (WEEKEND.has(weekdayFmt.format(day))) continue;
    days.push(dateFmt.format(day));
  }
  return days;
}

// Sessão já existente na agenda do implantador (vinda do banco).
export interface ExistingSession {
  startISO: string;
  endISO: string;
  product: ImplantationProduct;
  kind: ImplantationKind;
  count: number;
}

// Opção de horário oferecida ao vendedor (entrar numa sessão ou abrir nova).
export interface SlotOption {
  startISO: string;
  endISO: string;
  remaining: number;
  capacity: number;
  isNew: boolean;
}

function bounds(date: string, hm: readonly [string, string]): [Date, Date] {
  return [new Date(`${date}T${hm[0]}:00${OFFSET}`), new Date(`${date}T${hm[1]}:00${OFFSET}`)];
}

// Para um dia: dentro de cada janela, oferece (a) sessões abertas do MESMO
// produto/tipo com vaga (entrar) e (b) o próximo bloco livre se a duração couber
// (abrir nova). Sessões empacotam sequencialmente a partir do início da janela.
export function optionsForDay(
  now: Date,
  date: string,
  product: ImplantationProduct,
  durationMin: number,
  kind: ImplantationKind,
  capacity: number,
  sessions: ExistingSession[],
): SlotOption[] {
  const options: SlotOption[] = [];
  const durMs = durationMin * 60 * 1000;

  for (const hm of IMPLANTATION.WINDOWS) {
    const [wStart, wEnd] = bounds(date, hm);
    const inWindow = sessions
      .map((s) => ({ s, start: new Date(s.startISO), end: new Date(s.endISO) }))
      .filter(({ start }) => start.getTime() >= wStart.getTime() && start.getTime() < wEnd.getTime())
      .sort((a, b) => a.start.getTime() - b.start.getTime());

    // (a) Entrar numa sessão aberta do mesmo produto/tipo com vaga.
    for (const { s, start } of inWindow) {
      if (
        s.product === product &&
        s.kind === kind &&
        s.count < capacity &&
        start.getTime() > now.getTime()
      ) {
        options.push({
          startISO: s.startISO,
          endISO: s.endISO,
          remaining: capacity - s.count,
          capacity,
          isNew: false,
        });
      }
    }

    // (b) Abrir nova sessão no próximo bloco livre (após a última sessão).
    const lastEnd = inWindow.length ? inWindow[inWindow.length - 1]!.end : wStart;
    const nextStart = lastEnd.getTime() > wStart.getTime() ? lastEnd : wStart;
    const nextEnd = new Date(nextStart.getTime() + durMs);
    if (nextEnd.getTime() <= wEnd.getTime() && nextStart.getTime() > now.getTime()) {
      options.push({
        startISO: nextStart.toISOString(),
        endISO: nextEnd.toISOString(),
        remaining: capacity,
        capacity,
        isNew: true,
      });
    }
  }
  return options;
}
