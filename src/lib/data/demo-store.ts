"use client";

import type {
  ActivityItem,
  AwardOutcome,
  DashboardSummary,
  IssuedCard,
  LoyaltySnapshot,
  Member,
  ProgramSettings,
  RedeemOutcome,
  ResolvedMember,
  ResolveOutcome,
  StaffMember,
} from "@/lib/data/types";

const STORAGE_KEY = "loyalty-scan.demo.v1";
const STAFF_NAME = "Gabbu (Demo Owner)";

type DemoMember = Member & { token: string; credentialActive: boolean };
type DemoState = Omit<LoyaltySnapshot, "members"> & {
  members: DemoMember[];
  revokedTokens: string[];
};

function nowIso() {
  return new Date().toISOString();
}

function randomToken() {
  const bytes = new Uint8Array(32);
  globalThis.crypto.getRandomValues(bytes);
  const base64 = btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
  return `ls1_${base64}`;
}

function randomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(6);
  globalThis.crypto.getRandomValues(bytes);
  return `LS-${Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("")}`;
}

function makeSeedMember(
  fullName: string,
  phone: string | null,
  pointBalance: number,
  daysAgo: number,
): DemoMember {
  const createdAt = new Date(Date.now() - daysAgo * 86_400_000).toISOString();
  return {
    id: crypto.randomUUID(),
    memberCode: randomCode(),
    fullName,
    phone,
    pointBalance,
    status: "active",
    createdAt,
    updatedAt: createdAt,
    token: randomToken(),
    credentialActive: true,
  };
}

function seedState(): DemoState {
  const members = [
    makeSeedMember("Mika Santos", "+63 917 555 0123", 8, 42),
    makeSeedMember("Paolo Reyes", "+63 905 555 0188", 4, 17),
    makeSeedMember("Jamie Cruz", null, 11, 8),
  ];
  const activity: ActivityItem[] = [
    {
      id: crypto.randomUUID(),
      memberId: members[0].id,
      memberName: members[0].fullName,
      memberCode: members[0].memberCode,
      kind: "earn",
      delta: 1,
      balanceAfter: members[0].pointBalance,
      staffName: STAFF_NAME,
      reason: "Visit scan",
      status: "accepted",
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      idempotencyKey: crypto.randomUUID(),
    },
  ];

  return {
    settings: {
      storeId: "demo-store",
      storeName: "Loyalty Scan Cafe",
      timezone: "Asia/Manila",
      pointsPerVisit: 1,
      cooldownMinutes: 10,
      rewardEnabled: true,
      rewardId: "demo-reward",
      rewardName: "Free signature drink",
      rewardCost: 10,
    },
    members,
    activity,
    revokedTokens: [],
    staff: [
      {
        id: "demo-owner",
        displayName: STAFF_NAME,
        email: "owner@example.com",
        role: "owner",
        active: true,
        createdAt: new Date(Date.now() - 60 * 86_400_000).toISOString(),
      },
      {
        id: "demo-staff",
        displayName: "Ari (Cashier)",
        email: "staff@example.com",
        role: "staff",
        active: true,
        createdAt: new Date(Date.now() - 20 * 86_400_000).toISOString(),
      },
    ],
  };
}

function safeMember(member: DemoMember): Member {
  const { token: _token, credentialActive: _credentialActive, ...safe } = member;
  void _token;
  void _credentialActive;
  return safe;
}

function saveState(state: DemoState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function loadState(): DemoState {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as DemoState;
      return {
        ...parsed,
        revokedTokens: Array.isArray(parsed.revokedTokens) ? parsed.revokedTokens : [],
      };
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }
  const state = seedState();
  saveState(state);
  return state;
}

function resolvedMember(state: DemoState, member: DemoMember): ResolvedMember {
  const latestEarn = state.activity.find(
    (item) =>
      item.memberId === member.id && item.kind === "earn" && item.status === "accepted",
  );
  const nextEligibleAt = latestEarn
    ? new Date(
        new Date(latestEarn.createdAt).getTime() + state.settings.cooldownMinutes * 60_000,
      ).toISOString()
    : null;
  const eligible = !nextEligibleAt || new Date(nextEligibleAt).getTime() <= Date.now();
  return {
    ...safeMember(member),
    eligible,
    nextEligibleAt: eligible ? null : nextEligibleAt,
    rewardAvailable:
      state.settings.rewardEnabled && member.pointBalance >= state.settings.rewardCost,
  };
}

