import { env } from '../config/env.js';
import { AppError } from '../errors/AppError.js';

const API = 'https://api.clickup.com/api/v2';

function getConfig(): { token: string; listId: string } {
  const { CLICKUP_API_TOKEN, CLICKUP_LIST_ID } = env;
  if (!CLICKUP_API_TOKEN || !CLICKUP_LIST_ID) {
    throw new AppError({
      code: 'CLICKUP_NOT_CONFIGURED',
      statusCode: 503,
      publicMessage: 'Sincronização indisponível.',
      message: 'CLICKUP_API_TOKEN/CLICKUP_LIST_ID ausentes.',
    });
  }
  return { token: CLICKUP_API_TOKEN, listId: CLICKUP_LIST_ID };
}

export async function createTask(input: {
  name: string;
  description: string;
  status: string;
}): Promise<{ taskId: string }> {
  const { token, listId } = getConfig();
  const res = await fetch(`${API}/list/${encodeURIComponent(listId)}/task`, {
    method: 'POST',
    headers: { Authorization: token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: input.name, description: input.description, status: input.status }),
  });
  if (!res.ok) {
    throw new AppError({
      code: 'CLICKUP_CREATE_FAILED',
      statusCode: 502,
      publicMessage: 'Sincronização indisponível.',
      message: `ClickUp task create respondeu ${res.status}`,
    });
  }
  const json = (await res.json()) as { id: string };
  return { taskId: json.id };
}

// Atualização de status por etapa (seção 7.7) — usado também no Passo 9.
export async function updateTaskStatus(taskId: string, status: string): Promise<void> {
  const { token } = getConfig();
  const res = await fetch(`${API}/task/${encodeURIComponent(taskId)}`, {
    method: 'PUT',
    headers: { Authorization: token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) {
    throw new AppError({
      code: 'CLICKUP_UPDATE_FAILED',
      statusCode: 502,
      publicMessage: 'Sincronização indisponível.',
      message: `ClickUp task update respondeu ${res.status}`,
    });
  }
}
