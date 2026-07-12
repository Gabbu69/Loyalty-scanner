import { describe, expect, it } from "vitest";

import { isLoyaltyToken, normalizeScannedToken } from "@/lib/loyalty/token";

describe("loyalty token validation", () => {
  const valid = `ls1_${"a".repeat(43)}`;

  it("accepts the versioned 32-byte base64url shape", () => {
    expect(isLoyaltyToken(valid)).toBe(true);
    expect(normalizeScannedToken(`  ${valid}\n`)).toBe(valid);
  });

  it("rejects malformed, legacy, and padded values", () => {
    expect(isLoyaltyToken(`ls1_${"a".repeat(42)}`)).toBe(false);
    expect(isLoyaltyToken(`ls2_${"a".repeat(43)}`)).toBe(false);
    expect(isLoyaltyToken(`ls1_${"a".repeat(42)}=`)).toBe(false);
    expect(normalizeScannedToken("https://example.com/member/123")).toBeNull();
  });

  it("accepts every base64url character but rejects unsafe or embedded payloads", () => {
    const allBase64UrlCharacters = `ls1_${"A0_-".repeat(10)}ABC`;

    expect(allBase64UrlCharacters).toHaveLength(47);
    expect(isLoyaltyToken(allBase64UrlCharacters)).toBe(true);
    expect(isLoyaltyToken(`${valid}.example.com`)).toBe(false);
    expect(isLoyaltyToken(`customer:${valid}`)).toBe(false);
    expect(isLoyaltyToken(`ls1_${"a".repeat(42)}+`)).toBe(false);
    expect(isLoyaltyToken(`ls1_${"a".repeat(42)}/`)).toBe(false);
  });
});
