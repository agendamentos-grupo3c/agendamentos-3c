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

## Implantação — confirmação de agendamento e link da reunião

Regras específicas do fluxo de **implantação** (segmento + produto + rodízio de
implantadores), além do que está no `CLAUDE.md`:

### Modal de confirmação (antes de agendar)

Ao selecionar um horário, o botão **Agendar** abre um **modal de confirmação**
que destaca a escolha do vendedor antes de efetivar:

> *"{primeiro nome do vendedor}, você está agendando a implantação de **{produto}**
> para a empresa **{empresa}**."* — com a data e o horário em destaque.

Só ao **Confirmar** o horário é reservado e o cliente notificado. "Revisar"
fecha o modal sem agendar. O nome vem da sessão (`useCurrentUser`); produto,
empresa, dia e hora vêm do formulário e do slot selecionado.

### Link da reunião (pós-reunião)

Depois que o implantador registra o desfecho de **toda a sessão**
(`compareceu` / `no-show` → ClickUp e Slack via n8n), surge um campo para ele
**colar manualmente o link da reunião** quando ela for gerada. Ao salvar:

1. **HubSpot** — o link é anexado à **reunião já criada para cada lead** que
   **compareceu**. Ele entra no corpo da reunião **abaixo da observação, com duas
   linhas em branco** entre os dois (`composeMeetingBody`), para que a observação
   e o link nunca quebrem a visualização da reunião.
2. **n8n** — dispara o e-mail "link da reunião gerado" **apenas aos leads que
   compareceram** (payload `tipo: 'link'` no `N8N_IMPLANTACAO_WEBHOOK`).

Garantias de robustez:

- **Permissões:** o endpoint `POST /implantation/:id/meeting-link` exige papel
  **implantador** (`requireImplanter`) e valida que o ator é o **dono da agenda**
  da sessão (vendedor → 403; implantador de outra coluna → 403).
- **Coerência de estado:** o link só é aceito quando a sessão **não tem mais
  participantes pendentes** e **ao menos um compareceu** (senão 409).
- **Idempotência:** o mesmo link já gravado e notificado não redispara o e-mail;
  `meeting_link_notified_at` só é marcado após o sucesso no n8n, então um retry
  reprocessa o que faltou sem duplicar.
- **Campo separado:** `meeting_link` é distinto do `meeting_url` (Google Meet do
  kickoff) — o link manual não sobrescreve o link original.

### Notificações (n8n)

A implantação **não usa ClickUp** — só Slack e e-mail, via n8n. O backend dispara
três eventos para `N8N_IMPLANTACAO_WEBHOOK` (`tipo`: `agendada`, `desfecho`,
`link`), tratados pelo fluxo n8n de implantação.

## Orçamento de integração (ClickSign)

Fluxo do **vendedor** quando o cliente quer uma integração. Entrada principal do
dashboard (o agendamento de reuniões de integradores saiu da entrada e virou um
ramo deste fluxo).

1. **Triagem** — antes de orçar, define o cenário:
   - cliente só quer **tirar dúvidas** → agenda reunião com a integração (sem custo);
   - **CRM fora da lista** com template → agenda reunião de **viabilidade**;
   - CRM na lista + quer fechar → segue para a **calculadora**.
2. **Calculadora** — precifica a integração (serviços + dimensionamento). O preço é
   **sempre recomputado no backend** (`lib/orcamentoPolicy.ts`); o total do front é
   apenas informativo.
   - **Desconto:** até o teto (`ORCAMENTO.DESCONTO_MAX_PCT`, hoje 20%) **ou** o valor
     cheio (cortesia total). Entre os dois é recusado (`DESCONTO_EXCEDENTE`). O teto
     **não** é exibido ao cliente na tela; só aparece um aviso de "excedente".
3. **Dados da proposta (contratante)** — nome/e-mail/telefone/empresa/CNPJ, IDs
   HubSpot/negócio (opcionais), forma de pagamento e parcelas.
4. **Envio** — `POST /orcamento` (auth + CSRF + `Idempotency-Key` + rate-limit)
   monta o payload e dispara o webhook **`N8N_CLICKSIGN_WEBHOOK`** (a chave também
   vai como header HTTP). Cada envio é auditado (`orcamento.sent`).
   - **Idempotência server-side:** a tabela `orcamento_envios` (índice único na
     `idempotency_key`) grava o envio e **bloqueia o reenvio no nosso lado** — um
     replay com a mesma chave retorna o resultado anterior **sem** chamar o n8n de
     novo, evitando proposta/boleto duplicados.

**Delegado ao n8n (outro setor):** a geração da proposta no **ClickSign + boleto**,
e a mudança do **ClickUp → "Orçamento enviado"** + aviso no **Slack** acontecem do
lado do n8n a partir do webhook. O enriquecimento de CNPJ (Receita Federal) e do
deal no HubSpot também fica no n8n. Sem `N8N_CLICKSIGN_WEBHOOK` configurada, o envio
retorna erro tratado (nada externo dispara).

## Distribuição de projetos pagos (Alana / Guilherme)

Quando um orçamento é **assinado e pago**, o n8n (outro setor) chama a nossa API
para decidir qual integrador fica com o projeto, mantendo os dois **parelhos por
valor no mês**. A decisão e o estado ficam no nosso backend (tabela
`integracao_atribuicoes`), auditável e à prova de replay.

- **Regra:** cada projeto pago vai para quem tem o **menor acumulado no mês**
  (competência `YYYY-MM`, fuso SP). Empate → `alana`. Cortesia (R$0) conta como 0.
- **Chamar** no momento do pagamento, **antes** de criar o lead no ClickUp.

**Contrato — `POST /integracao/atribuir`** (máquina-a-máquina, sem sessão):

```
Header:  X-Api-Key: <INTEGRACAO_API_KEY>
Body:    { "idempotencyKey": "<ref única do orçamento pago>",
           "valor": 1200,            // líquido pago, R$ inteiros (cortesia = 0)
           "empresa": "Acme",        // opcional
           "crm": "Kommo" }          // opcional
Resp:    { "integrador": "alana",    // ou "guilherme"
           "competencia": "2026-07",
           "totais": { "alana": 2000, "guilherme": 2500 },
           "jaAtribuido": false }    // true em replay (mesma idempotencyKey)
```

**Idempotência:** a mesma `idempotencyKey` nunca é contabilizada duas vezes — um
replay devolve a mesma atribuição (`jaAtribuido: true`). Sem `INTEGRACAO_API_KEY`
configurada, a rota responde **401**.

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
