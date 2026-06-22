'use client';

import { Logo } from '@/components/brand/logo';
import { GoogleIcon } from '@/components/icons/google';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { api } from '@/lib/api';
import { loginErrorMessage } from '@/lib/auth-errors';

export function LoginCard({ errorCode }: { errorCode?: string }) {
  const errorMessage = loginErrorMessage(errorCode);

  return (
    <Card className="w-full max-w-md rounded-3xl border-border/60 shadow-xl shadow-black/5 backdrop-blur-sm">
      <CardContent className="flex flex-col items-center gap-7 p-8 sm:p-10">
        <Logo className="h-12" />

        <div className="space-y-1.5 text-center">
          <h1 className="text-2xl font-bold tracking-tight">Agendamento de Integrações</h1>
          <p className="text-sm text-muted-foreground">
            Acesso exclusivo a colaboradores Grupo&nbsp;3C.
          </p>
        </div>

        {errorMessage && (
          <p
            role="alert"
            className="w-full rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-center text-sm text-destructive"
          >
            {errorMessage}
          </p>
        )}

        <Button
          size="lg"
          variant="outline"
          className="w-full gap-3 rounded-xl text-base font-medium [&_svg]:size-5"
          onClick={() => (window.location.href = api.loginUrl())}
        >
          <GoogleIcon className="size-5" />
          Entrar com Google
        </Button>

        <p className="text-center text-xs text-muted-foreground">
          Use sua conta <span className="font-medium">@grupo-3c.com</span>.
        </p>
      </CardContent>
    </Card>
  );
}
