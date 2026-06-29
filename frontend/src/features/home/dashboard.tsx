'use client';

import { ArrowRight, Calculator, ListChecks, Rocket } from 'lucide-react';
import Link from 'next/link';

import { useCurrentUser } from '@/features/auth/auth-guard';
import { cn } from '@/lib/utils';

// Um card por formulário (escalável: novos tipos = novos cards aqui).
// Obs.: o fluxo "Integrações / Automações" saiu da entrada principal (backlog);
// a reunião com a integração agora é acionada dentro do fluxo de orçamento.
const ACTIONS = [
  {
    href: '/orcamento',
    title: 'Orçamento de integração',
    description: 'Monte o orçamento da integração do cliente e envie a proposta.',
    icon: Calculator,
    accent: true,
  },
  {
    href: '/agendar/implantacao',
    title: 'Implantação',
    description: 'Agende o treinamento de implantação do cliente.',
    icon: Rocket,
    accent: true,
  },
  {
    href: '/cards',
    title: 'Meus agendamentos',
    description: 'Acompanhe os agendamentos e registre os desfechos das reuniões.',
    icon: ListChecks,
    accent: false,
  },
] as const;

export function Dashboard() {
  const user = useCurrentUser();
  const firstName = user.name.split(' ')[0] || 'colaborador';

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <p className="text-sm text-muted-foreground">Bem-vindo(a) de volta,</p>
        <h1 className="text-3xl font-bold tracking-tight capitalize">{firstName}</h1>
        <p className="text-muted-foreground">O que você quer fazer agora?</p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        {ACTIONS.map(({ href, title, description, icon: Icon, accent }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              'group relative overflow-hidden rounded-3xl border bg-card p-6 shadow-sm transition-all',
              'hover:-translate-y-0.5 hover:border-foreground/25 hover:shadow-lg',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            )}
          >
            <span
              className={cn(
                'mb-5 inline-flex size-12 items-center justify-center rounded-2xl transition-colors',
                accent
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-secondary-foreground',
              )}
            >
              <Icon className="size-6" />
            </span>
            <h2 className="text-lg font-semibold">{title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
            <ArrowRight className="mt-4 size-5 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-foreground" />
          </Link>
        ))}
      </div>
    </div>
  );
}
