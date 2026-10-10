# LeadScope

WhatsApp lead assistant for real-estate developers. It greets leads, asks three qualifying questions, answers the repeated ones from the company's own files, asks when an advisor can call, and leaves the case in HubSpot. First client: Altamira (Uruguay). The build plan is [`docs/design.md`](docs/design.md).

| Folder | What it is |
| --- | --- |
| `backend/` | Express 5 + Prisma 7 (Postgres). WhatsApp webhook, conversation engine, Anthropic, HubSpot, knowledge uploads. Ships as a Docker image. |
| `backoffice/` | Client-side Next.js 16, Tailwind 4, shadcn (preset `b1Z5bafVA`), React Query. Conversations, pause/resume, knowledge files. |
| `docs/` | Design, proposals, meeting notes. |

## Run it locally

You need Node 22.12+ and Postgres 16. `docker compose up -d` starts Postgres with a `leadscope` database and a `leadscope_test` database for the tests.

```bash
docker compose up -d

cd backend
cp .env.example .env
npm install
npm run db:migrate
npm run db:seed      # Altamira, operador@example.com, a sample knowledge file, 7 demo conversations
npm run dev          # http://localhost:3001
```

```bash
cd backoffice
cp .env.example .env.local
npm install
npm run dev          # http://localhost:3000
```

Sign in at http://localhost:3000 as `operador@example.com` (development login, no password).

The demo conversations use fake numbers (+598 99 000 001–007) and cover every status: qualifying, scheduling a call, handed off with a failed HubSpot write, waiting for an advisor, paused, closed, and a form lead.

## Talk to the assistant

**From the terminal (recommended for prompt work).** Runs the real engine and knowledge with WhatsApp faked:

```bash
cd backend
npm run chat                         # or: npm run chat -- --phone +59899555123 --name "Ana"
```

Type as the lead. `/audio` sends a voice note, `/estado` shows what the bot extracted, `/reset` starts over. Without an Anthropic key it uses a scripted stand-in; put a key in `ANTHROPIC_API_KEY` in `backend/.env` (development only) or on the company (below) to talk to `claude-haiku-4-5` with the real prompt. The conversation appears in the panel like any other.

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
| Anthropic | scripted replies that walk the three questions | `anthropicApiKey` on the company |
| WhatsApp | sends recorded in memory | `metaAccessToken` + the company's phone number id |
| HubSpot | contacts kept in memory | `hubspotAccessToken`, and `crm.transcriptProperty` in the config |

Still placeholders in `backend/prisma/seed-data/altamira.ts`: the welcome template name, the HubSpot property name, and business hours. The sample knowledge file is fictional.

## Tests

```bash
cd backend && npm test          # 140+ tests; needs Postgres (leadscope_test, or set TEST_DATABASE_URL)
cd backoffice && npm run lint && npm run typecheck && npm run build
```

CI runs both on every pull request.

## Going live

1. **Supabase (us-east-1).** Turn off public signups. Note the pooled URL (port 6543, `?pgbouncer=true`), the direct URL (5432), the project URL, and the anon key. In Auth → URL configuration, set the site URL to the backoffice and allow `<backoffice>/auth/set-password` as a redirect.
2. **Backend.** Deploy `backend/Dockerfile` as one always-on instance (Fly, Railway, or Render) with: `NODE_ENV=production`, `DATABASE_URL` (pooled), `DIRECT_URL`, `SECRETS_ENCRYPTION_KEY` (`openssl rand -base64 32`), `META_APP_SECRET`, `META_WEBHOOK_VERIFY_TOKEN`, `AUTH_MODE=supabase`, `SUPABASE_URL`, `BACKOFFICE_ORIGIN`, and optionally `SENTRY_DSN`. The container applies migrations on start.
3. **Company.** From a checkout pointed at production: `NODE_ENV=production SEED_WHATSAPP_PHONE_NUMBER_ID=<id> SEED_OPERATOR_EMAIL=<email> npm run db:seed` (no demo data in production). Edit the config in `prisma/seed-data/altamira.ts` and re-run the seed to change it; secrets are kept.
4. **Secrets**, encrypted on the company row (`-` reads the value from stdin, so it stays out of shell history):
   `npm run company:secret -- altamira anthropicApiKey -`, then `metaAccessToken`, `hubspotAccessToken`, `formLeadSecret`.
5. **Operators.** `npm run operator:add -- altamira persona@altamira.uy --invite` emails a Supabase invitation (needs `SUPABASE_SERVICE_ROLE_KEY`).
6. **Meta.** Webhook URL `https://<backend>/webhooks/whatsapp`, the verify token, and a subscription to `messages`.
7. **HubSpot.** Create the long-text property and put its internal name in `crm.transcriptProperty`. Add a workflow "Send a webhook" to `POST https://<backend>/hooks/crm/form-lead/altamira` with the header `X-LeadScope-Secret`.
8. **Backoffice on Vercel.** Root directory `backoffice`; set `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_AUTH_MODE=supabase`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
