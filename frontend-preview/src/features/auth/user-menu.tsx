'use client';

import { LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import { useCurrentUser } from '@/features/auth/auth-guard';
import { api } from '@/lib/api';

export function UserMenu() {
  const user = useCurrentUser();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = React.useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await api.logout();
    } finally {
      router.replace('/login');
    }
  }

  return (
    <div className="flex items-center gap-3">
      <span className="hidden text-sm text-muted-foreground sm:inline">{user.email}</span>
      <Button variant="outline" size="sm" onClick={handleLogout} disabled={loggingOut}>
        <LogOut />
        Sair
      </Button>
    </div>
  );
}
