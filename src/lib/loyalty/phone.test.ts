import { describe, expect, it } from "vitest";

import { maskPhoneNumber, normalizePhilippinePhone } from "@/lib/loyalty/phone";

describe("phone helpers", () => {
  it("normalizes common Philippine mobile formats", () => {
    expect(normalizePhilippinePhone("0917 555 0123")).toBe("+639175550123");
    expect(normalizePhilippinePhone("63 917 555 0123")).toBe("+639175550123");
    expect(normalizePhilippinePhone("+63 (917) 555-0123")).toBe("+639175550123");
  });

  it("allows an empty optional phone and rejects invalid text", () => {
    expect(normalizePhilippinePhone("")).toBeNull();
    expect(normalizePhilippinePhone("   ")).toBeNull();
    expect(normalizePhilippinePhone("call me")).toBeNull();
    expect(normalizePhilippinePhone("0917-ABC-0123")).toBeNull();
    expect(normalizePhilippinePhone("+63 12")).toBeNull();
  });

  it("only reveals the final four digits in staff summaries", () => {
    expect(maskPhoneNumber("+639175550123")).toBe("•••• 0123");
    expect(maskPhoneNumber(null)).toBe("No phone added");
  });
});
