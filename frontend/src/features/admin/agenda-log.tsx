'use client';

import * as React from 'react';

import { Card, CardContent } from '@/components/ui/card';
import { useCurrentUser } from '@/features/auth/auth-guard';
import { api, type AgendaLogEntry } from '@/lib/api';

const whenFmt = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  dateStyle: 'short',
  timeStyle: 'short',
});

const SUBJECT_LABELS: Record<string, string> = {
  alana: 'Alana (integração)',
  guilherme: 'Guilherme (integração)',
  gabrielle: 'Gabrielle (implantação)',
  bryan: 'Bryan (implantação)',
  wagner: 'Wagner (implantação)',
};

export function AgendaLog() {
  const user = useCurrentUser();
  const [entries, setEntries] = React.useState<AgendaLogEntry[] | null>(null);
  const [error, setError] = React.useState(false);

  React.useEffect(() => {
    if (!user.isAdmin) return;
    api
      .getAgendaLog()
      .then(setEntries)
      .catch(() => setError(true));
  }, [user.isAdmin]);

  if (!user.isAdmin) {
    return <p className="text-sm text-destructive">Acesso restrito.</p>;
  }
  if (error) {
    return <p className="text-sm text-destructive">Não foi possível carregar o log.</p>;
  }
  if (!entries) {
    return <p className="text-muted-foreground">Carregando…</p>;
  }
  if (entries.length === 0) {
    return <p className="text-muted-foreground">Nenhuma pausa ou reativação registrada.</p>;
  }

  return (
    <div className="space-y-2">
      {entries.map((e, i) => {
        const paused = e.action === 'agenda.paused';
        const subjects = (e.metadata?.subjects ?? []).map((s) => SUBJECT_LABELS[s] ?? s).join(', ');
        return (
          <Card key={i} className="rounded-xl">
            <CardContent className="flex flex-wrap items-center justify-between gap-2 py-3">
              <div className="min-w-0">
                <p className="text-sm">
                  <span className="font-medium">{e.actorEmail}</span>{' '}
                  <span className={paused ? 'text-destructive' : 'text-green-500 dark:text-green-300'}>
                    {paused ? 'pausou' : 'reativou'} a agenda
                  </span>
                </p>
                {subjects && <p className="text-xs text-muted-foreground">{subjects}</p>}
              </div>
              <span className="text-xs text-muted-foreground">{whenFmt.format(new Date(e.createdAt))}</span>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
