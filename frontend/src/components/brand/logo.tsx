import { cn } from '@/lib/utils';

// Logo do Grupo 3C. Troca automática por tema (preta no claro, amarela no
// escuro) via classes utilitárias — sem JS, evitando flicker de hidratação.
// Os arquivos devem existir em /public:
//   public/logo-3c-black.png  e  public/logo-3c-yellow.png
export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn('inline-block', className)} aria-label="Grupo 3C">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo-3c-black.png"
        alt="Grupo 3C"
        className="block h-full w-auto dark:hidden"
        draggable={false}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo-3c-yellow.png"
        alt="Grupo 3C"
        className="hidden h-full w-auto dark:block"
        draggable={false}
      />
    </span>
  );
}
