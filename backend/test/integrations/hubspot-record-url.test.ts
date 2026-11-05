import { describe, expect, it } from "vitest";
import { hubspotRecordUrl } from "../../src/integrations/crm/hubspot-check.js";

describe("hubspotRecordUrl", () => {
  it("builds the contact record URL on the account's own UI host", () => {
    expect(
      hubspotRecordUrl(
        { portalId: "12345678", uiDomain: "app.hubspot.com" },
        "901",
      ),
    ).toBe("https://app.hubspot.com/contacts/12345678/record/0-1/901");
    expect(
      hubspotRecordUrl(
        { portalId: "146221212", uiDomain: "app-eu1.hubspot.com" },
        "51",
      ),
    ).toBe("https://app-eu1.hubspot.com/contacts/146221212/record/0-1/51");
  });

  it("gives no link without an account or a contact", () => {
    const account = { portalId: "1", uiDomain: "app.hubspot.com" };
    expect(hubspotRecordUrl(account, null)).toBeNull();
    expect(
      hubspotRecordUrl({ portalId: null, uiDomain: "app.hubspot.com" }, "5"),
    ).toBeNull();
    expect(hubspotRecordUrl({ portalId: "1", uiDomain: null }, "5")).toBeNull();
  });

  it("never links outside HubSpot or with odd ids", () => {
    expect(
      hubspotRecordUrl({ portalId: "1", uiDomain: "evil.example.com" }, "5"),
    ).toBeNull();
    expect(
      hubspotRecordUrl(
        { portalId: "1", uiDomain: "app.hubspot.com.evil.io" },
        "5",
      ),
    ).toBeNull();
    expect(
      hubspotRecordUrl(
        { portalId: "1", uiDomain: "app.hubspot.com" },
        "fake-1",
      ),
    ).toBeNull();
    expect(
      hubspotRecordUrl(
        { portalId: "1/../x", uiDomain: "app.hubspot.com" },
        "5",
      ),
    ).toBeNull();
  });
});
