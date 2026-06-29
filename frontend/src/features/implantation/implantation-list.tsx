'use client';

import * as React from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useCurrentUser } from '@/features/auth/auth-guard';
import {
  api,
  type ImplantationBooking,
  type ImplantationProduct,
  type ImplantationStatus,
  type Segment,
} from '@/lib/api';
import { cn } from '@/lib/utils';

const STATUS_META: Record<ImplantationStatus, { label: string; className: string }> = {
  agendado: { label: 'Agendado', className: 'bg-blue-500/15 text-blue-600 dark:text-blue-400' },
  compareceu: { label: 'Compareceu', className: 'bg-green-500/10 text-green-500 dark:text-green-300' },
  no_show: { label: 'No-show', className: 'bg-red-500/10 text-red-500 dark:text-red-300' },
};

const PRODUCT_LABELS: Record<ImplantationProduct, string> = {
  discador: 'Discador',
  omni: 'Omni',
  ura: 'URA',
  pabx: 'PABX',
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

type Decision = 'compareceu' | 'no_show';

interface Slot {
  key: string;
  product: ImplantationProduct | null;
  scheduledStart: string;
  bookings: ImplantationBooking[];
}

function groupBySlot(bookings: ImplantationBooking[]): Slot[] {
  const map = new Map<string, Slot>();
  for (const b of bookings) {
    // Sessão = implantador (lista já é dele) + horário de início.
    const key = b.scheduledStart;
    const slot = map.get(key) ?? {
      key,
      product: b.product,
      scheduledStart: b.scheduledStart,
      bookings: [],
    };
    slot.bookings.push(b);
    map.set(key, slot);
  }
  return [...map.values()].sort((a, b) => a.scheduledStart.localeCompare(b.scheduledStart));
}

// Botão de escolha por cliente (Compareceu / No-show), sem hover amarelo.
function ChoiceButton({
  active,
  tone,
  onClick,
  children,
}: {
  active: boolean;
  tone: 'ok' | 'no';
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'rounded-lg border px-3 py-1 text-xs font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        active && tone === 'ok' && 'border-green-400 bg-green-500/10 text-green-600 dark:text-green-300',
        active && tone === 'no' && 'border-destructive bg-destructive/10 text-destructive',
        !active && 'border-input text-muted-foreground hover:border-foreground/30 hover:text-foreground',
      )}
    >
      {children}
    </button>
  );
}

// Link da reunião (pós-reunião): aparece só depois que toda a sessão tem
// desfecho e alguém compareceu. Ao salvar, o backend anexa o link à reunião do
// HubSpot e dispara o e-mail (n8n) a quem compareceu.
function MeetingLinkSection({
  attendedId,
  current,
  onChanged,
}: {
  attendedId: string;
  current: string | null;
  onChanged: () => void;
}) {
  const [link, setLink] = React.useState(current ?? '');
  const [savedLink, setSavedLink] = React.useState<string | null>(current);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const trimmed = link.trim();
  const looksValid = /^https?:\/\/\S+$/i.test(trimmed);
  const dirty = trimmed !== (savedLink ?? '');

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const res = await api.implantationMeetingLink(attendedId, trimmed);
      setSavedLink(res.booking.meetingLink);
      onChanged();
    } catch {
      setError('Não foi possível salvar o link. Verifique a URL e tente novamente.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2 rounded-xl border p-3">
      <Label htmlFor={`link-${attendedId}`}>Link da reunião</Label>
      <p className="text-xs text-muted-foreground">
        Cole o link quando a reunião for gerada. Ele é anexado à reunião no HubSpot e enviado por
        e-mail a quem compareceu.
      </p>
      {savedLink && (
        <p className="text-sm">
          <span className="text-muted-foreground">Atual: </span>
          <a
            className="break-all text-primary underline underline-offset-4"
            href={savedLink}
            target="_blank"
            rel="noreferrer"
          >
            {savedLink}
          </a>
        </p>
      )}
      <Input
        id={`link-${attendedId}`}
        inputMode="url"
        placeholder="https://meet.google.com/…"
        value={link}
        onChange={(e) => setLink(e.target.value)}
      />
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button size="sm" disabled={busy || !dirty || !looksValid} onClick={save}>
        {busy ? 'Enviando…' : savedLink ? 'Atualizar link' : 'Salvar e enviar link'}
      </Button>
    </div>
  );
}

