"use client";

import { createClient } from "@/lib/supabase/client";
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

type JsonRecord = Record<string, unknown>;

type StoreContext = {
  storeId: string;
  userId: string;
  role: "owner" | "staff";
};

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" ? (value as JsonRecord) : {};
}

function asString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function asNumber(value: unknown, fallback = 0) {
  return typeof value === "number" ? value : fallback;
}

function asBoolean(value: unknown, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function mapMember(row: unknown, reward?: { enabled: boolean; cost: number }): ResolvedMember {
  const value = asRecord(row);
  const pointBalance = asNumber(value.current_balance ?? value.pointBalance, 0);
  const rewardAvailable = asBoolean(
    value.reward_eligible,
    reward ? reward.enabled && pointBalance >= reward.cost : false,
  );
  return {
    id: asString(value.id),
    memberCode: asString(value.member_code ?? value.memberCode),
    fullName: asString(value.full_name ?? value.fullName, "Customer"),
    phone: typeof value.phone === "string" ? value.phone : null,
    maskedPhone: typeof value.masked_phone === "string" ? value.masked_phone : null,
    pointBalance,
    status: value.is_active === false ? "archived" : "active",
    createdAt: asString(value.created_at ?? value.createdAt),
    updatedAt: asString(value.updated_at ?? value.updatedAt),
    eligible: asBoolean(value.eligible, true),
    nextEligibleAt:
      typeof value.next_eligible_at === "string"
        ? value.next_eligible_at
        : typeof value.nextEligibleAt === "string"
          ? value.nextEligibleAt
          : null,
    rewardAvailable,
  };
}

function memberOnly(member: ResolvedMember): Member {
  return {
    id: member.id,
    memberCode: member.memberCode,
    fullName: member.fullName,
    phone: member.phone,
    maskedPhone: member.maskedPhone,
    pointBalance: member.pointBalance,
    status: member.status,
    createdAt: member.createdAt,
    updatedAt: member.updatedAt,
  };
}

function messageForStatus(status: string) {
  return {
    forbidden: "Your staff account is not active for this store.",
    invalid: "This loyalty ID is not recognized for this store.",
    revoked: "This card was replaced. Use the newest loyalty card.",
    invalid_request: "The request was incomplete. Try again.",
    idempotency_conflict: "This retry key was already used for a different action.",
    reward_unavailable: "This reward is not available right now.",
  }[status] ?? "The request could not be completed.";
}

async function requireClient() {
  const supabase = createClient();
  if (!supabase) throw new Error("Supabase is not configured.");
  return supabase;
}

async function getContext(): Promise<StoreContext> {
  const supabase = await requireClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    throw new Error("Sign in again to continue.");
  }

  const { data, error } = await supabase
    .from("staff_memberships")
    .select("store_id,user_id,role,is_active")
    .eq("user_id", userData.user.id)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (error || !data) throw new Error("No active staff membership was found.");
  const row = asRecord(data);
  const role = row.role === "staff" ? "staff" : "owner";
  return { storeId: asString(row.store_id), userId: userData.user.id, role };
}

async function loadMembers(
  storeId: string,
  reward: { enabled: boolean; cost: number },
): Promise<ResolvedMember[]> {
  const supabase = await requireClient();
  const { data, error } = await supabase.rpc("search_members", {
    p_store_id: storeId,
    p_query: "",
    p_limit: 50,
  });
  if (error) throw error;
  const payload = asRecord(data);
  if (payload.status !== "ok") throw new Error(messageForStatus(asString(payload.status)));
  const rows = Array.isArray(payload.members) ? payload.members : [];
  return rows.map((row) => mapMember(row, reward));
}

