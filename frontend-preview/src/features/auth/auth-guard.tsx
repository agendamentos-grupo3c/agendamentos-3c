'use client';

import { useRouter } from 'next/navigation';
import * as React from 'react';

import { api, type ApiUser } from '@/lib/api';

const AuthContext = React.createContext<ApiUser | null>(null);

export function useCurrentUser(): ApiUser {
  const user = React.useContext(AuthContext);
  if (!user) {
    throw new Error('useCurrentUser deve ser usado dentro de <AuthGuard>.');
  }
  return user;
}

// Guarda client-side: a autorização real é do backend (revalida a sessão a cada
// chamada). Aqui só decidimos o que renderizar; sem sessão válida → /login.
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = React.useState<ApiUser | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let active = true;
    api
      .getMe()
      .then((u) => {
        if (active) {
          setUser(u);
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) router.replace('/login');
      });
    return () => {
      active = false;
    };
  }, [router]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Carregando…
      </div>
    );
  }

  return <AuthContext.Provider value={user}>{children}</AuthContext.Provider>;
}
