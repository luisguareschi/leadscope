# LeadScope

WhatsApp lead assistant for real-estate developers. It greets leads, asks three qualifying questions, answers the repeated ones from the company's own files, asks when an advisor can call, and leaves the case in HubSpot. First client: Altamira (Uruguay). The build plan is [`docs/design.md`](docs/design.md).

| Folder | What it is |
| --- | --- |
| `backend/` | Express 5 + Prisma 7 (Postgres). WhatsApp webhook, conversation engine, Anthropic, HubSpot, knowledge uploads. Ships as a Docker image. |
| `backoffice/` | Client-side Next.js 16, Tailwind 4, shadcn (preset `b1Z5bafVA`), React Query. Conversations, pause/resume, knowledge files, company secrets, and (for a platform admin) creating a company and entering one through support access. |
| `docs/` | Design, proposals, meeting notes. |

## Run it locally

You need Node 22.12+ and Postgres 16. `docker compose up -d` starts Postgres with a `leadscope` database and a `leadscope_test` database for the tests.

```bash
docker compose up -d

cd backend
cp .env.example .env
npm install
npm run db:migrate   # empty database: no companies, no operators
npm run dev          # http://localhost:3001
```

In `backend/.env`, set `PLATFORM_ADMIN_EMAILS` to the email that may create companies (comma-separated; nothing is hardcoded), then restart the API. That login does not need an operator row.

```bash
cd backoffice
cp .env.example .env.local
npm install
npm run dev          # http://localhost:3000
```

Sign in at http://localhost:3000 as that email (development login, no password). The panel opens **Empresas**. The list is empty. Create the company (for Altamira: name Altamira, identifier altamira) and the first operator's email. That writes the company, its slug, a starter config, and the operator. It does not ask for API keys. The new row shows in the list.

**Entrar** on a row opens that company's panel as the admin (support access), with no operator row there. A bar at the top says "Viendo como administrador: Altamira", and **Volver a Empresas** leaves. The panel sends `X-Company-Id` on every request; the API honors it only for emails on `PLATFORM_ADMIN_EMAILS`, and every write made that way is recorded in the `AdminAuditEntry` table.

Sign in as the operator email you just typed. The sidebar is Conversaciones, Conocimiento, and Integraciones. Empresas is not there, and `/companies` says there is no access. **Integraciones** is where that company sets its Anthropic, Meta, HubSpot, and form-lead secrets. The page shows whether each one is set and the last 4 characters; it never shows the full value. Leaving a field empty does not clear it.

`npm run db:seed` and `npm run operator:add` are local fixtures only. A production setup does not run them. The seed loads a sample knowledge file and 7 demo conversations on fake numbers (+598 99 000 001–007): qualifying, scheduling a call, handed off with a failed HubSpot write, waiting for an advisor, paused, closed, and a form lead. Use it only when you want that fixture in a development database.

## Talk to the assistant

The examples below assume the local seed fixture (`npm run db:seed` in a development database), which creates Altamira and the dev form secret. A production setup does not run that command.

**From the terminal (recommended for prompt work).** Runs the real engine and knowledge with WhatsApp faked:

```bash
cd backend
npm run chat                         # or: npm run chat -- --phone +59899555123 --name "Ana"
```

Type as the lead. `/audio` sends a voice note, `/estado` shows what the bot extracted, `/reset` starts over. Without an Anthropic key it uses a scripted stand-in; put a key in `ANTHROPIC_API_KEY` in `backend/.env` (development only) or set the company's Anthropic key in Integraciones to talk to `claude-haiku-4-5` with the real prompt. The conversation appears in the panel like any other.

**As Meta would.** With the backend running, post a signed webhook; the reply arrives after the debounce (3.5 s) and shows in the panel:

```bash
npm run webhook:send -- "Hola, busco un 2 dormitorios" --from 59899000999 --name Ana
```

**As a HubSpot form would.** Sends the welcome template once (faked locally):

```bash
curl -X POST localhost:3001/hooks/crm/form-lead/altamira \
  -H "X-LeadScope-Secret: dev-form-secret" -H "Content-Type: application/json" \
  -d '{"phone": "099 123 456", "email": "ana@example.com", "firstname": "Ana"}'
```

