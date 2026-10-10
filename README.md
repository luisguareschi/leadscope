# LeadScope

WhatsApp lead assistant. First client: Altamira (Uruguay). One repo, two apps.

The hosted database and the app host go in **us-east-1** (N. Virginia). This repo does not create a Supabase project. Locally, Postgres from Docker Compose is the database. The backend talks to it through Prisma. `DATABASE_URL` is required.

## Backend

```bash
docker compose up -d
cd backend
cp .env.example .env
npm install
npx prisma migrate deploy
npm run dev
```

The API listens on port 3001. Prisma reads `backend/.env` for migrate and seed. `npm run dev` loads that same file.

On a development start, an empty database gets the Altamira company, the operator, one sample knowledge file (`ficha-de-prueba.txt`, not inventory), and five sample threads (fake numbers `+59899000001`–`+59899000005`). If any thread already exists, those samples are not inserted again. A company that already has knowledge files does not get the sample file. Production startup does not insert them. Nothing here is a real lead.

`npm run db:seed` writes the company, the operator, and the sample knowledge file when that company has no files yet. It does not write the sample threads. Use it when you want that data without waiting for the development startup. Secrets in that seed are placeholders (`fake`), encrypted with `SECRETS_ENCRYPTION_KEY`. Generate a new key before any shared environment:

```bash
openssl rand -base64 32
```

| Phone | What you should see |
| --- | --- |
| +59899000001 | Qualify. Interest stored, still asking for budget. |
| +59899000002 | Answer. Budget stored, does not know the projects, asked for a price. |
| +59899000003 | Handoff. Call time “mañana a las 10”. |
| +59899000004 | Answer, paused. |
| +59899000005 | Qualify, needs an advisor. The last line is “Te va a contactar un asesor.” |

The Docker image is `backend/Dockerfile`. It runs `prisma migrate deploy` and then the server. Staging and production are separate databases in us-east-1. The host (Fly, Railway, or Render) is not chosen yet, so nothing here is deployed.

## Backoffice

```bash
cd backoffice
cp .env.example .env.local
npm install
npm run dev
```

Open http://localhost:3000 (use `localhost`, not `127.0.0.1`, so the browser origin matches `BACKOFFICE_ORIGIN`). Sign in as `operador@example.com` (no password in fake mode). There is no signup. The list should show the five sample threads within one poll (12 seconds). The panel does not send WhatsApp. It can pause and resume a thread, clear the advisor-wait flag, and on Conocimiento upload, replace, or delete a knowledge file.

To try an upload: sign in, open Conocimiento, and choose a PDF, DOCX, PPTX, ODT, XLSX, CSV, Markdown, or plain-text file. Uploading the same filename again replaces that file. The extracted text is what the assistant sees. Limits are 80 KB of extracted text per file, 200 KB per company, and 1 MB for the original file.

Set `NEXT_PUBLIC_AUTH_MODE=supabase` only after the us-east-1 project exists. Public signup stays off; create the operator in Supabase Auth and set `SEED_OPERATOR_SUPABASE_USER_ID` to that user id before seeding.

## Send a new test conversation

With Postgres up and the backend running, from another terminal:

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

## What is fake until week 1

- Anthropic: a company key of `fake` uses `backend/src/llm/fake.ts`. It walks the three questions. It is not the live model.
- HubSpot: a token of `fake` stores the contact in memory for that process. The transcript property name is blank on purpose. The adapter writes that property only when `crm.transcriptProperty` is set. It does not assign an owner or create a task.
- WhatsApp: a Meta token of `fake` records sends in that process. The webhook still checks `META_APP_SECRET`. The welcome template name `welcome_placeholder` is not an approved template.
- Knowledge: operators upload files in the panel. A development database with no files gets `ficha-de-prueba.txt` (sample copy, not inventory). There is no Google sheet sync in v1.
- Site notes: the allowlist stays empty. Fetching those pages is not wired yet.
- Business hours text is empty in the seed.
- Sentry stays off until `SENTRY_DSN` is set. Errors still go to structured logs. Logs do not include message bodies or phone numbers.

## Tests

Postgres has to be running, and `backend/.env` has to point at it (`DATABASE_URL` and `DIRECT_URL`).

```bash
cd backend
npm test
```

The engine tests cover the qualify gate, `needsHuman`, the pause flag, and reopen after Closed or Handoff. The conversation tests use the same Postgres database and clear it as they run.

## Deleting a lead

`DELETE /internal/threads/:id` removes that company’s thread and its messages. The panel has no delete button. Operators call it when someone asks for deletion.
