# LeadScope

WhatsApp lead assistant. First client: Altamira (Uruguay). One repo, two apps.

The hosted database and the app host go in **us-east-1** (N. Virginia). This repo does not create a Supabase project. Locally, Postgres from Docker Compose is a stand-in, or the backend can run with an in-memory store.

## Backend (in-memory, sample threads)

The server reads the shell environment. It does not load `backend/.env` by itself. Leave `DATABASE_URL` unset. Copying `.env.example` and exporting it turns on Postgres and does **not** insert these sample threads.

```bash
cd backend
npm install
META_APP_SECRET=dev-meta-app-secret \
META_WEBHOOK_VERIFY_TOKEN=dev-verify-token \
AUTH_MODE=fake \
BACKOFFICE_ORIGIN=http://localhost:3000 \
npm run dev
```

The API listens on port 3001. On startup it loads the Altamira company, the fixture sheet, and five sample threads (fake numbers `+59899000001`–`+59899000005`). Restarting the process replaces that memory; it does not append a second copy in the same process. Nothing here is a real lead.

| Phone | What you should see |
| --- | --- |
| +59899000001 | Qualify. Interest stored, still asking for budget. |
| +59899000002 | Answer. Budget stored, does not know the projects, asked for a price. |
| +59899000003 | Handoff. Call time “mañana a las 10”. |
| +59899000004 | Answer, paused. |
| +59899000005 | Qualify, needs an advisor. The last line is “Te va a contactar un asesor.” |

## Backoffice

```bash
cd backoffice
cp .env.example .env.local
npm install
npm run dev
```

Open http://localhost:3000. Sign in as `operador@example.com` (no password in fake mode). There is no signup. The list should show the five sample threads within one poll (12 seconds). The panel does not send WhatsApp. It can pause and resume a thread, clear the advisor-wait flag, and run a sheet sync.

Set `NEXT_PUBLIC_AUTH_MODE=supabase` only after the us-east-1 project exists. Public signup stays off; create the operator in Supabase Auth and set `SEED_OPERATOR_SUPABASE_USER_ID` to that user id before seeding.

## Send a new test conversation

With the backend running as above, from another terminal:

```bash
node -e '
const { createHmac } = require("crypto");
const id = "wamid.local." + Date.now();
const body = JSON.stringify({
  entry: [{
    changes: [{
      value: {
        metadata: { phone_number_id: "FAKE_PHONE_NUMBER_ID" },
        messages: [{
          from: "59899000999",
          id,
          type: "text",
          text: { body: "Hola, busco un apartamento de dos dormitorios" }
        }]
      }
    }]
  }]
});
const sig = "sha256=" + createHmac("sha256", "dev-meta-app-secret").update(body).digest("hex");
fetch("http://127.0.0.1:3001/webhooks/whatsapp", {
  method: "POST",
  headers: { "Content-Type": "application/json", "x-hub-signature-256": sig },
  body
}).then((res) => res.text()).then(console.log);
'
```

That returns `{"ok":true}` immediately. About three seconds later the fake model replies, and `+59899000999` shows up in the panel. Use another `from` number for a different thread. The same WhatsApp `id` is ignored the second time.

## Backend with Postgres

Demo threads are not inserted when `DATABASE_URL` is set. This path is the company, the operator, and the fixture sheet only.

```bash
docker compose up -d
cd backend
cp .env.example .env
npm install
npx prisma migrate deploy
npm run db:seed
set -a && source .env && set +a
npm run dev
```

Prisma reads `backend/.env` for migrate and seed. `npm run dev` does not, so the `source` line is what turns Postgres on. With `DATABASE_URL` set, the five sample threads above are not inserted.

`npm run db:seed` writes the Altamira company, an operator (`operador@example.com`), and the fixture projects. Secrets in that seed are placeholders (`fake`), encrypted with `SECRETS_ENCRYPTION_KEY`. Generate a new key before any shared environment:

```bash
openssl rand -base64 32
```

The Docker image is `backend/Dockerfile`. It runs `prisma migrate deploy` and then the server. Staging and production are separate databases in us-east-1. The host (Fly, Railway, or Render) is not chosen yet, so nothing here is deployed.

## What is fake until week 1

- Anthropic: a company key of `fake` uses `backend/src/llm/fake.ts`. It walks the three questions. It is not the live model.
- HubSpot: a token of `fake` stores the contact in memory. The transcript property name is blank on purpose. The adapter writes that property only when `crm.transcriptProperty` is set. It does not assign an owner or create a task.
- WhatsApp: a Meta token of `fake` records sends in memory. The webhook still checks `META_APP_SECRET`. The welcome template name `welcome_placeholder` is not an approved template.
- Sheet: Altamira’s seed uses `knowledge.source: "fixture"` and `backend/fixtures/projects.json`. Those rows are sample data, not inventory. A real sheet is used only when the source is `google-sheet` and a service account is configured.
- Site notes: the allowlist is empty, so the scheduled fetch does nothing.
- Business hours text is empty in the seed.
- Sentry stays off until `SENTRY_DSN` is set. Errors still go to structured logs. Logs do not include message bodies or phone numbers.

## Tests

```bash
cd backend
npm test
```

The engine tests cover the qualify gate, `needsHuman`, the pause flag, and reopen after Closed or Handoff.

## Deleting a lead

`DELETE /internal/threads/:id` removes that company’s thread and its messages. The panel has no delete button. Operators call it when someone asks for deletion.
