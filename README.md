# LeadScope

WhatsApp lead assistant. First client: Altamira (Uruguay). One repo, two apps.

The hosted database and the app host go in **us-east-1** (N. Virginia). This repo does not create a Supabase project. Locally, Postgres from Docker Compose is a stand-in, or the backend can run with an in-memory store.

## Backend

```bash
cd backend
cp .env.example .env
npm install
npm test
npm run dev
```

The API listens on port 3001.

With `DATABASE_URL` empty, the process keeps companies, threads, and messages in memory and loads the Altamira seed plus a fixture sheet. That data disappears when the process stops. Do not use it for anything but local trial.

With Postgres:

```bash
docker compose up -d
cd backend
cp .env.example .env
npm install
npx prisma migrate deploy
npm run db:seed
npm run dev
```

`npm run db:seed` writes the Altamira company, an operator (`operador@example.com`), and the fixture projects. Secrets in that seed are placeholders (`fake`), encrypted with `SECRETS_ENCRYPTION_KEY`. Generate a new key before any shared environment:

```bash
openssl rand -base64 32
```

The Docker image is `backend/Dockerfile`. It runs `prisma migrate deploy` and then the server. Staging and production are separate databases in us-east-1. The host (Fly, Railway, or Render) is not chosen yet, so nothing here is deployed.

## Backoffice

```bash
cd backoffice
cp .env.example .env.local
npm install
npm run dev
```

Open http://localhost:3000. With `NEXT_PUBLIC_AUTH_MODE=fake`, sign in as `operador@example.com`. There is no signup. The panel polls the API every 12 seconds. It lists threads, opens one, pauses or resumes the assistant, clears the “waiting for an advisor” flag, and runs a sheet sync. It does not send WhatsApp.

Set `NEXT_PUBLIC_AUTH_MODE=supabase` only after the us-east-1 project exists. Public signup stays off; create the operator in Supabase Auth and set `SEED_OPERATOR_SUPABASE_USER_ID` to that user id before seeding.

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