function SlotCard({ slot, canEdit, onChanged }: { slot: Slot; canEdit: boolean; onChanged: () => void }) {
  const [decisions, setDecisions] = React.useState<Record<string, Decision>>({});
  const [observation, setObservation] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Coletiva = qualquer segmento != enterprise (enterprise é individual).
  const isColetiva = slot.bookings.some((b) => b.segment !== 'enterprise');
  const productLabel = slot.product ? PRODUCT_LABELS[slot.product] : 'Implantação';
  const pending = slot.bookings.filter((b) => b.status === 'agendado');
  const attended = slot.bookings.filter((b) => b.status === 'compareceu');
  const firstAttended = attended[0];
  const attendedNote = firstAttended?.attendanceNotes;
  const allDecided = pending.length > 0 && pending.every((b) => decisions[b.id]);
  const anyAttended = pending.some((b) => decisions[b.id] === 'compareceu');

  async function save() {
    setBusy(true);
    setError(null);
    try {
      for (const b of pending) {
        const d = decisions[b.id];
        if (d === 'compareceu') await api.implantationAttended(b.id, observation);
        else if (d === 'no_show') await api.implantationNoShow(b.id);
      }
      onChanged();
    } catch {
      setError('Não foi possível salvar os desfechos. Tente novamente.');
      setBusy(false);
    }
  }

  return (
    <Card className="rounded-2xl">
      <CardHeader className="space-y-0.5">
        <CardTitle className="text-base">
          {`Implantação ${productLabel}`}
          {isColetiva ? ` · coletiva · ${slot.bookings.length} participante(s)` : ' · individual'}
        </CardTitle>
        <p className="text-sm text-muted-foreground">{whenFmt.format(new Date(slot.scheduledStart))}</p>
      </CardHeader>
      <CardContent className="space-y-3">
        <ul className="divide-y">
          {slot.bookings.map((b) => (
            <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{b.companyName}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {b.clientName} · {SEGMENT_LABELS[b.segment]}
                </p>
              </div>
              {b.status !== 'agendado' ? (
                <StatusBadge status={b.status} />
              ) : canEdit ? (
                <div className="flex gap-1.5">
                  <ChoiceButton
                    active={decisions[b.id] === 'compareceu'}
                    tone="ok"
                    onClick={() => setDecisions((d) => ({ ...d, [b.id]: 'compareceu' }))}
                  >
                    Compareceu
                  </ChoiceButton>
                  <ChoiceButton
                    active={decisions[b.id] === 'no_show'}
                    tone="no"
                    onClick={() => setDecisions((d) => ({ ...d, [b.id]: 'no_show' }))}
                  >
                    No-show
                  </ChoiceButton>
                </div>
              ) : (
                <StatusBadge status={b.status} />
              )}
            </li>
          ))}
        </ul>

        {attendedNote && (
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Observações:</span> {attendedNote}
          </p>
        )}

        {canEdit && pending.length > 0 && (
          <div className="space-y-3 rounded-xl border p-3">
            {anyAttended && (
              <div className="space-y-1.5">
                <Label htmlFor={`obs-${slot.key}`}>Observações da reunião (vale para todos que compareceram)</Label>
                <Textarea
                  id={`obs-${slot.key}`}
                  rows={3}
                  placeholder="Anote os pontos principais do treinamento…"
                  value={observation}
                  onChange={(e) => setObservation(e.target.value)}
                />
              </div>
            )}
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button size="sm" disabled={!allDecided || busy} onClick={save}>
              {busy ? 'Salvando…' : 'Salvar desfechos'}
            </Button>
            {!allDecided && (
              <p className="text-xs text-muted-foreground">
                Marque Compareceu ou No-show para cada participante.
              </p>
            )}
          </div>
        )}

        {canEdit && pending.length === 0 && firstAttended && (
          <MeetingLinkSection
            attendedId={firstAttended.id}
            current={attended.find((b) => b.meetingLink)?.meetingLink ?? null}
            onChanged={onChanged}
          />
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

  const slots = groupBySlot(bookings);

  return (
    <div className="space-y-3">
      {slots.map((slot) => (
        <SlotCard key={slot.key} slot={slot} canEdit={canEdit} onChanged={load} />
      ))}
    </div>
  );
}
