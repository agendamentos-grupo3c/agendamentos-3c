import 'fastify';

declare module 'fastify' {
  interface FastifyRequest {
    // Preenchido pelo middleware requireAuth após validar a sessão.
    user?: { email: string; name: string };
  }
}
