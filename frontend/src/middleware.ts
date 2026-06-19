import { NextResponse, type NextRequest } from 'next/server';

const API = process.env.NEXT_PUBLIC_API_BASE_URL ?? '';

// CSP por requisição com nonce: scripts só executam com o nonce desta resposta
// (o Next aplica o nonce aos próprios scripts). style-src mantém 'unsafe-inline'
// pois estilos têm baixo risco e o Next/Tailwind injetam estilos sem nonce.
export function middleware(request: NextRequest): NextResponse {
  const nonce = btoa(crypto.randomUUID());
  const csp = [
    `default-src 'self'`,
    // 'unsafe-eval' só em dev: o React Refresh/HMR do Next usa eval. Em produção fica estrita.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${
      process.env.NODE_ENV !== 'production' ? " 'unsafe-eval'" : ''
    }`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data:`,
    `font-src 'self'`,
    `connect-src 'self' ${API}`.trim(),
    `frame-ancestors 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `object-src 'none'`,
  ].join('; ');

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('content-security-policy', csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('content-security-policy', csp);
  return response;
}

export const config = {
  matcher: [
    {
      source: '/((?!_next/static|_next/image|favicon.ico).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
