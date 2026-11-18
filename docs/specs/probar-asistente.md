# Spec: Probar asistente (test chat in the backoffice)

Status: approved by Luis on 17 Nov 2026, built 18 Nov 2026. Internal build spec. Not in the commercial proposal.

## 1. Goal

Let a person chat with a company's assistant from inside the backoffice, playing the lead, with no WhatsApp number. The point is to try the prompt, instructions, knowledge files, and settings of a company before (or without) connecting Kapso, and to see why the assistant answered the way it did.

- It runs on the company's **saved** settings and knowledge files, exactly what a real lead would get on the next WhatsApp message. Unsaved edits in Configuración are not used.
- Its replies come from the same prompt and the same turn logic (`decideTurn`) as WhatsApp, so a test shows real behavior: collected items, stage moves, `callNow`, forbidden topics, the fixed lines.
- A test chat is temporary. It is never stored as a thread or message. It never reaches Conversaciones, Métricas (except Anthropic spend, see §6), the Por contactar badge, HubSpot, or WhatsApp.

### Who can use it

Every operator of the company (no roles in the MVP, and every operator can already edit Configuración), and a platform admin inside a company through support access (Entrar). A platform admin outside any company does not see it.

### Out of scope (do NOT build)

- Testing **unsaved** settings or instructions (a draft). Later, if wanted.
- Storing test chats on the server, sharing them, or saved regression scenarios ("this conversation must end in Por contactar").
- Simulating a form lead (welcome template), attachments or voice notes, the reply debounce (a burst of messages answered once), the 24-hour window, a different current time, or a person changing the stage in the middle of the test chat.
- Sending anything through Kapso, writing HubSpot, or creating `Thread` / `Message` rows.
- Any change to how the WhatsApp bot behaves.

## 2. Approaches considered

| | Approach | Trade-off |
|---|---|---|
| **A (chosen)** | **Stateless turn endpoint.** The browser holds the test conversation and the simulated lead state; each message posts both to one endpoint, which builds the prompt from saved settings, calls the model, runs `decideTurn`, and returns the reply and the new state. Nothing is stored except Anthropic usage. | Cannot leak into real data by construction. Reuses the real prompt and turn logic. Smallest change. Skips WhatsApp-only behavior (debounce, window, takeover). This is how bot builders (Voiceflow, Botpress, Dialogflow, Intercom Fin) do their test/preview panel. |
| B | Test threads in the real tables with an `isTest` flag, run through the real pipeline with a stand-in channel. | Exercises everything and persists, but every list, count, badge, metric, HubSpot write, and sweeper needs a filter. One missed filter puts a test lead in Altamira's queue or HubSpot. |
| C | Separate `TestChat` / `TestMessage` tables. | Persistent without touching `Thread`, but duplicates the message model for a feature that does not need history. |

Luis picked A on 17 Nov 2026, with saved settings only.

## 3. Repo conventions

Same as `docs/specs/metricas.md` §2: Express 5 + Prisma 7 + zod 4, ESM with `.js` imports, one controller and one service per endpoint in `backend/src/features/<feature>/`; Next.js 16 client components, shadcn, Tailwind 4, React Query hooks in `backoffice/lib/queries.ts`, types in `backoffice/lib/types.ts`. Panel copy in neutral Spanish with tú forms. Colors from theme tokens only. Mobile layout below `lg` must work.

## 4. Backend

### 4.1 Endpoint

`POST /internal/assistant-test/turn`, mounted in `backend/src/app.ts` behind `requireCompanyAccess` like the other company routes:

```ts
backoffice.use("/assistant-test", company, assistantTestRoutes(ctx));
```

