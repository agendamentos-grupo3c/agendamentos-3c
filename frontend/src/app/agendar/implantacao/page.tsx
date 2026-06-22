import { AppHeader } from '@/components/app-header';
import { AuthGuard } from '@/features/auth/auth-guard';
import { ImplantationFlow } from '@/features/implantation/implantation-flow';

export default function AgendarImplantacaoPage() {
  return (
    <AuthGuard>
      <div className="flex min-h-screen flex-col">
        <AppHeader />
        <main className="mx-auto w-full max-w-3xl flex-1 p-6 sm:p-8">
          <ImplantationFlow />
        </main>
      </div>
    </AuthGuard>
  );
}
