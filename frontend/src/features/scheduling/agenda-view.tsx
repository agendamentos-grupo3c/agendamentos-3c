'use client';

import * as React from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { api, type AvailableSlot, type Availability } from '@/lib/api';
import { cn } from '@/lib/utils';

export interface SelectedSlot extends AvailableSlot {
  collaborator: 'alana' | 'guilherme';
  collaboratorLabel: string;
}

function groupByDate(slots: AvailableSlot[]): [string, AvailableSlot[]][] {
  const map = new Map<string, AvailableSlot[]>();
  for (const slot of slots) {
    const list = map.get(slot.dateLabel) ?? [];
    list.push(slot);
    map.set(slot.dateLabel, list);
  }
  return [...map.entries()];
}

function SlotColumn({
  title,
  slots,
  selectedToken,
  onSelect,
}: {
  title: string;
  slots: AvailableSlot[];
  selectedToken?: string;
  onSelect: (slot: AvailableSlot) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {slots.length === 0 && (
          <p className="text-sm text-muted-foreground">Sem horários livres nos próximos dias.</p>
        )}
        {groupByDate(slots).map(([dateLabel, daySlots]) => (
          <div key={dateLabel} className="space-y-2">
            <p className="text-xs font-medium uppercase text-muted-foreground">{dateLabel}</p>
            <div className="grid grid-cols-2 gap-2">
              {daySlots.map((slot) => (
                <Button
                  key={slot.token}
                  type="button"
                  variant={slot.token === selectedToken ? 'default' : 'outline'}
                  size="sm"
                  className={cn(slot.token === selectedToken && 'ring-1 ring-ring')}
                  onClick={() => onSelect(slot)}
                >
                  {slot.timeLabel}
                </Button>
              ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function AgendaView({
  onBack,
  onConfirm,
  notice,
}: {
  onBack: () => void;
  onConfirm: (slot: SelectedSlot) => void;
  notice?: string;
}) {
  const [data, setData] = React.useState<Availability | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(false);
  const [selected, setSelected] = React.useState<SelectedSlot | null>(null);

  React.useEffect(() => {
    let active = true;
    api
      .getAvailability()
      .then((d) => active && (setData(d), setLoading(false)))
      .catch(() => active && (setError(true), setLoading(false)));
    return () => {
      active = false;
    };
  }, []);

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

  return (
    <div className="space-y-4">
      {notice && (
        <p
          role="alert"
          className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {notice}
        </p>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        <SlotColumn
          title="Alana Gaspar (manhã)"
          slots={data.alana}
          selectedToken={selected?.collaborator === 'alana' ? selected.token : undefined}
          onSelect={(slot) =>
            setSelected({ ...slot, collaborator: 'alana', collaboratorLabel: 'Alana Gaspar' })
          }
        />
        <SlotColumn
          title="Guilherme Ribeiro (tarde)"
          slots={data.guilherme}
          selectedToken={selected?.collaborator === 'guilherme' ? selected.token : undefined}
          onSelect={(slot) =>
            setSelected({
              ...slot,
              collaborator: 'guilherme',
              collaboratorLabel: 'Guilherme Ribeiro',
            })
          }
        />
      </div>

      <div className="flex items-center justify-between gap-3 rounded-lg border p-4">
        <span className="text-sm text-muted-foreground">
          {selected
            ? `${selected.collaboratorLabel} · ${selected.dateLabel} · ${selected.timeLabel}`
            : 'Selecione um horário disponível.'}
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
