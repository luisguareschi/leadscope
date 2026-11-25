import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../../src/app.js";
import { recordInboundMessage } from "../../src/conversation/inbound.js";
import { processThread } from "../../src/conversation/process-thread.js";
import { sweepOnce } from "../../src/conversation/sweeper.js";
import {
  baseConfig,
  createCompany,
  createTestContext,
  inbound,
  resetDb,
  settle,
  testDb,
  type TestContext,
} from "../support/harness.js";
import { makePdf } from "../support/file-fixtures.js";

const db = testDb();
let now: Date;
let ctx: TestContext;
let app: ReturnType<typeof createApp>;
let companyId: string;
let phoneNumberId: string;
const asAna = { Authorization: "Bearer dev:ana@altamira.uy" };

const PNG_BYTES = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
]);

beforeEach(async () => {
  await resetDb();
  now = new Date("2026-11-25T15:00:00Z");
  const company = await createCompany(db, {
    slug: "altamira",
    name: "Altamira",
    config: {
      ...baseConfig,
      followUp: { enabled: true, delayHours: 4, maxCount: 1 },
      inactivity: { noResponseHours: 24 },
    },
  });
  companyId = company.id;
  phoneNumberId = company.whatsappPhoneNumberId!;
  await db.operator.create({ data: { email: "ana@altamira.uy", companyId } });
  ctx = createTestContext({ now: () => now });
  app = createApp(ctx);
});

describe("inbound audio transcription & image vision (LUI-19)", () => {
  it("answers a transcribed voice note using the LLM, and sends nonText when there is no transcript", async () => {
    ctx.llm.push({ reply: "Claro, tenemos opciones de 2 dormitorios." });
    const withTranscript = await recordInboundMessage(
      ctx,
      inbound(phoneNumberId, {
        waMessageId: "wamid.aud-ok",
        type: "audio",
        body: "Hola, busco un 2 dormitorios",
        sentAt: now,
      }),
    );
    if (withTranscript.status !== "recorded")
      throw new Error(withTranscript.status);
    await processThread(ctx, withTranscript.threadId);
    expect(ctx.llm.calls).toHaveLength(1);
    expect(ctx.llm.calls[0]!.messages[0]!.content).toContain(
      'Transcript: "Hola, busco un 2 dormitorios"',
    );
    expect(ctx.integrations.fakes.channel.sent[0]).toMatchObject({
      kind: "text",
      body: "Claro, tenemos opciones de 2 dormitorios.",
    });

    // Without transcript: falls back to nonText fixed message without calling LLM.
    const noTranscript = await recordInboundMessage(
      ctx,
      inbound(phoneNumberId, {
        waMessageId: "wamid.aud-empty",
        from: "59899111333",
        type: "audio",
        body: "",
        sentAt: now,
      }),
    );
    if (noTranscript.status !== "recorded")
      throw new Error(noTranscript.status);
    await processThread(ctx, noTranscript.threadId);
    expect(ctx.llm.calls).toHaveLength(1);
    expect(ctx.integrations.fakes.channel.sent[1]).toMatchObject({
      kind: "text",
      body: "¿Me lo escribís?",
    });
  });

  it("downloads an inbound image into storage and passes it to Claude Vision", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(PNG_BYTES, {
        status: 200,
        headers: { "content-type": "image/png" },
      }),
    );
    try {
      ctx.llm.push({ reply: "Veo el plano que me pasaste." });
      const recorded = await recordInboundMessage(
        ctx,
        inbound(phoneNumberId, {
          waMessageId: "wamid.img-1",
          type: "image",
          body: "¿Tienen algo así?",
          mediaUrl: "https://cdn.kapso.ai/plano.png",
          mediaMimeType: "image/png",
          mediaFileName: "plano.png",
          sentAt: now,
        }),
      );
      if (recorded.status !== "recorded") throw new Error(recorded.status);
      await processThread(ctx, recorded.threadId);
      expect(ctx.llm.calls).toHaveLength(1);
      expect(ctx.llm.calls[0]!.messages[0]!.images).toEqual([
        { mediaType: "image/png", base64: PNG_BYTES.toString("base64") },
      ]);
    } finally {
      fetchSpy.mockRestore();
    }
  });
});

