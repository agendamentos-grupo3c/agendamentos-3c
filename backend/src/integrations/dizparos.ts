import { env } from '../config/env.js';
import { AppError } from '../errors/AppError.js';

const SEND_URL = 'https://api.dizparos.dev/v1/whatsapp/send';

function getApiKey(): string {
  const { DIZPAROS_API_KEY } = env;
  if (!DIZPAROS_API_KEY) {
    throw new AppError({
      code: 'DIZPAROS_NOT_CONFIGURED',
      statusCode: 503,
      publicMessage: 'Envio de WhatsApp indisponível.',
      message: 'DIZPAROS_API_KEY ausente.',
    });
  }
  return DIZPAROS_API_KEY;
}

// `to` deve estar em E.164 (+55...). A API key vive só no backend.
export async function sendWhatsapp(to: string, message: string): Promise<void> {
  const apiKey = getApiKey();
  const res = await fetch(SEND_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ to, message }),
  });
  if (!res.ok) {
    throw new AppError({
      code: 'DIZPAROS_SEND_FAILED',
      statusCode: 502,
      publicMessage: 'Envio de WhatsApp indisponível.',
      message: `dizparos respondeu ${res.status}`,
    });
  }
}