async function loadSettings(storeId: string): Promise<ProgramSettings> {
  const supabase = await requireClient();
  const [{ data: store }, { data: program }, { data: reward }] = await Promise.all([
    supabase.from("stores").select("id,name,timezone").eq("id", storeId).single(),
    supabase
      .from("program_settings")
      .select("points_per_visit,duplicate_cooldown_minutes")
      .eq("store_id", storeId)
      .single(),
    supabase
      .from("rewards")
      .select("id,name,cost_points,is_enabled")
      .eq("store_id", storeId)
      .limit(1)
      .maybeSingle(),
  ]);
  const storeRow = asRecord(store);
  const programRow = asRecord(program);
  const rewardRow = asRecord(reward);
  return {
    storeId,
    storeName: asString(storeRow.name, "Loyalty Scan"),
    timezone: asString(storeRow.timezone, "Asia/Manila"),
    pointsPerVisit: asNumber(programRow.points_per_visit, 1),
    cooldownMinutes: asNumber(programRow.duplicate_cooldown_minutes, 10),
    rewardEnabled: asBoolean(rewardRow.is_enabled, false),
    rewardId: asString(rewardRow.id),
    rewardName: asString(rewardRow.name, "Reward"),
    rewardCost: asNumber(rewardRow.cost_points, 10),
  };
}

async function loadStaff(context: StoreContext): Promise<StaffMember[]> {
  const supabase = await requireClient();
  const { data } = await supabase
    .from("staff_memberships")
    .select("id,user_id,role,is_active,created_at")
    .eq("store_id", context.storeId)
    .order("created_at", { ascending: true });
  const rows = Array.isArray(data) ? data : [];
  return rows.map((row) => {
    const value = asRecord(row);
    const userId = asString(value.user_id);
    const isCurrent = userId === context.userId;
    return {
      id: asString(value.id, userId),
      displayName: isCurrent ? "Signed-in staff" : `Staff ${userId.slice(0, 8)}`,
      email: isCurrent ? "Current account" : userId,
      role: value.role === "staff" ? "staff" : "owner",
      active: asBoolean(value.is_active, false),
      createdAt: asString(value.created_at),
    };
  });
}

async function loadActivity(storeId: string): Promise<ActivityItem[]> {
  const supabase = await requireClient();
  const { data, error } = await supabase
    .from("point_transactions")
    .select("id,member_id,transaction_type,points_delta,balance_after,reason,idempotency_key,source_transaction_id,staff_user_id,created_at,members(member_code,full_name)")
    .eq("store_id", storeId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error || !Array.isArray(data)) return [];
  return data.map((row) => {
    const value = asRecord(row);
    const member = asRecord(value.members);
    const type = asString(value.transaction_type);
    return {
      id: asString(value.id),
      memberId: asString(value.member_id),
      memberName: asString(member.full_name, "Customer"),
      memberCode: asString(member.member_code),
      kind:
        type === "reward_redemption"
          ? "redeem"
          : type === "manual_adjustment"
            ? "adjustment"
            : type === "reversal"
              ? "reversal"
              : "earn",
      delta: asNumber(value.points_delta),
      balanceAfter: asNumber(value.balance_after),
      staffName: asString(value.staff_user_id, "Staff"),
      reason: typeof value.reason === "string" ? value.reason : null,
      status: "accepted",
      createdAt: asString(value.created_at),
      idempotencyKey: asString(value.idempotency_key),
      reversesTransactionId:
        typeof value.source_transaction_id === "string" ? value.source_transaction_id : null,
    };
  });
}

function summarize(settings: ProgramSettings, members: Member[], activity: ActivityItem[]) {
  const today = new Date().toLocaleDateString("en-CA", { timeZone: settings.timezone });
  const todaysItems = activity.filter(
    (item) =>
      item.createdAt &&
      new Date(item.createdAt).toLocaleDateString("en-CA", {
        timeZone: settings.timezone,
      }) === today,
  );
  return {
    activeMembers: members.filter((member) => member.status === "active").length,
    visitsToday: todaysItems.filter((item) => item.kind === "earn").length,
    pointsIssuedToday: todaysItems
      .filter((item) => item.kind === "earn")
      .reduce((total, item) => total + item.delta, 0),
    rewardsRedeemedToday: todaysItems.filter((item) => item.kind === "redeem").length,
    blockedToday: todaysItems.filter((item) => item.status === "blocked").length,
  } satisfies DashboardSummary;
}

