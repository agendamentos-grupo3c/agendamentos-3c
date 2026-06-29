'use client';

import * as React from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CRMS_LISTADOS } from '@/lib/orcamento';
import { cn } from '@/lib/utils';

export type MeetingReason = 'duvidas' | 'crm_nao_listado';
type Intent = 'fechar' | 'duvidas';

const NAO_LISTADO = '__nao_listado__';

// Antes do orçamento: decide se o caso vira reunião com o time de integração
// (cliente só quer dúvidas, ou CRM fora da lista) ou segue para a calculadora.
export function Triagem({
  onNeedsMeeting,
  onProceed,
}: {
  onNeedsMeeting: (reason: MeetingReason) => void;
  onProceed: (crm: string) => void;
}) {
  const [intent, setIntent] = React.useState<Intent | null>(null);
  const [crm, setCrm] = React.useState<string | null>(null);

  const canContinue = intent === 'duvidas' || (intent === 'fechar' && crm !== null);

  function handleContinue() {
    if (intent === 'duvidas') return onNeedsMeeting('duvidas');
    if (intent === 'fechar' && crm === NAO_LISTADO) return onNeedsMeeting('crm_nao_listado');
    if (intent === 'fechar' && crm) return onProceed(crm);
  }

  return (
    <Card className="rounded-3xl">
      <CardHeader>
        <CardTitle>Antes do orçamento</CardTitle>
        <CardDescription>
          Nem todo cliente precisa de orçamento agora. Vamos entender o cenário primeiro.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <p className="text-sm font-medium">O que o cliente quer neste momento?</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <SelectButton active={intent === 'fechar'} onClick={() => setIntent('fechar')}>
              <span className="font-medium">Quer a integração</span>
              <span className="text-xs text-muted-foreground">Seguir para o orçamento</span>
            </SelectButton>
            <SelectButton active={intent === 'duvidas'} onClick={() => setIntent('duvidas')}>
              <span className="font-medium">Só tirar dúvidas</span>
              <span className="text-xs text-muted-foreground">Reunião com a equipe · sem custo</span>
            </SelectButton>
          </div>
        </div>

        {intent === 'fechar' && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Qual o CRM do cliente?</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {CRMS_LISTADOS.map((nome) => (
                <SelectButton key={nome} active={crm === nome} onClick={() => setCrm(nome)}>
                  <span className="text-sm font-medium">{nome}</span>
                </SelectButton>
              ))}
              <SelectButton active={crm === NAO_LISTADO} onClick={() => setCrm(NAO_LISTADO)}>
                <span className="text-sm font-medium">Não está na lista</span>
                <span className="text-xs text-muted-foreground">Validar viabilidade</span>
              </SelectButton>
            </div>
            {crm === NAO_LISTADO && (
              <p className="text-sm text-muted-foreground">
                CRM fora da lista precisa de uma reunião de viabilidade com o time de integração antes
                do orçamento.
              </p>
            )}
          </div>
        )}

        <div className="flex justify-end">
          <Button disabled={!canContinue} onClick={handleContinue}>
            Continuar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function SelectButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'flex flex-col items-start gap-0.5 rounded-xl border px-3 py-2.5 text-left transition-all',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        active
          ? 'border-primary bg-primary/10 ring-1 ring-primary/40'
          : 'border-input hover:border-foreground/30 hover:bg-secondary/50',
      )}
    >
      {children}
    </button>
  );
}
