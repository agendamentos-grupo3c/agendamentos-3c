import { AppHeader } from '@/components/app-header';
import { AuthGuard } from '@/features/auth/auth-guard';
import { AgendarFlow } from '@/features/scheduling/agendar-flow';

export default function AgendarPage() {
  return (
    <AuthGuard>
      <div className="flex min-h-screen flex-col">
        <AppHeader />
        <main className="mx-auto w-full max-w-3xl flex-1 p-6 sm:p-8">
          <AgendarFlow />
        </main>
      </div>
    </AuthGuard>
  );
}
