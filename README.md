# LeadScope

WhatsApp lead assistant for real-estate developers. It greets leads and, in a natural conversation, finds out what each company asks for (for Altamira: interest, budget, and whether they know the projects). It answers repeated questions from the company's own files, asks when an advisor can call, and keeps every lead in HubSpot from its first message. The first client is Altamira (Uruguay). The build plan is [`docs/design.md`](docs/design.md).

| Folder | What it is |
| --- | --- |
| `backend/` | Express 5 + Prisma 7 (Postgres). WhatsApp through Kapso (webhook and sends), conversation engine, Anthropic, HubSpot, knowledge uploads. Ships as a Docker image. |
| `backoffice/` | Client-side Next.js 16, Tailwind 4, shadcn, React Query, styled after Revolut Business with light and dark mode. Conversations (the Por contactar queue, assigning leads to advisors, marking them contacted, writing to the lead from the company's number), pause/resume, knowledge files in folders, and company settings, instructions, and secrets. For a platform admin it also creates, archives, and deletes companies, manages their operators, and enters a company through support access. |
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

Sign in at http://localhost:3000 as that email (development login, no password). The panel opens Empresas, and the list is empty. Create the company (for Altamira, name Altamira and identifier altamira) and enter the first operator's email. That writes the company, its slug, a starter config, and the operator, and invites the operator. With `AUTH_MODE=dev` the invitation is simulated in memory and no email is sent. It does not ask for API keys. The new row shows in the list.

The menu on each row has Operadores (add and invite, resend the invitation, archive, restore, delete), Archivar / Restaurar, and Eliminar. Archiving is reversible. While a company is archived, its operators get an "empresa archivada" message instead of the panel, Entrar is replaced by Restaurar, and the bot ignores messages to its number. Archived companies are hidden until you turn on Mostrar archivadas. Eliminar is permanent. It asks you to type the company's identifier and removes the company and all its data. Archiving an operator blocks that login until it is restored. Deleting one also deletes its Supabase user, unless that email is on `PLATFORM_ADMIN_EMAILS`. Every one of these writes is recorded in `AdminAuditEntry`.

Entrar on a row opens that company's panel as the admin (support access), with no operator row there. A bar at the top says "Viendo como administrador: Altamira", and Volver a Empresas leaves. The panel sends `X-Company-Id` on every request. The API honors it only for emails on `PLATFORM_ADMIN_EMAILS`, and every write made that way is recorded in the `AdminAuditEntry` table.

Sign in as the operator email you just typed. The sidebar is Conversaciones, Conocimiento, and Configuración. Empresas is not there, and `/companies` says there is no access.

**Configuración.** General edits the company's name and the assistant's name. Nombre de la empresa is the company's name everywhere, Empresas included. Nombre del asistente (for example Almira) is optional, and the assistant introduces itself as "Almira, asistente virtual de Altamira". The other Asistente sections edit the company config (tone, the information to collect, forbidden topics, fixed messages, business hours, and Respuestas y límites) and the company instructions. The welcome template, the HubSpot property, and the model are in Integraciones, in the same draft and save bar.

Información a recopilar, in Conversación, is the list of things the assistant finds out from each lead, up to 10. Each item has a name, a key (how it is stored; a new item's key follows its name until you type one), what to find out (for the prompt, not a question to read out), and Necesario para Por contactar or Opcional. The assistant asks naturally, in any order, and skips what the lead already said. Once every necessary item is in, the lead is Por contactar and the assistant asks for a call time. With no necessary items, the lead moves to Por contactar once it gives a call time.

Temas prohibidos is plain language, one topic per line. When the lead asks about one, the model flags it, and the engine sends the fixed "Hace falta un asesor" line, stops, and writes HubSpot. Idioma, Zona horaria, País de los teléfonos, and the model (Integraciones → Anthropic) are searchable lists. The models come from Anthropic's API when the company has its key, and from a fixed list otherwise. The platform rules the engine depends on are shown read-only, with the full prompt the model would receive. Every save keeps a version (who and when), and Versiones restores any of them.

Integraciones is a group of Configuración with one section per provider. Each has what that provider needs, a step-by-step guide in Spanish, and Probar conexión, which checks something real without sending a message to anyone. The old `/integrations` URL opens WhatsApp (Kapso).

- **WhatsApp (Kapso).** The Phone number ID, the Kapso API key, the exact webhook URL with a copy button, and the webhook secret. The test asks Kapso for the number's health and the webhook.
- **Formularios.** The form-lead hook URL with a copy button, the form-lead secret, and the welcome template. The test checks the secret and looks the template up in the number's WhatsApp account through Kapso (it must exist in that language and be approved).
- **HubSpot.** Usar HubSpot (on/off), the access token, the summary property, and the HubSpot account once known. The test checks the token, its two scopes (`crm.objects.contacts.read` and `crm.objects.contacts.write`), and that the property exists. LeadScope does not create the property; create it by hand as a contact property of type Multi-line text.
- **Anthropic.** The API key and the model. The test asks Anthropic's Models API for the saved model with the key, without generating anything.

Secrets show whether each one is set and the last 4 characters. They never show the full value. Leaving a field empty does not clear it. A platform admin inside the company through Entrar also sees an Operadores tab.

**Conocimiento.** It holds the files the assistant answers from (PDF, Word, Excel, PowerPoint, CSV, text, Markdown, HTML, JSON). The text is extracted on upload. Files go in folders, nested as deep as you like, for example Proyectos / Tres Cruces. Nueva carpeta is in the list's header, and Nueva subcarpeta is in a folder's ⋯ menu. Each row's menu has Renombrar, Mover a…, and Eliminar. A renamed file keeps its extension.

Drag files and folders onto a folder to move them there, onto a file to put them in that file's folder, or onto the Conocimiento header to take them back to the root. Drop files from your computer onto a folder to upload them into it. On a phone, use Mover a…. Uploading a file with the same name to the same folder replaces the old version. The same name in another folder is a separate file. Deleting a folder with files in it asks first and says how many files it deletes.

The assistant gets the files grouped by folder, each headed by its folder path ("Proyectos / Tres Cruces / Precios.xlsx"). Configuración → Reglas y prompt → Ver prompt → Conocimiento shows that order. The character limits are the same as without folders.

**Conversaciones.** It shows two things per thread: the lead stage (Calificando, then Por contactar, then Contactado, plus Sin interés) and what the assistant is doing (respondiendo, pausado, requiere asesor). The assistant only moves the stage forward. Once a lead gives every necessary item, the thread is Por contactar. It stays there until a person changes the stage, even when the lead writes again (it then gets an "Escribió de nuevo" badge). The bot keeps answering without asking for the data again. Por contactar is the advisors' queue, longest wait first. The Asignado picker, in each row and in the thread, assigns the lead to Asignarme, another active operator of the company (searchable), or Sin asignar.

The Etapa works the same way, like a ticket's status in Linear. Click it in the row (the thread does not open) or in the thread's Seguimiento, and pick Calificando, Por contactar, Contactado, or Sin interés, in any direction, with no confirmation. Contactado records who and when, and assigns the lead to you if nobody had it. Moving it out of Contactado clears that, so a mistake is one click to undo. Each change rewrites the HubSpot property and shows in Seguimiento as Cambio de etapa, with who and when ("el asistente" when the bot moved it).

After a manual move the assistant follows the new stage. Calificando asks for what is still missing and puts the lead back in Por contactar (at the end of the queue) once it is all in. If nothing is missing, that happens on the lead's next message. Sin interés keeps answering questions without asking for anything, until the lead asks to talk to someone or gives the missing data. Asignadas a mí filters the list to your threads.

**Writing to the lead from the panel.** Advisors can answer from their own WhatsApp as before, or from the composer at the bottom of the thread view, which sends from the company's number (the bot's). It is text only, with WhatsApp's own formatting. The **B**, *I*, and ~~S~~ buttons, or Ctrl/Cmd+B, Ctrl/Cmd+I, and Ctrl/Cmd+Shift+X, wrap the selection in `*…*`, `_…_`, or `~…~`. Press again to remove them. Enter sends, and Shift+Enter adds a line. Every bubble in the panel shows that formatting the way WhatsApp does. The ones you send say Enviado por and your name (the admin's email through Entrar).

