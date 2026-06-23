'use client';

import { Trash2 } from 'lucide-react';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { api, type CardSummary } from '@/lib/api';

export function DeleteCardButton({
  card,
  onChanged,
}: {
  card: CardSummary;
  onChanged: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      await api.deleteCard(card.id);
      setOpen(false);
      onChanged();
    } catch {
      setError('Não foi possível excluir. Tente novamente.');
      setBusy(false);
    }
  }

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Excluir agendamento"
        className="size-8 text-muted-foreground hover:text-destructive"
        onClick={() => setOpen(true)}
      >
        <Trash2 className="size-4" />
      </Button>

      <Modal
        open={open}
        onClose={() => !busy && setOpen(false)}
        title="Excluir agendamento"
        description="Esta ação não pode ser desfeita."
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            O agendamento de <span className="font-medium text-foreground">{card.companyName}</span>{' '}
            ({card.clientName}) será removido, o convite do cliente cancelado e o lead irá para a
            etapa <span className="font-medium text-foreground">Cancelado</span> no ClickUp.
          </p>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2 border-t pt-4">
            <Button variant="ghost" disabled={busy} onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" disabled={busy} onClick={confirm}>
              {busy ? 'Excluindo…' : 'Excluir'}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
