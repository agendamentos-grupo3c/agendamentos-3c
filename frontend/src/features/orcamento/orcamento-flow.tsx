'use client';

import { CalendarPlus, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { api, type OrcamentoResponse } from '@/lib/api';
import { brl, computeOrcamento, resolveDesconto } from '@/lib/orcamento';
import type { ContratanteValues } from '@/schemas/orcamento';

import { Calculadora, type CalculadoraData } from './calculadora';
import { Contratante } from './contratante';
import { Triagem, type MeetingReason } from './triagem';

type StepName = 'triagem' | 'meeting' | 'calculadora' | 'contratante' | 'submitting' | 'done' | 'error';

const MEETING_COPY: Record<MeetingReason, string> = {
  duvidas:
    'O cliente só quer tirar dúvidas — agende uma reunião com o time de integração. Sem custo e sem orçamento.',
  crm_nao_listado:
    'O CRM do cliente está fora da lista com template pronto. Agende uma reunião de viabilidade com o time de integração antes de orçar.',
};

const validadeFmt = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long', timeZone: 'America/Sao_Paulo' });

export function OrcamentoFlow() {
  const [step, setStep] = React.useState<StepName>('triagem');
  const [meetingReason, setMeetingReason] = React.useState<MeetingReason>('duvidas');
  const [crm, setCrm] = React.useState('');
  const [calc, setCalc] = React.useState<CalculadoraData | null>(null);
  const [result, setResult] = React.useState<OrcamentoResponse | null>(null);
  const [notice, setNotice] = React.useState<string | undefined>(undefined);
  // Chave estável por submissão: reusada em retry após erro, para o n8n/ClickSign
  // deduplicar e não gerar proposta/boleto duplicados.
  const [idemKey, setIdemKey] = React.useState('');

  async function send(values: ContratanteValues) {
    if (!calc) return;
    setStep('submitting');
    setNotice(undefined);
    try {
      const res = await api.enviarOrcamento(
        {
          contratanteNome: values.contratanteNome,
          contratanteEmail: values.contratanteEmail,
          contratanteTelefone: values.contratanteTelefone,
          empresa: values.empresa,
          cnpj: values.cnpj,
          idHubspot: values.idHubspot || undefined,
          idNegocio: values.idNegocio || undefined,
          clienteRef: calc.cliente || undefined,
          crm,
          escopo: {
            pilares: calc.escopo.pilares,
            funis: calc.escopo.funis,
            qualifs: calc.escopo.qualifs,
            sdrs: calc.escopo.sdrs,
            campos: calc.escopo.campos,
            url: calc.escopo.url,
          },
          desconto: calc.desconto ?? undefined,
          formaPagamento: values.formaPagamento,
          parcelas: values.formaPagamento === 'parcelado' ? values.parcelas : undefined,
          descricao: calc.descricao || undefined,
          observacoes: values.observacoes || undefined,
        },
        idemKey,
      );
      setResult(res);
      setStep('done');
    } catch {
      setNotice('Não foi possível enviar a proposta. Confira os dados e tente novamente.');
      setStep('contratante');
    }
  }

  if (step === 'meeting') {
    return (
      <Card className="rounded-3xl">
        <CardHeader>
          <CardTitle>Agendar reunião com a integração</CardTitle>
          <CardDescription>{MEETING_COPY[meetingReason]}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row">
          <Button asChild>
            <Link href="/agendar/integracoes">
              <CalendarPlus className="size-4" />
              Agendar reunião
            </Link>
          </Button>
          <Button variant="ghost" onClick={() => setStep('triagem')}>
            Voltar
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (step === 'calculadora') {
    return (
      <Calculadora
        crm={crm}
        onBack={() => setStep('triagem')}
        onContinue={(data) => {
          setCalc(data);
          setIdemKey(crypto.randomUUID());
          setStep('contratante');
        }}
      />
    );
  }

  if (step === 'contratante' && calc) {
    const totalLiquido = resolveDesconto(computeOrcamento(calc.escopo).total, calc.desconto).total;
    return (
      <Contratante
        total={totalLiquido}
        notice={notice}
        onBack={() => setStep('calculadora')}
        onSubmit={send}
      />
    );
  }

  if (step === 'submitting') {
    return <p className="text-center text-muted-foreground">Enviando proposta…</p>;
  }

  if (step === 'done' && result) {
    return (
      <Card className="rounded-3xl">
        <CardHeader>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-5 text-green-500" />
            <CardTitle>Proposta enviada!</CardTitle>
          </div>
          <CardDescription>
            O cliente vai receber a proposta para assinar no ClickSign, junto com o boleto. O ClickUp foi
            movido para “Orçamento enviado” e o time avisado no Slack.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p>
            Valor: <span className="font-semibold">R$ {brl(result.total)}</span> · validade até{' '}
            <span className="font-semibold">{validadeFmt.format(new Date(result.validadeISO))}</span>.
          </p>
          <Button
            variant="outline"
            onClick={() => {
              setCalc(null);
              setResult(null);
              setCrm('');
              setIdemKey('');
              setStep('triagem');
            }}
          >
            Novo orçamento
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Triagem
      onNeedsMeeting={(reason) => {
        setMeetingReason(reason);
        setStep('meeting');
      }}
      onProceed={(selectedCrm) => {
        setCrm(selectedCrm);
        setStep('calculadora');
      }}
    />
  );
}
