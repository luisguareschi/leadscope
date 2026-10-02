# Altamira Uruguay — WhatsApp assistant (v1)

WhatsApp assistant for **Altamira**, a real-estate developer in **Uruguay** (not Altamira Group Paraguay). Version 1 qualifies leads and hands them to a human advisor. It does not replace the sales team, does not book site visits, and does not quote future rental yields.

**Owner:** Luis Guareschi (freelancer, USD 120/h). WhatsApp: +34 695 40 3932. LinkedIn: https://www.linkedin.com/in/luis-guareschi-29a68b1a0/  
**Client side:** Fabio Tombion (Uruguay operations). José Daniel Guzmán (HubSpot / marketing consulting, biweekly). Luis’s father was on the 30 Sep 2026 call.  
**Status (Oct 2026):** proposal for v1, not signed. Repo has no implementation. Kickoff only after they accept the proposal.

**Paraguay (closed):** Altamira Group (Florencia Ozuna) went with another provider. Do not use that scope, projects, Calendly links, HubSpot statuses, or GHL notes as the current build. Those files stay in `docs/resources/` as archive only.

## What we are building (v1)

Volume they reported: about **15–20 leads/day** and **~60 conversations/day**. About 70% of leads interact outside office hours.

1. **WhatsApp assistant** on the official API number (marketing/cloud number). Greeting, three questions (interest, budget, whether they know the projects), answers to repeated questions (price-from, typology, delivery date, orientation). A lead who writes gets the greeting; a lead who arrives from a form gets one welcome. Junk leads stop there. No future rental-yield or “guaranteed rent” answers. No project-presentation file in v1.
2. **Knowledge** from a private Google Drive project sheet Altamira keeps current. Not the public website. Do not dump full inventory or unit-level availability in chat.
3. **HubSpot Sales Pro** (already live ~2 months). On handoff or close, create/update the contact and store the transcript as a long text property. Do not use HubSpot’s native AI (José estimated that route at about USD 1,800/month at this volume). How the connection is built is decided at kickoff.
4. **Handoff:** if the lead qualifies, ask when an advisor can call, then leave the case for the team. Advisors keep their own WhatsApp numbers. The bot does not live on those phones.
5. **Small panel:** thread list and the ability to pause the assistant when a human takes over.

Commercial quote (if asked): **USD 2,000** setup + **USD 950/month** from go-live, 6-month minimum, then month to month. Timeline: about 6 weeks, with no week-by-week breakdown in the proposal, aiming to test from **mid-November 2026**. If kickoff slips, launch moves to **early February 2027** (do not go live into year-end holidays). The monthly fee covers running the assistant, bug fixes, and small adjustments. Future versions are quoted separately. Altamira pays Anthropic usage on their own account, Meta/WhatsApp fees, and the HubSpot license. José estimated WhatsApp platform cost around USD 120–250/month, separate from this quote. From 1 Oct 2026 Meta charges about USD 0.085/send in most of LatAm, with 1,000 free messages and a 72-hour window. Proposal dated 2 Oct 2026, valid for 1 week.

## Out of scope (v1)

Not in the sendable proposal. Internally: Instagram DM, Messenger, email-to-WhatsApp, landing-form automation beyond the one welcome, mass email/remarketing, a second country (Costa Rica / “Erika”), native HubSpot AI, Calendly, full CRM rebuild, and the replicable product José might later sell to other developers. Uruguay is the first proof, not that product. Anything new after v1 is a separate quote.

## Product rules

- Model: Anthropic, a consistent smaller model is enough. Behavior will need live tuning; tests alone will not catch bad answers.
- Never answer future rental yield or guaranteed returns.
- Price-from and typology are allowed. Full availability stays with the advisor.
- Knowledge changes often (units, prices, quotas). The Drive sheet is the source, not a prompt frozen at kickoff.
- Two WhatsApp worlds: API number for the bot, personal numbers for advisors. Do not merge them in v1.

## Docs (source of truth)

- `docs/Propuesta-comercial-Almira-IA.html` — current Uruguay v1 proposal. Edit this when the proposal changes. Visual style follows grupoaltamira.uy: Montserrat, teal `#00374d`, gold `#bd995c`, cream page, uppercase labels.
- `docs/Propuesta-comercial-Almira-IA.pdf` — sendable PDF. Regenerate from the HTML after any proposal change.
- `docs/resources/reunion-2026-09-30.md` — 30 Sep 2026 meeting summary (Fabio, José Daniel, Luis).
- `docs/resources/` PDFs, docx, and xlsx — **Paraguay archive**. Do not treat them as Uruguay requirements.

## How to work in this repo

- Respond to Luis in English. Client-facing documents stay in Spanish.
- The HTML proposal is the build contract. Do not start implementation unless Luis asks.
- **Keep this file current.** After any change to scope, price, timeline, status, people, channels, product rules, integrations, or other project detail, update `AGENTS.md` in the same turn. If the sendable proposal is affected, update the HTML and regenerate the PDF. Do not leave this file stale.
