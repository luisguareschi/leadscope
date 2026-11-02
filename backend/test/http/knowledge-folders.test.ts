import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../../src/app.js";
import {
  createCompany,
  createTestContext,
  resetDb,
  testDb,
} from "../support/harness.js";

const db = testDb();
let app: ReturnType<typeof createApp>;
let companyId: string;
let otherId: string;
let foreignFolderId: string;
let foreignFileId: string;
const auth = { Authorization: "Bearer dev:operador@test.com" };
const admin = { Authorization: "Bearer dev:admin@example.com" };

beforeEach(async () => {
  await resetDb();
  companyId = (await createCompany(db, { slug: "altamira" })).id;
  otherId = (await createCompany(db, { slug: "otra" })).id;
  await db.operator.create({
    data: { email: "operador@test.com", companyId },
  });
  foreignFolderId = (
    await db.knowledgeFolder.create({
      data: { companyId: otherId, name: "Ajena", nameKey: "ajena" },
    })
  ).id;
  foreignFileId = (
    await db.knowledgeFile.create({
      data: {
        companyId: otherId,
        folderId: foreignFolderId,
        name: "ajeno.txt",
        nameKey: "ajeno.txt",
        format: "txt",
        mimeType: "text/plain",
        sizeBytes: 5,
        sha256: "x",
        text: "ajeno",
        charCount: 5,
      },
    })
  ).id;
  app = createApp(
    createTestContext({ env: { PLATFORM_ADMIN_EMAILS: "admin@example.com" } }),
  );
});

const createFolder = (name: string, parentId: string | null = null) =>
  request(app)
    .post("/internal/knowledge/folders")
    .set(auth)
    .send({ name, parentId });

const upload = (name: string, text: string, folderId?: string | null) => {
  const req = request(app).post("/internal/knowledge/files").set(auth);
  if (folderId) req.field("folderId", folderId);
  return req.attach("file", Buffer.from(text), name);
};

const patchFolder = (id: string, body: object) =>
  request(app).patch(`/internal/knowledge/folders/${id}`).set(auth).send(body);

const patchFile = (id: string, body: object) =>
  request(app).patch(`/internal/knowledge/files/${id}`).set(auth).send(body);

const list = async () =>
  (await request(app).get("/internal/knowledge/files").set(auth).expect(200))
    .body as {
    folders: { id: string; name: string; parentId: string | null }[];
    files: { id: string; name: string; folderId: string | null }[];
  };

