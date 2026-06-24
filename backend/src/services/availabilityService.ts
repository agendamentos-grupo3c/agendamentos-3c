import { SCHEDULING } from '../config/constants.js';
import { getBusyIntervals, getCalendarConfig, type BusyInterval } from '../integrations/googleCalendar.js';
import { generateSlots, type Collaborator, type Slot } from '../lib/schedulingPolicy.js';
import { encodeSlotToken } from '../lib/slotToken.js';
import { listInactiveSubjects } from '../repositories/agendaRepository.js';

export interface AvailableSlot {
  token: string;
  dateLabel: string;
  timeLabel: string;
  startISO: string;
}

export interface Availability {
  alana: AvailableSlot[];
  guilherme: AvailableSlot[];
}

function overlaps(slot: Slot, busy: BusyInterval): boolean {
  const busyStart = new Date(busy.start).getTime();
  const busyEnd = new Date(busy.end).getTime();
  return slot.start.getTime() < busyEnd && busyStart < slot.end.getTime();
}

const dateLabelFmt = new Intl.DateTimeFormat('pt-BR', {
  timeZone: SCHEDULING.TIMEZONE,
  weekday: 'short',
  day: '2-digit',
  month: '2-digit',
});

const timeLabelFmt = new Intl.DateTimeFormat('pt-BR', {
  timeZone: SCHEDULING.TIMEZONE,
  hour: '2-digit',
  minute: '2-digit',
});

async function forCollaborator(
  now: Date,
  collaborator: Collaborator,
  calendarId: string,
): Promise<AvailableSlot[]> {
  const candidates = generateSlots(now, collaborator);
  if (candidates.length === 0) return [];

  const timeMax = new Date(Math.max(...candidates.map((s) => s.end.getTime())));
  const busy = await getBusyIntervals(calendarId, now, timeMax);

  return candidates
    .filter((slot) => !busy.some((b) => overlaps(slot, b)))
    .map((slot) => ({
      token: encodeSlotToken({
        collaborator,
        startISO: slot.start.toISOString(),
        endISO: slot.end.toISOString(),
      }),
      dateLabel: dateLabelFmt.format(slot.start),
      timeLabel: `${timeLabelFmt.format(slot.start)}–${timeLabelFmt.format(slot.end)}`,
      startISO: slot.start.toISOString(),
    }));
}

// Duas colunas (seção 7.3): horários livres da Alana e do Guilherme. O front
// recebe apenas rótulos + token opaco — nunca e-mails/IDs de agenda.
export async function getAvailability(now: Date): Promise<Availability> {
  const cfg = getCalendarConfig();
  // Agenda pausada não é oferecida (a coluna some).
  const inactive = await listInactiveSubjects();
  const [alana, guilherme] = await Promise.all([
    inactive.has('alana') ? Promise.resolve([]) : forCollaborator(now, 'alana', cfg.alanaId),
    inactive.has('guilherme') ? Promise.resolve([]) : forCollaborator(now, 'guilherme', cfg.guilhermeId),
  ]);
  return { alana, guilherme };
}