function addActivity(state: DemoState, item: ActivityItem) {
  state.activity.unshift(item);
  state.activity = state.activity.slice(0, 250);
}

export const demoStore = {
  reset(): LoyaltySnapshot {
    saveState(seedState());
    return this.snapshot();
  },

  snapshot(): LoyaltySnapshot {
    const state = loadState();
    return {
      settings: state.settings,
      members: state.members.map(safeMember),
      activity: state.activity,
      staff: state.staff,
    };
  },

  dashboard(): DashboardSummary {
    const state = loadState();
    const today = new Date().toLocaleDateString("en-CA", {
      timeZone: state.settings.timezone,
    });
    const todaysItems = state.activity.filter(
      (item) =>
        new Date(item.createdAt).toLocaleDateString("en-CA", {
          timeZone: state.settings.timezone,
        }) === today,
    );
    return {
      activeMembers: state.members.filter((member) => member.status === "active").length,
      visitsToday: todaysItems.filter((item) => item.kind === "earn").length,
      pointsIssuedToday: todaysItems
        .filter((item) => item.kind === "earn")
        .reduce((total, item) => total + item.delta, 0),
      rewardsRedeemedToday: todaysItems.filter((item) => item.kind === "redeem").length,
      blockedToday: todaysItems.filter((item) => item.status === "blocked").length,
    };
  },

  searchMembers(query = ""): Member[] {
    const normalized = query.trim().toLowerCase();
    return loadState()
      .members.filter((member) => member.status === "active")
      .filter((member) => {
        if (!normalized) return true;
        return [member.fullName, member.memberCode, member.phone ?? ""].some((value) =>
          value.toLowerCase().includes(normalized),
        );
      })
      .sort((a, b) => a.fullName.localeCompare(b.fullName))
      .map(safeMember);
  },

  getMember(memberId: string): ResolvedMember | null {
    const state = loadState();
    const member = state.members.find((candidate) => candidate.id === memberId);
    return member ? resolvedMember(state, member) : null;
  },

  getCard(memberId: string): IssuedCard | null {
    const state = loadState();
    const member = state.members.find((candidate) => candidate.id === memberId);
    if (!member || !member.credentialActive) return null;
    return { member: safeMember(member), token: member.token };
  },

  resolveToken(token: string): ResolveOutcome {
    const state = loadState();
    const member = state.members.find(
      (candidate) => candidate.token === token && candidate.credentialActive,
    );
    if (member) return { status: "valid", member: resolvedMember(state, member) };
    if (state.revokedTokens.includes(token)) {
      return { status: "revoked", message: "This card was replaced. Use the newest loyalty card." };
    }
    return { status: "invalid", message: "This loyalty ID is not recognized for this store." };
  },

  createMember(input: { fullName: string; phone?: string | null }): IssuedCard {
    const state = loadState();
    const timestamp = nowIso();
    const member: DemoMember = {
      id: crypto.randomUUID(),
      memberCode: randomCode(),
      fullName: input.fullName.trim(),
      phone: input.phone?.trim() || null,
      pointBalance: 0,
      status: "active",
      createdAt: timestamp,
      updatedAt: timestamp,
      token: randomToken(),
      credentialActive: true,
    };
    state.members.unshift(member);
    saveState(state);
    return { member: safeMember(member), token: member.token };
  },

  awardVisit(memberId: string, idempotencyKey: string): AwardOutcome {
    const state = loadState();
    const duplicate = state.activity.find((item) => item.idempotencyKey === idempotencyKey);
    const member = state.members.find((candidate) => candidate.id === memberId);
    if (!member || member.status !== "active") {
      return { status: "invalid", message: "Customer is not active." };
    }
    if (duplicate?.kind === "earn") {
      return {
        status: "awarded",
        pointsAdded: duplicate.delta,
        newBalance: duplicate.balanceAfter,
        member: resolvedMember(state, member),
        transactionId: duplicate.id,
      };
    }
    if (duplicate?.kind === "blocked") {
      const nextEligibleAt =
        duplicate.createdAt && state.settings.cooldownMinutes > 0
          ? new Date(
              new Date(duplicate.createdAt).getTime() +
                state.settings.cooldownMinutes * 60_000,
            ).toISOString()
          : resolvedMember(state, member).nextEligibleAt;
      return {
        status: "cooldown",
        nextEligibleAt: nextEligibleAt ?? new Date().toISOString(),
        member: resolvedMember(state, member),
      };
    }
    const resolved = resolvedMember(state, member);
    if (!resolved.eligible && resolved.nextEligibleAt) {
      addActivity(state, {
        id: crypto.randomUUID(),
        memberId: member.id,
        memberName: member.fullName,
        memberCode: member.memberCode,
        kind: "blocked",
        delta: 0,
        balanceAfter: member.pointBalance,
        staffName: STAFF_NAME,
        reason: "Duplicate scan cooldown",
        status: "blocked",
        createdAt: nowIso(),
        idempotencyKey,
      });
      saveState(state);
      return { status: "cooldown", nextEligibleAt: resolved.nextEligibleAt, member: resolved };
    }
    member.pointBalance += state.settings.pointsPerVisit;
    member.updatedAt = nowIso();
    const transactionId = crypto.randomUUID();
    addActivity(state, {
      id: transactionId,
      memberId: member.id,
      memberName: member.fullName,
      memberCode: member.memberCode,
      kind: "earn",
      delta: state.settings.pointsPerVisit,
      balanceAfter: member.pointBalance,
      staffName: STAFF_NAME,
      reason: "Visit scan",
      status: "accepted",
      createdAt: member.updatedAt,
      idempotencyKey,
    });
    saveState(state);
    return {
      status: "awarded",
      pointsAdded: state.settings.pointsPerVisit,
      newBalance: member.pointBalance,
      member: resolvedMember(state, member),
      transactionId,
    };
  },

  redeemReward(memberId: string, idempotencyKey: string): RedeemOutcome {
    const state = loadState();
    const duplicate = state.activity.find((item) => item.idempotencyKey === idempotencyKey);
    const member = state.members.find((candidate) => candidate.id === memberId);
    if (!member || member.status !== "active") {
      return { status: "invalid", message: "Customer is not active." };
    }
    if (duplicate?.kind === "redeem") {
      return {
        status: "redeemed",
        pointsSpent: Math.abs(duplicate.delta),
        newBalance: duplicate.balanceAfter,
        member: resolvedMember(state, member),
        transactionId: duplicate.id,
      };
    }
    if (!state.settings.rewardEnabled || member.pointBalance < state.settings.rewardCost) {
      return {
        status: "insufficient_points",
        required: state.settings.rewardCost,
        current: member.pointBalance,
        member: resolvedMember(state, member),
      };
    }
    member.pointBalance -= state.settings.rewardCost;
    member.updatedAt = nowIso();
    const transactionId = crypto.randomUUID();
    addActivity(state, {
      id: transactionId,
      memberId: member.id,
      memberName: member.fullName,
      memberCode: member.memberCode,
      kind: "redeem",
      delta: -state.settings.rewardCost,
      balanceAfter: member.pointBalance,
      staffName: STAFF_NAME,
      reason: state.settings.rewardName,
      status: "accepted",
      createdAt: member.updatedAt,
      idempotencyKey,
    });
    saveState(state);
    return {
      status: "redeemed",
      pointsSpent: state.settings.rewardCost,
      newBalance: member.pointBalance,
      member: resolvedMember(state, member),
      transactionId,
    };
  },

  reissueCard(memberId: string): IssuedCard | null {
    const state = loadState();
    const member = state.members.find((candidate) => candidate.id === memberId);
    if (!member) return null;
    if (member.token) state.revokedTokens.push(member.token);
    member.token = randomToken();
    member.credentialActive = true;
    member.updatedAt = nowIso();
    addActivity(state, {
      id: crypto.randomUUID(),
      memberId: member.id,
      memberName: member.fullName,
      memberCode: member.memberCode,
      kind: "reissue",
      delta: 0,
      balanceAfter: member.pointBalance,
      staffName: STAFF_NAME,
      reason: "Lost or replaced card",
      status: "accepted",
      createdAt: member.updatedAt,
      idempotencyKey: crypto.randomUUID(),
    });
    saveState(state);
    return { member: safeMember(member), token: member.token };
  },

  updateSettings(next: ProgramSettings) {
    const state = loadState();
    state.settings = next;
    saveState(state);
    return next;
  },

  updateStaff(staff: StaffMember[]) {
    const state = loadState();
    state.staff = staff;
    saveState(state);
    return staff;
  },
};
