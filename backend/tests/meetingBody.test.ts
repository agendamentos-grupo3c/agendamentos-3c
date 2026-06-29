import { describe, expect, it } from 'vitest';

import { composeMeetingBody } from '../src/integrations/hubspot';

describe('composeMeetingBody', () => {
  it('separa observação e link por duas linhas em branco', () => {
    const body = composeMeetingBody('Treinamento concluído.', 'https://meet.google.com/abc');
    expect(body).toBe('Treinamento concluído.\n\n\n🔗 Link da reunião: https://meet.google.com/abc');
    // Garante o "pular pelo menos duas linhas": 3 quebras = 2 linhas em branco.
    const gap = body.slice('Treinamento concluído.'.length, body.indexOf('🔗'));
    expect(gap).toBe('\n\n\n');
  });

  it('sem observação, retorna só a linha do link', () => {
    expect(composeMeetingBody(null, 'https://x.com')).toBe('🔗 Link da reunião: https://x.com');
    expect(composeMeetingBody('   ', 'https://x.com')).toBe('🔗 Link da reunião: https://x.com');
  });

  it('sem link, retorna só a observação (sem quebras sobrando)', () => {
    expect(composeMeetingBody('Observação.', null)).toBe('Observação.');
    expect(composeMeetingBody('  Observação.  ', null)).toBe('Observação.');
  });

  it('sem observação e sem link, retorna string vazia', () => {
    expect(composeMeetingBody(null, null)).toBe('');
    expect(composeMeetingBody('', '')).toBe('');
  });
});
