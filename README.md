# Sistema de Agendamento de Integrações — Grupo 3C

Aplicação web interna para que **vendedores** do Grupo 3C agendem a reunião de
kickoff entre o cliente e o time de integrações (Alana Gaspar e Guilherme Ribeiro),
lendo a disponibilidade real no Google Calendar, e disparem automaticamente as
ações de Slack, WhatsApp (dizparos), card do cliente e sincronização no ClickUp.

> Este repositório é construído **um passo por vez**, conforme o documento mestre
> [`CLAUDE.md`](./CLAUDE.md). Cada passo é liberado manualmente.

## Estrutura do monorepo

```
projeto-3c-integracoes/
├── backend/    # API Node.js (Fastify + TypeScript) — deploy na Render
└── frontend/   # App Next.js (App Router + TypeScript) — deploy na Vercel
```

Cada pasta é independente: tem seu próprio `package.json`, build, deploy e
variáveis de ambiente.

## Stack

| Camada      | Tecnologia                                              | Hospedagem |
| ----------- | ------------------------------------------------------- | ---------- |
| Frontend    | Next.js (App Router) + React + TypeScript + Tailwind    | Vercel     |
| UI          | shadcn/ui + tema claro/escuro (`next-themes`)           | —          |
| Backend     | Node.js + TypeScript + Fastify (arquitetura em camadas) | Render     |
| Validação   | Zod (front e back)                                      | —          |
| Banco       | Neon (PostgreSQL serverless) via `pg` (node-postgres)   | Neon       |
| Auth        | Google OAuth 2.0 / OIDC com restrição de domínio `hd`   | —          |

## Pré-requisitos

- Node.js >= 20
- npm >= 10

## Desenvolvimento

```bash
# Backend
cd backend
npm install
cp .env.example .env   # preencher com valores reais (NÃO commitar)
npm run migrate        # cria as tabelas no Neon
npm run dev            # carrega o .env automaticamente

# Frontend
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

## Deploy

- **Backend (Render):** blueprint em [`render.yaml`](./render.yaml). Build `npm ci && npm run build`, start `npm run start`, health check em `/health`, migrations via `preDeployCommand`. Defina todos os segredos no painel (variáveis `sync:false`).
- **Frontend (Vercel):** importe o repositório com **Root Directory = `frontend`**. Defina `NEXT_PUBLIC_API_BASE_URL` (URL da API na Render) e `NEXT_PUBLIC_GOOGLE_CLIENT_ID`.
- **Banco (Neon):** crie o projeto, copie as connection strings (pooled e direta) e rode as migrations.
- Antes de publicar, siga o [checklist de segurança](./SECURITY.md).

## Roadmap (resumo)

1. **Estrutura base** ✅ (este passo)
2. Backend — fundação segura (Fastify, helmet/CSP, CORS, rate-limit, `/health`)
3. Config + dados (env via Zod, pool Neon/Postgres, migrations SQL, auditoria)
4. Auth Google (OIDC server-side, allowlist, sessão em cookie, CSRF)
5. Frontend base (Next + Tailwind + shadcn/ui, tema, login, guarda de rota)
6. Formulário (campos, validação Zod, máscara/telefone E.164)
7. Agenda (Google Calendar, 2 colunas, anti-corrida, regra de janela)
8. Pipeline de submit (card → Slack → WhatsApp → ClickUp, idempotente)
9. Pós-reunião (no-show / orçamento enviado, máquina de estados)
10. Hardening + deploy

Detalhes completos em [`CLAUDE.md`](./CLAUDE.md).
