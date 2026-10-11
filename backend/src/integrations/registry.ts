import type { LoadedCompany } from "../companies/load-company.js";
import type { Env } from "../config/env.js";
import { createAnthropicClient } from "../llm/anthropic.js";
import { createFakeLlm } from "../llm/fake-llm.js";
import type { LlmClient } from "../llm/types.js";
import { FakeCrm, type Crm } from "./crm/crm.js";
import { createHubSpotCrm } from "./crm/hubspot.js";
import { createMetaChannel, FakeChannel, type Channel } from "./whatsapp/channel.js";

export class MissingIntegrationError extends Error {}

export type Integrations = {
  llmFor(company: LoadedCompany): LlmClient;
  channelFor(company: LoadedCompany): Channel;
  crmFor(company: LoadedCompany): Crm;
  /** Shared in-process fakes, so scripts and tests can read what was "sent". */
  fakes: { llm: LlmClient; channel: FakeChannel; crm: FakeCrm };
};

type Overrides = Partial<{
  llmFor: Integrations["llmFor"];
  channelFor: Integrations["channelFor"];
  crmFor: Integrations["crmFor"];
}>;

export function createIntegrations(env: Env, overrides: Overrides = {}): Integrations {
  const fakes = { llm: createFakeLlm(), channel: new FakeChannel(), crm: new FakeCrm() };
  const anthropicClients = new Map<string, LlmClient>();

  function fakeOrFail<T>(fake: T, what: string, company: LoadedCompany): T {
    if (env.ALLOW_FAKE_INTEGRATIONS) return fake;
    throw new MissingIntegrationError(`${company.slug} has no ${what} configured`);
  }

  return {
    fakes,
    llmFor:
      overrides.llmFor ??
      ((company) => {
        const devKey = env.NODE_ENV === "production" ? undefined : env.ANTHROPIC_API_KEY;
        const apiKey = company.secrets.anthropicApiKey ?? devKey;
        if (!apiKey) return fakeOrFail(fakes.llm, "Anthropic API key", company);
        let client = anthropicClients.get(apiKey);
        if (!client) {
          client = createAnthropicClient(apiKey);
          anthropicClients.set(apiKey, client);
        }
        return client;
      }),
    channelFor:
      overrides.channelFor ??
      ((company) => {
        const { metaAccessToken } = company.secrets;
        if (!metaAccessToken || !company.whatsappPhoneNumberId) {
          return fakeOrFail(fakes.channel, "WhatsApp access token", company);
        }
        return createMetaChannel({
          phoneNumberId: company.whatsappPhoneNumberId,
          accessToken: metaAccessToken,
          graphVersion: env.META_GRAPH_VERSION,
        });
      }),
    crmFor:
      overrides.crmFor ??
      ((company) => {
        const { hubspotAccessToken } = company.secrets;
        if (!hubspotAccessToken) return fakeOrFail(fakes.crm, "HubSpot access token", company);
        return createHubSpotCrm({
          accessToken: hubspotAccessToken,
          transcriptProperty: company.config.crm.transcriptProperty,
        });
      }),
  };
}