## What is faked until week 1

When a company has no key for an integration and `ALLOW_FAKE_INTEGRATIONS=true` (refused in production), that integration runs in-process:

| Integration | Fake | Real once you set |
| --- | --- | --- |
| Anthropic | scripted replies that walk the three questions | `anthropicApiKey` on the company, from Integraciones |
| WhatsApp | sends recorded in memory | `metaAccessToken` (Integraciones) + the company's phone number id |
| HubSpot | contacts kept in memory | `hubspotAccessToken` (Integraciones), and `crm.transcriptProperty` in the config |

Still placeholders in `backend/prisma/seed-data/altamira.ts`: the welcome template name, the HubSpot property name, and business hours. The sample knowledge file is fictional.

## Tests

```bash
cd backend && npm test          # 155 tests; needs Postgres (leadscope_test, or set TEST_DATABASE_URL)
cd backoffice && npm run lint && npm run typecheck && npm run build
```

CI runs both on every pull request.

## Going live

1. **Supabase (us-east-1).** Turn off public signups. Note the pooled URL (port 6543, `?pgbouncer=true`), the direct URL (5432), the project URL, and the anon key. In Auth → URL configuration, set the site URL to the backoffice and allow `<backoffice>/auth/set-password` as a redirect. In Authentication, create the user whose email will be on `PLATFORM_ADMIN_EMAILS`. Do not run `db:seed` or `operator:add`.
2. **Backend.** Deploy `backend/Dockerfile` as one always-on instance (Fly, Railway, or Render) with: `NODE_ENV=production`, `DATABASE_URL` (pooled), `DIRECT_URL`, `SECRETS_ENCRYPTION_KEY` (`openssl rand -base64 32`), `META_APP_SECRET`, `META_WEBHOOK_VERIFY_TOKEN`, `AUTH_MODE=supabase`, `SUPABASE_URL` (the same project URL as the backoffice's `NEXT_PUBLIC_SUPABASE_URL`, no path), `BACKOFFICE_ORIGIN` (the backoffice origin, exactly), `PLATFORM_ADMIN_EMAILS` (comma-separated signed-in emails that may create companies), and optionally `SENTRY_DSN` and `SUPABASE_JWT_SECRET` (only for an older project that still signs access tokens with HS256). Current Supabase projects sign sessions with ES256; the backend reads the JWKS from `SUPABASE_URL`. The container applies migrations on start and does not seed. The database stays empty of companies and operators.
3. **First company.** Sign in to the backoffice as the allowlisted user and open Empresas. Create the company and the first operator email (Altamira: name Altamira, identifier altamira). That is the whole setup. Do not run `npm run db:seed` or `npm run operator:add`. In Supabase Authentication, create the user for that operator email so they can sign in. They see only their company.
4. **Secrets.** Each company sets its own in the panel: sign in as an operator of that company and open Integraciones. The fields are the Anthropic API key, the Meta access token, the HubSpot access token, and the form-lead secret. The page shows whether each one is set and the last 4 characters. It never shows the full value, and an empty field does not clear a secret (use Quitar). The platform encryption key (`SECRETS_ENCRYPTION_KEY`) stays a server environment variable. For debugging from a checkout, `npm run company:secret` still writes the same fields (`-` reads the value from stdin; `--delete` removes one): `npm run company:secret -- altamira anthropicApiKey -`.
5. **Meta.** Webhook URL `https://<backend>/webhooks/whatsapp`, the verify token, and a subscription to `messages`.
6. **HubSpot.** Create the long-text property and put its internal name in `crm.transcriptProperty`. Add a workflow "Send a webhook" to `POST https://<backend>/hooks/crm/form-lead/altamira` with the header `X-LeadScope-Secret`.
7. **Backoffice on Vercel.** Root directory `backoffice`; set `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_AUTH_MODE=supabase`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

`db:seed` and `operator:add` refuse to run when `NODE_ENV=production`. They are local fixtures, not the setup.
