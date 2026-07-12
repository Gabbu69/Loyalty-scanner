"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { demoStore } from "@/lib/data/demo-store";
import { productionStore } from "@/lib/data/production-store";
import { getSupabasePublicConfig } from "@/lib/supabase/env";
import type {
  AwardOutcome,
  DashboardSummary,
  IssuedCard,
  LoyaltySnapshot,
  ProgramSettings,
  RedeemOutcome,
  ResolvedMember,
  ResolveOutcome,
  StaffMember,
} from "@/lib/data/types";

type LoyaltyContextValue = {
  mode: "demo" | "production";
  loading: boolean;
  snapshot: LoyaltySnapshot | null;
  summary: DashboardSummary | null;
  refresh: () => Promise<void>;
  resetDemo: () => Promise<void>;
  resolveToken: (token: string) => Promise<ResolveOutcome>;
  getMember: (memberId: string) => Promise<ResolvedMember | null>;
  createMember: (input: { fullName: string; phone?: string | null }) => Promise<IssuedCard>;
  awardVisit: (
    memberId: string,
    idempotencyKey: string,
    loyaltyToken?: string | null,
  ) => Promise<AwardOutcome>;
  redeemReward: (memberId: string, idempotencyKey: string) => Promise<RedeemOutcome>;
  reissueCard: (memberId: string) => Promise<IssuedCard | null>;
  updateSettings: (settings: ProgramSettings) => Promise<ProgramSettings>;
  updateStaff: (staff: StaffMember[]) => Promise<StaffMember[]>;
};

const LoyaltyContext = createContext<LoyaltyContextValue | null>(null);

export function LoyaltyProvider({ children }: { children: ReactNode }) {
  const mode = getSupabasePublicConfig() ? "production" : "demo";
  const [snapshot, setSnapshot] = useState<LoyaltySnapshot | null>(null);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      if (mode === "production") {
        const next = await productionStore.snapshot();
        setSnapshot(next.snapshot);
        setSummary(next.summary);
      } else {
        setSnapshot(demoStore.snapshot());
        setSummary(demoStore.dashboard());
      }
    } finally {
      setLoading(false);
    }
  }, [mode]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo<LoyaltyContextValue>(
    () => ({
      mode,
      loading,
      snapshot,
      summary,
      refresh,
      async resetDemo() {
        demoStore.reset();
        await refresh();
      },
      async resolveToken(token) {
        return mode === "production"
          ? productionStore.resolveToken(token)
          : demoStore.resolveToken(token);
      },
      async getMember(memberId) {
        return mode === "production"
          ? productionStore.getMember(memberId)
          : demoStore.getMember(memberId);
      },
      async createMember(input) {
        const card =
          mode === "production"
            ? await productionStore.createMember(input)
            : demoStore.createMember(input);
        await refresh();
        return card;
      },
      async awardVisit(memberId, idempotencyKey, loyaltyToken) {
        const outcome =
          mode === "production"
            ? await productionStore.awardVisit(memberId, idempotencyKey, loyaltyToken)
            : demoStore.awardVisit(memberId, idempotencyKey);
        await refresh();
        return outcome;
      },
      async redeemReward(memberId, idempotencyKey) {
        const outcome =
          mode === "production"
            ? await productionStore.redeemReward(memberId, idempotencyKey)
            : demoStore.redeemReward(memberId, idempotencyKey);
        await refresh();
        return outcome;
      },
      async reissueCard(memberId) {
        const card =
          mode === "production"
            ? await productionStore.reissueCard(memberId)
            : demoStore.reissueCard(memberId);
        await refresh();
        return card;
      },
      async updateSettings(settings) {
        const next =
          mode === "production"
            ? await productionStore.updateSettings(settings)
            : demoStore.updateSettings(settings);
        await refresh();
        return next;
      },
      async updateStaff(staff) {
        if (mode === "production") {
          const current = snapshot?.staff ?? [];
          const added = staff.find((item) => !current.some((existing) => existing.id === item.id));
          const changed = staff.find((item) => {
            const existing = current.find((candidate) => candidate.id === item.id);
            return existing && existing.active !== item.active;
          });

          if (added) {
            await productionStore.inviteStaff({
              displayName: added.displayName,
              email: added.email,
              role: added.role,
            });
          } else if (changed) {
            await productionStore.setStaffActive(changed.id, changed.active);
          }

          await refresh();
          return staff;
        }

        const next = demoStore.updateStaff(staff);
        await refresh();
        return next;
      },
    }),
    [loading, mode, refresh, snapshot, summary],
  );

  return <LoyaltyContext.Provider value={value}>{children}</LoyaltyContext.Provider>;
}

export function useLoyalty() {
  const context = useContext(LoyaltyContext);
  if (!context) {
    throw new Error("useLoyalty must be used inside LoyaltyProvider");
  }
  return context;
}
