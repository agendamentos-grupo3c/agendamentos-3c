'use client';

import { PlugZap, Rocket, type LucideIcon } from 'lucide-react';
import * as React from 'react';

import { ImplantationFlow } from '@/features/implantation/implantation-flow';
import { SchedulingFlow } from '@/features/scheduling/scheduling-flow';
import { cn } from '@/lib/utils';

type DemandKind = 'integracoes_automacoes' | 'implantacao';

const OPTIONS: { kind: DemandKind; label: string; icon: LucideIcon }[] = [
  { kind: 'integracoes_automacoes', label: 'Integrações / Automações', icon: PlugZap },
  { kind: 'implantacao', label: 'Implantação', icon: Rocket },
];

export function AgendarFlow() {
  const [kind, setKind] = React.useState<DemandKind>('integracoes_automacoes');

  return (
    <div className="space-y-6">
      <div>
        <p className="mb-2 text-sm font-medium">Tipo de demanda</p>
        <div className="grid grid-cols-1 gap-2 rounded-2xl bg-secondary p-1.5 sm:grid-cols-2">
          {OPTIONS.map(({ kind: k, label, icon: Icon }) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              aria-pressed={kind === k}
              className={cn(
                'flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                kind === k
                  ? 'bg-card text-foreground shadow-sm ring-1 ring-primary/40'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Icon className="size-4" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {kind === 'integracoes_automacoes' ? <SchedulingFlow /> : <ImplantationFlow />}
    </div>
  );
}