Sending pauses the assistant in that thread, so a "Requiere asesor" thread becomes "Pausado". The assistant comes back only with Reanudar asistente. It then reads what you wrote as the advisor's and does not ask again for what the lead already told you. A thread nobody had is assigned to you. The stage does not change.

WhatsApp only allows free-form messages within 24 hours of the lead's last message. The composer shows the time left. After that it is disabled, with the explanation (templates from the panel are not in v1). If WhatsApp refuses a message, the bubble says No enviado and why. HubSpot's transcript names you on those lines the next time the property is written.

A lead who wants to talk to a person now ("llámenme", "quiero hablar con alguien") skips the questions. The thread goes to Por contactar right away, even with items missing, with the call time Lo antes posible (shown in the Lead panel like any call time). The assistant says an advisor will contact them as soon as possible. If the company's Instrucciones give a phone number for leads who want to call right away (for example "Si alguien quiere llamar ya, el número de ventas es …"), the assistant offers it. There is no other setting for it and no number in the code. It is a normal Por contactar thread, with no badge and no special place in the queue.

**HubSpot.** It is optional per company: Configuración → Integraciones → HubSpot → Usar HubSpot. With it off, nothing is created or updated in HubSpot, nothing is retried (turning it off drops pending writes), and the conversations show no HubSpot status. Turning it on creates each lead with their next message; earlier leads are not loaded. New companies start off. Companies from before the switch were turned on at start-up when they had a HubSpot token, so Altamira stays on. While it is on, it gets every lead from its first message, or when a form lead arrives. The contact is found by phone or created with the WhatsApp name and phone, and the thread keeps its id. After each reply that changed something (the collected fields, the summary, the stage, or the call time), the same contact's long-text property is rewritten, with the summary and fields on top and the transcript below. Those writes run in the background, so a slow or failing HubSpot never delays a reply. A failure shows in the thread's Lead panel with Reintentar and is retried with backoff. Once the thread has a contact, the Lead panel has Abrir en HubSpot, which opens the contact on the account's own HubSpot host (the account id and host come from HubSpot when the token is saved or tested). LeadScope does not change the HubSpot lead status.

