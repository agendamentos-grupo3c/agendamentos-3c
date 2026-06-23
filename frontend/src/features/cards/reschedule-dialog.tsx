'use client';

import { CalendarClock } from 'lucide-react';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { ApiError, api, type AvailableSlot, type CardSummary } from '@/lib/api';
import { cn } from '@/lib/utils';

const COLLABORATOR_LABEL: Record<CardSummary['assignedTo'], string> = {
  alana: 'Alana Gaspar (manhã)',
  guilherme: 'Guilherme Ribeiro (tarde)',
};

function groupByDate(slots: AvailableSlot[]): [string, AvailableSlot[]][] {
  const map = new Map<string, AvailableSlot[]>();
  for (const slot of slots) {
    const list = map.get(slot.dateLabel) ?? [];
    list.push(slot);
    map.set(slot.dateLabel, list);
  }
  return [...map.entries()];
}

function SlotPicker({ card, onDone }: { card: CardSummary; onDone: () => void }) {
  const [slots, setSlots] = React.useState<AvailableSlot[] | null>(null);
  const [error, setError] = React.useState(false);
  const [selected, setSelected] = React.useState<AvailableSlot | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [notice, setNotice] = React.useState<string | null>(null);

  const load = React.useCallback(() => {
    setSlots(null);
    setError(false);
    api
      .getAvailability()
      .then((d) => setSlots(d[card.assignedTo]))
      .catch(() => setError(true));
  }, [card.assignedTo]);

  React.useEffect(() => load(), [load]);

  async function confirm() {
    if (!selected) return;
    setBusy(true);
    setNotice(null);
    try {
      await api.reschedule(card.id, selected.token);
      onDone();
    } catch (err) {
      if (err instanceof ApiError && err.code === 'SLOT_TAKEN') {
        setNotice('Esse horário acabou de ser ocupado. Escolha outro.');
        setSelected(null);
        load();
      } else {
        setNotice('Não foi possível reagendar. Tente novamente.');
      }
      setBusy(false);
    }
  }

  if (error) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-destructive">Não foi possível carregar os horários.</p>
        <Button variant="outline" size="sm" onClick={load}>
          Tentar novamente
        </Button>
      </div>
    );
  }

  if (!slots) {
    return <p className="text-sm text-muted-foreground">Carregando horários…</p>;
  }

  return (
    <div className="space-y-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {COLLABORATOR_LABEL[card.assignedTo]}
      </p>

      {notice && (
        <p
          role="alert"
          className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {notice}
        </p>
      )}

      {slots.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sem horários livres nos próximos dias.</p>
      ) : (
        <div className="space-y-4">
          {groupByDate(slots).map(([dateLabel, daySlots]) => (
            <div key={dateLabel} className="space-y-2">
              <p className="text-xs font-medium uppercase text-muted-foreground">{dateLabel}</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {daySlots.map((slot) => (
                  <Button
                    key={slot.token}
                    type="button"
                    variant={slot.token === selected?.token ? 'default' : 'outline'}
                    size="sm"
                    className={cn(slot.token === selected?.token && 'ring-1 ring-ring')}
                    onClick={() => setSelected(slot)}
                  >
                    {slot.timeLabel}
                  </Button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-end gap-2 border-t pt-4">
        <Button disabled={!selected || busy} onClick={confirm}>
          {busy ? 'Reagendando…' : 'Confirmar reagendamento'}
        </Button>
      </div>
    </div>
  );
}

export function RescheduleButton({
  card,
  onChanged,
}: {
  card: CardSummary;
  onChanged: () => void;
}) {
  const [open, setOpen] = React.useState(false);

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">
        Cliente não compareceu ao kickoff. Você pode reagendar a reunião.
      </p>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <CalendarClock className="size-4" />
        Reagendar
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Reagendar kickoff"
        description="Escolha um novo horário. O cliente recebe o convite atualizado por e-mail e WhatsApp."
      >
        <SlotPicker
          card={card}
          onDone={() => {
            setOpen(false);
            onChanged();
          }}
        />
      </Modal>
    </div>
  );
}
