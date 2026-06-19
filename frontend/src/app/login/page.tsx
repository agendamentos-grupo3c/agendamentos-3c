import { ThemeToggle } from '@/components/theme-toggle';
import { LoginCard } from '@/features/auth/login-card';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="relative flex min-h-screen items-center justify-center p-4">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <LoginCard errorCode={error} />
    </main>
  );
}