describe("knowledge folders", () => {
  it("creates nested folders, and renames and moves folders and files", async () => {
    const proyectos = (await createFolder("  Proyectos ").expect(201)).body
      .folder;
    expect(proyectos).toMatchObject({ name: "Proyectos", parentId: null });
    const tres = (await createFolder("Tres Cruces", proyectos.id).expect(201))
      .body.folder;
    const torre = (await createFolder("Torre Norte", tres.id).expect(201)).body
      .folder;
    expect(torre.parentId).toBe(tres.id);

    // Same name: refused next to it, fine in another folder.
    const taken = await createFolder("proyectos").expect(409);
    expect(taken.body.error).toMatchObject({ code: "name_taken" });
    expect(taken.body.error.message).toContain("la raíz de Conocimiento");
    await createFolder("Tres Cruces").expect(201);
    await createFolder("a/b").expect(400);
    await createFolder("   ").expect(400);

    const renamed = await patchFolder(tres.id, {
      name: "Tres Cruces II",
    }).expect(200);
    expect(renamed.body.folder).toMatchObject({
      name: "Tres Cruces II",
      parentId: proyectos.id,
    });
    // A case-only rename is not a clash with itself.
    await patchFolder(tres.id, { name: "tres cruces ii" }).expect(200);

    const file = (await upload("precios.xlsx.txt", "USD 150.000").expect(201))
      .body.file;
    expect(file.folderId).toBeNull();
    const stored = await db.knowledgeFile.findUniqueOrThrow({
      where: { id: file.id },
    });

    const moved = await patchFile(file.id, { folderId: torre.id }).expect(200);
    expect(moved.body.file.folderId).toBe(torre.id);
    // Renaming keeps the extension, and neither moves the content's date.
    const fileRenamed = await patchFile(file.id, { name: "Lista 2027" }).expect(
      200,
    );
    expect(fileRenamed.body.file.name).toBe("Lista 2027.txt");
    await patchFile(file.id, { name: "Lista.TXT" }).expect(200);
    const after = await db.knowledgeFile.findUniqueOrThrow({
      where: { id: file.id },
    });
    expect(after.name).toBe("Lista.TXT");
    expect(after.nameKey).toBe("lista.txt");
    expect(after.updatedAt).toEqual(stored.updatedAt);

    // A folder moves with everything inside it, and back to the root.
    await patchFolder(torre.id, { parentId: null }).expect(200);
    await patchFile(file.id, { folderId: null }).expect(200);
    const tree = await list();
    expect(
      tree.folders.find((folder) => folder.id === torre.id)?.parentId,
    ).toBeNull();
    expect(tree.files.find((item) => item.id === file.id)?.folderId).toBeNull();
    await patchFolder(torre.id, { parentId: proyectos.id }).expect(200);
    await patchFolder("nope", { name: "x" }).expect(404);
    await patchFile(file.id, { folderId: "nope" }).expect(404);
  });

  it("never moves a folder into itself or a folder inside it", async () => {
    const a = (await createFolder("A").expect(201)).body.folder;
    const b = (await createFolder("B", a.id).expect(201)).body.folder;
    const c = (await createFolder("C", b.id).expect(201)).body.folder;

    for (const target of [a.id, b.id, c.id]) {
      const response = await patchFolder(a.id, { parentId: target }).expect(
        400,
      );
      expect(response.body.error.code).toBe("folder_cycle");
    }
    await patchFolder(b.id, { parentId: c.id }).expect(400);
    // Moving C out to the root and B under C is fine: C is no longer inside B.
    await patchFolder(c.id, { parentId: null }).expect(200);
    await patchFolder(b.id, { parentId: c.id }).expect(200);
    const tree = await list();
    expect(tree.folders.find((folder) => folder.id === b.id)?.parentId).toBe(
      c.id,
    );

    // Two opposite moves at once: the lock lets only one of them make A and C each other's child.
    const [first, second] = await Promise.all([
      patchFolder(a.id, { parentId: c.id }),
      patchFolder(c.id, { parentId: a.id }),
    ]);
    expect([first.status, second.status].sort()).toEqual([200, 400]);
  });

  it("replaces a file uploaded again with the same name in the same folder only", async () => {
    const proyectos = (await createFolder("Proyectos").expect(201)).body.folder;
    const tres = (await createFolder("Tres Cruces", proyectos.id).expect(201))
      .body.folder;
    const pocitos = (await createFolder("Pocitos", proyectos.id).expect(201))
      .body.folder;

    const root = (await upload("precios.txt", "raíz").expect(201)).body.file;
    const inTres = (await upload("precios.txt", "tres v1", tres.id).expect(201))
      .body.file;
    const inPocitos = (
      await upload("Precios.txt", "pocitos", pocitos.id).expect(201)
    ).body.file;
    expect(new Set([root.id, inTres.id, inPocitos.id]).size).toBe(3);
    expect(inTres.folderId).toBe(tres.id);

    const again = await upload("PRECIOS.txt", "tres v2", tres.id).expect(200);
    expect(again.body).toMatchObject({
      replaced: true,
      file: { id: inTres.id, name: "PRECIOS.txt", folderId: tres.id },
    });
    const texts = Object.fromEntries(
      (await db.knowledgeFile.findMany({ where: { companyId } })).map(
        (file) => [file.id, file.text],
      ),
    );
    expect(texts).toEqual({
      [root.id]: "raíz",
      [inTres.id]: "tres v2",
      [inPocitos.id]: "pocitos",
    });

    // Moving or renaming onto a name that is already in the folder is refused.
    const clash = await patchFile(root.id, { folderId: tres.id }).expect(409);
    expect(clash.body.error.message).toContain("Proyectos / Tres Cruces");
    await createFolder("Pocitos", tres.id).expect(201);
    await patchFolder(pocitos.id, { parentId: tres.id }).expect(409);
    const other = (await upload("otro.txt", "otro", tres.id).expect(201)).body
      .file;
    await patchFile(other.id, { name: "precios" }).expect(409);
    // Reemplazar keeps the file in its folder and checks names there.
    await request(app)
      .put(`/internal/knowledge/files/${other.id}`)
      .set(auth)
      .attach("file", Buffer.from("x"), "Precios.txt")
      .expect(409);
    await request(app)
      .put(`/internal/knowledge/files/${other.id}`)
      .set(auth)
      .attach("file", Buffer.from("x"), "faq.txt")
      .expect(200);
    expect(
      (await db.knowledgeFile.findUniqueOrThrow({ where: { id: other.id } }))
        .folderId,
    ).toBe(tres.id);
  });

  it("deletes a folder with its subfolders and files", async () => {
    const proyectos = (await createFolder("Proyectos").expect(201)).body.folder;
    const tres = (await createFolder("Tres Cruces", proyectos.id).expect(201))
      .body.folder;
    const torre = (await createFolder("Torre", tres.id).expect(201)).body
      .folder;
    const keep = (await createFolder("Otra").expect(201)).body.folder;
    await upload("a.txt", "a", proyectos.id).expect(201);
    await upload("b.txt", "b", tres.id).expect(201);
    await upload("c.txt", "c", torre.id).expect(201);
    await upload("d.txt", "d", keep.id).expect(201);
    await upload("e.txt", "e").expect(201);

    const deleted = await request(app)
      .delete(`/internal/knowledge/folders/${proyectos.id}`)
      .set(auth)
      .expect(200);
    expect(deleted.body).toEqual({ deletedFolders: 3, deletedFiles: 3 });
    const tree = await list();
    expect(tree.folders.map((folder) => folder.name)).toEqual(["Otra"]);
    expect(tree.files.map((file) => file.name).sort()).toEqual([
      "d.txt",
      "e.txt",
    ]);
    await request(app)
      .delete(`/internal/knowledge/folders/${proyectos.id}`)
      .set(auth)
      .expect(404);
    // Another company's knowledge is untouched.
    expect(
      await db.knowledgeFile.count({ where: { companyId: otherId } }),
    ).toBe(1);
  });

  it("never reads or writes another company's folders", async () => {
    const mine = (await createFolder("Mía").expect(201)).body.folder;
    const file = (await upload("mio.txt", "mío", mine.id).expect(201)).body
      .file;

    expect((await list()).folders.map((folder) => folder.name)).toEqual([
      "Mía",
    ]);
    await upload("x.txt", "x", foreignFolderId).expect(404);
    await createFolder("Dentro", foreignFolderId).expect(404);
    await patchFile(file.id, { folderId: foreignFolderId }).expect(404);
    await patchFolder(mine.id, { parentId: foreignFolderId }).expect(404);
    await patchFolder(foreignFolderId, { name: "Robada" }).expect(404);
    await patchFile(foreignFileId, { folderId: null }).expect(404);
    await request(app)
      .delete(`/internal/knowledge/folders/${foreignFolderId}`)
      .set(auth)
      .expect(404);
    const foreign = await db.knowledgeFolder.findUniqueOrThrow({
      where: { id: foreignFolderId },
    });
    expect(foreign.name).toBe("Ajena");
    expect(
      (
        await db.knowledgeFile.findUniqueOrThrow({
          where: { id: foreignFileId },
        })
      ).folderId,
    ).toBe(foreignFolderId);
  });

  it("records folder writes made through support access", async () => {
    const created = await request(app)
      .post("/internal/knowledge/folders")
      .set(admin)
      .set("X-Company-Id", companyId)
      .send({ name: "Soporte" })
      .expect(201);
    await request(app)
      .patch(`/internal/knowledge/folders/${created.body.folder.id}`)
      .set(admin)
      .set("X-Company-Id", companyId)
      .send({ name: "Soporte 2" })
      .expect(200);
    await vi.waitFor(async () => {
      expect(await db.adminAuditEntry.count({ where: { status: null } })).toBe(
        0,
      );
    });
    const entries = await db.adminAuditEntry.findMany({
      where: { companyId },
      orderBy: { createdAt: "asc" },
    });
    expect(entries.map((entry) => [entry.action, entry.status])).toEqual([
      ["POST /internal/knowledge/folders", 201],
      [`PATCH /internal/knowledge/folders/${created.body.folder.id}`, 200],
    ]);
  });

  it("shows the folder paths in the prompt preview, in prompt order", async () => {
    const proyectos = (await createFolder("Proyectos").expect(201)).body.folder;
    const tres = (await createFolder("Tres Cruces", proyectos.id).expect(201))
      .body.folder;
    await upload("Precios.txt", "Torre Sur desde USD 150.000", tres.id).expect(
      201,
    );
    await upload("faq.txt", "Entrega 2027").expect(201);

    const preview = await request(app)
      .get("/internal/settings/prompt")
      .set(auth)
      .expect(200);
    expect(preview.body.knowledge.documents).toEqual([
      { path: "faq.txt", chars: 12 },
      { path: "Proyectos / Tres Cruces / Precios.txt", chars: 27 },
    ]);
    expect(preview.body.system).toContain(
      '<document path="Proyectos / Tres Cruces / Precios.txt"',
    );
  });
});
