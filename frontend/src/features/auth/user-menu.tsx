'use client';

import { LogOut, Pause, Play, ScrollText } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import { useCurrentUser } from '@/features/auth/auth-guard';
import { api } from '@/lib/api';

export function UserMenu() {
  const user = useCurrentUser();
  const router = useRouter();
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

  async function toggleAgenda() {
    setToggling(true);
    try {
      const s = await api.toggleAgenda();
      setActive(s.active);
    } catch {
      // mantém o estado atual em caso de falha
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
    <div className="flex items-center gap-2">
      {ownsAgenda && (
        <Button
          variant="outline"
          size="sm"
          onClick={toggleAgenda}
          disabled={toggling}
          title={active ? 'Pausar sua agenda (ninguém poderá agendar)' : 'Reativar sua agenda'}
        >
          {active ? <Pause /> : <Play />}
          <span className="hidden sm:inline">{active ? 'Pausar agenda' : 'Reativar agenda'}</span>
        </Button>
      )}

      {ownsAgenda && !active && (
        <span className="rounded-full bg-destructive/10 px-2.5 py-0.5 text-xs font-medium text-destructive">
          Agenda pausada
        </span>
      )}

      {user.isAdmin && (
        <Button asChild variant="ghost" size="sm">
          <Link href="/admin/agendas" title="Log de pausas/reativações de agenda">
            <ScrollText />
            <span className="hidden sm:inline">Log de agendas</span>
          </Link>
        </Button>
      )}

      <span className="hidden text-sm text-muted-foreground md:inline">{user.email}</span>
      <Button variant="outline" size="sm" onClick={handleLogout} disabled={loggingOut}>
        <LogOut />
        <span className="hidden sm:inline">Sair</span>
      </Button>
    </div>
  );
}