`npm run db:seed` and `npm run operator:add` are local fixtures only. A production setup does not run them. The seed turns HubSpot on for Altamira with a placeholder account (id 12345678 on app.hubspot.com), so Abrir en HubSpot shows on the two demo threads that have a contact. It loads a sample knowledge file and 7 demo conversations on fake numbers (+598 99 000 001 to 007): qualifying, Por contactar asking for a call time, Por contactar with a failed HubSpot write and a later question from the lead, waiting for an advisor, contacted and paused (assigned to the seed operator), Sin interés, and a form lead. `SEED_OPERATOR_EMAIL` sets the seed operator. Add more with `npm run operator:add -- altamira <email>` to try assigning between them. Use it only when you want that fixture in a development database.

## Talk to the assistant

The examples below assume the local seed fixture (`npm run db:seed` in a development database), which creates Altamira and the dev form secret. A production setup does not run that command.

**From the terminal (recommended for prompt work).** This runs the real engine and knowledge with WhatsApp faked.

```bash
cd backend
npm run chat                         # or: npm run chat -- --phone +59899555123 --name "Ana"
```

Type as the lead. `/audio` sends a voice note. `/estado` shows the lead stage, the conversation step, what the bot collected (by item key), and its summary. `/reset` starts over. Without an Anthropic key it uses a scripted stand-in. To talk to `claude-haiku-4-5` with the real prompt, put a key in `ANTHROPIC_API_KEY` in `backend/.env` (development only) or set the company's Anthropic key in Configuración → Integraciones. The conversation appears in the panel like any other.

