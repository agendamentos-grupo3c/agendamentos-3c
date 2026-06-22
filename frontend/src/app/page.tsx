import { AppHeader } from '@/components/app-header';
import { AuthGuard } from '@/features/auth/auth-guard';
import { Dashboard } from '@/features/home/dashboard';

export default function HomePage() {
  return (
    <AuthGuard>
      <div className="flex min-h-screen flex-col">
        <AppHeader />
        <main className="mx-auto w-full max-w-3xl flex-1 p-6 sm:p-8">
          <Dashboard />
        </main>
      </div>
    </AuthGuard>
  );
}