async function mapAwardOutcome(data: unknown, settings: ProgramSettings): Promise<AwardOutcome> {
  const payload = asRecord(data);
  const status = asString(payload.status);
  if (status === "awarded") {
    const member = mapMember(asRecord(payload.member), {
      enabled: settings.rewardEnabled,
      cost: settings.rewardCost,
    });
    member.pointBalance = asNumber(payload.new_balance, member.pointBalance);
    return {
      status: "awarded",
      pointsAdded: asNumber(payload.points_added, settings.pointsPerVisit),
      newBalance: asNumber(payload.new_balance, member.pointBalance),
      member,
      transactionId: asString(payload.transaction_id, crypto.randomUUID()),
    };
  }
  if (status === "cooldown") {
    return {
      status: "cooldown",
      nextEligibleAt: asString(payload.next_eligible_at, new Date().toISOString()),
      member: mapMember(asRecord(payload.member), {
        enabled: settings.rewardEnabled,
        cost: settings.rewardCost,
      }),
    };
  }
  return {
    status: status === "revoked" || status === "forbidden" ? status : "invalid",
    message: messageForStatus(status),
  };
}

async function mapRedeemOutcome(data: unknown, settings: ProgramSettings): Promise<RedeemOutcome> {
  const payload = asRecord(data);
  const status = asString(payload.status);
  if (status === "redeemed") {
    const member = mapMember(asRecord(payload.member), {
      enabled: settings.rewardEnabled,
      cost: settings.rewardCost,
    });
    return {
      status: "redeemed",
      pointsSpent: asNumber(payload.points_spent, settings.rewardCost),
      newBalance: asNumber(payload.new_balance, member.pointBalance),
      member,
      transactionId: asString(payload.transaction_id, crypto.randomUUID()),
    };
  }
  if (status === "insufficient_points") {
    const current = asNumber(payload.current_balance, 0);
    return {
      status: "insufficient_points",
      required: asNumber(payload.required_points, settings.rewardCost),
      current,
      member: {
        id: "",
        memberCode: "",
        fullName: "Customer",
        phone: null,
        pointBalance: current,
        status: "active",
        createdAt: "",
        updatedAt: "",
        eligible: true,
        nextEligibleAt: null,
        rewardAvailable: false,
      },
    };
  }
  return { status: status === "forbidden" ? "forbidden" : "invalid", message: messageForStatus(status) };
}

