# Altamira Uruguay — WhatsApp assistant (v1)

WhatsApp assistant for **Altamira**, a real-estate developer in **Uruguay** (not Altamira Group Paraguay). Version 1 qualifies leads and hands them to a human advisor. It does not replace the sales team, does not book site visits, and does not quote future rental yields.

**Owner:** Luis Guareschi (freelancer, USD 120/h). WhatsApp: +34 695 40 3932. LinkedIn: https://www.linkedin.com/in/luis-guareschi-29a68b1a0/  
**Client side:** Fabio Tombion (Uruguay operations). José Daniel Guzmán (HubSpot / marketing consulting, biweekly). Luis’s father was on the 30 Sep 2026 call.  
**Status (Oct 2026):** Altamira accepted the v1 proposal. Kickoff is on. Implementation has started in this repo (`https://github.com/luisguareschi/leadscope`). Live HubSpot, production WhatsApp, and their Anthropic key are still week-1 access; until then the apps run on env examples and fakes. v1 knowledge is operator uploads. Google Drive / Sheets is later.

**Product goal:** Altamira is the first client. The system is built as a multi-company product (one shared deployment, every row scoped by company, company-specific behavior in config) so it can be sold to other developers later. Version 1 still ships only Altamira’s scope; no resale features (signup, billing, company admin) yet. Software ownership must be settled in Altamira’s signed contract before resale.

**Paraguay (closed):** Altamira Group (Florencia Ozuna) went with another provider. Their files were removed from this repo. Do not recover that scope, projects, Calendly links, HubSpot statuses, or GHL notes as the current build.

## What we are building (v1)

Volume they reported: about **15–20 leads/day** and **~60 conversations/day**. About 70% of leads interact outside office hours.

1. **WhatsApp assistant** on the official API number (marketing/cloud number). Greeting, three questions (interest, budget, whether they know the projects), answers to repeated questions (price-from, typology, delivery date, orientation). A lead who writes gets the greeting; a lead who arrives from a form gets one welcome. A lead with no interest is written to the CRM and no advisor is assigned. No future rental-yield or “guaranteed rent” answers. No project-presentation file in v1.
2. **Knowledge** from files operators upload in the backoffice, per company. Formats: PDF, DOCX, PPTX, ODT, Markdown, plain text, CSV, and XLSX. Text is extracted on upload, stored in Postgres, and injected into the prompt. Commercial facts (price-from, typology, delivery, orientation) come from those files. Re-uploading a file replaces its previous version; if they do not re-upload, prices go stale. Extracted text is limited to **80 KB per file** and **200 KB per company**. The original upload is capped at **1 MB**. Allowlisted public site pages are optional and secondary (address, amenities). No RAG, no embeddings, and no live browsing during a chat. Uploaded files win over site notes on commercial facts. Do not dump full inventory or unit-level availability in chat. Google Drive / Sheets sync and a Connect Google OAuth flow are later. MCP is not the plan.
3. **HubSpot Sales Pro** (already live ~2 months). On handoff or close, create/update the contact and store the transcript as a long text property via the HubSpot API. Do not use HubSpot’s native AI (José estimated that route at about USD 1,800/month at this volume).
4. **Handoff:** if the lead qualifies, ask when an advisor can call, then leave the case for the team. Advisors keep their own WhatsApp numbers. The bot does not live on those phones.
5. **Small panel:** thread list and the ability to pause the assistant when a human takes over. The Conocimiento page is upload, list, replace, and delete files, not a sheet sync.

Commercial quote (if asked): **USD 2,000** setup + **USD 950/month** from go-live, 6-month minimum, then month to month. Timeline: about 6 weeks, with no week-by-week breakdown in the proposal, aiming to test from **mid-November 2026**. If kickoff slips, launch moves to **early February 2027** (do not go live into year-end holidays). The monthly fee covers running the assistant, bug fixes, and small adjustments. Future versions are quoted separately. Altamira pays Anthropic usage on their own account, Meta/WhatsApp fees, and the HubSpot license. José estimated WhatsApp platform cost around USD 120–250/month, separate from this quote. From 1 Oct 2026 Meta charges about USD 0.085/send in most of LatAm, with 1,000 free messages and a 72-hour pricing window. That pricing window is separate from the product rule: free-form replies only within 24 hours of the lead’s last message, and v1 does not follow up after that. Proposal dated 2 Oct 2026, valid for 1 week.

