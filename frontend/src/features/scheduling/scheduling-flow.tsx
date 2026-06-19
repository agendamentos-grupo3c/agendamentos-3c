'use client';

import * as React from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ClientForm } from '@/features/form/client-form';
import { AgendaView, type SelectedSlot } from '@/features/scheduling/agenda-view';
import { ApiError, api, type SubmitResponse } from '@/lib/api';
import type { ClientFormValues } from '@/schemas/clientForm';

type Step = 'form' | 'agenda' | 'submitting' | 'done' | 'error';

export function SchedulingFlow() {
  const [step, setStep] = React.useState<Step>('form');
  const [formData, setFormData] = React.useState<ClientFormValues | null>(null);
  const [result, setResult] = React.useState<SubmitResponse | null>(null);
  const [notice, setNotice] = React.useState<string | undefined>(undefined);

  async function handleConfirm(slot: SelectedSlot) {
    if (!formData) return;
    setStep('submitting');
    setNotice(undefined);
    try {
      const res = await api.submit(
        { ...formData, slotToken: slot.token },
        crypto.randomUUID(),
      );
      setResult(res);
      setStep('done');
    } catch (err) {
      if (err instanceof ApiError && err.code === 'SLOT_TAKEN') {
        setNotice('Esse horário acabou de ser ocupado. Escolha outro.');
        setStep('agenda');
      } else {
        setStep('error');
      }
    }
  }

  if (step === 'form') {
    return (
      <ClientForm
        defaultValues={formData ?? undefined}
        onSubmit={(values) => {
          setFormData(values);
          setStep('agenda');
        }}
      />
    );
  }

  if (step === 'agenda') {
    return <AgendaView notice={notice} onBack={() => setStep('form')} onConfirm={handleConfirm} />;
  }

  if (step === 'submitting') {
    return <p className="text-center text-muted-foreground">Agendando…</p>;
  }

  if (step === 'error') {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Não foi possível agendar</CardTitle>
          <CardDescription>Ocorreu um erro ao concluir o agendamento.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={() => setStep('agenda')}>
            Tentar novamente
          </Button>
        </CardContent>
      </Card>
    );
  }

  // done
  return (
    <Card>
      <CardHeader>
        <CardTitle>Kickoff agendado!</CardTitle>
        <CardDescription>
          O cliente recebeu o convite por e-mail e WhatsApp, e o time foi notificado.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {result?.card.meetingUrl && (
          <p>
            Link da reunião:{' '}
            <a
              className="text-primary underline underline-offset-4"
              href={result.card.meetingUrl}
              target="_blank"
              rel="noreferrer"
            >
              {result.card.meetingUrl}
            </a>
          </p>
        )}
        {result && result.pending.length > 0 && (
          <p className="text-muted-foreground">
            Algumas notificações estão pendentes e serão reprocessadas: {result.pending.join(', ')}.
          </p>
        )}
        <Button
          variant="outline"
          onClick={() => {
            setFormData(null);
            setResult(null);
            setStep('form');
          }}
        >
          Novo agendamento
        </Button>
      </CardContent>
    </Card>
  );
}