The company always comes from `CompanyAccess` (the operator's row, or `X-Company-Id` for a platform admin). Through support access the POST is recorded in `AdminAuditEntry` by the existing middleware (one entry per test message; acceptable, and consistent with "every write through support access is recorded").

Files:

```
backend/src/features/assistant-test/
  assistant-test.routes.ts
  run-test-turn.controller.ts
  run-test-turn.service.ts
backend/test/http/assistant-test.test.ts
```

### 4.2 Request

Validated with zod in the controller. Errors are Spanish, code `bad_request`.

```ts
type TestTurnRequest = {
  /** The whole test conversation so far, oldest first, ending with the new lead message. */
  messages: Array<{
    role: "lead" | "assistant";
    body: string; // 1..4096 chars after trim for "lead"; assistant ≤ 4096
  }>; // 1..200 items, ≤ 60,000 chars in total; the last one must be role "lead"
  /** The simulated lead state the previous response returned. Omitted on the first message. */
  lead?: {
    state: "greeting" | "qualify" | "answer" | "handoff" | "closed";
    stage: "qualifying" | "to_contact" | "contacted" | "not_interested";
    collected: Record<string, string>; // ≤ 10 keys, values ≤ 4,096 chars
    callTime: string | null;           // ≤ 4,096 chars
    summary: string | null;            // ≤ 1,200 chars (MAX_SUMMARY_CHARS)
  };
  /** Shown to the model as the WhatsApp profile name. Optional, ≤ 80 chars. */
  leadName?: string | null;
};
```

Without `lead`, the service starts from a new WhatsApp lead: `state: "greeting"`, `stage: "qualifying"`, empty `collected`, null `callTime` and `summary`. `stageChangedByEmail` is always null (only the assistant moves the stage in a test).

The server trusts this state only as a test input: it affects nothing but the reply it returns. It drops `collected` keys that are not in the saved config's collect items before building the thread (`mergeFields` keeps every key it is given, so old keys would otherwise linger in the response).

**Body size.** The backoffice router parses JSON with a 100 KB limit (`backend/src/app.ts`), and the server only uses the last `config.llm.historyLimit` messages anyway. So the browser sends only the last `historyLimit` messages (from the saved config it already loads), further trimmed from the oldest until the total is ≤ 60,000 characters. The lead state carries what older messages established, as on WhatsApp. Keep the global 100 KB limit; do not add a route-specific parser.

### 4.3 What the service does

1. `loadCompanyById(ctx.db, companyId, ctx.encryptionKey)`.
2. `loadSystemPrompt(ctx, company)`, the same function the WhatsApp turn and the Reglas y prompt preview use.
3. Build a `PromptThread` from `lead` (§4.2) with `name: leadName ?? null`, `source: "whatsapp"`.
4. `buildTurnContext(thread, company.config, company.name, ctx.now())`.
5. `buildChatTurns(history, company.config.llm.historyLimit)`, where `history` maps `lead` → `{ direction: "inbound", type: "text" }` and `assistant` → `{ direction: "outbound", type: "text", sentByEmail: null }`.
6. `ctx.integrations.llmFor(company).complete({...})` with the same arguments as `askModel` in `backend/src/conversation/process-thread.ts` (model, temperature, timeoutMs from config; `scenario` with the thread, config, company name, documents).
7. `decideTurn(thread, input, rules)`. A thrown model error becomes `{ kind: "model_failure", reason }`, exactly like `askModel`.
8. Record `LlmUsage` with `threadId: null` whenever the model call returned usage, fake LLM included, as WhatsApp turns do (see §6).
9. Return the response (§4.4).

Shared code, so the test and WhatsApp cannot drift:

- Move `rulesFor(company)` out of `process-thread.ts` into a small exported helper (for example `backend/src/conversation/turn-rules.ts`) and use it from both places.
- Extract the model call in `askModel` into a function both can call, taking the LLM client, the prompt thread, the system prompt and documents, and the chat turns (for example `callModel(ctx, llm, company, promptThread, system, documents, chatTurns)` returning `{ input, usage }`, with errors from `complete()` turned into `model_failure`). `askModel` keeps loading the thread's messages and calling `llmFor` **inside its own `try`**, so on WhatsApp a missing key still becomes a `model_failure` turn. The WhatsApp behavior must not change; the existing pipeline tests prove it.

The test service calls `ctx.integrations.llmFor(company)` itself, before `callModel`. If it throws `MissingIntegrationError` (no Anthropic key and fakes not allowed), respond **409** `anthropic_missing`: "Configura la clave de Anthropic en Configuración → Integraciones → Anthropic para probar el asistente." Do not turn it into a `model_failure` turn. With `ALLOW_FAKE_INTEGRATIONS` (local development) the fake LLM answers, as it does for WhatsApp.

An archived company never gets here (`requireCompanyAccess` already refuses it).

### 4.4 Response

```ts
type TestTurnResponse = {
  /** What the lead would receive on WhatsApp. */
  reply: string;
  /**
   * What the model wrote when the lead receives something else instead: the fixed needsHuman line
   * on a forbidden topic or needsHuman, or the fallback line on an empty reply. Null otherwise.
   * Shown only in the test panel, never sent anywhere.
   */
  modelReply: string | null;
  /** The new simulated lead state; the browser sends it back with the next message. */
  lead: {
    state: ThreadState;
    stage: LeadStage;
    collected: Record<string, string>;
    callTime: string | null;
    summary: string | null;
  };
  /** What the model flagged this turn. Null when the model failed or did not answer. */
  model: {
    intent: "continue" | "qualified" | "not_interested";
    callNow: boolean;
    needsHuman: boolean;
    forbiddenTopic: string | null;
  } | null;
  /**
   * Set when the real assistant would stop here and wait for a person (decision.needsHuman), with
   * its reason: "forbidden_topic: …", "lead_needs_human", "empty_reply", "model_failure: …".
   */
  stoppedReason: string | null;
  /** Null only when the model call failed. The fake LLM reports model "fake". */
  usage: { model: string; inputTokens: number; outputTokens: number; latencyMs: number } | null;
};
```

`modelReply` is the model's `output.reply` when `decision.reply !== capReply(output.reply, maxReplyChars)`; otherwise null.

### 4.5 Tests (`backend/test/http/assistant-test.test.ts`)

Follow `manual-messages.test.ts` / `thread-stage.test.ts` (dev tokens, `createCompany`, `resetDb`, the scripted LLM in `test/support/scripted-llm.ts`). Cover at least:

1. Operator gets a reply; the system prompt the LLM received equals `loadSystemPrompt`'s for that company (instructions and a knowledge file appear in it).
2. First message without `lead` starts in greeting / qualifying; the returned `lead` carries collected items, and sending it back with the next message reaches `to_contact` when the required items are complete (stage moves like WhatsApp).
3. `callNow` → `stage: "to_contact"`, `callTime: "Lo antes posible"` (`CALL_NOW_TIME`).
4. Forbidden topic → `reply` is the company's needsHuman line, `modelReply` is the model's text, `stoppedReason` starts with `forbidden_topic:`.
5. Model throws → `reply` is the fallback line, `stoppedReason` starts with `model_failure:`, `model` and `usage` null.
6. No Anthropic key with fakes off → 409 `anthropic_missing`.
7. **Nothing leaks**: after several turns there are no `Thread` or `Message` rows, nothing was sent on the fake channel, nothing written on the fake CRM (HubSpot on), and one `LlmUsage` row per answered turn with `threadId: null`.
8. Platform admin with `X-Company-Id` → 200 and an `AdminAuditEntry`; admin without a company → 403 (the `requireCompanyAccess` body); archived operator → 403.
9. Validation: empty `messages`, last message not from the lead, body over 4,096 chars, more than 200 messages, over 60,000 chars in total → 400.
10. Uses saved settings: change the config through the settings API, then a turn uses the new tone / collect items.
11. `lead.collected` with a key not in the config → the key is not in the returned `lead.collected`.

## 5. Backoffice

### 5.1 Where it lives

Its own page in the sidebar, **Probar asistente** at `/probar`, after Conocimiento (icon `FlaskConicalIcon`). It shows only inside a company, like Conocimiento. The header title is "Probar asistente".

The first build put it in Configuración → Prompt. Luis asked on 18 Nov 2026 to move it to the sidebar: it tests the files as much as the settings, it is something people use rather than configure, and a full page gives the chat the height of a conversation. There are no links to it from Instrucciones or Reglas y prompt (Luis's call).

### 5.2 Layout

Desktop (`lg` and up): the page fills the panel's height like the thread view. An info line and **Nueva conversación** on top, then two columns, chat on the left (about 3/5), **Estado del lead** on the right, each with its own scroll.

```
┌ Probar asistente ─────────────────────────────── [Nueva conversación] ┐
│ ⓘ Usa la configuración guardada. No se envía nada por WhatsApp ni      │
│   a HubSpot, y la conversación no aparece en Conversaciones.            │
├──────────────────────────────────────────┬─────────────────────────────┤
│                     Hola, busco un 2 dorm│ Etapa      ● Calificando     │
│ Hola, soy Almira, la asistente virtual…  │ Paso       qualify           │
│                                          │ Necesario para Por contactar │
│                                          │  Interés      2 dorm. vivir  │
│                                          │  Presupuesto  —              │
│                                          │ Opcional                      │
│                                          │  …                           │
│                                          │ Hora para llamar  —          │
│                                          │ Resumen                      │
│                                          │  - Busca 2 dormitorios…      │
│                                          │ Último turno                 │
│                                          │  intent continue · callNow no│
│                                          │  1,840 + 120 tokens · 1.4 s  │
├──────────────────────────────────────────┤                              │
│ [ Escribe como si fueras el lead…   ] (➤)│                              │
└──────────────────────────────────────────┴─────────────────────────────┘
```

Below `lg`: tabs **Conversación / Lead**, like the thread view on a phone.

### 5.3 Chat

- Bubbles look like the thread view (`components/threads/chat-transcript.tsx`): the person's messages on the lead side, the assistant's on the company side labeled "Asistente", WhatsApp markup rendered. Reuse the component if it fits by mapping test messages to `ChatMessage` (`status: null`, `sentBy: null`); otherwise extract the bubble into a shared piece rather than copying it.
- Composer: a plain textarea and send button (no formatting toolbar; the person is playing the lead). Enter sends, Shift+Enter adds a line; on touch screens Enter adds a line. Max 4,096 characters.
- While a turn runs: the composer is disabled and a "Escribiendo…" bubble shows on the assistant side. One turn at a time.
- When the response has `modelReply`, show under that assistant bubble a muted, collapsible note: "El modelo quería responder: …".
- When `stoppedReason` is set, show a notice under the bubble: "Aquí el asistente se detendría y esperaría a una persona (<reason in Spanish>)." and disable the composer, with two buttons: **Continuar como si una persona lo hubiera atendido** (re-enables the composer; mirrors marking a WhatsApp thread attended) and **Nueva conversación**. Reason labels reuse the Métricas mapping (`forbidden_topic` "Tema prohibido", `model_failure` "Falla del modelo", `lead_needs_human` "Pidió una persona", `empty_reply` "Respuesta vacía"); for a forbidden topic also show the topic.
- On a request error (409 `anthropic_missing`, 5xx, network): an `Alert` with the API message above the composer, and the person's message stays in the composer so they can retry. The failed message is not added to the transcript. For `anthropic_missing`, the alert links to Integraciones → Anthropic (`/settings?tab=anthropic`).
- Empty state: "Escribe un mensaje como si fueras un lead que llega por WhatsApp." plus an optional **Nombre del lead** input (sent as `leadName`, default empty).

### 5.4 Estado del lead

From the latest response's `lead` and `model`:

- Etapa with the same colored dot and Spanish label as the stage picker, and the conversation step (`state`) in small muted text.
- The company's collect items, split into "Necesario para Por contactar" and "Opcional", in config order, with the value or "—". Item names come from the saved config (`useSettings`).
- Hora para llamar.
- Resumen (the bullets).
- Último turno: intent, callNow, needsHuman, forbidden topic, tokens and latency (`usage`), model id.

### 5.5 State in the browser

- Keep `{ messages, lead, leadName, stopped }` in `localStorage` under `leadscope.assistant-test.<company slug>` (the panel knows the slug, not the id), wrapped in try/catch. A stored lead state that does not have the right shape is dropped on load. A reload keeps the test chat; another company has its own. **Nueva conversación** clears it (no confirmation; it is only a test).
- If the saved config changed since the chat started, collect keys no longer in the config simply stop showing in Estado del lead; the backend drops them on the next turn (§4.2).
- Before each request, trim the history as §4.2 says (last `historyLimit` messages, ≤ 60,000 chars), and further until its JSON is ≤ 80,000 bytes, since accents and emoji take more than one byte.
- The chat state lives in a provider around the whole panel (`components/assistant-test/assistant-test-provider.tsx`), so a reply on its way still lands after the person opens another page. If a platform admin enters another company meanwhile, that reply is saved to the first company's chat.
- There is no "unsaved changes" notice: the draft lives in Configuración, and the info line already says the saved settings are used.

### 5.6 Files

```
backoffice/app/(panel)/probar/page.tsx
backoffice/components/assistant-test/assistant-test-provider.tsx
backoffice/components/assistant-test/assistant-test-chat.tsx
backoffice/components/assistant-test/assistant-test-lead.tsx
backoffice/lib/assistant-test-storage.ts
```

Plus: `TestTurnRequest` / `TestTurnResponse` in `lib/types.ts`, a `useAssistantTestTurn()` mutation in `lib/queries.ts` (no cache invalidation; it changes nothing the panel reads, except Métricas spend, which refetches on focus anyway), the provider in `app/(panel)/layout.tsx`, the sidebar item in `components/app-sidebar.tsx`, and the title in `components/site-header.tsx`.

## 6. Cost

Every test message is a real Anthropic call on the company's own key, billed to the company like WhatsApp turns. Each turn sends the full system prompt (cached after the first call within the cache window), so a test costs about what a lead message costs.

- Record `LlmUsage` for each answered test turn with `threadId: null`, so Métricas' Anthropic estimate matches what the company is actually billed. Métricas does not separate test from lead usage; that is acceptable at this volume.
- No rate limit in v1: only operators can call it, one turn at a time per browser.

## 7. Docs to update when built

- `AGENTS.md`: a status bullet, the section in **Configuración**'s layout list, and a line in **Small panel**.
- `docs/design.md`: the endpoint and that test turns store only `LlmUsage`.
- `README.md` only if it lists Configuración sections.

## 8. Definition of done

```
cd backend && npm run typecheck && npm run lint && npm test
cd backoffice && npm run typecheck && npm run lint && npm run build
```

Backend tests need Postgres (`docker compose up -d`). The existing `test/conversation/pipeline.test.ts` must pass unchanged, which shows the refactor in §4.3 did not change WhatsApp behavior. Then try it in the running panel with the fake LLM: a few turns to Por contactar, a forbidden topic, Nueva conversación, a reload that keeps the chat, and the phone layout.