describe("media sending from bot and panel (LUI-21)", () => {
  it("sends only public knowledge files chosen by the bot and never internal ones", async () => {
    const pubPath = `${companyId}/brochure.pdf`;
    const privPath = `${companyId}/costos-internos.pdf`;
    await ctx.storage.upload(pubPath, makePdf("Brochure"), "application/pdf");
    await ctx.storage.upload(privPath, makePdf("Costos"), "application/pdf");
    const pub = await db.knowledgeFile.create({
      data: {
        companyId,
        name: "Brochure.pdf",
        nameKey: "brochure.pdf",
        format: "pdf",
        mimeType: "application/pdf",
        sizeBytes: 100,
        sha256: "p1",
        text: "Brochure",
        charCount: 8,
        visibility: "public",
        storagePath: pubPath,
      },
    });
    const priv = await db.knowledgeFile.create({
      data: {
        companyId,
        name: "Costos.pdf",
        nameKey: "costos.pdf",
        format: "pdf",
        mimeType: "application/pdf",
        sizeBytes: 100,
        sha256: "p2",
        text: "Costos",
        charCount: 6,
        visibility: "internal",
        storagePath: privPath,
      },
    });

    ctx.llm.push({
      reply: "Te paso el brochure.",
      sendFileIds: [pub.id, priv.id],
    });
    const recorded = await recordInboundMessage(
      ctx,
      inbound(phoneNumberId, { body: "Pasame el brochure", sentAt: now }),
    );
    if (recorded.status !== "recorded") throw new Error(recorded.status);
    await processThread(ctx, recorded.threadId);

    const mediaSends = ctx.integrations.fakes.channel.sent.filter(
      (s) => s.kind === "image" || s.kind === "document",
    );
    expect(mediaSends).toHaveLength(1);
    expect(mediaSends[0]).toMatchObject({
      kind: "document",
      fileName: "Brochure.pdf",
      mimeType: "application/pdf",
    });
  });

  it("lets an operator send a direct upload or a public knowledge file, and blocks internal files", async () => {
    const pubPath = `${companyId}/plano.png`;
    await ctx.storage.upload(pubPath, PNG_BYTES, "image/png");
    const pub = await db.knowledgeFile.create({
      data: {
        companyId,
        name: "Plano.png",
        nameKey: "plano.png",
        format: "png",
        mimeType: "image/png",
        sizeBytes: PNG_BYTES.length,
        sha256: "img1",
        text: "",
        charCount: 0,
        visibility: "public",
        storagePath: pubPath,
      },
    });
    const priv = await db.knowledgeFile.create({
      data: {
        companyId,
        name: "Interno.pdf",
        nameKey: "interno.pdf",
        format: "pdf",
        mimeType: "application/pdf",
        sizeBytes: 100,
        sha256: "priv1",
        text: "Secreto",
        charCount: 7,
        visibility: "internal",
        storagePath: `${companyId}/interno.pdf`,
      },
    });

    const thread = await db.thread.create({
      data: {
        companyId,
        phone: "+59899111222",
        waId: "59899111222",
        lastInboundAt: now,
        lastMessageAt: now,
      },
    });

    // Reject internal knowledge file.
    const rejected = await request(app)
      .post(`/internal/threads/${thread.id}/messages`)
      .set(asAna)
      .send({ knowledgeFileId: priv.id })
      .expect(400);
    expect(rejected.body.error.code).toBe("file_not_public");

    // Allow public knowledge file.
    const sentPub = await request(app)
      .post(`/internal/threads/${thread.id}/messages`)
      .set(asAna)
      .send({ knowledgeFileId: pub.id, body: "Aquí va el plano" })
      .expect(201);
    expect(sentPub.body.message).toMatchObject({
      type: "image",
      body: "Aquí va el plano",
      media: { fileName: "Plano.png", mimeType: "image/png" },
    });

    // Direct multipart upload & download.
    const pdfBytes = makePdf("Oferta");
    const sentUpload = await request(app)
      .post(`/internal/threads/${thread.id}/messages`)
      .set(asAna)
      .field("body", "Adjunto cotización")
      .attach("file", pdfBytes, "cotizacion.pdf")
      .expect(201);
    expect(sentUpload.body.message).toMatchObject({
      type: "document",
      media: { fileName: "cotizacion.pdf", mimeType: "application/pdf" },
    });

    const downloaded = await request(app)
      .get(
        `/internal/threads/${thread.id}/messages/${sentUpload.body.message.id}/media`,
      )
      .set(asAna)
      .expect(200);
    expect(Buffer.compare(downloaded.body, pdfBytes)).toBe(0);
  });
});

