import type { Metadata } from 'next';
import { headers } from 'next/headers';

import { ThemeProvider } from '@/components/theme-provider';

import './globals.css';

export const metadata: Metadata = {
  title: 'Agendamento de Integrações — Grupo 3C',
  description: 'Ferramenta interna para agendar o kickoff de integrações.',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Nonce vindo do middleware (CSP) — repassado ao script inline do next-themes.
  const nonce = (await headers()).get('x-nonce') ?? undefined;

  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
          nonce={nonce}
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
