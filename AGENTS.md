# Altamira Uruguay WhatsApp assistant (v1)

WhatsApp assistant for Altamira, a real-estate developer in Uruguay (not Altamira Group Paraguay). Version 1 qualifies leads and hands them to a human advisor. It does not replace the sales team, does not book site visits, and does not quote future rental yields.

## People and status

**Owner.** Luis Guareschi (freelancer, USD 120/h). WhatsApp: +34 695 40 3932. LinkedIn: https://www.linkedin.com/in/luis-guareschi-29a68b1a0/

**Client side.** Fabio Tombion runs Uruguay operations. José Daniel Guzmán consults on HubSpot and marketing every two weeks. Luis's father was on the 30 Sep 2026 call. Victoria (Vicky) is Altamira's only advisor for now. She sends the project documents and is the main panel user. Fabio gives the HubSpot access code when Luis connects it.

**Status (Oct 2026).** Altamira accepted the v1 proposal and kickoff is on. Implementation has started in this repo (`https://github.com/luisguareschi/leadscope`).

- Week-1 access is still pending for live HubSpot, production WhatsApp (Altamira's own number connected in a Kapso project; Luis has no Kapso account yet), and their Anthropic key. Until then the apps run on env examples and fakes.
- v1 knowledge is operator uploads. Google Drive / Sheets comes later.
- `README.md` explains how to run the apps locally and has the go-live checklist.
- On 20 Oct 2026 Luis demoed the sandbox to Fabio (`docs/resources/reunion-2026-10-20.md`). They agreed that every lead goes to HubSpot from its first message, and that a lead who wants to talk to a person now skips the questions. Both are built. They also agreed on an email alert to all active operators when a lead wants a call now. That alert is not built yet.
- On 22 Oct 2026 Luis asked for operators to change a thread's Etapa by hand, like a ticket's status in Linear. That is built: a stage picker replaced Marcar contactado.
- The same day he asked for operators to write to the lead from the thread view, so advisors do not need their own phones. That is built: a composer sends from the company's bot number.
- In Nov 2026 Conocimiento gained folders (nested, renamed, moved by drag and drop or Mover a…), and the prompt heads each file with its folder path. That is built.
- In Nov 2026 the panel copy moved from Uruguayan voseo to neutral Spanish with tú forms (tienes, sube, elige). New panel text follows that. What the bot says to leads is company config and keeps each company's own tone.

**Product goal.** Altamira is the first client. The system is a multi-company product so it can be sold to other developers later: one shared deployment, every row scoped by company, and company-specific behavior in config. Version 1 still ships only Altamira's scope, with no resale features yet (signup, billing, a customer admin for their own company). Software ownership must be settled in Altamira's signed contract before resale.

A platform admin is allowlisted by `PLATFORM_ADMIN_EMAILS`. That admin can open Empresas and create a company and its first operator, even when the database has no companies and they have no operator row. That is how the first company is created. From Empresas the same admin archives companies (reversible), restores them, and deletes them (permanent, after typing the slug). The admin also adds, invites, archives, and deletes their operators. Company operators cannot see or call that screen. The admin can click Entrar on a company to work inside its panel without an operator row there (support access). Every write made that way is recorded. `db:seed` and `operator:add` are local fixtures only, and a production setup does not run them.

**Paraguay (closed).** Altamira Group (Florencia Ozuna) went with another provider, and their files were removed from this repo. Do not bring back that scope, projects, Calendly links, HubSpot statuses, or GHL notes as the current build.

## What we are building (v1)

Altamira reported about 15 to 20 leads a day and about 60 conversations a day. About 70% of leads write outside office hours.

### 1. WhatsApp assistant

The bot runs on the official API number (marketing/cloud number), reached through Kapso, a Business Solution Provider for the official WhatsApp Cloud API. This was decided in Oct 2026 and Altamira agreed. The due diligence is in the Project store, `docs/whatsapp-options.md`. The conditions are:

- Altamira's own number, never a Kapso-provided one.
- The WhatsApp Business Account sits in Altamira's own Meta Business portfolio.
- Altamira pays Meta by card directly, not with Kapso credits.
- Kapso keeps messages for 30 days, on a paid plan.

The bot greets the lead, then finds out the information each company configures. For Altamira that is interest, budget, and whether they know the projects, all required. It asks naturally, in any order, and never re-asks what the lead already said. It answers the usual questions: price-from, typology, delivery date, orientation. A lead who writes gets the greeting. A lead who arrives from a form gets one welcome. A lead with no interest is written to the CRM and gets no advisor. The bot gives no answers on future rental yield or "guaranteed rent". There is no project-presentation file in v1.

### 2. Knowledge

Operators upload files in the backoffice, per company. Accepted formats are PDF, Word (DOCX, DOC), Excel (XLSX, XLS), OpenDocument (ODT, ODS), PowerPoint (PPTX), CSV, plain text, Markdown, HTML, and JSON. The backend extracts the text on upload, stores it in Postgres, and injects it into the prompt. Commercial facts (price-from, typology, delivery, orientation) come from those files.

- Uploading a file with the same name (any case) to the same folder replaces the previous version. The same name in another folder is a separate file. If operators do not re-upload, prices go stale.
- Folders nest to any depth (for example Proyectos / Tres Cruces). Operators create, rename, and delete folders. Deleting a folder that has anything in it asks first, says how many files it holds, and deletes them too.
- Operators rename files (the extension stays) and move files and folders between folders and back to the root. They do it by drag and drop, or with Mover a… for touch and keyboard. A folder never moves into itself or into one of its subfolders. Files dropped from the computer onto a folder upload into it.
- Files and folders have no descriptions. Files that existed before folders were migrated to the root.
- In the prompt, files are grouped by folder: depth-first, a folder's files before its subfolders, sorted by name. Each file is headed by its path ("Proyectos / Tres Cruces / Precios.xlsx"), so the model knows which project it is about.
- Default limits in company config are 60,000 characters of text per file, 150,000 per company, and 15 MB per upload.
- Operators can preview the extracted text.

Allowlisted public site pages (address, amenities) are optional and secondary, and not built in the MVP. Uploaded files win over site notes on commercial facts. There is no RAG, no embeddings, and no live browsing during a chat. The bot does not dump full inventory or unit-level availability in chat. Google Drive / Sheets sync and a Connect Google OAuth flow come later. MCP is not the plan.

### 3. HubSpot Sales Pro

Altamira has had HubSpot live for about 2 months. Fabio wants every lead in the database, even the ones disqualified later.

- The backend creates the HubSpot contact on the lead's first inbound message, or when a form lead arrives. It searches by phone first so nobody is duplicated. The contact gets the WhatsApp profile name and the phone; the bot does not ask for email. The contact id is stored on the thread.
- After each bot turn that changed something (collected fields, summary, stage, call time), and on handoff, close, or when the bot stops itself, the backend updates the same contact. It writes one long text property through the HubSpot API: the assistant's bullet summary and the collected fields at the top, then the transcript. There are no per-field properties.
- Writes run in the background, so the reply to the lead never waits on HubSpot. Failed writes retry with backoff and show in the panel.
- LeadScope never changes the HubSpot lead status. Vicky disqualifies by hand (automating that is v2).
- Do not use HubSpot's native AI. José estimated that route at about USD 1,800 a month at this volume.

### 4. Handoff

If the lead qualifies, the bot asks when an advisor can call, then leaves the case to the team. Advisors keep their own WhatsApp numbers, and the bot does not live on those phones.

**Writing from the panel.** An advisor may also write to the lead from the thread view, through the company's bot number (the existing Kapso send).

- Text only, with WhatsApp's own *bold*, _italic_, and ~strikethrough~. The toolbar has buttons for each, and the shortcuts are Ctrl/Cmd+B, Ctrl/Cmd+I, and Ctrl/Cmd+Shift+X. Enter sends and Shift+Enter adds a line. On a touch screen Enter adds a line and the send button sends.
- Only within 24 hours of the lead's last message. The composer shows the time left. Once the window closes it is disabled with an explanation in Spanish, and the API refuses with 409 `reply_window_closed`. The panel sends no templates in v1.
- Sending pauses the assistant on that thread (a "requiere asesor" thread becomes "pausado"). The bot comes back only with Reanudar asistente. A thread nobody had is assigned to the sender; an existing assignee is kept. The stage never changes.
- Each message records who sent it, shown as `Enviado por <name>` on the bubble. Through support access it records the admin's email, audited like any write. Archived operators cannot send.
- If WhatsApp refuses a send, the message is stored as failed with the reason, and the takeover still applies.
- HubSpot labels those lines with the advisor's name. Sending alone does not queue a HubSpot write; the usual rules decide when one happens.
- When the bot resumes, the prompt marks the advisor's messages as written by a person, so the model does not contradict them or re-ask what was settled. A turn that was answering when the advisor wrote drops its reply.

**Stage and bot activity.** A thread tracks two separate things. The lead stage is Calificando, then Por contactar, then Contactado, plus Sin interés. The bot only moves it forward; a person can set any stage in any direction. The bot activity is respondiendo, pausado, or requiere asesor, which map to the existing pause and `needsHuman`.

- The thread reaches Por contactar once every required item ("Necesario para Por contactar" in the panel) is stored. With no required items, it gets there once the lead gives a call time.
- It also reaches Por contactar right away when the lead wants to talk to a person now ("llámenme", "quiero hablar con alguien"). That sets the `callNow` flag, stores the call time as "Lo antes posible", and stops the questions. Otherwise it is a normal Por contactar thread, with no badge and no special order.
- The thread stays in Por contactar until a person changes the stage. Nothing the lead writes moves it back.
- After the handoff, and after Contactado, the bot keeps answering questions without re-qualifying. It may remind the lead that an advisor will call.

**Pickers.** Advisors are the company's operators.

- One assignee picker (Linear-style, searchable) assigns, reassigns, or unassigns a thread. It lists Asignarme first, then the company's active operators, then Sin asignar. It appears inline in the Conversaciones row and in the thread view. An archived operator cannot be assigned.
- The stage picker has the same style: the current stage with its colour dot, and a searchable list of Calificando, Por contactar, Contactado, and Sin interés. It appears inline in the Conversaciones Etapa column and in the thread's Seguimiento. It asks for no confirmation, since every move can be undone.
- Choosing Contactado records who and when, and assigns the thread to the current operator if nobody had it. Leaving Contactado clears that record.
- A platform admin in support access has no operator row there, so the picker does not offer Asignarme. The admin can still pick an operator and change the stage. Both are recorded with their email and audited like any other write.

**After a manual stage change.** The bot follows the new stage:

- Calificando: the bot asks for the required items still missing. Once they are all stored it moves the thread back to Por contactar, at the end of the queue. If nothing is missing, that happens on the next lead message.
- Por contactar: the bot asks only for a call time, if there is none.
- Contactado: the bot answers and asks for nothing.
- Sin interés set by a person: the bot answers without qualifying. The thread comes back only if the lead completes the required items, the model returns `qualified`, or the lead asks for a person (`callNow`).

A turn that was running when a person changed the stage keeps its reply, collected values, and summary, but not its stage or conversation step. Every manual change rewrites the HubSpot property, whose Etapa line says who picked the stage and when. It is logged in `LeadStageChange` (from, to, who, when, support access). Seguimiento shows the thread's last stage change as "Cambio de etapa", or "el asistente" when the bot moved it.

### 5. Small panel

The panel has a thread list, a way to pause the assistant when a person takes over, and a composer to write to the lead from the thread view. The sidebar has Conversaciones, Conocimiento, and Configuración, plus Empresas for a platform admin.

**Conversaciones.**

- Separate columns for the lead stage (Etapa) and the bot activity (Asistente), and the assignee picker in an Asignado column.
- Filters by lead stage, by bot activity, and by "Asignadas a mí". Por contactar is the advisors' queue: oldest handoff first, with the time waiting and an "Escribió de nuevo" badge when the lead wrote after the handoff.
- The sidebar badge counts Por contactar threads nobody has taken.

**Thread view.** The same split (Etapa, Asistente, Asignado) with both pickers and the last stage change. A composer under the conversation writes to the lead (see Handoff). Every bubble renders WhatsApp's markup, and outbound bubbles say "Asistente" or `Enviado por <name>`.

**On a phone.** Below the `lg` breakpoint, Conversaciones is a list of stacked rows with the same pickers, and the thread view has Conversación / Lead tabs with Pausar in the ⋯ menu. From `lg` up the desktop layout is unchanged. Luis asked for this on 23 Oct 2026.

**Conocimiento.** Upload, list, replace, rename, move, and delete files in a folder tree. It keeps the same list look. On a phone the rows keep the name, details, and ⋯ menu. There is no sheet sync. Reglas y prompt shows the files in prompt order with their folder paths.

**Configuración.** Any operator of the company can edit it. There are no admin/member roles in the MVP. A platform admin can too, through support access.

- The layout is a grouped section nav, one section at a time:
  - Asistente: General, Conversación, Temas prohibidos, Mensajes fijos, Bienvenida y CRM, Modelo y límites.
  - Prompt: Instrucciones, Reglas y prompt.
  - Empresa: Integraciones, Historial, and Operadores for support access.
- One config draft spans the Asistente sections. A save bar shows only when there are unsaved changes.
- General has two separate name fields. "Nombre de la empresa" is `Company.name`, the one value that the prompt, Empresas, and the panel read. "Nombre del asistente" is `config.assistantName` (for example "Almira"), and it is optional. The prompt says "Almira, the virtual assistant of Altamira" and never swaps them. Until 22 Oct 2026 a single `displayName`, labeled as the assistant's name, was used by the prompt as the company's name. The migration split it in two.
- The company config covers tone, the information to collect, forbidden topics, fixed messages, business hours, the welcome template, the HubSpot property name, the model, and knowledge limits. The panel validates it before saving.
  - The information to collect is up to 10 items. Each has a key, a name, a short description for the prompt, and a choice between "Necesario para Por contactar" and optional.
  - Forbidden topics are plain language, with no regex patterns.
  - Idioma, Zona horaria (IANA), País de los teléfonos (country and calling code), and Modelo de Anthropic are searchable selects. The model list comes from Anthropic's API when the company has its key, and from a fixed list otherwise. A saved value outside the list stays valid.
- The WhatsApp phone number id is a unique column on the company that routes inbound webhooks. It is empty until the company has a number.
- The company instructions are free text.
- The platform rules the engine depends on stay in code and are shown read-only, next to the full prompt the model would receive. They cover the submit_turn output format, the required-items handoff, the needsHuman and forbidden-topic flags, and the 24-hour window.
- Each save of the config, the instructions, the company's name, or the phone number id keeps a version with who and when. Any version can be restored.

**Integraciones.** A section (tab) of Configuración. The old `/integrations` route redirects there.

- An operator connects WhatsApp through Kapso here. The section has the Phone number ID, a step-by-step guide in Spanish, the company's exact webhook URL with a copy button, and Probar conexión. Probar conexión asks Kapso for the number's health and for the webhook that points at the company.
- The operator sets the company's secrets: Kapso API key, Kapso webhook secret, Anthropic API key, HubSpot access token, and form-lead secret.
- Secrets are write-only. The panel shows whether each one is set, and the last 4 characters when that does not reveal the whole value. It never shows the full secret. An empty field does not clear a secret; Quitar does.
- `SECRETS_ENCRYPTION_KEY` stays a server env var. `npm run company:secret` remains for debugging.

**Empresas.** A platform-admin page. The signed-in Supabase email must be on `PLATFORM_ADMIN_EMAILS` (comma-separated, not hardcoded). That login can open it with no operator row and no companies. Operators who are not on the list get no nav item and a 403 on the routes.

- It creates a company (row, slug, starter config, first operator email) and lists existing companies. Archived ones sit behind Mostrar archivadas. Empresas does not collect API keys.
- Archiving a company blocks its operators with a 403 and a reason in Spanish, refuses support access into it, makes the WhatsApp webhook ignore its number (nothing stored, no reply), and makes its form-lead hook return 404. Restaurar undoes it.
- Eliminar asks the admin to type the slug back, then removes the company and its data by cascade.

**Operators.** The admin manages a company's operators from Empresas (Operadores), or from inside the company through support access (Configuración → Operadores, admin only).

- Adding an operator saves the row, then creates the Supabase Auth user and sends Supabase's invitation email through the Supabase admin API with `SUPABASE_SERVICE_ROLE_KEY` (server env only). The link points to `/auth/set-password` on the panel that sent the request: its Origin when that matches `BACKOFFICE_ORIGIN`, otherwise the first exact entry. `BACKOFFICE_ORIGIN` is a comma-separated list, and an entry may use one `*` in the first host label for Render PR previews.
- If a Supabase user with that email already exists, it is linked instead.
- A failed invite keeps the row with a reason in Spanish, and the admin can resend it. Resending to an account that already has a password sends the password-reset email.
- The first operator of a new company is invited the same way. After that, operators sign in only to their company.
- Archiving an operator blocks that login until it is restored. The API refuses it; the Supabase user is not banned.
- Deleting an operator removes the row and its Supabase user, unless that login is still an operator elsewhere or on `PLATFORM_ADMIN_EMAILS`.
- In `AUTH_MODE=dev` an in-memory stand-in replaces Supabase.
- `db:seed` and `operator:add` stay as local fixtures, and a production setup does not run them.

**Support access.** Each company row has Entrar. The panel then sends `X-Company-Id` on every API request, and the API honors it only when the signed-in email is on `PLATFORM_ADMIN_EMAILS`. For everyone else the company always comes from their operator row and the API ignores the header. The admin needs no operator row in that company. They see its Conversaciones, Conocimiento, and Integraciones (secrets still write-only), under a bar that says "Viendo como administrador: <empresa>" with Volver a Empresas.

`AdminAuditEntry` records every write made through support access and every Empresas write to an existing company (archive, restore, delete, operator changes). Each entry has the admin email, company id and slug, method and path, status, and time. Entries keep the slug and survive the company's deletion. There is no screen to browse them yet.

## Commercial terms

Quote these only if asked.

- USD 2,000 setup plus USD 950 a month from go-live, with a 6-month minimum, then month to month. The monthly fee covers running the assistant, bug fixes, and small adjustments. Future versions are quoted separately.
- Timeline is about 6 weeks, with no week-by-week breakdown in the proposal, aiming to test from mid-November 2026. If kickoff slips, launch moves to early February 2027, so as not to go live into the year-end holidays.
- Altamira pays Anthropic usage on their own account, Meta/WhatsApp fees, and the HubSpot license. José estimated the WhatsApp platform cost at USD 120 to 250 a month, separate from this quote.
- Meta pricing from 1 Oct 2026 in Uruguay (Meta's "Rest of Latin America"): a marketing template costs about USD 0.085 per send. A service reply inside the 24-hour window costs about USD 0.0113, after 1,000 free service messages per number per month. Utility templates cost the same USD 0.0113. There is also a 72-hour pricing window. That pricing window is separate from the product rule: free-form replies only within 24 hours of the lead's last message, and v1 does not follow up after that.
- Kapso is billed separately. Free (2,000 messages a month, 1 number) is for testing. Pro at USD 25 a month (100,000 messages, 3 numbers) is for production. Who pays Kapso is not settled.
- The proposal is dated 2 Oct 2026 and was valid for 1 week.

## Out of scope (v1)

These are not in the sendable proposal. Internally they are: Instagram DM, Messenger, email-to-WhatsApp, landing-form automation beyond the one welcome, mass email and remarketing, a second country (Costa Rica / "Erika"), native HubSpot AI, Calendly, a full CRM rebuild, follow-ups outside WhatsApp's 24-hour window, resale features (signup, billing, a customer admin for their own company), and Google Drive / Sheets sync (including a Connect Google OAuth flow; MCP is not the plan). Anything new after v1 is a separate quote.

Creating the next company is in the panel for a platform admin. It is not a customer-facing admin. Support access (Entrar) is for that admin, not a company switcher for operators.

## Product rules

- The model is Anthropic `claude-haiku-4-5`, behind one `complete()`. Behavior will need live tuning, because tests alone will not catch bad answers.
- Never answer about future rental yield or guaranteed returns.
- Price-from and typology are allowed. Full availability stays with the advisor.
- Knowledge changes often (units, prices, quotas). Uploaded files are the commercial source, not a prompt frozen at kickoff. Re-uploading with the same name to the same folder replaces the previous file, and prices go stale if operators do not re-upload. Folders give the model context, since each file is headed by its folder path. The character limits are the same with or without folders. Public site notes are optional and for stable facts only. Commercial facts in the uploaded files win over site notes.
- There are two kinds of WhatsApp number: the API number for the bot, and advisors' personal numbers. Advisors may reply from the bot number inside the panel, through the thread view's composer, which pauses the bot. Answering from their personal phones is still fine. The bot never lives on an advisor's phone, and the panel does not connect personal numbers.
- The bot only moves the lead stage forward. It moves Calificando to Por contactar, or to Sin interés. Sin interés comes back to Por contactar only if the lead re-qualifies or asks to talk to a person now. From Por contactar and Contactado only a person moves the stage. A person can set any stage in any direction from the stage picker. The bot then continues forward from there, and a person's change wins over a turn that was running.
- HubSpot gets the contact from the first message, and the same content after every turn that changes it. The status line in the property follows the thread (stage, needsHuman, closed).
- The model returns structured fields through `submit_turn`: the reply, collected values by item key, the call time, an intent with an explicit not-interested, needsHuman, `callNow` for a lead who wants to talk to a person now, a forbidden-topic flag, and a short bullet summary of the conversation and what the lead wants. The summary is stored on the thread every turn. The engine owns the conversation state.
- Handoff starts only once every required item is stored, or on `callNow`. Optional items never hold it up. On `callNow` the platform rule tells the model to answer that an advisor will contact the lead as soon as possible. A phone number to call right away comes only from the company instructions: there is no setting for it, no business-hours logic, and never a hardcoded number. The thread's Lead panel shows the summary and the collected fields.
- The bot stops itself (`needsHuman`) in three cases: a lead asks something only a person can answer (a complaint, an existing purchase), the model flags a forbidden topic (the lead asked about one, or its reply would touch one), or the model or WhatsApp fails. The engine then sends one fixed line from company config, never the model's own words on a forbidden topic. It writes HubSpot and waits until an operator marks the thread attended. Forbidden topics are plain language only, and there is no regex check on replies.
- Nothing Altamira-specific is hardcoded. Tone, the information to collect, forbidden topics, knowledge sources, and CRM settings live in company config, and the company's own instructions live on the Company row. The system prompt is the platform rules (in code, filled from the config), then the company instructions, then the knowledge block. The platform rules win if they disagree.

## Stack (v1)

One repo holds two apps.

`backend/` is Express 5, Prisma 7, Anthropic, WhatsApp, and HubSpot, deployed as a Docker container. There is one controller and one service per endpoint, and services call Prisma directly.

`backoffice/` is a client-side Next.js 16 app: shadcn on the `dashboard-01` layout, Tailwind 4, and React Query.

- Motion animates lists (the Conocimiento tree and upload rows). Animation is off when the system asks for reduced motion.
- The look follows Revolut Business's admin dashboard and the Revolut web app (Nov 2026). Light mode is a soft grey canvas with white cards. Dark mode is Revolut's near-black canvas with navy-tinted cards. Buttons are ink/white pills, the accent is cobalt/periwinkle, body text is Inter, and headings are Geist.
- The header has the page title and the account avatar menu, which holds the theme choice. The Conversaciones search (⌘K) sits at the top of that page only. The sign-in pages follow Revolut's SSO page.
- Light and dark mode come from theme tokens in `app/globals.css`. The theme follows the system by default, can be switched from the account menu (and the theme button on the sign-in pages), and is remembered per browser.
- The panel installs as a PWA through `app/manifest.ts`, the LeadScope icons, and `public/sw.js`. The service worker caches only an offline page in Spanish, never panel data, and has no push.
- Panel copy is neutral Spanish with tú forms, not Uruguayan voseo.

Supabase provides Postgres and Auth. Prisma owns the schema and all database access from the backend. Local development uses Postgres, with Docker Compose standing in for Supabase. Supabase and the app host are in us-east-1.

WhatsApp goes through Kapso, not the Meta Cloud API directly. Each company has its own Kapso project. Its Kapso webhook posts to `/webhooks/kapso/<company slug>`, and the backend verifies it with that company's webhook secret (hex HMAC-SHA256 in `X-Webhook-Signature`). Replies and the welcome template go to Kapso's WhatsApp API (Meta's body, `X-API-Key`). The channel sits behind an adapter so another provider could be added, but Kapso is the one that ships. There is no platform-wide WhatsApp env var.

Per-company Anthropic, Kapso, HubSpot, and form-lead secrets are encrypted on the Company row with AES-256-GCM. An operator sets them for their own company from Configuración → Integraciones (a platform admin can too, through support access). The API never returns the full value. The encryption key stays in the server environment. There is no Vault in v1. Google access comes later, with Drive / Sheets.

One deployment serves all companies. The same image can be deployed separately if a client needs isolation. Knowledge is text extracted from uploaded files, stored in Postgres per company, and injected into the Anthropic prompt (no RAG). Optional allowlisted site pages are secondary. Details are in `docs/design.md`.

## Docs (source of truth)

- `docs/design.md` is how we build v1: stack, knowledge, conversation, data model, build order. Update it when an architecture decision changes. The accepted proposal (`docs/Propuesta-comercial-Almira-IA.html` and its PDFs, with and without prices) still says knowledge comes from a private Google Drive project sheet. That commercial copy is unchanged. The build plan is uploads: in v1, knowledge is files operators upload in the backoffice. Google Drive / Sheets sync comes later.
- `docs/Propuesta-comercial-Almira-IA.html` is the current Uruguay v1 proposal, with prices. Edit it when the proposal changes. Its visual style follows grupoaltamira.uy: Montserrat, teal `#00374d`, gold `#bd995c`, a cream page, and uppercase labels.
- `docs/Propuesta-comercial-Almira-IA.pdf` is the sendable PDF with prices. Regenerate it from the HTML after any proposal change.
- `docs/Propuesta-comercial-Almira-IA-sin-precios.html` is the same proposal with no fees, so Altamira can name a price first. Keep it in sync with the priced HTML except for money and the closing line.
- `docs/Propuesta-comercial-Almira-IA-sin-precios.pdf` is the sendable PDF of that copy.
- `docs/resources/reunion-2026-09-30.md` summarizes the 30 Sep 2026 meeting (Fabio, José Daniel, Luis).
- `docs/resources/reunion-2026-10-20.md` summarizes the 20 Oct 2026 demo (Fabio, Luis): HubSpot from the first message, the "quiere hablar ya" path, and the operator email alert (not built yet).

## How to work in this repo

- Respond to Luis in English. Client-facing documents stay in Spanish.
- The HTML proposal is the commercial contract and `docs/design.md` is the build plan. Implementation has started. Do not go beyond that design.
- Keep this file current. After any change to scope, price, timeline, status, people, channels, product rules, integrations, stack, or other project detail, update `AGENTS.md` in the same turn. If the design is affected, update `docs/design.md`. If the sendable proposal is affected, update the HTML and regenerate the PDF.
