import { AppHeader } from '@/components/app-header';
import { AuthGuard } from '@/features/auth/auth-guard';
import { CardsList } from '@/features/cards/cards-list';

export default function CardsPage() {
  return (
    <AuthGuard>
      <div className="flex min-h-screen flex-col">
        <AppHeader />
        <main className="mx-auto w-full max-w-2xl flex-1 p-6">
          <h1 className="mb-4 text-lg font-semibold">Meus agendamentos</h1>
          <CardsList />
        </main>
      </div>
    </AuthGuard>
  );
}
