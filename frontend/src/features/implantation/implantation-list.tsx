'use client';

import * as React from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useCurrentUser } from '@/features/auth/auth-guard';
import {
  api,
  type ImplantationBooking,
  type ImplantationSlotKind,
  type ImplantationStatus,
  type Segment,
} from '@/lib/api';
import { cn } from '@/lib/utils';

const STATUS_META: Record<ImplantationStatus, { label: string; className: string }> = {
  agendado: { label: 'Agendado', className: 'bg-blue-500/15 text-blue-600 dark:text-blue-400' },
  compareceu: { label: 'Compareceu', className: 'bg-green-500/15 text-green-600 dark:text-green-400' },
  no_show: { label: 'No-show', className: 'bg-red-500/15 text-red-600 dark:text-red-400' },
};

const SLOT_LABELS: Record<ImplantationSlotKind, string> = {
  coletiva_manha: 'Coletiva (manhã)',
  individual: 'Individual',
  coletiva_tarde: 'Coletiva (tarde)',
};

const SEGMENT_LABELS: Record<Segment, string> = {
  enterprise: 'Enterprise',
  middle: 'Middle',
  small: 'Small',
};

const whenFmt = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  dateStyle: 'short',
  timeStyle: 'short',
});

function StatusBadge({ status }: { status: ImplantationStatus }) {
  const meta = STATUS_META[status];
  return (
    <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium', meta.className)}>
      {meta.label}
    </span>
  );
}

function AttendForm({ id, onDone }: { id: string; onDone: () => void }) {
  const [notes, setNotes] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await api.implantationAttended(id, notes);
      onDone();
    } catch {
      setError('Não foi possível salvar. Tente novamente.');
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 rounded-xl border p-3">
      <div className="space-y-1.5">
        <Label htmlFor={`notes-${id}`}>Observações da reunião</Label>
        <Textarea
          id={`notes-${id}`}
          rows={3}
          placeholder="Anote os pontos principais do treinamento…"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button size="sm" disabled={busy} onClick={submit}>
        Confirmar presença
      </Button>
    </div>
  );
}

function BookingItem({
  booking,
  canEdit,
  onChanged,
}: {
  booking: ImplantationBooking;
  canEdit: boolean;
  onChanged: () => void;
}) {
  const [registering, setRegistering] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  async function noShow() {
    setBusy(true);
    try {
      await api.implantationNoShow(booking.id);
      onChanged();
    } catch {
      setBusy(false);
    }
  }

  return (
    <Card className="rounded-2xl">
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
        <div>
          <CardTitle className="text-base">{booking.companyName}</CardTitle>
          <p className="text-sm text-muted-foreground">
            {booking.clientName} · {SEGMENT_LABELS[booking.segment]} · {SLOT_LABELS[booking.slotKind]}
            {` · ${whenFmt.format(new Date(booking.scheduledStart))}`}
          </p>
        </div>
        <StatusBadge status={booking.status} />
      </CardHeader>
      <CardContent className="space-y-3">
        {booking.status === 'agendado' &&
          (canEdit ? (
            registering ? (
              <AttendForm id={booking.id} onDone={onChanged} />
            ) : (
              <div className="flex gap-2">
                <Button size="sm" onClick={() => setRegistering(true)}>
                  Compareceu
                </Button>
                <Button size="sm" variant="outline" disabled={busy} onClick={noShow}>
                  No-show
                </Button>
              </div>
            )
          ) : (
            <p className="text-sm text-muted-foreground">Aguardando o treinamento.</p>
          ))}

        {booking.status === 'compareceu' && booking.attendanceNotes && (
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Observações:</span>{' '}
            {booking.attendanceNotes}
          </p>
        )}

        {booking.status === 'no_show' && (
          <p className="text-sm text-muted-foreground">Cliente não compareceu ao treinamento.</p>
        )}
      </CardContent>
    </Card>
  );
}

export function ImplantationList() {
  const user = useCurrentUser();
  const canEdit = user.implanter !== null;
  const [bookings, setBookings] = React.useState<ImplantationBooking[] | null>(null);
  const [error, setError] = React.useState(false);

  const load = React.useCallback(() => {
    api
      .listImplantations()
      .then(setBookings)
      .catch(() => setError(true));
  }, []);

  React.useEffect(() => load(), [load]);

  if (error) {
    return <p className="text-sm text-destructive">Não foi possível carregar as implantações.</p>;
  }
  if (!bookings) {
    return <p className="text-muted-foreground">Carregando…</p>;
  }
  if (bookings.length === 0) {
    return <p className="text-muted-foreground">Nenhuma implantação agendada.</p>;
  }

  return (
    <div className="space-y-3">
      {bookings.map((booking) => (
        <BookingItem key={booking.id} booking={booking} canEdit={canEdit} onChanged={load} />
      ))}
    </div>
  );
}
