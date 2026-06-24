'use client';

import { ChevronDown } from 'lucide-react';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { api, type ImplantationAvailability, type ImplantationSlot, type Segment } from '@/lib/api';
import { cn } from '@/lib/utils';

function groupByDate(slots: ImplantationSlot[]): [string, ImplantationSlot[]][] {
  const map = new Map<string, ImplantationSlot[]>();
  for (const slot of slots) {
    const list = map.get(slot.dateLabel) ?? [];
    list.push(slot);
    map.set(slot.dateLabel, list);
  }
  return [...map.entries()];
}

function SeatBadge({ slot }: { slot: ImplantationSlot }) {
  if (slot.capacity === 1) {
    return <span className="text-[11px] font-medium text-muted-foreground">Individual · 1 vaga</span>;
  }
  // Mostra OCUPADAS/total (cresce conforme enche): 1/8, 2/8, …
  const occupied = slot.capacity - slot.remaining;
  const scarce = slot.remaining <= 2;
  return (
    <span className={cn('text-[11px] font-medium', scarce ? 'text-destructive' : 'text-muted-foreground')}>
      {occupied}/{slot.capacity} ocupadas
    </span>
  );
}

function SlotGrid({
  slots,
  selectedToken,
  onSelect,
}: {
  slots: ImplantationSlot[];
  selectedToken?: string;
  onSelect: (slot: ImplantationSlot) => void;
}) {
  return (
    <div className="space-y-4">
      {groupByDate(slots).map(([dateLabel, daySlots]) => (
        <div key={dateLabel} className="space-y-2">
          <p className="text-xs font-medium uppercase text-muted-foreground">{dateLabel}</p>
          <div className="grid gap-2 sm:grid-cols-3">
            {daySlots.map((slot) => (
              <button
                key={slot.token}
                type="button"
                onClick={() => onSelect(slot)}
                className={cn(
                  'flex flex-col items-start gap-0.5 rounded-xl border px-3 py-2 text-left transition-all',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  slot.token === selectedToken
                    ? 'border-primary bg-primary/10 ring-1 ring-primary/40'
                    : 'border-input hover:border-foreground/30 hover:bg-secondary/50',
                )}
              >
                <span className="text-sm font-medium">{slot.timeLabel}</span>
                <SeatBadge slot={slot} />
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function ImplantationAgenda({
  segment,
  notice,
  onBack,
  onConfirm,
}: {
  segment: Segment;
  notice?: string;
  onBack: () => void;
  onConfirm: (slot: ImplantationSlot) => void;
}) {
  const [data, setData] = React.useState<ImplantationAvailability | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(false);
  const [selected, setSelected] = React.useState<ImplantationSlot | null>(null);
  const [showOthers, setShowOthers] = React.useState(false);

  React.useEffect(() => {
    let active = true;
    api
      .getImplantationAvailability(segment)
      .then((d) => active && (setData(d), setLoading(false)))
      .catch(() => active && (setError(true), setLoading(false)));
    return () => {
      active = false;
    };
  }, [segment]);

  if (loading) {
    return <p className="text-center text-muted-foreground">Carregando horários…</p>;
  }

  if (error || !data) {
    return (
      <Card>
        <CardContent className="space-y-4 pt-6">
          <p className="text-sm text-destructive">Não foi possível carregar a agenda.</p>
          <Button variant="outline" onClick={onBack}>
            Voltar
          </Button>
        </CardContent>
      </Card>
    );
  }

  const hasBest = data.best.length > 0;
  const hasOthers = data.others.length > 0;

  return (
    <div className="space-y-4">
      {notice && (
        <p
          role="alert"
          className="rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {notice}
        </p>
      )}

      <Card className="rounded-2xl">
        <CardContent className="space-y-3 pt-6">
          <h2 className="text-base font-semibold">Melhores horários</h2>
          {hasBest ? (
            <SlotGrid slots={data.best} selectedToken={selected?.token} onSelect={setSelected} />
          ) : (
            <p className="text-sm text-muted-foreground">
              Sem horários no momento. Veja os outros horários disponíveis abaixo.
            </p>
          )}
        </CardContent>
      </Card>

      {hasOthers && (
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => setShowOthers((v) => !v)}
            className="flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-sm font-medium transition-colors hover:bg-secondary/60"
            aria-expanded={showOthers || !hasBest}
          >
            <span>Outros horários disponíveis ({data.others.length})</span>
            <ChevronDown
              className={cn('size-4 transition-transform', (showOthers || !hasBest) && 'rotate-180')}
            />
          </button>
          {(showOthers || !hasBest) && (
            <Card className="rounded-2xl">
              <CardContent className="pt-6">
                <SlotGrid slots={data.others} selectedToken={selected?.token} onSelect={setSelected} />
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <div className="flex flex-col items-stretch justify-between gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center">
        <span className="text-sm text-muted-foreground">
          {selected ? `${selected.dateLabel} · ${selected.timeLabel}` : 'Selecione um horário disponível.'}
        </span>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onBack}>
            Voltar
          </Button>
          <Button disabled={!selected} onClick={() => selected && onConfirm(selected)}>
            Agendar
          </Button>
        </div>
      </div>
    </div>
  );
}
