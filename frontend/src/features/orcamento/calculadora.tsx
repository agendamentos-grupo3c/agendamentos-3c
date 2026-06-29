'use client';

import { Check, Copy } from 'lucide-react';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useCurrentUser } from '@/features/auth/auth-guard';
import {
  brl,
  computeOrcamento,
  EMPTY_ORCAMENTO,
  ORCAMENTO_WEIGHTS,
  PILARES,
  STEP_DRIVERS,
  tierFor,
  type OrcamentoState,
} from '@/lib/orcamento';
import { cn } from '@/lib/utils';

export interface CalculadoraData {
  escopo: OrcamentoState;
  cliente: string;
  descricao: string;
}

export function Calculadora({
  crm,
  onBack,
  onContinue,
}: {
  crm: string;
  onBack: () => void;
  onContinue: (data: CalculadoraData) => void;
}) {
  const user = useCurrentUser();
  const [state, setState] = React.useState<OrcamentoState>(EMPTY_ORCAMENTO);
  const [cliente, setCliente] = React.useState('');
  const [descricao, setDescricao] = React.useState('');
  const [copied, setCopied] = React.useState(false);

  const { lines, total } = computeOrcamento(state);

  const setNum = (key: 'funis' | 'qualifs' | 'sdrs' | 'campos', val: number) =>
    setState((s) => ({ ...s, [key]: val }));

  function buildResumo(): string {
    const L: string[] = [];
    L.push(`ORÇAMENTO — ${cliente || '(cliente)'}`);
    L.push(`Responsável: ${user.name}`);
    L.push(`CRM: ${crm}`);
    if (descricao) L.push('', 'DESCRIÇÃO', descricao);
    L.push('', 'ESCOPO');
    L.push('• Setup base (kickoff, deploy, testes, dedup)');
    for (const p of PILARES) if (state.pilares[p.key]) L.push(`• ${p.nome}${p.free ? ' (grátis · nativo 3C)' : ''}`);
    L.push('', 'DIMENSIONAMENTO');
    L.push(`• Funis de gatilho: ${state.funis}`);
    L.push(`• Qualificações mapeadas: ${state.qualifs}`);
    L.push(`• SDRs / operadores: ${state.sdrs}`);
    L.push(`• Campos personalizados: ${state.campos}`);
    L.push(`• URL no retorno: ${state.url ? 'sim' : 'não'}`);
    L.push('', `VALOR: R$ ${brl(total)},00`);
    return L.join('\n');
  }

  async function copyResumo() {
    try {
      await navigator.clipboard.writeText(buildResumo());
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard indisponível — ignora silenciosamente */
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_340px] lg:items-start">
      <div className="space-y-5">
        <Card className="rounded-2xl">
          <CardContent className="space-y-4 pt-6">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold">Pilares do escopo</h2>
              <span className="text-xs text-muted-foreground">CRM: {crm}</span>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {PILARES.map((p) => {
                const on = state.pilares[p.key];
                return (
                  <button
                    key={p.key}
                    type="button"
                    aria-pressed={on}
                    onClick={() =>
                      setState((s) => ({ ...s, pilares: { ...s.pilares, [p.key]: !s.pilares[p.key] } }))
                    }
                    className={cn(
                      'flex flex-col items-start gap-0.5 rounded-xl border px-3 py-2.5 text-left transition-all',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      on
                        ? 'border-primary bg-primary/10 ring-1 ring-primary/40'
                        : 'border-input hover:border-foreground/30 hover:bg-secondary/50',
                    )}
                  >
                    <span className="text-sm font-medium">{p.nome}</span>
                    <span className="text-xs text-muted-foreground">{p.desc}</span>
                    <span
                      className={cn(
                        'mt-1 text-xs font-semibold',
                        p.free ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground',
                      )}
                    >
                      {p.free ? 'Grátis · nativo 3C' : `+ R$ ${brl(ORCAMENTO_WEIGHTS.pilar[p.key])}`}
                    </span>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardContent className="space-y-1 pt-6">
            <h2 className="mb-2 text-base font-semibold">Tamanho da operação</h2>
            {STEP_DRIVERS.map((d) => {
              const value = state[d.key];
              const tier = d.tiered ? tierFor(value) : null;
              return (
                <div
                  key={d.key}
                  className="flex items-center justify-between gap-3 border-b py-3 last:border-b-0"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{d.label}</p>
                    <p className="text-xs text-muted-foreground">{d.hint}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {tier && tier.add > 0 && (
                      <span className="text-xs font-semibold text-green-600 dark:text-green-400">
                        +R$ {brl(tier.add)}
                      </span>
                    )}
                    <Stepper value={value} min={d.min} max={d.max} onChange={(v) => setNum(d.key, v)} />
                  </div>
                </div>
              );
            })}
            <div className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">URL no retorno</p>
                <p className="text-xs text-muted-foreground">link/gravação clicável no card</p>
              </div>
              <div className="flex items-center gap-3">
                {state.url && (
                  <span className="text-xs font-semibold text-green-600 dark:text-green-400">
                    +R$ {brl(ORCAMENTO_WEIGHTS.url)}
                  </span>
                )}
                <Switch checked={state.url} onChange={(v) => setState((s) => ({ ...s, url: v }))} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardContent className="space-y-4 pt-6">
            <h2 className="text-base font-semibold">Identificação</h2>
            <div className="space-y-1.5">
              <Label htmlFor="orc-cliente">Cliente / ID 3C</Label>
              <Input
                id="orc-cliente"
                placeholder="Ex.: Pieta Tech / 13678"
                value={cliente}
                onChange={(e) => setCliente(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="orc-desc">Descrição do projeto</Label>
              <Textarea
                id="orc-desc"
                rows={3}
                placeholder="Resumo do que foi combinado na call."
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-2xl lg:sticky lg:top-6">
        <CardContent className="space-y-4 pt-6">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Valor do orçamento
            </p>
            <p className="mt-1 text-4xl font-bold tracking-tight">
              <span className="align-top text-lg font-semibold text-muted-foreground">R$ </span>
              {brl(total)}
            </p>
          </div>

          <ul className="space-y-1 border-t pt-3">
            {lines.map((l, i) => (
              <li
                key={`${l.label}-${i}`}
                className={cn(
                  'flex justify-between gap-2 text-sm',
                  l.base ? 'text-muted-foreground' : 'text-foreground',
                )}
              >
                <span>{l.label}</span>
                <span className="font-medium tabular-nums">
                  {l.val === 0 ? 'Grátis' : `R$ ${brl(l.val)}`}
                </span>
              </li>
            ))}
          </ul>

          <div className="space-y-2 border-t pt-3">
            <Button variant="outline" className="w-full" onClick={copyResumo}>
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
              {copied ? 'Copiado!' : 'Copiar resumo'}
            </Button>
            <Button className="w-full" onClick={() => onContinue({ escopo: state, cliente, descricao })}>
              Continuar para a proposta
            </Button>
            <Button variant="ghost" className="w-full" onClick={onBack}>
              Voltar
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Stepper({
  value,
  min,
  max,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  const clamp = (v: number) => Math.min(max, Math.max(min, v));
  return (
    <div className="flex items-center overflow-hidden rounded-lg border">
      <button
        type="button"
        aria-label="diminuir"
        onClick={() => onChange(clamp(value - 1))}
        className="flex size-8 items-center justify-center text-lg leading-none transition-colors hover:bg-secondary"
      >
        −
      </button>
      <input
        inputMode="numeric"
        value={value}
        onChange={(e) => {
          const v = parseInt(e.target.value.replace(/\D/g, ''), 10);
          onChange(Number.isNaN(v) ? min : clamp(v));
        }}
        className="h-8 w-12 border-x bg-transparent text-center text-sm font-semibold tabular-nums outline-none"
      />
      <button
        type="button"
        aria-label="aumentar"
        onClick={() => onChange(clamp(value + 1))}
        className="flex size-8 items-center justify-center text-lg leading-none transition-colors hover:bg-secondary"
      >
        +
      </button>
    </div>
  );
}

function Switch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative h-6 w-11 shrink-0 rounded-full transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        checked ? 'bg-primary' : 'bg-input',
      )}
    >
      <span
        className={cn(
          'absolute left-0.5 top-0.5 size-5 rounded-full bg-background shadow transition-transform',
          checked && 'translate-x-5',
        )}
      />
    </button>
  );
}
