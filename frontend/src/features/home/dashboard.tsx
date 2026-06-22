'use client';

import { ArrowRight, CalendarPlus, ListChecks } from 'lucide-react';
import Link from 'next/link';

import { useCurrentUser } from '@/features/auth/auth-guard';
import { cn } from '@/lib/utils';

const ACTIONS = [
  {
    href: '/agendar',
    title: 'Novo agendamento',
    description: 'Preencha os dados do cliente e agende o kickoff da demanda.',
    icon: CalendarPlus,
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
              'hover:-translate-y-0.5 hover:border-primary/60 hover:shadow-lg hover:shadow-primary/10',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            )}
          >
            <span
              className={cn(
                'mb-5 inline-flex size-12 items-center justify-center rounded-2xl transition-colors',
                accent
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-secondary-foreground group-hover:bg-primary group-hover:text-primary-foreground',
              )}
            >
              <Icon className="size-6" />
            </span>
            <h2 className="text-lg font-semibold">{title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
            <ArrowRight className="mt-4 size-5 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
          </Link>
        ))}
      </div>
    </div>
  );
}
