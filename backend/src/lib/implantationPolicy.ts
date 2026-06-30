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

// Intervalo ocupado na agenda real do implantador (freeBusy do Google).
export interface Interval {
  start: string;
  end: string;
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

interface Occupied {
  start: number;
  end: number;
}

// Próximo início livre na janela: o primeiro ponto (início da janela ou fim de um
// intervalo ocupado) em que cabe um bloco de `durMs` sem sobrepor nada ocupado.
// `occupied` = sessões nossas + agenda real do implantador (freeBusy).
function nextFreeStart(
  wStart: Date,
  wEnd: Date,
  durMs: number,
  occupied: Occupied[],
  now: Date,
): Date | null {
  const candidates = [wStart.getTime(), ...occupied.map((o) => o.end)]
    .filter((t) => t >= wStart.getTime() && t < wEnd.getTime())
    .sort((a, b) => a - b);

  for (const start of candidates) {
    if (start <= now.getTime()) continue;
    const end = start + durMs;
    if (end > wEnd.getTime()) continue;
    const clash = occupied.some((o) => start < o.end && o.start < end);
    if (!clash) return new Date(start);
  }
  return null;
}

// Para um dia: dentro de cada janela, oferece (a) sessões abertas do MESMO
// produto/tipo com vaga (entrar) e (b) o próximo bloco livre que caiba (abrir
// nova), pulando qualquer compromisso real do implantador (`busy`/freeBusy) e as
// sessões já existentes. Entrar numa sessão nossa do mesmo produto é permitido
// mesmo o horário aparecendo "ocupado" — o evento é justamente essa sessão.
export function optionsForDay(
  now: Date,
  date: string,
  product: ImplantationProduct,
  durationMin: number,
  kind: ImplantationKind,
  capacity: number,
  sessions: ExistingSession[],
  busy: readonly Interval[] = [],
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

    // (b) Abrir nova sessão: pula sessões existentes E a agenda real do implantador.
    const occupied: Occupied[] = [
      ...inWindow.map(({ start, end }) => ({ start: start.getTime(), end: end.getTime() })),
      ...busy.map((b) => ({ start: new Date(b.start).getTime(), end: new Date(b.end).getTime() })),
    ];
    const start = nextFreeStart(wStart, wEnd, durMs, occupied, now);
    if (start) {
      options.push({
        startISO: start.toISOString(),
        endISO: new Date(start.getTime() + durMs).toISOString(),
        remaining: capacity,
        capacity,
        isNew: true,
      });
    }
  }
  return options;
}
