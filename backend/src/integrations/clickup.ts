import { CLICKUP, type DemandType } from '../config/constants.js';
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

async function request(path: string, init: RequestInit, code: string): Promise<unknown> {
  const { token } = getConfig();
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: token, 'Content-Type': 'application/json', ...init.headers },
  });
  if (!res.ok) {
    throw new AppError({
      code,
      statusCode: 502,
      publicMessage: 'Sincronização indisponível.',
      message: `ClickUp ${path} respondeu ${res.status}`,
    });
  }
  return res.json();
}

export interface KickoffTaskInput {
  companyName: string;
  clientName: string;
  phoneE164: string;
  description: string;
  requesterEmail: string;
  requesterName: string;
  clientId: string;
  demandType: DemandType;
}

// Cria a task no funil (status "kickoff") com os custom fields. O fluxo n8n da
// 3C reage à lista e dispara Slack/WhatsApp.
export async function createKickoffTask(input: KickoffTaskInput): Promise<{ taskId: string }> {
  const { listId } = getConfig();
  const body = {
    name: `Kickoff - ${input.companyName} (${input.clientName})`,
    status: 'kickoff',
    custom_fields: [
      { id: CLICKUP.FIELDS.companyName, value: input.companyName },
      { id: CLICKUP.FIELDS.clientName, value: input.clientName },
      { id: CLICKUP.FIELDS.phone, value: input.phoneE164 },
      { id: CLICKUP.FIELDS.description, value: input.description },
      { id: CLICKUP.FIELDS.requesterEmail, value: input.requesterEmail },
      { id: CLICKUP.FIELDS.requesterName, value: input.requesterName },
      { id: CLICKUP.FIELDS.clientId, value: input.clientId },
      { id: CLICKUP.FIELDS.demandType, value: CLICKUP.DEMAND_TYPE_OPTION[input.demandType] },
    ],
  };
  const json = (await request(
    `/list/${encodeURIComponent(listId)}/task`,
    { method: 'POST', body: JSON.stringify(body) },
    'CLICKUP_CREATE_FAILED',
  )) as { id: string };
  return { taskId: json.id };
}

export async function updateTaskStatus(taskId: string, status: string): Promise<void> {
  await request(
    `/task/${encodeURIComponent(taskId)}`,
    { method: 'PUT', body: JSON.stringify({ status }) },
    'CLICKUP_UPDATE_FAILED',
  );
}

// Troca o responsável (assignee) da task: adiciona o novo integrador e remove o
// anterior. Usado no reagendamento quando muda o integrador.
export async function changeTaskAssignee(
  taskId: string,
  addUserId: number,
  remUserIds: number[],
): Promise<void> {
  await request(
    `/task/${encodeURIComponent(taskId)}`,
    { method: 'PUT', body: JSON.stringify({ assignees: { add: [addUserId], rem: remUserIds } }) },
    'CLICKUP_ASSIGNEE_FAILED',
  );
}

// Registra um comentário na task (ex.: aviso de reagendamento). Mantém o
// histórico na mesma tarefa, sem criar uma nova.
export async function addTaskComment(taskId: string, text: string): Promise<void> {
  await request(
    `/task/${encodeURIComponent(taskId)}/comment`,
    { method: 'POST', body: JSON.stringify({ comment_text: text, notify_all: false }) },
    'CLICKUP_COMMENT_FAILED',
  );
}

// Preenche o campo monetário "Valor do orçamento" (currency espera número).
export async function setBudgetField(taskId: string, value: number): Promise<void> {
  await request(
    `/task/${encodeURIComponent(taskId)}/field/${CLICKUP.FIELDS.budget}`,
    { method: 'POST', body: JSON.stringify({ value }) },
    'CLICKUP_FIELD_FAILED',
  );
}
