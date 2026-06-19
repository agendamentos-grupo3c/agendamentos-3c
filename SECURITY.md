# Segurança — Sistema de Agendamento de Integrações (Grupo 3C)

Resumo dos controles implementados e checklist a validar antes de cada deploy.

## Controles implementados

### Autenticação e sessão
- Login Google OAuth 2.0 / OIDC com **PKCE**, `state` e `nonce`.
- Verificação do ID token **no servidor** (assinatura JWKS, `iss`, `aud`, `exp`, `nonce`).
- Regras de acesso: `email_verified === true`, `hd === grupo-3c.com` e **allowlist** server-side.
- Sessão em **JWT curto** (12h) em cookie `httpOnly`, `Secure` (prod), `SameSite=Lax`, prefixo `__Host-` em produção.
- Toda rota protegida revalida a sessão no backend.

### Superfície / transporte
- **Helmet** + CSP restritiva (`default-src 'none'`) na API.
- Frontend: CSP por requisição com **nonce** (middleware) + HSTS, `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, `Permissions-Policy`.
- **CORS** travado no `FRONTEND_ORIGIN` (sem curinga), com `credentials`.
- **Rate limit** global + mais agressivo em `/submit` (10/min). `/health` isento.
- **CSRF** double-submit (`@fastify/csrf-protection`) em todas as rotas que alteram estado.

### Dados
- Acesso ao banco só pelo backend (Neon), conexões **SSL** com verificação de certificado.
- Queries **parametrizadas** (`pg`), nunca concatenação de SQL.
- Idempotência no submit (`Idempotency-Key`) + índices únicos (slot e idempotência) contra corrida/duplicação.
- **Auditoria** (`audit_log`) em login, criação de card e mudanças de status.
- Segredos só no backend; nada sensível em `NEXT_PUBLIC_*`.

### Robustez
- Erros ao cliente são **genéricos**; detalhe só no log do servidor.
- Logger com **redaction** de PII/segredos.
- Falha parcial de integração não corrompe o card; pendências são reprocessáveis (replay idempotente).

## Checklist pré-deploy

- [ ] `SESSION_SECRET` forte (≥ 32 chars) e único por ambiente.
- [ ] `FRONTEND_ORIGIN` = URL exata do front em produção (sem barra final).
- [ ] Front e API no **mesmo domínio registrável** (ex.: `app.grupo-3c.com` / `api.grupo-3c.com`) para o cookie `SameSite=Lax` funcionar; senão, ajustar para `SameSite=None; Secure`.
- [ ] `ALLOWLIST_EMAILS` preenchida (offboarding revisado).
- [ ] `GOOGLE_REDIRECT_URI` registrada no Google Cloud Console (Authorized redirect URI).
- [ ] `DATABASE_URL` com `sslmode=verify-full` (ou manter `require` — o código já força verificação de certificado).
- [ ] Migrations aplicadas (`npm run migrate`).
- [ ] Tokens de Slack/dizparos/ClickUp e refresh token do Calendar definidos só no backend.
- [ ] `.env` nunca commitado (já no `.gitignore`).
- [ ] Build de produção sem `console.*` (removido pelo Next; lint `no-console` no backend).
