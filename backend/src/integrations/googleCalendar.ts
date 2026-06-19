import { randomUUID } from 'node:crypto';

import { GOOGLE } from '../config/constants.js';
import { env } from '../config/env.js';
import { AppError } from '../errors/AppError.js';

const CALENDAR_API = 'https://www.googleapis.com/calendar/v3';

interface CalendarConfig {
  alanaId: string;
  guilhermeId: string;
  refreshToken: string;
  clientId: string;
  clientSecret: string;
}

export function getCalendarConfig(): CalendarConfig {
  const {
    CALENDAR_ALANA_ID,
    CALENDAR_GUILHERME_ID,
    GOOGLE_CALENDAR_REFRESH_TOKEN,
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
  } = env;

  if (
    !CALENDAR_ALANA_ID ||
    !CALENDAR_GUILHERME_ID ||
    !GOOGLE_CALENDAR_REFRESH_TOKEN ||
    !GOOGLE_CLIENT_ID ||
    !GOOGLE_CLIENT_SECRET
  ) {
    throw new AppError({
      code: 'CALENDAR_NOT_CONFIGURED',
      statusCode: 503,
      publicMessage: 'Agenda indisponível no momento.',
      message: 'CALENDAR_*/GOOGLE_CALENDAR_REFRESH_TOKEN/GOOGLE_CLIENT_* ausentes.',
    });
  }

  return {
    alanaId: CALENDAR_ALANA_ID,
    guilhermeId: CALENDAR_GUILHERME_ID,
    refreshToken: GOOGLE_CALENDAR_REFRESH_TOKEN,
    clientId: GOOGLE_CLIENT_ID,
    clientSecret: GOOGLE_CLIENT_SECRET,
  };
}

let cached: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;

  const cfg = getCalendarConfig();
  const res = await fetch(GOOGLE.TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      refresh_token: cfg.refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!res.ok) {
    throw new AppError({
      code: 'CALENDAR_AUTH_FAILED',
      statusCode: 502,
      publicMessage: 'Agenda indisponível no momento.',
      message: `refresh token endpoint respondeu ${res.status}`,
    });
  }

  const json = (await res.json()) as { access_token: string; expires_in: number };
  cached = { token: json.access_token, expiresAt: Date.now() + json.expires_in * 1000 };
  return json.access_token;
}

export interface BusyInterval {
  start: string;
  end: string;
}

export async function getBusyIntervals(
  calendarId: string,
  timeMin: Date,
  timeMax: Date,
): Promise<BusyInterval[]> {
  const token = await getAccessToken();
  const res = await fetch(`https://www.googleapis.com/calendar/v3/freeBusy`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      items: [{ id: calendarId }],
    }),
  });

  if (!res.ok) {
    throw new AppError({
      code: 'CALENDAR_FREEBUSY_FAILED',
      statusCode: 502,
      publicMessage: 'Não foi possível carregar a agenda.',
      message: `freeBusy respondeu ${res.status}`,
    });
  }

  const json = (await res.json()) as {
    calendars?: Record<string, { busy?: BusyInterval[]; errors?: unknown[] }>;
  };
  const cal = json.calendars?.[calendarId];
  if (!cal || (cal.errors && cal.errors.length > 0)) {
    throw new AppError({
      code: 'CALENDAR_ACCESS_ERROR',
      statusCode: 502,
      publicMessage: 'Não foi possível carregar a agenda.',
      message: 'freeBusy retornou erro para a agenda solicitada',
    });
  }
  return cal.busy ?? [];
}

export interface CreateEventInput {
  calendarId: string;
  summary: string;
  description: string;
  start: Date;
  end: Date;
  attendeeEmail: string;
}

export interface CreatedEvent {
  eventId: string;
  meetUrl?: string;
  htmlLink?: string;
}

// Cria o evento real com Google Meet e o cliente como convidado (usado pelo
// pipeline de submit, Passo 8). sendUpdates=all dispara o convite por e-mail.
export async function createEvent(input: CreateEventInput): Promise<CreatedEvent> {
  const token = await getAccessToken();
  const res = await fetch(
    `${CALENDAR_API}/calendars/${encodeURIComponent(input.calendarId)}/events?conferenceDataVersion=1&sendUpdates=all`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        summary: input.summary,
        description: input.description,
        start: { dateTime: input.start.toISOString() },
        end: { dateTime: input.end.toISOString() },
        attendees: [{ email: input.attendeeEmail }],
        conferenceData: {
          createRequest: {
            requestId: randomUUID(),
            conferenceSolutionKey: { type: 'hangoutsMeet' },
          },
        },
      }),
    },
  );

  if (!res.ok) {
    throw new AppError({
      code: 'CALENDAR_EVENT_FAILED',
      statusCode: 502,
      publicMessage: 'Não foi possível criar o evento na agenda.',
      message: `events.insert respondeu ${res.status}`,
    });
  }

  const json = (await res.json()) as { id: string; hangoutLink?: string; htmlLink?: string };
  return { eventId: json.id, meetUrl: json.hangoutLink, htmlLink: json.htmlLink };
}
