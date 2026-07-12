import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { demoStore } from "@/lib/data/demo-store";
import { isLoyaltyToken } from "@/lib/loyalty/token";

const TEST_TIME = new Date("2026-07-12T04:00:00.000Z");

function createMemoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => Array.from(values.keys())[index] ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, String(value)),
  };
}

function createCustomer(fullName = "Test Customer") {
  return demoStore.createMember({ fullName, phone: "+639175550123" });
}

describe("demo loyalty store", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", createMemoryStorage());
    vi.useFakeTimers();
    vi.setSystemTime(TEST_TIME);
    demoStore.reset();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("returns the original award for an idempotent retry without adding points twice", () => {
    const { member } = createCustomer();
    const idempotencyKey = crypto.randomUUID();

    const first = demoStore.awardVisit(member.id, idempotencyKey);
    const retry = demoStore.awardVisit(member.id, idempotencyKey);

    expect(first.status).toBe("awarded");
    expect(retry).toEqual(first);
    expect(demoStore.getMember(member.id)?.pointBalance).toBe(1);

    const matchingEntries = demoStore
      .snapshot()
      .activity.filter((item) => item.memberId === member.id && item.kind === "earn");
    expect(matchingEntries).toHaveLength(1);
    expect(matchingEntries[0]).toMatchObject({
      delta: 1,
      balanceAfter: 1,
      idempotencyKey,
      status: "accepted",
    });
  });

  it("blocks a distinct award during cooldown and leaves the balance unchanged", () => {
    const { member } = createCustomer();
    const first = demoStore.awardVisit(member.id, crypto.randomUUID());
    const blockedKey = crypto.randomUUID();
    const second = demoStore.awardVisit(member.id, blockedKey);

    expect(first.status).toBe("awarded");
    expect(second.status).toBe("cooldown");
    if (second.status === "cooldown") {
      expect(new Date(second.nextEligibleAt).getTime()).toBe(
        TEST_TIME.getTime() + 10 * 60_000,
      );
      expect(second.member.pointBalance).toBe(1);
      expect(second.member.eligible).toBe(false);
    }

    const snapshot = demoStore.snapshot();
    expect(snapshot.members.find((item) => item.id === member.id)?.pointBalance).toBe(1);
    expect(
      snapshot.activity.filter(
        (item) => item.memberId === member.id && item.status === "accepted",
      ),
    ).toHaveLength(1);
    expect(
      snapshot.activity.filter(
        (item) => item.memberId === member.id && item.status === "blocked",
      ),
    ).toEqual([
      expect.objectContaining({
        kind: "blocked",
        delta: 0,
        balanceAfter: 1,
        idempotencyKey: blockedKey,
      }),
    ]);
  });

  it("qualifies a customer at the reward threshold and redeems only once on retry", () => {
    const snapshot = demoStore.snapshot();
    const qualified = snapshot.members.find((member) => member.pointBalance >= 10);
    expect(qualified).toBeDefined();
    if (!qualified) throw new Error("Expected a seeded customer at the reward threshold");

    expect(demoStore.getMember(qualified.id)?.rewardAvailable).toBe(true);

    const idempotencyKey = crypto.randomUUID();
    const first = demoStore.redeemReward(qualified.id, idempotencyKey);
    const retry = demoStore.redeemReward(qualified.id, idempotencyKey);

    expect(first.status).toBe("redeemed");
    expect(retry).toEqual(first);
    if (first.status === "redeemed") {
      expect(first.pointsSpent).toBe(10);
      expect(first.newBalance).toBe(qualified.pointBalance - 10);
      expect(first.member.rewardAvailable).toBe(false);
    }

    const after = demoStore.snapshot();
    expect(after.members.find((member) => member.id === qualified.id)?.pointBalance).toBe(
      qualified.pointBalance - 10,
    );
    expect(
      after.activity.filter(
        (item) => item.memberId === qualified.id && item.kind === "redeem",
      ),
    ).toHaveLength(1);
  });

  it("rejects redemption below the configured threshold without writing to the ledger", () => {
    const { member } = createCustomer("Not Yet Qualified");
    const before = demoStore.snapshot().activity.length;

    const result = demoStore.redeemReward(member.id, crypto.randomUUID());

    expect(result.status).toBe("insufficient_points");
    if (result.status === "insufficient_points") {
      expect(result.current).toBe(0);
      expect(result.required).toBe(10);
      expect(result.member.rewardAvailable).toBe(false);
    }
    expect(demoStore.getMember(member.id)?.pointBalance).toBe(0);
    expect(demoStore.snapshot().activity).toHaveLength(before);
  });

  it("keeps the cached member balance equal to the sum of accepted ledger deltas", () => {
    const { member } = createCustomer("Ledger Check");
    const currentSettings = demoStore.snapshot().settings;
    demoStore.updateSettings({
      ...currentSettings,
      cooldownMinutes: 0,
      rewardEnabled: true,
      rewardCost: 2,
    });

    expect(demoStore.awardVisit(member.id, crypto.randomUUID()).status).toBe("awarded");
    expect(demoStore.awardVisit(member.id, crypto.randomUUID()).status).toBe("awarded");
    expect(demoStore.redeemReward(member.id, crypto.randomUUID()).status).toBe("redeemed");

    const snapshot = demoStore.snapshot();
    const ledgerEntries = snapshot.activity.filter(
      (item) => item.memberId === member.id && item.status === "accepted",
    );
    const ledgerBalance = ledgerEntries.reduce((total, item) => total + item.delta, 0);
    const cachedBalance = snapshot.members.find((item) => item.id === member.id)?.pointBalance;

    expect(ledgerEntries.map((item) => item.delta).sort((a, b) => a - b)).toEqual([
      -2, 1, 1,
    ]);
    expect(cachedBalance).toBe(ledgerBalance);
    expect(cachedBalance).toBe(0);
  });

  it("revokes the old token when a loyalty card is reissued", () => {
    const issued = createCustomer("Lost Card Customer");
    expect(isLoyaltyToken(issued.token)).toBe(true);
    expect(demoStore.resolveToken(issued.token)).toEqual(
      expect.objectContaining({
        status: "valid",
        member: expect.objectContaining({ id: issued.member.id }),
      }),
    );

    const replacement = demoStore.reissueCard(issued.member.id);

    expect(replacement).not.toBeNull();
    if (!replacement) throw new Error("Expected a replacement loyalty card");
    expect(isLoyaltyToken(replacement.token)).toBe(true);
    expect(replacement.token).not.toBe(issued.token);
    expect(demoStore.resolveToken(issued.token)).toEqual(
      expect.objectContaining({ status: "revoked" }),
    );
    expect(demoStore.resolveToken(replacement.token)).toEqual(
      expect.objectContaining({
        status: "valid",
        member: expect.objectContaining({ id: issued.member.id }),
      }),
    );
    expect(demoStore.getCard(issued.member.id)?.token).toBe(replacement.token);

    expect(
      demoStore
        .snapshot()
        .activity.filter((item) => item.memberId === issued.member.id && item.kind === "reissue"),
    ).toEqual([
      expect.objectContaining({
        delta: 0,
        balanceAfter: 0,
        reason: "Lost or replaced card",
        status: "accepted",
      }),
    ]);
  });
});
