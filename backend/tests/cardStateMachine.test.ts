import { describe, expect, it } from 'vitest';

import { canTransition } from '../src/lib/cardStateMachine';

describe('canTransition', () => {
  it('permite os desfechos do kickoff', () => {
    expect(canTransition('kickoff', 'compareceu')).toBe(true);
    expect(canTransition('kickoff', 'no_show')).toBe(true);
  });

  it('permite compareceu → orçamento enviado', () => {
    expect(canTransition('compareceu', 'orcamento_enviado')).toBe(true);
  });

  it('bloqueia pular o compareceu (kickoff → orçamento enviado)', () => {
    expect(canTransition('kickoff', 'orcamento_enviado')).toBe(false);
  });

  it('permite reagendar a partir do no-show (no_show → kickoff)', () => {
    expect(canTransition('no_show', 'kickoff')).toBe(true);
  });

  it('bloqueia transições inválidas do no-show e do estado terminal', () => {
    expect(canTransition('no_show', 'compareceu')).toBe(false);
    expect(canTransition('no_show', 'orcamento_enviado')).toBe(false);
    expect(canTransition('orcamento_enviado', 'compareceu')).toBe(false);
    expect(canTransition('orcamento_enviado', 'kickoff')).toBe(false);
  });

  it('bloqueia no-show a partir de compareceu', () => {
    expect(canTransition('compareceu', 'no_show')).toBe(false);
  });
});
