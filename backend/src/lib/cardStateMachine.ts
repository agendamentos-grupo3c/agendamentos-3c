import type { CardStatus } from '../config/constants.js';

// Máquina de estados do card (seção 7.8). Transições válidas:
//   kickoff → compareceu | no_show
//   compareceu → orcamento_enviado
//   no_show → kickoff (reagendamento pelo vendedor — mesma tarefa, novo horário)
// Estado terminal: orcamento_enviado.
const TRANSITIONS: Record<CardStatus, readonly CardStatus[]> = {
  kickoff: ['compareceu', 'no_show'],
  compareceu: ['orcamento_enviado'],
  no_show: ['kickoff'],
  orcamento_enviado: [],
};

export function canTransition(from: CardStatus, to: CardStatus): boolean {
  return TRANSITIONS[from].includes(to);
}
