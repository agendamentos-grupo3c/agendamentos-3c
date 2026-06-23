import { env } from '../config/env.js';
import { AppError } from '../errors/AppError.js';

// Notificação da implantação delegada ao n8n: o backend chama o webhook com os
// dados do agendamento e o fluxo n8n dispara WhatsApp + e-mail ao cliente.
export interface ImplantationNotification {
  companyName: string;
  clientName: string;
  clientEmail: string;
  clientPhoneE164: string;
  clientId: string | null;
  implanter: string;
  scheduledStart: string;
  meetingUrl: string | null;
  requesterName: string | null;
  requesterEmail: string;
}

async function postWebhook(
  url: string | undefined,
  payload: unknown,
  missingMessage: string,
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
    headers: { 'Content-Type': 'application/json' },
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

export async function notifyImplantation(payload: ImplantationNotification): Promise<void> {
  await postWebhook(env.N8N_IMPLANTACAO_WEBHOOK, payload, 'N8N_IMPLANTACAO_WEBHOOK ausente.');
}