## Out of scope (v1)

Not in the sendable proposal. Internally: Instagram DM, Messenger, email-to-WhatsApp, landing-form automation beyond the one welcome, mass email/remarketing, a second country (Costa Rica / “Erika”), native HubSpot AI, Calendly, full CRM rebuild, follow-ups outside WhatsApp’s 24-hour window, resale features (signup, billing, company admin), and Google Drive / Sheets sync (including a Connect Google OAuth flow; MCP is not the plan). Anything new after v1 is a separate quote.

## Product rules

- Model: Anthropic `claude-haiku-4-5`, behind one `complete()`. Behavior will need live tuning; tests alone will not catch bad answers.
- Never answer future rental yield or guaranteed returns.
- Price-from and typology are allowed. Full availability stays with the advisor.
- Knowledge changes often (units, prices, quotas). Uploaded files are the commercial source, not a prompt frozen at kickoff. Re-upload replaces the previous file; prices go stale if they do not. Public site notes are optional and for stable facts only. Commercial facts in the uploaded files win over site notes.
- Two WhatsApp worlds: API number for the bot, personal numbers for advisors. Do not merge them in v1.
- The model returns structured fields (reply, extracted lead data, intent); the engine owns the conversation state.
- Nothing Altamira-specific is hardcoded: tone, questions, forbidden topics, knowledge sources, and CRM settings live in company config.

## Stack (v1)

One repo, two apps: `backend/` (Express + Prisma + Anthropic + WhatsApp + HubSpot, deployed as a Docker container) and `backoffice/` (client-side Next.js, shadcn new-york, Tailwind, React Query). Services call Prisma directly. Supabase provides Postgres and Auth; Prisma owns the schema and all DB access from the backend. Local development uses Postgres (Docker Compose is the stand-in). Supabase and the app host are in **us-east-1**. Per-company Anthropic, HubSpot, and Meta secrets are encrypted on the Company row (AES-256-GCM); the encryption key stays in the server environment. No Vault in v1. Google access is later, with Drive / Sheets. One shared deployment for all companies; the same image can be deployed separately if a client needs isolation. Knowledge is text extracted from files operators upload, stored in Postgres per company, then injected into the Anthropic prompt (no RAG). Optional allowlisted site pages are secondary. Details: `docs/design.md`.

## Docs (source of truth)

- `docs/design.md` — how we build v1 (stack, knowledge, conversation, data model, build order). Update when architecture decisions change. The accepted proposal (`docs/Propuesta-comercial-Almira-IA.html` and its PDF, priced and without prices) still says knowledge comes from a private Google Drive project sheet. That commercial copy is unchanged. The build plan is uploads: v1 knowledge is files operators upload in the backoffice. Google Drive / Sheets sync is later.
- `docs/Propuesta-comercial-Almira-IA.html` — current Uruguay v1 proposal, with prices. Edit this when the proposal changes. Visual style follows grupoaltamira.uy: Montserrat, teal `#00374d`, gold `#bd995c`, cream page, uppercase labels.
- `docs/Propuesta-comercial-Almira-IA.pdf` — sendable PDF with prices. Regenerate from the HTML after any proposal change.
- `docs/Propuesta-comercial-Almira-IA-sin-precios.html` — same proposal with no fees, for them to name a price first. Keep it in sync with the priced HTML except money and the closing line.
- `docs/Propuesta-comercial-Almira-IA-sin-precios.pdf` — sendable PDF of that copy.
- `docs/resources/reunion-2026-09-30.md` — 30 Sep 2026 meeting summary (Fabio, José Daniel, Luis).

## How to work in this repo

- Respond to Luis in English. Client-facing documents stay in Spanish.
- The HTML proposal is the commercial contract. `docs/design.md` is the build plan. Implementation has started. Do not widen past that design.
- **Keep this file current.** After any change to scope, price, timeline, status, people, channels, product rules, integrations, stack, or other project detail, update `AGENTS.md` in the same turn. If the design is affected, update `docs/design.md`. If the sendable proposal is affected, update the HTML and regenerate the PDF. Do not leave this file stale.
