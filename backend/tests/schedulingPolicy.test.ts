import { describe, expect, it } from 'vitest';

import { generateSlots } from '../src/lib/schedulingPolicy';

// 2026-01-05 é segunda; 2026-01-02 é sexta. Alana atende de manhã, Guilherme à
// tarde. Regra: o slot precisa estar ≥ 2 meios-períodos à frente (exclui o
// mesmo dia e exige meio período de folga). Janela: hoje + 3 dias corridos.
const MONDAY_MORNING = new Date('2026-01-05T07:00:00-03:00');
const MONDAY_AFTERNOON = new Date('2026-01-05T13:00:00-03:00');
const FRIDAY_MORNING = new Date('2026-01-02T07:00:00-03:00');

describe('generateSlots', () => {
  it('de manhã, libera ter/qua/qui (4 slots/dia = 12) e exclui o mesmo dia', () => {
    // Seg de manhã → seg é excluída (mesmo dia); ter, qua, qui entram.
    expect(generateSlots(MONDAY_MORNING, 'alana')).toHaveLength(12);
    expect(generateSlots(MONDAY_MORNING, 'guilherme')).toHaveLength(12);
    // Primeiro slot da Alana = terça 09:15 (segunda não entra).
    const first = generateSlots(MONDAY_MORNING, 'alana')[0];
    expect(first?.start.toISOString()).toBe(new Date('2026-01-06T09:15:00-03:00').toISOString());
  });

  it('à tarde, a manhã do dia seguinte (Alana) é barrada por falta de meio período', () => {
    // Seg à tarde → terça de manhã NÃO entra (Alana): sobram qua + qui = 8.
    expect(generateSlots(MONDAY_AFTERNOON, 'alana')).toHaveLength(8);
    // Guilherme (tarde) mantém ter/qua/qui = 12.
    expect(generateSlots(MONDAY_AFTERNOON, 'guilherme')).toHaveLength(12);
  });

  it('pula fins de semana: sexta de manhã → só a segunda seguinte entra (4)', () => {
    // Sex (mesmo dia, excluída) + sáb/dom (pulados) + seg (offset 3) = só seg.
    const slots = generateSlots(FRIDAY_MORNING, 'alana');
    expect(slots).toHaveLength(4);
    expect(slots[0]?.start.toISOString()).toBe(new Date('2026-01-05T09:15:00-03:00').toISOString());
  });

  it('retorna intervalos com start antes do end', () => {
    for (const s of generateSlots(MONDAY_MORNING, 'alana')) {
      expect(s.start.getTime()).toBeLessThan(s.end.getTime());
    }
  });
});
