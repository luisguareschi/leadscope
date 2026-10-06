import { readFile } from "fs/promises";
import path from "path";
import { importPKCS8, SignJWT } from "jose";
import { CompanyConfig } from "../../companies/config";
import { ProjectDraft } from "../../store/types";

export type ColumnMapping = CompanyConfig["knowledge"]["columnMapping"];

export async function loadFixtureProjects(fixturePath?: string): Promise<ProjectDraft[]> {
  const file = fixturePath ?? path.join(process.cwd(), "fixtures", "projects.json");
  const raw = await readFile(file, "utf8");
  const rows = JSON.parse(raw) as ProjectDraft[];
  return rows.map((row) => ({
    slug: row.slug,
    name: row.name,
    priceFrom: row.priceFrom ?? null,
    typologies: row.typologies ?? null,
    deliveryDate: row.deliveryDate ?? null,
    orientation: row.orientation ?? null,
    notes: row.notes ?? null,
  }));
}

export function rowsFromSheetValues(values: string[][], mapping: ColumnMapping): ProjectDraft[] {
  if (values.length < 2) return [];
  const headers = values[0].map((header) => header.trim());
  const index = (header: string) => headers.indexOf(header);
  const drafts: ProjectDraft[] = [];
  for (const row of values.slice(1)) {
    const cell = (header: string) => {
      const at = index(header);
      if (at < 0) return null;
      const value = (row[at] ?? "").trim();
      return value.length > 0 ? value : null;
    };
    const slug = cell(mapping.slug);
    const name = cell(mapping.name);
    if (!slug || !name) continue;
    drafts.push({
      slug,
      name,
      priceFrom: cell(mapping.priceFrom),
      typologies: cell(mapping.typologies),
      deliveryDate: cell(mapping.deliveryDate),
      orientation: cell(mapping.orientation),
      notes: cell(mapping.notes),
    });
  }
  return drafts;
}

type ServiceAccount = { client_email: string; private_key: string };

export async function fetchSheetValues(input: {
  sheetId: string;
  range: string;
  serviceAccountJson: string;
  fetchImpl?: typeof fetch;
}): Promise<string[][]> {
  const account = JSON.parse(input.serviceAccountJson) as ServiceAccount;
  const token = await googleAccessToken(account, input.fetchImpl ?? fetch);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(input.sheetId)}/values/${encodeURIComponent(input.range)}`;
  const response = await (input.fetchImpl ?? fetch)(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error(`google sheet read failed (${response.status})`);
  const json = (await response.json()) as { values?: string[][] };
  return json.values ?? [];
}

async function googleAccessToken(account: ServiceAccount, fetchImpl: typeof fetch): Promise<string> {
  const key = await importPKCS8(account.private_key, "RS256");
  const now = Math.floor(Date.now() / 1000);
  const assertion = await new SignJWT({ scope: "https://www.googleapis.com/auth/spreadsheets.readonly" })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuer(account.client_email)
    .setSubject(account.client_email)
    .setAudience("https://oauth2.googleapis.com/token")
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(key);
  const response = await fetchImpl("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  if (!response.ok) throw new Error(`google token exchange failed (${response.status})`);
  const json = (await response.json()) as { access_token?: string };
  if (!json.access_token) throw new Error("google token exchange returned no access_token");
  return json.access_token;
}
