import { describe, expect, it } from 'vitest';

import { generateSlots } from '../src/lib/schedulingPolicy';

// Datas de referência (2026-01-01 é quinta): 01/05 = segunda, 01/02 = sexta.
const MONDAY_MORNING = new Date('2026-01-05T07:00:00-03:00');
const MONDAY_LATE = new Date('2026-01-05T11:00:00-03:00');
const FRIDAY_MORNING = new Date('2026-01-02T07:00:00-03:00');

describe('generateSlots', () => {
  it('gera 4 slots/dia em 3 dias úteis (12) para a Alana', () => {
    expect(generateSlots(MONDAY_MORNING, 'alana')).toHaveLength(12);
    expect(generateSlots(MONDAY_MORNING, 'guilherme')).toHaveLength(12);
  });

  it('omite slots no passado do dia corrente', () => {
    // Segunda às 11h: sobra só 11:30 da Alana hoje + 4 ter + 4 qua = 9.
    expect(generateSlots(MONDAY_LATE, 'alana')).toHaveLength(9);
  });

  it('pula fins de semana (sexta → só sexta entra na janela de 3 dias)', () => {
    expect(generateSlots(FRIDAY_MORNING, 'alana')).toHaveLength(4);
  });

  it('retorna intervalos com start antes do end e na ordem dos templates', () => {
    const slots = generateSlots(MONDAY_MORNING, 'alana');
    for (const s of slots) {
      expect(s.start.getTime()).toBeLessThan(s.end.getTime());
    }
    expect(slots[0]?.start.toISOString()).toBe(new Date('2026-01-05T09:15:00-03:00').toISOString());
  });
});
