'use client';

import Link from 'next/link';

import { ThemeToggle } from '@/components/theme-toggle';
import { UserMenu } from '@/features/auth/user-menu';

export function AppHeader() {
  return (
    <header className="flex items-center justify-between border-b px-6 py-3">
      <div className="flex items-center gap-6">
        <span className="font-semibold">Integrações Grupo 3C</span>
        <nav className="flex gap-4 text-sm">
          <Link href="/" className="text-muted-foreground transition-colors hover:text-foreground">
            Novo agendamento
          </Link>
          <Link
            href="/cards"
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            Meus agendamentos
          </Link>
        </nav>
      </div>
      <div className="flex items-center gap-2">
        <ThemeToggle />
        <UserMenu />
      </div>
    </header>
  );
}
