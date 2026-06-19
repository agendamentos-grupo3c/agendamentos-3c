import { env } from '../config/env.js';
import { AppError } from '../errors/AppError.js';

const POST_MESSAGE_URL = 'https://slack.com/api/chat.postMessage';

function getConfig(): { token: string; channelIds: string[] } {
  const { SLACK_BOT_TOKEN, SLACK_CHANNEL_IDS } = env;
  const channelIds = (SLACK_CHANNEL_IDS ?? '')
    .split(',')
    .map((c) => c.trim())
    .filter(Boolean);
  if (!SLACK_BOT_TOKEN || channelIds.length === 0) {
    throw new AppError({
      code: 'SLACK_NOT_CONFIGURED',
      statusCode: 503,
      publicMessage: 'Notificação indisponível.',
      message: 'SLACK_BOT_TOKEN/SLACK_CHANNEL_IDS ausentes.',
    });
  }
  return { token: SLACK_BOT_TOKEN, channelIds };
}

async function postToChannel(token: string, channel: string, text: string): Promise<void> {
  const res = await fetch(POST_MESSAGE_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ channel, text }),
  });
  const json = (await res.json()) as { ok: boolean; error?: string };
  // A Web API do Slack retorna 200 com ok:false em caso de erro.
  if (!res.ok || !json.ok) {
    throw new AppError({
      code: 'SLACK_SEND_FAILED',
      statusCode: 502,
      publicMessage: 'Notificação indisponível.',
      message: `chat.postMessage falhou: ${json.error ?? res.status}`,
    });
  }
}

export async function sendToChannels(text: string): Promise<void> {
  const { token, channelIds } = getConfig();
  await Promise.all(channelIds.map((channel) => postToChannel(token, channel, text)));
}
