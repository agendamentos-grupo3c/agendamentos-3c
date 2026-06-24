import { AppHeader } from '@/components/app-header';
import { AgendaLog } from '@/features/admin/agenda-log';
import { AuthGuard } from '@/features/auth/auth-guard';

export default function AdminAgendasPage() {
  return (
    <AuthGuard>
      <div className="flex min-h-screen flex-col">
        <AppHeader />
        <main className="mx-auto w-full max-w-2xl flex-1 space-y-4 p-6 sm:p-8">
          <div>
            <h1 className="text-lg font-semibold">Log de agendas</h1>
            <p className="text-sm text-muted-foreground">
              Histórico de pausas e reativações de agenda dos integradores e implantadores.
            </p>
          </div>
          <AgendaLog />
        </main>
      </div>
    </AuthGuard>
  );
}
