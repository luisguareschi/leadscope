# LeadScope

WhatsApp lead assistant for real-estate developers. It greets leads, finds out what each company asks for (for Altamira: interest, budget, and whether they know the projects) in a natural conversation, answers the repeated ones from the company's own files, asks when an advisor can call, and leaves the case in HubSpot. First client: Altamira (Uruguay). The build plan is [`docs/design.md`](docs/design.md).

| Folder | What it is |
| --- | --- |
| `backend/` | Express 5 + Prisma 7 (Postgres). WhatsApp through Kapso (webhook and sends), conversation engine, Anthropic, HubSpot, knowledge uploads. Ships as a Docker image. |
| `backoffice/` | Client-side Next.js 16, Tailwind 4, shadcn (preset `b1Z5bafVA`), React Query. Conversations (the Por contactar queue, assigning leads to advisors, marking them contacted), pause/resume, knowledge files, company settings, instructions, and secrets, and (for a platform admin) creating, archiving, and deleting companies, managing their operators, and entering one through support access. |
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

Sign in at http://localhost:3000 as that email (development login, no password). The panel opens **Empresas**. The list is empty. Create the company (for Altamira: name Altamira, identifier altamira) and the first operator's email. That writes the company, its slug, a starter config, and the operator, and invites the operator (with `AUTH_MODE=dev` the invitation is simulated in memory; no email is sent). It does not ask for API keys. The new row shows in the list.

The menu on each row has **Operadores** (add and invite, resend the invitation, archive, restore, delete), **Archivar** / **Restaurar**, and **Eliminar**. Archiving is reversible: that company's operators get a "empresa archivada" message instead of the panel, Entrar is replaced by Restaurar, and the bot ignores messages to its number. Archived companies are hidden until you turn on **Mostrar archivadas**. Eliminar is permanent: it asks you to type the company's identifier and removes the company and all its data. Archiving an operator blocks that login until it is restored; deleting one also deletes its Supabase user unless that email is on `PLATFORM_ADMIN_EMAILS`. Every one of these writes is recorded in `AdminAuditEntry`.

**Entrar** on a row opens that company's panel as the admin (support access), with no operator row there. A bar at the top says "Viendo como administrador: Altamira", and **Volver a Empresas** leaves. The panel sends `X-Company-Id` on every request; the API honors it only for emails on `PLATFORM_ADMIN_EMAILS`, and every write made that way is recorded in the `AdminAuditEntry` table.

Sign in as the operator email you just typed. The sidebar is Conversaciones, Conocimiento, and Configuración. Empresas is not there, and `/companies` says there is no access.

