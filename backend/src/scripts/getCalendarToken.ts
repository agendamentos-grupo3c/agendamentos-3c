import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';

// Gera o GOOGLE_CALENDAR_REFRESH_TOKEN (escopo Calendar) da conta
// agendamentos@grupo-3c.com, via fluxo OAuth com servidor local.
//
// Pré-requisitos:
//   1. GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET no .env (mesmos do login).
//   2. No Google Cloud Console → OAuth client → "Authorized redirect URIs",
//      adicione o redirect deste script (default abaixo). Pode remover depois.
//
// Uso: npm run get-calendar-token  (e faça login como agendamentos@grupo-3c.com)

const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const SCOPE = 'https://www.googleapis.com/auth/calendar.events';

const clientId = process.env.GOOGLE_CLIENT_ID;
const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
// URL pública registrada no Google (ex.: a do ngrok). Com ngrok é https sem
// porta — o túnel encaminha para a porta local de escuta abaixo.
const redirectUri =
  process.env.CALENDAR_TOKEN_REDIRECT_URI ?? 'http://localhost:53682/oauth2callback';
// Porta LOCAL onde o servidor escuta (e para onde o ngrok encaminha). Desacoplada
// da URL de redirect, já que a URL pública do ngrok não tem porta.
const listenPort = Number(process.env.CALENDAR_TOKEN_PORT ?? '53682');
const loginHint = process.env.CALENDAR_TOKEN_LOGIN_HINT ?? 'agendamentos@grupo-3c.com';

function fail(message: string): never {
  process.stderr.write(`\n✗ ${message}\n`);
  process.exit(1);
}

if (!clientId || !clientSecret) {
  fail('Defina GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET no .env antes de rodar.');
}

const callback = new URL(redirectUri);
const state = randomBytes(16).toString('hex');

const authUrl = new URL(AUTH_ENDPOINT);
authUrl.searchParams.set('client_id', clientId);
authUrl.searchParams.set('redirect_uri', redirectUri);
authUrl.searchParams.set('response_type', 'code');
authUrl.searchParams.set('scope', SCOPE);
// offline + consent garantem que o Google devolva um refresh_token.
authUrl.searchParams.set('access_type', 'offline');
authUrl.searchParams.set('prompt', 'consent');
authUrl.searchParams.set('state', state);
authUrl.searchParams.set('login_hint', loginHint);

async function exchangeCode(code: string): Promise<void> {
  const res = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId!,
      client_secret: clientSecret!,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  const json = (await res.json()) as { refresh_token?: string; error?: string; error_description?: string };

  if (!res.ok || !json.refresh_token) {
    fail(
      `Falha ao trocar o code (${res.status}). ${json.error ?? ''} ${json.error_description ?? ''}`.trim(),
    );
  }

  process.stdout.write(
    `\n✓ Refresh token gerado. Configure no Render:\n\n` +
      `GOOGLE_CALENDAR_REFRESH_TOKEN=${json.refresh_token}\n\n` +
      `(Não commite este valor — é um segredo.)\n`,
  );
}

const HTML = (msg: string): string =>
  `<!doctype html><meta charset="utf-8"><body style="font-family:system-ui;padding:3rem;text-align:center">${msg}</body>`;

const server = createServer((req, res) => {
  const reqUrl = new URL(req.url ?? '/', `http://localhost:${listenPort}`);
  if (reqUrl.pathname !== callback.pathname) {
    res.writeHead(404).end();
    return;
  }

  const error = reqUrl.searchParams.get('error');
  const code = reqUrl.searchParams.get('code');
  const returnedState = reqUrl.searchParams.get('state');

  if (error || !code || returnedState !== state) {
    res.writeHead(400, { 'Content-Type': 'text/html' }).end(HTML('Falha na autorização. Volte ao terminal.'));
    server.close();
    fail(error ? `Google retornou: ${error}` : 'state divergente ou code ausente.');
  }

  res
    .writeHead(200, { 'Content-Type': 'text/html' })
    .end(HTML('Pronto! Pode fechar esta aba e voltar ao terminal.'));

  exchangeCode(code!)
    .then(() => {
      server.close();
      process.exit(0);
    })
    .catch((err: unknown) => {
      server.close();
      fail(err instanceof Error ? err.message : String(err));
    });
});

server.listen(listenPort, () => {
  process.stdout.write(
    `\nServidor local escutando em http://localhost:${listenPort} (encaminhe o ngrok para esta porta).\n\n` +
      `Abra esta URL no navegador e faça login como ${loginHint}:\n\n${authUrl.toString()}\n\n` +
      `Aguardando o retorno em ${redirectUri} …\n`,
  );
});
