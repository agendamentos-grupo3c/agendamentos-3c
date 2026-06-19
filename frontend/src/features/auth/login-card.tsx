'use client';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { api } from '@/lib/api';
import { loginErrorMessage } from '@/lib/auth-errors';

export function LoginCard({ errorCode }: { errorCode?: string }) {
  const errorMessage = loginErrorMessage(errorCode);

  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="text-center">
        <CardTitle className="text-xl">Agendamento de Integrações</CardTitle>
        <CardDescription>Acesso exclusivo a colaboradores Grupo 3C.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {errorMessage && (
          <p
            role="alert"
            className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {errorMessage}
          </p>
        )}
        <Button className="w-full" onClick={() => (window.location.href = api.loginUrl())}>
          Entrar com Google
        </Button>
      </CardContent>
    </Card>
  );
}
