'use client';

import { ChevronDown, LogOut, Pause, Play, ScrollText, User } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import { useCurrentUser } from '@/features/auth/auth-guard';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

export function UserMenu() {
  const user = useCurrentUser();
  const router = useRouter();
  const ref = React.useRef<HTMLDivElement>(null);

  const [open, setOpen] = React.useState(false);
  const [loggingOut, setLoggingOut] = React.useState(false);
  const [ownsAgenda, setOwnsAgenda] = React.useState(false);
  const [active, setActive] = React.useState(true);
  const [toggling, setToggling] = React.useState(false);

  React.useEffect(() => {
    let on = true;
    api
      .getAgendaStatus()
      .then((s) => on && (setOwnsAgenda(s.ownsAgenda), setActive(s.active)))
      .catch(() => undefined);
    return () => {
      on = false;
    };
  }, []);

  React.useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const firstName = user.name.split(' ')[0] || 'Conta';

  async function toggleAgenda() {
    setToggling(true);
    try {
      const s = await api.toggleAgenda();
      setActive(s.active);
    } catch {
      // mantém o estado em caso de falha
    } finally {
      setToggling(false);
    }
  }

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await api.logout();
    } finally {
      router.replace('/login');
    }
  }

  return (
    <div ref={ref} className="relative">
      <Button variant="outline" size="sm" onClick={() => setOpen((v) => !v)} className="gap-1.5">
        <User className="size-4" />
        <span className="hidden max-w-[8rem] truncate sm:inline">{firstName}</span>
        {ownsAgenda && !active && (
          <span className="size-2 rounded-full bg-destructive" title="Agenda pausada" />
        )}
        <ChevronDown className={cn('size-3.5 transition-transform', open && 'rotate-180')} />
      </Button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-60 overflow-hidden rounded-xl border bg-card p-1 shadow-xl"
        >
          <p className="truncate px-3 py-2 text-xs text-muted-foreground" title={user.email}>
            {user.email}
          </p>
          <div className="my-1 border-t" />

          {ownsAgenda && (
            <button
              type="button"
              role="menuitem"
              disabled={toggling}
              onClick={toggleAgenda}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-secondary disabled:opacity-50"
            >
              {active ? <Pause className="size-4" /> : <Play className="size-4" />}
              {active ? 'Pausar minha agenda' : 'Reativar minha agenda'}
            </button>
          )}

          {user.isAdmin && (
            <Link
              href="/admin/agendas"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-secondary"
            >
              <ScrollText className="size-4" />
              Log de agendas
            </Link>
          )}

          <div className="my-1 border-t" />
          <button
            type="button"
            role="menuitem"
            disabled={loggingOut}
            onClick={handleLogout}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-destructive hover:bg-secondary disabled:opacity-50"
          >
            <LogOut className="size-4" />
            Sair
          </button>
        </div>
      )}
    </div>
  );
}
