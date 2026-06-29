import { AppHeader } from '@/components/app-header';
import { AuthGuard } from '@/features/auth/auth-guard';
import { OrcamentoFlow } from '@/features/orcamento/orcamento-flow';

export default function OrcamentoPage() {
  return (
    <AuthGuard>
      <div className="flex min-h-screen flex-col">
        <AppHeader />
        <main className="mx-auto w-full max-w-5xl flex-1 p-6 sm:p-8">
          <OrcamentoFlow />
        </main>
      </div>
    </AuthGuard>
  );
}
