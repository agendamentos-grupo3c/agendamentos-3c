'use client';

import * as React from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useCurrentUser } from '@/features/auth/auth-guard';
import { RescheduleButton } from '@/features/cards/reschedule-dialog';
import { api, type CardStatus, type CardSummary } from '@/lib/api';
import { cn } from '@/lib/utils';

const STATUS_META: Record<CardStatus, { label: string; className: string }> = {
  kickoff: { label: 'Kickoff', className: 'bg-blue-500/15 text-blue-600 dark:text-blue-400' },
  compareceu: { label: 'Compareceu', className: 'bg-amber-500/15 text-amber-600 dark:text-amber-400' },
  orcamento_enviado: {
    label: 'Orçamento enviado',
    className: 'bg-green-500/15 text-green-600 dark:text-green-400',
  },
  no_show: { label: 'No-show', className: 'bg-red-500/15 text-red-600 dark:text-red-400' },
};

const whenFmt = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  dateStyle: 'short',
  timeStyle: 'short',
});

// Data (YYYY-MM-DD) no fuso de São Paulo, para comparar com os inputs de data.
const spDateFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Sao_Paulo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
const spDate = (iso: string): string => spDateFmt.format(new Date(iso));

function StatusBadge({ status }: { status: CardStatus }) {
  const meta = STATUS_META[status];
  return (
    <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium', meta.className)}>
      {meta.label}
    </span>
  );
}

function BudgetForm({ cardId, onDone }: { cardId: string; onDone: () => void }) {
  const [requiredIntegration, setRequiredIntegration] = React.useState('');
  const [budget, setBudget] = React.useState('');
  const [productionDeadline, setProductionDeadline] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const budgetValue = Number(budget);
  const valid =
    requiredIntegration.trim() && budget.trim() && budgetValue > 0 && productionDeadline.trim();

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await api.sendBudget(cardId, { requiredIntegration, budget: budgetValue, productionDeadline });
      onDone();
    } catch {
      setError('Não foi possível salvar. Tente novamente.');
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 rounded-md border p-3">
      <div className="space-y-1.5">
        <Label htmlFor={`int-${cardId}`}>Integração necessária</Label>
        <Textarea
          id={`int-${cardId}`}
          rows={2}
          value={requiredIntegration}
          onChange={(e) => setRequiredIntegration(e.target.value)}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`bud-${cardId}`}>Orçamento (R$)</Label>
          <Input
            id={`bud-${cardId}`}
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            placeholder="0,00"
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`prz-${cardId}`}>Prazo de produção</Label>
          <Input
            id={`prz-${cardId}`}
            value={productionDeadline}
            onChange={(e) => setProductionDeadline(e.target.value)}
          />
        </div>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button size="sm" disabled={!valid || busy} onClick={submit}>
        Enviar orçamento
      </Button>
    </div>
  );
}

function CardItem({
  card,
  canEdit,
  onChanged,
}: {
  card: CardSummary;
  canEdit: boolean;
  onChanged: () => void;
}) {
  const [busy, setBusy] = React.useState(false);

  async function act(fn: () => Promise<unknown>) {
    setBusy(true);
    try {
      await fn();
      onChanged();
    } catch {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
        <div>
          <CardTitle className="text-base">{card.companyName}</CardTitle>
          <p className="text-sm text-muted-foreground">
            {card.clientName}
            {card.scheduledAt ? ` · ${whenFmt.format(new Date(card.scheduledAt))}` : ''}
          </p>
        </div>
        <StatusBadge status={card.status} />
      </CardHeader>
      <CardContent className="space-y-3">
        {card.status === 'kickoff' &&
          (canEdit ? (
            <div className="flex gap-2">
              <Button size="sm" disabled={busy} onClick={() => act(() => api.markAttended(card.id))}>
                Compareceu
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => act(() => api.markNoShow(card.id))}
              >
                No-show
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Aguardando a reunião de kickoff.</p>
          ))}

        {card.status === 'compareceu' &&
          (canEdit ? (
            <BudgetForm cardId={card.id} onDone={onChanged} />
          ) : (
            <p className="text-sm text-muted-foreground">
              Reunião realizada — aguardando o registro do orçamento pelo time de integrações.
            </p>
          ))}

        {card.status === 'orcamento_enviado' && (
          <div className="space-y-1 text-sm text-muted-foreground">
            <p>
              <span className="font-medium text-foreground">Integração:</span>{' '}
              {card.requiredIntegration}
            </p>
            <p>
              <span className="font-medium text-foreground">Orçamento:</span>{' '}
              {card.budget
                ? Number(card.budget).toLocaleString('pt-BR', {
                    style: 'currency',
                    currency: 'BRL',
                  })
                : '-'}
            </p>
            <p>
              <span className="font-medium text-foreground">Prazo:</span> {card.productionDeadline}
            </p>
          </div>
        )}

        {card.status === 'no_show' &&
          (canEdit ? (
            <p className="text-sm text-muted-foreground">Cliente não compareceu ao kickoff.</p>
          ) : (
            // Reagendamento é ação do vendedor dono do card (não do integrador).
            <RescheduleButton card={card} onChanged={onChanged} />
          ))}
      </CardContent>
    </Card>
  );
}

export function CardsList() {
  const user = useCurrentUser();
  const canEdit = user.role === 'integrator';
  const [cards, setCards] = React.useState<CardSummary[] | null>(null);
  const [error, setError] = React.useState(false);

  const [query, setQuery] = React.useState('');
  const [from, setFrom] = React.useState('');
  const [to, setTo] = React.useState('');

  const load = React.useCallback(() => {
    api
      .listCards()
      .then(setCards)
      .catch(() => setError(true));
  }, []);

  React.useEffect(() => load(), [load]);

  const filtered = React.useMemo(() => {
    if (!cards) return [];
    const q = query.trim().toLowerCase();
    return cards.filter((card) => {
      if (q && !card.companyName.toLowerCase().includes(q)) return false;
      if (from || to) {
        if (!card.scheduledAt) return false;
        const d = spDate(card.scheduledAt);
        if (from && d < from) return false;
        if (to && d > to) return false;
      }
      return true;
    });
  }, [cards, query, from, to]);

  if (error) {
    return <p className="text-sm text-destructive">Não foi possível carregar os agendamentos.</p>;
  }
  if (!cards) {
    return <p className="text-muted-foreground">Carregando…</p>;
  }

  const hasFilters = query.trim() !== '' || from !== '' || to !== '';

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1 space-y-1.5">
          <Label htmlFor="card-search">Buscar por empresa</Label>
          <Input
            id="card-search"
            placeholder="Nome da empresa…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="card-from">De</Label>
          <Input id="card-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="card-to">Até</Label>
          <Input id="card-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setQuery('');
              setFrom('');
              setTo('');
            }}
          >
            Limpar
          </Button>
        )}
      </div>

      {cards.length === 0 ? (
        <p className="text-muted-foreground">Nenhum agendamento ainda.</p>
      ) : filtered.length === 0 ? (
        <p className="text-muted-foreground">Nenhum agendamento corresponde aos filtros.</p>
      ) : (
        <div className="space-y-3">
          {filtered.map((card) => (
            <CardItem key={card.id} card={card} canEdit={canEdit} onChanged={load} />
          ))}
        </div>
      )}
    </div>
  );
}