In the panel, the thread's Lead panel shows the assistant's bullet summary (rewritten every turn) and the company's collected fields. HubSpot gets the same summary and fields at the top of the one long-text property, followed by the transcript. To check the real model on rental-yield and guaranteed-return questions (fixtures in `backend/test/fixtures/forbidden-topic-messages.ts`), run `ANTHROPIC_API_KEY=sk-ant-… npx vitest run forbidden-topics` in `backend/`. Without a key those live cases are skipped, and the engine and fake cases still run.

**As Kapso would.** With the backend running, post a signed Kapso webhook. The reply arrives after the debounce (3.5 s) and shows in the panel. See [Local testing without Kapso](#local-testing-without-kapso) for the options and a hand-made `curl`:

```bash
npm run webhook:send -- "Hola, busco un 2 dormitorios" --from 59899000999 --name Ana
```

**As a HubSpot form would.** This sends the welcome template once (faked locally):

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
| HubSpot | contacts kept in memory, only while Usar HubSpot is on | `hubspotAccessToken` and the summary property (Configuración → Integraciones → HubSpot) |

Still placeholders for Altamira: the welcome template name, the HubSpot property name, and business hours. They are set in Configuración (the local fixture's copies are in `backend/prisma/seed-data/altamira.ts`). The sample knowledge file is fictional.

## Tests

```bash
cd backend && npm test          # 363 tests; needs Postgres (leadscope_test, or set TEST_DATABASE_URL)
cd backoffice && npm run lint && npm run typecheck && npm run build
```

CI runs both on every pull request.

## Going live

1. **Supabase (us-east-1).** Turn off public signups. Note the pooled URL (port 6543, `?pgbouncer=true`), the direct URL (5432), the project URL, the anon key, and the service role key (Project Settings → API keys; server only). In Auth → URL Configuration, set Site URL to the production panel and add every panel that can send an invitation to Redirect URLs. For Render with PR previews:

   ```
   https://leadscope-backoffice.onrender.com/auth/set-password
   https://leadscope-backoffice-pr-*.onrender.com/**
   ```

   Supabase ignores a `redirectTo` that is not on that list and sends the link to the Site URL instead. That is how an invitation ends up on `http://localhost:3000/#access_token=...`. In Authentication, create the user whose email will be on `PLATFORM_ADMIN_EMAILS`. Do not run `db:seed` or `operator:add`.
2. **Backend.** Deploy `backend/Dockerfile` as one always-on instance (Fly, Railway, or Render) with these variables:
   - `NODE_ENV=production`, `DATABASE_URL` (pooled), `DIRECT_URL`, `SECRETS_ENCRYPTION_KEY` (`openssl rand -base64 32`), and `AUTH_MODE=supabase`.
   - `SUPABASE_URL`, the same project URL as the backoffice's `NEXT_PUBLIC_SUPABASE_URL`, with no path.
   - `BACKOFFICE_ORIGIN`, the comma-separated panel origins. One `*` may stand for part of the first host label, https only, never a dot, for example `https://leadscope-backoffice.onrender.com,https://leadscope-backoffice-pr-*.onrender.com`. Confirm the real preview hostname from one Render preview. It is the CORS allowlist. Invitation links go to the panel that sent the request when it matches, otherwise to the first exact entry. `*` alone opens CORS to any site and invitations then fail, so list the origins.
   - `PLATFORM_ADMIN_EMAILS`, the comma-separated signed-in emails that may create companies.
   - `SUPABASE_SERVICE_ROLE_KEY`, the service role key. The API uses it to create operators' Supabase users, send their invitation, and remove a deleted operator's user. Without it, adding an operator saves the row and shows that the invitation failed.
   - Optionally `SENTRY_DSN`, and `SUPABASE_JWT_SECRET` only for an older project that still signs access tokens with HS256.

   Current Supabase projects sign sessions with ES256, and the backend reads the JWKS from `SUPABASE_URL`. The container applies migrations on start and does not seed, so the database stays empty of companies and operators. There is no platform-wide WhatsApp setting. A deployment from before Kapso can delete `META_APP_SECRET`, `META_WEBHOOK_VERIFY_TOKEN`, and `META_GRAPH_VERSION`, since nothing reads them.
3. **First company.** Sign in to the backoffice as the allowlisted user and open Empresas. Create the company and the first operator email (for Altamira, name Altamira and identifier altamira). That operator gets Supabase's invitation email and picks a password on `/auth/set-password`. If the email already had a Supabase user, it is linked instead. If the invitation fails, the panel says why, and Operadores → Reenviar invitación tries again. That is the whole setup. Do not run `npm run db:seed` or `npm run operator:add`. Operators see only their company. Add more operators from the same Operadores menu.
4. **Secrets.** Each company sets its own in the panel. Sign in as an operator of that company and open Configuración → Integraciones. The Kapso API key and webhook secret are in WhatsApp (Kapso), the form-lead secret in Formularios, the HubSpot access token in HubSpot, and the Anthropic API key in Anthropic. Each section's Probar conexión checks its values. The page shows whether each one is set and the last 4 characters. It never shows the full value, and an empty field does not clear a secret (use Quitar). The platform encryption key (`SECRETS_ENCRYPTION_KEY`) stays a server environment variable. For debugging from a checkout, `npm run company:secret` still writes the same fields (`-` reads the value from stdin; `--delete` removes one), for example `npm run company:secret -- altamira anthropicApiKey -`. A company saved before Kapso may still carry an unused Meta token inside its encrypted secrets. It is ignored and dropped on the next secret save, or right away with `npm run secrets:prune -- --apply` (without `--apply` it only lists the companies).
5. **WhatsApp through Kapso.** Follow [WhatsApp through Kapso](#whatsapp-through-kapso) for each company, as an operator of the company or as a platform admin through Entrar. Each phone number id belongs to one company. Until it is set, messages to that number reach no company.
6. **HubSpot (only if the company uses it).** Create a private app with `crm.objects.contacts.read` and `crm.objects.contacts.write`, and a contact property of type Multi-line text (LeadScope does not create it). In Configuración → Integraciones → HubSpot, paste the token, type the property's internal name, turn on Usar HubSpot, and run Probar conexión. For form leads, add a workflow "Send a webhook" to the URL shown in Configuración → Integraciones → Formularios (`POST https://<backend>/hooks/crm/form-lead/<slug>`) with the header `X-LeadScope-Secret`, and test it there.
7. **Backoffice on Vercel.** Set the root directory to `backoffice`, and set `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_AUTH_MODE=supabase`, `NEXT_PUBLIC_SUPABASE_URL`, and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

`db:seed` and `operator:add` refuse to run when `NODE_ENV=production`. They are local fixtures, not the setup.

## WhatsApp through Kapso

LeadScope talks to the official WhatsApp Cloud API through [Kapso](https://docs.kapso.ai), a Business Solution Provider. Each company has its own Kapso project and its own number. The panel walks an operator through the same steps in Spanish (Configuración → Integraciones → WhatsApp (Kapso)).

Conditions (from the provider due diligence):

- **Use the company's own number.** Never use a Kapso-provided number (Instant setup). Kapso only licenses those and can reclaim them.
- **Keep the WhatsApp Business Account in the company's own Meta Business portfolio.** Pick that portfolio in Meta's signup screen.
- **Pay Meta by card, directly.** Add the company's card in Meta's Billing Hub for that WhatsApp account before connecting, and do not turn on "Use Kapso credits". Kapso documents that a WABA that used its credit line cannot later switch to a card, and the credit line blocks moving to another provider until Kapso revokes it.
- **Set message retention to 30 days.** Kapso keeps every message forever by default and on the Free plan. On a paid plan, set Project settings → Message retention to 30 days. LeadScope and HubSpot already keep the transcript.

Steps for a new company:

1. **Kapso project.** Create one at [app.kapso.ai](https://app.kapso.ai) for this company. Free (2,000 messages/month, 1 number) is enough to test. Production needs Pro for the retention window.
2. **Connect the number.** Go to Connected numbers → Connect new number and choose **WhatsApp Business App** (Coexistence, where the team keeps using the phone app on that number) or **Bring your own SIM** (the number becomes API-only). Meta's embedded signup opens. Sign in with a Facebook user that administers the company's portfolio and choose that portfolio. Do not choose "Use a display name with a virtual number instead". ([Connect WhatsApp](https://docs.kapso.ai/docs/how-to/whatsapp/connect-whatsapp))
3. **Phone number ID.** Copy it from the connected number in Kapso (digits; it is Meta's id) into Configuración → Integraciones → WhatsApp (Kapso) → Phone number ID.
4. **API key.** In Kapso, go to Integrations → API keys → new key. Paste it in WhatsApp (Kapso) → *Clave de API de Kapso*.
5. **Webhook.** On the connected number, add a webhook of kind **Kapso** (payload v2) pointing at `https://<backend>/webhooks/kapso/<company-slug>`. The panel shows the exact URL with a copy button. The events are `whatsapp.message.received` (required) and `whatsapp.message.sent`, `.delivered`, `.read`, and `.failed` (delivery ticks in the panel). Buffering is optional, because LeadScope already waits `REPLY_DEBOUNCE_MS` and answers a burst once. The same webhook can be created with the API (`POST https://api.kapso.ai/platform/v1/whatsapp/phone_numbers/{phone_number_id}/webhooks`, header `X-API-Key`) or with `kapso whatsapp webhooks new`.
6. **Webhook secret.** Kapso signs every delivery with the webhook's `secret_key`. Put the same value in WhatsApp (Kapso) → *Clave secreta del webhook*. The **Generar** button makes a random one in the browser to paste into Kapso first. Until it is set, LeadScope answers every delivery with 401.
7. **Probar conexión.** It checks the three saved values, then calls Kapso's [phone health](https://docs.kapso.ai/api/platform/v1/phone-numbers/check-phone-health) and [list webhooks](https://docs.kapso.ai/api/platform/v1/webhooks/list-webhooks) for that number. The number must be healthy, and an active v2 Kapso webhook must point at this company's URL with `whatsapp.message.received` and (when Kapso returns it) the same secret. Then send a WhatsApp from another phone and watch it in Conversaciones.

Inbound deliveries are verified with the company's secret (`X-Webhook-Signature`, hex HMAC-SHA256 of the raw body). Only events for the company's own phone number id are stored, and the 200 goes back after they are stored. Duplicates are dropped by WhatsApp message id. Outbound text, the welcome template, and read receipts go to `https://api.kapso.ai/meta/whatsapp/v24.0/{phone_number_id}/messages` with `X-API-Key`, and the body is Meta's Cloud API body. Kapso's API is the only provider that ships. A second one would implement `Channel` (`backend/src/integrations/whatsapp/channel.ts`) and its own webhook route.

Two cases are not handled yet. Inbound messages that carry only a business-scoped user id and no phone number (Meta's username rollout) are logged and skipped, because threads are keyed by phone. Messages the team sends from the WhatsApp Business App (Coexistence) do not pause the bot. Messages sent from the thread view's composer do.

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
