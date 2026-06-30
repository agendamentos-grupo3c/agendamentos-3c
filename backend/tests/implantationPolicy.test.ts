import { describe, expect, it } from 'vitest';

import { optionsForDay, type ExistingSession, type Interval } from '../src/lib/implantationPolicy';

// Dia útil (quarta) e "agora" antes das janelas. Timezone fixo -03:00.
const DATE = '2026-07-01';
const NOW = new Date('2026-07-01T08:00:00-03:00');
const iso = (hm: string) => new Date(`${DATE}T${hm}:00-03:00`).toISOString();
const starts = (opts: { startISO: string }[]) => opts.map((o) => o.startISO);

describe('optionsForDay — agenda real do implantador (freeBusy)', () => {
  it('sem busy e sem sessões, oferece o início da janela da manhã (baseline)', () => {
    const opts = optionsForDay(NOW, DATE, 'pabx', 15, 'individual', 1, []);
    expect(starts(opts)).toContain(iso('09:30'));
  });

  it('evento externo às 09:30 → não oferece 09:30; oferece o próximo bloco livre (10:00)', () => {
    const busy: Interval[] = [{ start: iso('09:30'), end: iso('10:00') }];
    const opts = optionsForDay(NOW, DATE, 'pabx', 15, 'individual', 1, [], busy);
    expect(starts(opts)).not.toContain(iso('09:30'));
    expect(starts(opts)).toContain(iso('10:00'));
  });

  it('evento externo às 09:30 com produto longo (90min) não cabe no resto da manhã → só à tarde', () => {
    const busy: Interval[] = [{ start: iso('09:30'), end: iso('10:00') }];
    const opts = optionsForDay(NOW, DATE, 'discador', 90, 'individual', 1, [], busy);
    // nada na janela da manhã (09:30–11:00); a tarde abre normal em 13:30.
    expect(starts(opts).some((s) => s >= iso('09:30') && s < iso('11:00'))).toBe(false);
    expect(starts(opts)).toContain(iso('13:30'));
  });

  it('entrar em sessão do MESMO produto é permitido mesmo com o horário "ocupado" pelo nosso evento', () => {
    const sessions: ExistingSession[] = [
      { startISO: iso('13:30'), endISO: iso('15:00'), product: 'omni', kind: 'coletiva', count: 2 },
    ];
    // O freeBusy reflete o nosso próprio evento da sessão (13:30–15:00).
    const busy: Interval[] = [{ start: iso('13:30'), end: iso('15:00') }];
    const opts = optionsForDay(NOW, DATE, 'omni', 90, 'coletiva', 8, sessions, busy);
    const join = opts.find((o) => o.startISO === iso('13:30'));
    expect(join).toBeDefined();
    expect(join!.isNew).toBe(false);
    expect(join!.remaining).toBe(6);
    // E ainda oferece um novo bloco logo após a sessão (15:00).
    expect(starts(opts)).toContain(iso('15:00'));
  });

  it('produto diferente no horário ocupado → não entra e não abre ali', () => {
    const sessions: ExistingSession[] = [
      { startISO: iso('13:30'), endISO: iso('15:00'), product: 'discador', kind: 'coletiva', count: 1 },
    ];
    const busy: Interval[] = [{ start: iso('13:30'), end: iso('15:00') }];
    // Tentando agendar OMNI: não pode entrar na sessão de discador nem abrir em 13:30.
    const opts = optionsForDay(NOW, DATE, 'omni', 90, 'coletiva', 8, sessions, busy);
    expect(starts(opts)).not.toContain(iso('13:30'));
    expect(starts(opts)).toContain(iso('15:00'));
  });
});
