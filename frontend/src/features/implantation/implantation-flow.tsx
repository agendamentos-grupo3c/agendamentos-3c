'use client';

import * as React from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ApiError, api, type ImplantationSlot, type ImplantationSubmitResponse } from '@/lib/api';
import type { ImplantationFormValues } from '@/schemas/implantation';

import { ImplantationAgenda } from './implantation-agenda';
import { ImplantationForm } from './implantation-form';

type Step = 'form' | 'agenda' | 'submitting' | 'done' | 'error';

export function ImplantationFlow() {
  const [step, setStep] = React.useState<Step>('form');
  const [formData, setFormData] = React.useState<ImplantationFormValues | null>(null);
  const [result, setResult] = React.useState<ImplantationSubmitResponse | null>(null);
  const [notice, setNotice] = React.useState<string | undefined>(undefined);

  async function handleConfirm(slot: ImplantationSlot) {
    if (!formData) return;
    setStep('submitting');
    setNotice(undefined);
    try {
      const res = await api.bookImplantation(
        {
          companyName: formData.companyName,
          clientName: formData.clientName,
          clientEmail: formData.clientEmail,
          phone: formData.phone,
          segment: formData.segment,
          slotToken: slot.token,
        },
        crypto.randomUUID(),
      );
      setResult(res);
      setStep('done');
    } catch (err) {
      if (err instanceof ApiError && err.code === 'SLOT_FULL') {
        setNotice('Esse horário acabou de lotar. Escolha outro.');
        setStep('agenda');
      } else {
        setStep('error');
      }
    }
  }

  if (step === 'form') {
    return (
      <ImplantationForm
        defaultValues={formData ?? undefined}
        onSubmit={(values) => {
          setFormData(values);
          setStep('agenda');
        }}
      />
    );
  }

  if (step === 'agenda' && formData) {
    return (
      <ImplantationAgenda
        segment={formData.segment}
        notice={notice}
        onBack={() => setStep('form')}
        onConfirm={handleConfirm}
      />
    );
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
        <CardTitle>Treinamento agendado!</CardTitle>
        <CardDescription>O cliente será notificado por e-mail e WhatsApp.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {result?.booking.meetingUrl && (
          <p>
            Link da reunião:{' '}
            <a
              className="text-primary underline underline-offset-4"
              href={result.booking.meetingUrl}
              target="_blank"
              rel="noreferrer"
            >
              {result.booking.meetingUrl}
            </a>
          </p>
        )}
        {result && result.pending.length > 0 && (
          <p className="text-muted-foreground">
            Algumas ações estão pendentes e serão reprocessadas: {result.pending.join(', ')}.
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
