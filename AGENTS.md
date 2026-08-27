# Altamira — Almira IA

Custom WhatsApp inbound agent for **Altamira Group** (real-estate developer, Paraguay). The agent is **Almira**. It qualifies leads and hands them to a human or a Calendly link. It does not replace advisors and does not book visits itself.

**Owner:** Luis Guareschi (freelancer, USD 120/h). WhatsApp: +34 695 40 3932. LinkedIn: https://www.linkedin.com/in/luis-guareschi-29a68b1a0/  
**Client lead:** Florencia Ozuna (`fozuna@altamiragroup.com.py`).  
**Status (Aug 2026):** proposal / scoping. Repo is empty except `docs/`. Implementation has not started. Proposal is not signed yet.  
**Competitor (Integrative AI Inc., Nov 2025):** canned WhatsApp + HubSpot assistant. Setup **USD 1,850**, then **USD 1,650/month** (3-month minimum). No custom admin panel. They book appointments in HubSpot. Placeholder “[Client Name]” still in the deck. Year-1 TCO ≈ USD 20–22k if they stay 12 months; they do not own the stack.

## What we are building (MVP)

Channels: paid Meta forms (Facebook / Instagram) → WhatsApp for **all current projects**, plus organic WhatsApp so those chats are not dropped. Projects: Ycuá Satí (no units), Surubi’i, Altavida Luque, Altavida Norte, Veralta Los Laureles, Alzara Plaza, Parque Alcántara.

1. **Almira on WhatsApp** — master prompt + FAQ. Ask live vs invest, detect project, reply concisely (2–3 facts + price-from + site + Calendly). One follow-up at 10 minutes. Hand off after 3 detailed questions or requests for plans / exact expenses / custom financing. Rentals only: Altavida Luque, Surubi’i (delivered towers), Alzara Plaza.
2. **HubSpot** — create/update contact; write project, status, origin/campaign, sale vs rent, budget, typology, goal, and a conversation summary. Statuses Almira may set: `Almira activada`, `Solicita asesor`, `Visita agendada`, `Inválido`, `Perdido`.
3. **Calendly** — send the correct project link only. No Calendly API booking.
4. **Admin panel** — inbox, full thread, HubSpot card, filters, human takeover (pause/resume Almira), config for prices / Calendly / templates. Roles: admin and inbound operator.

Commercial quote (if asked): **USD 2,500** setup + **USD 950/month** from week 9, 3-month minimum. Timeline: 8 weeks — weeks 1–3 design/prototype, weeks 3–6 HubSpot/panel, weeks 6–8 UAT/go-live, week 9 onward support. The timeline may extend depending on admin-panel complexity. Monthly includes agent hosting, LLM, optimization, and support. Altamira still pays Meta/WhatsApp conversation fees and the HubSpot license.

## Out of scope (MVP)

Not listed in the sendable proposal. Internally: other inbound channels (web, mailing, TikTok, etc.), Instagram DM / Messenger, GHL → BUZZ migration, native Calendly booking, marketing dashboards, mobile app, HubSpot history cleanup.

## Product rules (Almira)

- WhatsApp tone: one message per turn, one question, no emojis, no opening `¿`/`¡`.
- Knowledge: only these projects — Ycuá Satí (no units), Surubi’i, Altavida Luque, Altavida Norte, Veralta Los Laureles, Alzara Plaza, Parque Alcántara.
- Prices in the master prompt are outdated; Altamira must supply current prices before real-lead tests.
- HubSpot stays the CRM of record. Do not invent a parallel customer database.
- They currently use GoHighLevel and mentioned moving to BUZZ later. Do not assume GHL is gone. Avoid duplicate outbound messages if GHL is still live.

## Docs (source of truth)

- `docs/Propuesta-comercial-Almira-IA.html` — scope and budget source. Edit this file when the proposal changes.
- `docs/Propuesta-comercial-Almira-IA.pdf` — sendable PDF. Regenerate from the HTML after any proposal change.
- `docs/resources/primera-reunion.md` — first meeting notes.
- `docs/resources/ALMIRA IA (Comportamiento) - Prompt maestro estructurado 12.01.pdf` — agent behavior + project sheets + Calendly URLs.
- `docs/resources/PREGUNTAS FRECUENTES ALMIRA.docx` — knowledge base.
- `docs/resources/MVP - Implementación Altamira 06.07.docx` — channels, lead statuses, HubSpot contact fields.
- `docs/resources/Implementación de canales Inbound 06.07.xlsx` — first-touch templates per channel.
- `docs/resources/correos.pdf` — email thread with Florencia (docs delivered 21 Aug 2026). Still missing from her list: platform-flow diagram, GHL–HubSpot/Supabase sync model, certification prototype, panel mockup, conversation-volume metrics.

## How to work in this repo

- Respond to Luis in English. Client-facing documents stay in Spanish.
- Prefer the proposal as the build contract. Use `docs/resources/` for behavior, copy, and CRM fields.
- Do not start implementation unless Luis asks. Next real step after a signed proposal: kickoff + WhatsApp/HubSpot access.
- **Keep this file current.** After any change to scope, price, timeline, status, people, channels, product rules, integrations, or other project detail, update `AGENTS.md` in the same turn. If the sendable proposal is affected, update `docs/Propuesta-comercial-Almira-IA.html` and regenerate `docs/Propuesta-comercial-Almira-IA.pdf`. Do not leave this file stale.
