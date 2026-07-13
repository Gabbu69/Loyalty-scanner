export type StaffRole = "owner" | "staff";

export type MemberStatus = "active" | "archived";

export type Member = {
  id: string;
  memberCode: string;
  fullName: string;
  phone: string | null;
  maskedPhone?: string | null;
  pointBalance: number;
  status: MemberStatus;
  createdAt: string;
  updatedAt: string;
};

export type ResolvedMember = Member & {
  eligible: boolean;
  nextEligibleAt: string | null;
  rewardAvailable: boolean;
};

export type ProgramSettings = {
  storeId: string;
  storeName: string;
  timezone: string;
  pointsPerVisit: number;
  cooldownMinutes: number;
  rewardEnabled: boolean;
  rewardId: string;
  rewardName: string;
  rewardCost: number;
};

export type ActivityKind =
  | "earn"
  | "redeem"
  | "adjustment"
  | "reversal"
  | "blocked"
  | "reissue";

export type ActivityItem = {
  id: string;
  memberId: string;
  memberName: string;
  memberCode: string;
  kind: ActivityKind;
  delta: number;
  balanceAfter: number;
  staffName: string;
  reason: string | null;
  status: "accepted" | "blocked";
  createdAt: string;
  idempotencyKey: string;
  reversesTransactionId?: string | null;
};

export type StaffMember = {
  id: string;
  isCurrent?: boolean;
  displayName: string;
  email: string;
  role: StaffRole;
  active: boolean;
  createdAt: string;
};

export type DashboardSummary = {
  activeMembers: number;
  visitsToday: number;
  pointsIssuedToday: number;
  rewardsRedeemedToday: number;
  blockedToday: number;
};

export type ResolveOutcome =
  | { status: "valid"; member: ResolvedMember }
  | { status: "invalid" | "revoked" | "forbidden"; message: string };

export type AwardOutcome =
  | {
      status: "awarded";
      pointsAdded: number;
      newBalance: number;
      member: ResolvedMember;
      transactionId: string;
    }
  | {
      status: "cooldown";
      nextEligibleAt: string;
      member: ResolvedMember;
    }
  | { status: "invalid" | "revoked" | "forbidden"; message: string };

export type RedeemOutcome =
  | {
      status: "redeemed";
      pointsSpent: number;
      newBalance: number;
      member: ResolvedMember;
      transactionId: string;
    }
  | {
      status: "insufficient_points";
      required: number;
      current: number;
      member: ResolvedMember;
    }
  | { status: "forbidden" | "invalid"; message: string };

export type IssuedCard = {
  member: Member;
  token: string;
};

export type LoyaltySnapshot = {
  settings: ProgramSettings;
  members: Member[];
  activity: ActivityItem[];
  staff: StaffMember[];
};