export const productionStore = {
  async snapshot(): Promise<{ snapshot: LoyaltySnapshot; summary: DashboardSummary }> {
    const context = await getContext();
    const settings = await loadSettings(context.storeId);
    const reward = { enabled: settings.rewardEnabled, cost: settings.rewardCost };
    const [resolvedMembers, activity, staff] = await Promise.all([
      loadMembers(context.storeId, reward),
      loadActivity(context.storeId),
      loadStaff(context),
    ]);
    const members = resolvedMembers.map(memberOnly);
    const snapshot = { settings, members, activity, staff };
    return { snapshot, summary: summarize(settings, members, activity) };
  },

  async resolveToken(token: string): Promise<ResolveOutcome> {
    const context = await getContext();
    const settings = await loadSettings(context.storeId);
    const supabase = await requireClient();
    const { data, error } = await supabase.rpc("resolve_loyalty_id", {
      p_store_id: context.storeId,
      p_loyalty_id: token,
    });
    if (error) throw error;
    const payload = asRecord(data);
    const status = asString(payload.status);
    if (status !== "valid") {
      return {
        status: status === "revoked" || status === "forbidden" ? status : "invalid",
        message: messageForStatus(status),
      };
    }
    const member = mapMember(
      {
        ...asRecord(payload.member),
        eligible: payload.eligible,
        next_eligible_at: payload.next_eligible_at,
        reward_eligible: asBoolean(asRecord(payload.reward).eligible),
      },
      { enabled: settings.rewardEnabled, cost: settings.rewardCost },
    );
    return { status: "valid", member };
  },

  async getMember(memberId: string): Promise<ResolvedMember | null> {
    const context = await getContext();
    const settings = await loadSettings(context.storeId);
    const members = await loadMembers(context.storeId, {
      enabled: settings.rewardEnabled,
      cost: settings.rewardCost,
    });
    return members.find((member) => member.id === memberId) ?? null;
  },

  async createMember(input: { fullName: string; phone?: string | null }): Promise<IssuedCard> {
    const context = await getContext();
    const supabase = await requireClient();
    const { data, error } = await supabase.rpc("create_member", {
      p_store_id: context.storeId,
      p_full_name: input.fullName,
      p_phone: input.phone ?? null,
    });
    if (error) throw error;
    const payload = asRecord(data);
    if (payload.status !== "created") throw new Error(messageForStatus(asString(payload.status)));
    const member = memberOnly(mapMember(payload.member));
    return { member, token: asString(payload.loyalty_id) };
  },

  async awardVisit(
    memberId: string,
    idempotencyKey: string,
    loyaltyToken?: string | null,
  ): Promise<AwardOutcome> {
    const context = await getContext();
    const settings = await loadSettings(context.storeId);
    const supabase = await requireClient();
    const { data, error } = loyaltyToken
      ? await supabase.rpc("award_visit", {
          p_store_id: context.storeId,
          p_loyalty_id: loyaltyToken,
          p_idempotency_key: idempotencyKey,
        })
      : await supabase.rpc("award_visit_manual", {
          p_store_id: context.storeId,
          p_member_id: memberId,
          p_idempotency_key: idempotencyKey,
        });
    if (error) throw error;
    return mapAwardOutcome(data, settings);
  },

  async redeemReward(memberId: string, idempotencyKey: string): Promise<RedeemOutcome> {
    const context = await getContext();
    const settings = await loadSettings(context.storeId);
    const supabase = await requireClient();
    const { data, error } = await supabase.rpc("redeem_reward", {
      p_store_id: context.storeId,
      p_member_id: memberId,
      p_reward_id: settings.rewardId,
      p_idempotency_key: idempotencyKey,
    });
    if (error) throw error;
    return mapRedeemOutcome(data, settings);
  },

  async reissueCard(memberId: string): Promise<IssuedCard | null> {
    const context = await getContext();
    const supabase = await requireClient();
    const { data, error } = await supabase.rpc("reissue_loyalty_id", {
      p_store_id: context.storeId,
      p_member_id: memberId,
      p_reason: "Lost or replaced card",
    });
    if (error) throw error;
    const payload = asRecord(data);
    if (payload.status !== "reissued") return null;
    return { member: memberOnly(mapMember(payload.member)), token: asString(payload.loyalty_id) };
  },

  async updateSettings(settings: ProgramSettings): Promise<ProgramSettings> {
    const supabase = await requireClient();
    const { data, error } = await supabase.rpc("update_program_settings", {
      p_store_id: settings.storeId,
      p_store_name: settings.storeName,
      p_timezone: settings.timezone,
      p_points_per_visit: settings.pointsPerVisit,
      p_duplicate_cooldown_minutes: settings.cooldownMinutes,
      p_reward_name: settings.rewardName,
      p_reward_cost: settings.rewardCost,
      p_reward_enabled: settings.rewardEnabled,
    });
    if (error) throw error;
    const payload = asRecord(data);
    if (payload.status !== "updated") throw new Error(messageForStatus(asString(payload.status)));
    return settings;
  },

  async updateStaff(staff: StaffMember[]): Promise<StaffMember[]> {
    return staff;
  },

  async inviteStaff(input: {
    displayName: string;
    email: string;
    role: "owner" | "staff";
  }): Promise<void> {
    const response = await fetch("/api/staff", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "invite",
        displayName: input.displayName,
        email: input.email,
        role: input.role,
      }),
    });
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { message?: string } | null;
      throw new Error(payload?.message ?? "Could not invite staff.");
    }
  },

  async setStaffActive(membershipId: string, active: boolean): Promise<void> {
    const response = await fetch("/api/staff", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "set_active", membershipId, active }),
    });
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { message?: string } | null;
      throw new Error(payload?.message ?? "Could not update staff access.");
    }
  },
};
