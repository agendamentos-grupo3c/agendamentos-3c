import type { CardStatus } from '../config/constants.js';

// Máquina de estados do card (seção 7.8). Transições válidas:
//   kickoff → compareceu | no_show
//   compareceu → orcamento_enviado
// Estados terminais: no_show, orcamento_enviado.
const TRANSITIONS: Record<CardStatus, readonly CardStatus[]> = {
  kickoff: ['compareceu', 'no_show'],
  compareceu: ['orcamento_enviado'],
  no_show: [],
  orcamento_enviado: [],
};

export function canTransition(from: CardStatus, to: CardStatus): boolean {
  return TRANSITIONS[from].includes(to);
}
