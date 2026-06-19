'use client';

import Link from 'next/link';
import * as React from 'react';

import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';
import { UserMenu } from '@/features/auth/user-menu';

// PREVIEW: alterna o papel (vendedor/integrador) via localStorage e recarrega,
// para visualizar as duas experiências. NÃO existe no app real.
function RoleToggle() {
  const [role, setRole] = React.useState<string | null>(null);

  React.useEffect(() => {
    setRole(localStorage.getItem('demo-role') ?? 'integrator');
  }, []);

  function toggle() {
    const next = role === 'seller' ? 'integrator' : 'seller';
    localStorage.setItem('demo-role', next);
    location.reload();
  }

  return (
    <Button variant="outline" size="sm" onClick={toggle}>
      Papel: {role === 'seller' ? 'Vendedor' : 'Integrador'}
    </Button>
  );
}

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
        <RoleToggle />
        <ThemeToggle />
        <UserMenu />
      </div>
    </header>
  );
}