**Configuración** edits the company config (tone, the information to collect, forbidden topics, fixed messages, business hours, welcome template, HubSpot property, model and limits) and the company instructions. **Información a recopilar** (in Conversación) is the list of things the assistant finds out from each lead, up to 10: a name, a key (how it is stored; a new item's key follows its name until you type one), what to find out (for the prompt, not a question to read out), and Obligatorio or Opcional. The assistant asks naturally, in any order, and skips what the lead already said; once every required item is in it asks for a call time. **Temas prohibidos** is plain language, one topic per line: when the lead asks about one, the model flags it and the engine sends the fixed "Hace falta un asesor" line, stops, and writes HubSpot. Idioma, Zona horaria, País de los teléfonos, and Modelo de Anthropic are searchable lists; the models come from Anthropic's API when the company has its key, and from a fixed list otherwise. The platform rules the engine depends on are shown read-only, with the full prompt the model would receive. Every save keeps a version (who and when), and **Versiones** restores any of them. **Integraciones** (a tab of Configuración; the old `/integrations` URL redirects there) is where that company connects WhatsApp through Kapso (a step-by-step guide, the exact webhook URL with a copy button, the Kapso API key and webhook secret, and **Probar conexión**) and sets its Anthropic, HubSpot, and form-lead secrets. It shows whether each one is set and the last 4 characters; it never shows the full value. Leaving a field empty does not clear it. A platform admin inside the company through Entrar also sees an **Operadores** tab.

**Conversaciones** shows two things per thread: the lead stage (Calificando → Por contactar → Contactado, plus Sin interés) and what the assistant is doing (respondiendo, pausado, requiere asesor). The stage only moves forward. Once a lead gives every required item the thread is **Por contactar**, and it stays there when the lead writes again (it gets an "Escribió de nuevo" badge) until a person marks it contacted; the bot keeps answering without asking for the data again. Por contactar is the advisors' queue, longest wait first. The **Asignado** picker, in each row and in the thread, assigns the lead: **Asignarme**, another active operator of the company (searchable), or **Sin asignar**. In a thread, **Marcar contactado** records who and when (and assigns it to you if nobody had it). **Asignadas a mí** filters the list to your threads. HubSpot gets the same writes as before.

`npm run db:seed` and `npm run operator:add` are local fixtures only. A production setup does not run them. The seed loads a sample knowledge file and 7 demo conversations on fake numbers (+598 99 000 001–007): qualifying, Por contactar asking for a call time, Por contactar with a failed HubSpot write and a later question from the lead, waiting for an advisor, contacted and paused (assigned to the seed operator), Sin interés, and a form lead. `SEED_OPERATOR_EMAIL` sets the seed operator; add more with `npm run operator:add -- altamira <email>` to try assigning between them. Use it only when you want that fixture in a development database.

## Talk to the assistant

The examples below assume the local seed fixture (`npm run db:seed` in a development database), which creates Altamira and the dev form secret. A production setup does not run that command.

**From the terminal (recommended for prompt work).** Runs the real engine and knowledge with WhatsApp faked:

```bash
cd backend
npm run chat                         # or: npm run chat -- --phone +59899555123 --name "Ana"
```

Type as the lead. `/audio` sends a voice note, `/estado` shows the lead stage, the conversation step, what the bot collected (by item key), and its summary, `/reset` starts over. Without an Anthropic key it uses a scripted stand-in; put a key in `ANTHROPIC_API_KEY` in `backend/.env` (development only) or set the company's Anthropic key in Configuración → Integraciones to talk to `claude-haiku-4-5` with the real prompt. The conversation appears in the panel like any other.

In the panel, the thread's **Lead** panel shows the assistant's bullet summary (rewritten every turn) and the company's collected fields; HubSpot gets the same summary and fields at the top of the one long-text property, followed by the transcript. To check the real model on rental-yield and guaranteed-return questions (fixtures in `backend/test/fixtures/forbidden-topic-messages.ts`), run `ANTHROPIC_API_KEY=sk-ant-… npx vitest run forbidden-topics` in `backend/`; without a key those live cases are skipped and the engine and fake cases still run.

**As Kapso would.** With the backend running, post a signed Kapso webhook; the reply arrives after the debounce (3.5 s) and shows in the panel. See [Local testing without Kapso](#local-testing-without-kapso) for the options and a hand-made `curl`:

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
| Anthropic | scripted replies that pick up the company's items from what the lead writes and flag yield questions | `anthropicApiKey` on the company, from Configuración → Integraciones |
| WhatsApp | sends recorded in memory (`FakeChannel`) | `kapsoApiKey` (Configuración → Integraciones) + the company's phone number id (Configuración → Integraciones). Inbound also needs `kapsoWebhookSecret`. |
| HubSpot | contacts kept in memory | `hubspotAccessToken` (Configuración → Integraciones), and `crm.transcriptProperty` in the config |

Still placeholders for Altamira: the welcome template name, the HubSpot property name, and business hours. They are set in Configuración (the local fixture's copies are in `backend/prisma/seed-data/altamira.ts`). The sample knowledge file is fictional.

## Tests

```bash
cd backend && npm test          # 276 tests; needs Postgres (leadscope_test, or set TEST_DATABASE_URL)
cd backoffice && npm run lint && npm run typecheck && npm run build
```

CI runs both on every pull request.

## Going live

1. **Supabase (us-east-1).** Turn off public signups. Note the pooled URL (port 6543, `?pgbouncer=true`), the direct URL (5432), the project URL, the anon key, and the service role key (Project Settings → API keys; server only). In Auth → URL Configuration, set Site URL to the production panel and add every panel that can send an invitation to Redirect URLs. For Render with PR previews:

   ```
   https://leadscope-backoffice.onrender.com/auth/set-password
   https://leadscope-backoffice-pr-*.onrender.com/**
   ```

   Supabase ignores a `redirectTo` that is not on that list and sends the link to the Site URL instead (that is how an invitation ends up on `http://localhost:3000/#access_token=...`). In Authentication, create the user whose email will be on `PLATFORM_ADMIN_EMAILS`. Do not run `db:seed` or `operator:add`.
2. **Backend.** Deploy `backend/Dockerfile` as one always-on instance (Fly, Railway, or Render) with: `NODE_ENV=production`, `DATABASE_URL` (pooled), `DIRECT_URL`, `SECRETS_ENCRYPTION_KEY` (`openssl rand -base64 32`), `AUTH_MODE=supabase`, `SUPABASE_URL` (the same project URL as the backoffice's `NEXT_PUBLIC_SUPABASE_URL`, no path), `BACKOFFICE_ORIGIN` (comma-separated panel origins; one `*` may stand for part of the first host label, https only, never a dot: `https://leadscope-backoffice.onrender.com,https://leadscope-backoffice-pr-*.onrender.com`; confirm the real preview hostname from one Render preview. It is the CORS allowlist, and invitation links go to the panel that sent the request when it matches, otherwise to the first exact entry. `*` alone opens CORS to any site and invitations then fail, so list the origins), `PLATFORM_ADMIN_EMAILS` (comma-separated signed-in emails that may create companies), `SUPABASE_SERVICE_ROLE_KEY` (the service role key: the API uses it to create operators' Supabase users, send their invitation, and remove a deleted operator's user; without it adding an operator saves the row and shows that the invitation failed), and optionally `SENTRY_DSN` and `SUPABASE_JWT_SECRET` (only for an older project that still signs access tokens with HS256). Current Supabase projects sign sessions with ES256; the backend reads the JWKS from `SUPABASE_URL`. The container applies migrations on start and does not seed. The database stays empty of companies and operators. There is no platform-wide WhatsApp setting: a deployment from before Kapso can delete `META_APP_SECRET`, `META_WEBHOOK_VERIFY_TOKEN`, and `META_GRAPH_VERSION` (nothing reads them).
3. **First company.** Sign in to the backoffice as the allowlisted user and open Empresas. Create the company and the first operator email (Altamira: name Altamira, identifier altamira). That operator gets Supabase's invitation email and picks a password on `/auth/set-password`; if the email already had a Supabase user, it is linked instead. If the invitation fails, the panel says why and Operadores → Reenviar invitación tries again. That is the whole setup. Do not run `npm run db:seed` or `npm run operator:add`. They see only their company. Add more operators from the same Operadores menu.
4. **Secrets.** Each company sets its own in the panel: sign in as an operator of that company and open Configuración → Integraciones. The fields are the Kapso API key, the Kapso webhook secret, the Anthropic API key, the HubSpot access token, and the form-lead secret. The page shows whether each one is set and the last 4 characters. It never shows the full value, and an empty field does not clear a secret (use Quitar). The platform encryption key (`SECRETS_ENCRYPTION_KEY`) stays a server environment variable. For debugging from a checkout, `npm run company:secret` still writes the same fields (`-` reads the value from stdin; `--delete` removes one): `npm run company:secret -- altamira anthropicApiKey -`. A company saved before Kapso may still carry an unused Meta token inside its encrypted secrets; it is ignored and dropped on the next secret save, or right away with `npm run secrets:prune -- --apply` (without `--apply` it only lists the companies).
5. **WhatsApp through Kapso.** Follow [WhatsApp through Kapso](#whatsapp-through-kapso) for each company, as an operator of the company or as a platform admin through Entrar. Each phone number id belongs to one company; until it is set, messages to that number reach no company.
6. **HubSpot.** Create the long-text property and put its internal name in Configuración → HubSpot (`crm.transcriptProperty`). Add a workflow "Send a webhook" to `POST https://<backend>/hooks/crm/form-lead/altamira` with the header `X-LeadScope-Secret`.
7. **Backoffice on Vercel.** Root directory `backoffice`; set `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_AUTH_MODE=supabase`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

`db:seed` and `operator:add` refuse to run when `NODE_ENV=production`. They are local fixtures, not the setup.

## WhatsApp through Kapso

LeadScope talks to the official WhatsApp Cloud API through [Kapso](https://docs.kapso.ai), a Business Solution Provider. Each company has its own Kapso project and its own number. The panel walks an operator through the same steps in Spanish (Configuración → Integraciones → WhatsApp con Kapso).

Conditions (from the provider due diligence):

- **Use the company's own number.** Never a Kapso-provided number (Instant setup): Kapso only licenses those and can reclaim them.
- **Keep the WhatsApp Business Account in the company's own Meta Business portfolio.** Pick that portfolio in Meta's signup screen.
- **Pay Meta by card, directly.** Add the company's card in Meta's Billing Hub for that WhatsApp account before connecting, and do not turn on "Use Kapso credits". Kapso documents that a WABA that used its credit line cannot later switch to a card, and the credit line blocks moving to another provider until Kapso revokes it.
- **Message retention 30 days.** Kapso keeps every message forever by default and on the Free plan. On a paid plan set Project settings → Message retention to 30 days. LeadScope and HubSpot already keep the transcript.

Steps for a new company:

1. **Kapso project.** Create one at [app.kapso.ai](https://app.kapso.ai) for this company. Free (2,000 messages/month, 1 number) is enough to test; production needs Pro for the retention window.
2. **Connect the number.** Connected numbers → Connect new number → **WhatsApp Business App** (Coexistence: the team keeps using the phone app on that number) or **Bring your own SIM** (the number becomes API-only). Meta's embedded signup opens; sign in with a Facebook user that administers the company's portfolio and choose that portfolio. Do not choose "Use a display name with a virtual number instead". ([Connect WhatsApp](https://docs.kapso.ai/docs/how-to/whatsapp/connect-whatsapp))
3. **Phone number ID.** Copy it from the connected number in Kapso (digits; it is Meta's id) into Configuración → Integraciones → Phone number ID.
4. **API key.** Kapso → Integrations → API keys → new key. Paste it in Integraciones → *Clave de API de Kapso*.
5. **Webhook.** On the connected number, add a webhook of kind **Kapso** (payload v2) pointing at `https://<backend>/webhooks/kapso/<company-slug>` (the panel shows the exact URL with a copy button). Events: `whatsapp.message.received` (required) and `whatsapp.message.sent`, `.delivered`, `.read`, `.failed` (delivery ticks in the panel). Buffering is optional; LeadScope already waits `REPLY_DEBOUNCE_MS` and answers a burst once. The same webhook can be created with the API (`POST https://api.kapso.ai/platform/v1/whatsapp/phone_numbers/{phone_number_id}/webhooks`, header `X-API-Key`) or `kapso whatsapp webhooks new`.
6. **Webhook secret.** Kapso signs every delivery with the webhook's `secret_key`. Put the same value in Integraciones → *Clave secreta del webhook* (the **Generar** button makes a random one in the browser to paste into Kapso first). Until it is set, LeadScope answers every delivery with 401.
7. **Probar conexión.** Checks the three saved values, then calls Kapso's [phone health](https://docs.kapso.ai/api/platform/v1/phone-numbers/check-phone-health) and [list webhooks](https://docs.kapso.ai/api/platform/v1/webhooks/list-webhooks) for that number: the number must be healthy, and an active v2 Kapso webhook must point at this company's URL with `whatsapp.message.received` and (when Kapso returns it) the same secret. Then send a WhatsApp from another phone and watch it in Conversaciones.

How it works: inbound deliveries are verified with the company's secret (`X-Webhook-Signature`, hex HMAC-SHA256 of the raw body), only events for the company's own phone number id are stored, and the 200 goes back after they are stored. Duplicates are dropped by WhatsApp message id. Outbound text, the welcome template, and read receipts go to `https://api.kapso.ai/meta/whatsapp/v24.0/{phone_number_id}/messages` with `X-API-Key`; the body is Meta's Cloud API body. Kapso's API is the only provider that ships; a second one would implement `Channel` (`backend/src/integrations/whatsapp/channel.ts`) and its own webhook route.

Not handled yet: inbound messages that carry only a business-scoped user id and no phone number (Meta's username rollout) are logged and skipped, because threads are keyed by phone. Messages the team sends from the WhatsApp Business App (Coexistence) do not pause the bot.

### Local testing without Kapso

With `ALLOW_FAKE_INTEGRATIONS=true` and no `kapsoApiKey`, the company's sends go to an in-memory fake channel (`FakeChannel`), and the conversation shows in the panel. The local seed gives Altamira the webhook secret `dev-kapso-webhook-secret` and phone number id `DEV_PHONE_NUMBER_ID`.

```bash
cd backend
npm run webhook:send -- "Hola, busco un 2 dormitorios"           # one message
npm run webhook:send -- "y con garage" --batch                   # Kapso's buffered envelope
npm run webhook:send -- --type audio                             # non-text: the bot asks to type it
npm run webhook:send -- "Hola" --company otra --secret <secret>  # another company
```

The script reads the company's secret and phone number id from the database unless `--secret` and `--phone-number-id` are given. To sign one by hand:

```bash
BODY='{"message":{"id":"wamid.manual.1","timestamp":"'$(date +%s)'","type":"text","from":"59899000999","text":{"body":"Hola"},"kapso":{"direction":"inbound","origin":"cloud_api"}},"conversation":{"contact_name":"Ana","phone_number":"59899000999","phone_number_id":"DEV_PHONE_NUMBER_ID"},"phone_number_id":"DEV_PHONE_NUMBER_ID"}'
SIG=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac dev-kapso-webhook-secret | sed 's/^.* //')
curl -X POST localhost:3001/webhooks/kapso/altamira \
  -H "Content-Type: application/json" -H "X-Webhook-Event: whatsapp.message.received" \
  -H "X-Webhook-Signature: $SIG" -d "$BODY"
```

A wrong signature returns 401 and stores nothing. To try the real Kapso flow from a laptop, expose the backend with `ngrok http 3001` or `cloudflared tunnel --url http://localhost:3001` and use that HTTPS URL in Kapso. Kapso's [Sandbox](https://docs.kapso.ai/docs/how-to/whatsapp/use-sandbox-for-testing) number can send text to your own phone but not templates.
