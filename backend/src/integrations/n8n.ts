import { env } from '../config/env.js';
import { AppError } from '../errors/AppError.js';

async function postWebhook(
  url: string | undefined,
  payload: unknown,
  missingMessage: string,
  extraHeaders?: Record<string, string>,
): Promise<void> {
  if (!url) {
    throw new AppError({
      code: 'N8N_NOT_CONFIGURED',
      statusCode: 503,
      publicMessage: 'Notificação indisponível.',
      message: missingMessage,
    });
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new AppError({
      code: 'N8N_WEBHOOK_FAILED',
      statusCode: 502,
      publicMessage: 'Notificação indisponível.',
      message: `webhook n8n respondeu ${res.status}`,
    });
  }
}

// Implantação delegada ao n8n: o backend manda os dados e o fluxo n8n formata e
// envia (WhatsApp ao cliente + Slack). O `tipo` roteia no n8n.
export interface ImplantationScheduledNotification {
  tipo: 'agendada';
  companyName: string;
  clientName: string;
  clientEmail: string;
  clientPhoneE164: string;
  segment: string;
  implanter: string;
  product: string;
  scheduledStartISO: string;
  meetingUrl: string | null;
  sellerEmail: string;
  sellerName: string | null;
  occupied: number;
  capacity: number;
}

export interface ImplantationOutcomeParticipant {
  companyName: string;
  clientName: string;
}

export interface ImplantationOutcomeNotification {
  tipo: 'desfecho';
  implanter: string;
  product: string;
  scheduledStartISO: string;
  attended: ImplantationOutcomeParticipant[];
  noShow: ImplantationOutcomeParticipant[];
  observation: string | null;
}

export interface ImplantationLinkRecipient {
  companyName: string;
  clientName: string;
  clientEmail: string;
}

// Disparado quando o implantador cola o link da reunião no pós-reunião: o n8n
// envia o e-mail "link gerado" a cada lead que compareceu.
export interface ImplantationLinkNotification {
  tipo: 'link';
  implanter: string;
  product: string;
  scheduledStartISO: string;
  meetingLink: string;
  recipients: ImplantationLinkRecipient[];
}

export async function notifyImplantationScheduled(
  payload: ImplantationScheduledNotification,
): Promise<void> {
  await postWebhook(env.N8N_IMPLANTACAO_WEBHOOK, payload, 'N8N_IMPLANTACAO_WEBHOOK ausente.');
}

export async function notifyImplantationOutcome(
  payload: ImplantationOutcomeNotification,
): Promise<void> {
  await postWebhook(env.N8N_IMPLANTACAO_WEBHOOK, payload, 'N8N_IMPLANTACAO_WEBHOOK ausente.');
}

export async function notifyImplantationMeetingLink(
  payload: ImplantationLinkNotification,
): Promise<void> {
  await postWebhook(env.N8N_IMPLANTACAO_WEBHOOK, payload, 'N8N_IMPLANTACAO_WEBHOOK ausente.');
}

// Orçamento de integração → n8n que gera a proposta no ClickSign + boleto e, do
// lado do n8n, move o ClickUp para "Orçamento enviado" e avisa no Slack.
// A idempotencyKey vai também como header HTTP para o n8n deduplicar retries.
export async function notifyOrcamentoProposta(
  payload: Record<string, unknown>,
  idempotencyKey: string,
): Promise<void> {
  await postWebhook(env.N8N_CLICKSIGN_WEBHOOK, payload, 'N8N_CLICKSIGN_WEBHOOK ausente.', {
    'Idempotency-Key': idempotencyKey,
  });
}
