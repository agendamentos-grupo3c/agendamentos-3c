import { AppHeader } from '@/components/app-header';
import { AuthGuard } from '@/features/auth/auth-guard';
import { CardsList } from '@/features/cards/cards-list';
import { ImplantationList } from '@/features/implantation/implantation-list';

export default function CardsPage() {
  return (
    <AuthGuard>
      <div className="flex min-h-screen flex-col">
        <AppHeader />
        <main className="mx-auto w-full max-w-2xl flex-1 space-y-10 p-6 sm:p-8">
          <section>
            <h1 className="mb-4 text-lg font-semibold">Integrações</h1>
            <CardsList />
          </section>
          <section>
            <h1 className="mb-4 text-lg font-semibold">Implantações</h1>
            <ImplantationList />
          </section>
        </main>
      </div>
    </AuthGuard>
  );
}
