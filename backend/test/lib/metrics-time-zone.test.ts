import { describe, expect, it } from "vitest";
import {
  localParts,
  zonedDayStart,
} from "../../src/features/metrics/time-zone.js";

describe("metrics time zone", () => {
  it("reads America/Montevideo, which does not observe DST", () => {
    expect(
      zonedDayStart("2026-11-02", "America/Montevideo").toISOString(),
    ).toBe("2026-11-02T03:00:00.000Z");
    // 02:00 UTC on 2 Nov is 23:00 on 1 Nov in Montevideo.
    expect(
      localParts(new Date("2026-11-02T02:00:00.000Z"), "America/Montevideo"),
    ).toEqual({ dateStr: "2026-11-01", weekday: 0, hour: 23 });
    expect(
      localParts(new Date("2026-11-02T03:00:00.000Z"), "America/Montevideo"),
    ).toEqual({ dateStr: "2026-11-02", weekday: 1, hour: 0 });
  });

  it("lands on midnight across Europe/Madrid DST changes", () => {
    // Spring forward: 29 Mar 2026, 02:00 CET becomes 03:00 CEST. Midnight is still CET.
    expect(zonedDayStart("2026-03-29", "Europe/Madrid").toISOString()).toBe(
      "2026-03-28T23:00:00.000Z",
    );
    expect(
      localParts(new Date("2026-03-28T23:00:00.000Z"), "Europe/Madrid"),
    ).toEqual({ dateStr: "2026-03-29", weekday: 0, hour: 0 });
    expect(
      localParts(new Date("2026-03-29T00:30:00.000Z"), "Europe/Madrid"),
    ).toMatchObject({ dateStr: "2026-03-29", hour: 1 });
    expect(
      localParts(new Date("2026-03-29T01:30:00.000Z"), "Europe/Madrid"),
    ).toMatchObject({ dateStr: "2026-03-29", hour: 3 });

    // Fall back: 25 Oct 2026, 03:00 CEST becomes 02:00 CET. Midnight is still CEST.
    expect(zonedDayStart("2026-10-25", "Europe/Madrid").toISOString()).toBe(
      "2026-10-24T22:00:00.000Z",
    );
    expect(
      localParts(new Date("2026-10-24T22:00:00.000Z"), "Europe/Madrid"),
    ).toEqual({ dateStr: "2026-10-25", weekday: 0, hour: 0 });
    expect(
      localParts(new Date("2026-10-25T00:30:00.000Z"), "Europe/Madrid"),
    ).toMatchObject({ dateStr: "2026-10-25", hour: 2 });
    expect(
      localParts(new Date("2026-10-25T01:30:00.000Z"), "Europe/Madrid"),
    ).toMatchObject({ dateStr: "2026-10-25", hour: 2 });
  });

  it("corrects the offset once when UTC midnight is already on the new offset", () => {
    // New Zealand springs forward at 02:00 on 27 Sep 2026. Local midnight is
    // still NZST, while UTC midnight that day is already NZDT.
    expect(zonedDayStart("2026-09-27", "Pacific/Auckland").toISOString()).toBe(
      "2026-09-26T12:00:00.000Z",
    );
    expect(
      localParts(new Date("2026-09-26T12:00:00.000Z"), "Pacific/Auckland"),
    ).toEqual({ dateStr: "2026-09-27", weekday: 0, hour: 0 });
  });

  it("treats the instant of local midnight as that calendar day", () => {
    const cases: Array<[string, string]> = [
      ["2026-11-02", "America/Montevideo"],
      ["2026-03-29", "Europe/Madrid"],
      ["2026-10-25", "Europe/Madrid"],
      ["2026-07-15", "Europe/Madrid"],
      ["2026-09-27", "Pacific/Auckland"],
    ];
    for (const [date, timeZone] of cases) {
      const start = zonedDayStart(date, timeZone);
      expect(localParts(start, timeZone)).toMatchObject({
        dateStr: date,
        hour: 0,
      });
      expect(
        localParts(new Date(start.getTime() - 60_000), timeZone).dateStr,
      ).not.toBe(date);
    }
  });
});