describe("automatic 24h follow-ups, no_response sweep, and CRM consistency (LUI-17, LUI-18, LUI-20)", () => {
  it("sends a contextual follow-up after delayHours within 24h, then marks no_response after noResponseHours", async () => {
    ctx.llm.push({ reply: "¡Hola! ¿Qué buscás?" });
    const recorded = await recordInboundMessage(
      ctx,
      inbound(phoneNumberId, { body: "Hola", sentAt: now }),
    );
    if (recorded.status !== "recorded") throw new Error(recorded.status);
    await processThread(ctx, recorded.threadId);

    // 5 hours later: follow-up fires.
    now = new Date(now.getTime() + 5 * 3_600_000);
    ctx.llm.push({ reply: "¿Te quedó alguna duda sobre nuestras opciones?" });
    const firstSweep = await sweepOnce(ctx);
    expect(firstSweep.followUpsSent).toBe(1);
    expect(firstSweep.markedNoResponse).toBe(0);

    const afterFollowUp = await db.thread.findUniqueOrThrow({
      where: { id: recorded.threadId },
    });
    expect(afterFollowUp.followUpCount).toBe(1);
    expect(afterFollowUp.stage).toBe("qualifying");
    expect(ctx.llm.calls[1]!.turnContext).toContain(
      "has not replied for about 5 hour(s)",
    );
    // Critical #1: follow-up turn must end with a `user` message for Anthropic forced tool_choice.
    expect(ctx.llm.calls[1]!.messages.at(-1)?.role).toBe("user");

    // 2 hours later: maxCount=1 already reached, no second follow-up.
    now = new Date(now.getTime() + 2 * 3_600_000);
    const secondSweep = await sweepOnce(ctx);
    expect(secondSweep.followUpsSent).toBe(0);

    // 25 hours after last message: transitions to no_response.
    now = new Date(now.getTime() + 25 * 3_600_000);
    const thirdSweep = await sweepOnce(ctx);
    expect(thirdSweep.markedNoResponse).toBe(1);
    const inactive = await db.thread.findUniqueOrThrow({
      where: { id: recorded.threadId },
    });
    expect(inactive.stage).toBe("no_response");

    // Lead replies later: resets followUpCount & lastFollowUpAt and returns to state=qualify (#12, #13).
    ctx.llm.push({ reply: "¡Hola de nuevo! Contame tu presupuesto." });
    await recordInboundMessage(
      ctx,
      inbound(phoneNumberId, {
        waMessageId: "wamid.back",
        body: "Perdón la demora, sigo interesado",
        sentAt: now,
      }),
    );
    await processThread(ctx, recorded.threadId);
    const revived = await db.thread.findUniqueOrThrow({
      where: { id: recorded.threadId },
    });
    expect(revived.followUpCount).toBe(0);
    expect(revived.lastFollowUpAt).toBeNull();
    expect(revived.stage).toBe("qualifying");
    expect(revived.state).toBe("qualify");
  });

  it("stops retrying failed or flagged follow-ups and records usage (Critical #2)", async () => {
    ctx.llm.push({ reply: "¡Hola! ¿Qué buscás?" });
    const recorded = await recordInboundMessage(
      ctx,
      inbound(phoneNumberId, {
        waMessageId: "wamid.fu-fail",
        from: "59899111999",
        body: "Hola",
        sentAt: now,
      }),
    );
    if (recorded.status !== "recorded") throw new Error(recorded.status);
    await processThread(ctx, recorded.threadId);

    // 5 hours later: follow-up hits forbiddenTopic -> must record usage and cap attempts so next sweep skips it.
    now = new Date(now.getTime() + 5 * 3_600_000);
    ctx.llm.push({
      reply: "Renta 10%",
      forbiddenTopic: "Rentabilidad futura",
    });
    const first = await sweepOnce(ctx);
    expect(first.followUpsSent).toBe(0);
    const after = await db.thread.findUniqueOrThrow({
      where: { id: recorded.threadId },
    });
    expect(after.followUpCount).toBe(1);
    expect(after.lastFollowUpAt).not.toBeNull();
    expect(
      await db.llmUsage.count({ where: { threadId: recorded.threadId } }),
    ).toBe(2);

    // Next 30s tick must NOT call the LLM again.
    now = new Date(now.getTime() + 30_000);
    const second = await sweepOnce(ctx);
    expect(second.followUpsSent).toBe(0);
    expect(ctx.llm.calls).toHaveLength(2);
  });

  it("blocks SVG/HTML manual uploads, sets safe download headers, preserves referenced binaries, and sends WebP as document (#4, #5, #14, #17)", async () => {
    const thread = await db.thread.create({
      data: {
        companyId,
        phone: "+59899111444",
        waId: "59899111444",
        lastInboundAt: now,
        lastMessageAt: now,
      },
    });
    // #4: SVG and HTML direct uploads rejected.
    await request(app)
      .post(`/internal/threads/${thread.id}/messages`)
      .set(asAna)
      .attach("file", Buffer.from("<svg><script>alert(1)</script></svg>"), {
        filename: "xss.svg",
        contentType: "image/svg+xml",
      })
      .expect(415);
    await request(app)
      .post(`/internal/threads/${thread.id}/messages`)
      .set(asAna)
      .attach("file", Buffer.from("<html><script>alert(1)</script></html>"), {
        filename: "xss.html",
        contentType: "text/html",
      })
      .expect(415);

    // #14: WebP sent as WhatsApp document, not image.
    const webpBytes = Buffer.from([
      0x52, 0x49, 0x46, 0x46, 0x10, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
    ]);
    const sentWebp = await request(app)
      .post(`/internal/threads/${thread.id}/messages`)
      .set(asAna)
      .attach("file", webpBytes, "render.webp")
      .expect(201);
    expect(sentWebp.body.message.type).toBe("document");

    // #4: Safe headers on download.
    const dl = await request(app)
      .get(
        `/internal/threads/${thread.id}/messages/${sentWebp.body.message.id}/media`,
      )
      .set(asAna)
      .expect(200);
    expect(dl.headers["x-content-type-options"]).toBe("nosniff");
    expect(dl.headers["content-security-policy"]).toBe(
      "default-src 'none'; sandbox",
    );

    // #5: Deleting a KnowledgeFile that was sent in a conversation keeps the binary for the message;
    // deleting the thread then removes it from storage.
    const uploadedPdf = await request(app)
      .post("/internal/knowledge/files")
      .set(asAna)
      .field("visibility", "public")
      .attach("file", makePdf("Folleto"), "folleto.pdf")
      .expect(201);
    const kfileId = uploadedPdf.body.file.id as string;
    const sentKfile = await request(app)
      .post(`/internal/threads/${thread.id}/messages`)
      .set(asAna)
      .send({ knowledgeFileId: kfileId })
      .expect(201);
    await request(app)
      .delete(`/internal/knowledge/files/${kfileId}`)
      .set(asAna)
      .expect(204);
    await request(app)
      .get(
        `/internal/threads/${thread.id}/messages/${sentKfile.body.message.id}/media`,
      )
      .set(asAna)
      .expect(200);

    // #17: Re-uploading an existing internal file with visibility=public preserves internal.
    await request(app)
      .post("/internal/knowledge/files")
      .set(asAna)
      .attach("file", makePdf("Interno v1"), "secreto.pdf")
      .expect(201);
    const replaced = await request(app)
      .post("/internal/knowledge/files")
      .set(asAna)
      .field("visibility", "public")
      .attach("file", makePdf("Interno v2"), "secreto.pdf")
      .expect(200);
    expect(replaced.body.file.visibility).toBe("internal");
  });

  it("keeps HubSpot status consistent with Etapa when a to_contact lead says not_interested (LUI-18)", async () => {
    const thread = await db.thread.create({
      data: {
        companyId,
        phone: "+59899111222",
        waId: "59899111222",
        state: "answer",
        stage: "to_contact",
        collected: {
          interest: "2 dormitorios",
          budget: "USD 150.000",
          knowsProjects: "No",
        },
        callTime: "mañana",
        handedOffAt: now,
        lastInboundAt: now,
        lastMessageAt: now,
      },
    });
    ctx.llm.push({
      intent: "not_interested",
      reply: "Entendido, quedamos a las órdenes.",
    });
    await recordInboundMessage(
      ctx,
      inbound(phoneNumberId, {
        waMessageId: "wamid.ni",
        body: "Al final por ahora no, gracias",
        sentAt: now,
      }),
    );
    await processThread(ctx, thread.id);
    await settle(ctx);

    const updated = await db.thread.findUniqueOrThrow({
      where: { id: thread.id },
    });
    expect(updated.stage).toBe("to_contact");
    expect(updated.state).toBe("answer");

    const crmSummary =
      ctx.integrations.fakes.crm.contacts.get("+59899111222")?.lead.summary;
    expect(crmSummary).toContain("Estado: Derivado a asesor");
    expect(crmSummary).toContain("Etapa: Por contactar");
    expect(crmSummary).not.toContain("Cerrado, sin interés");
  });
});
