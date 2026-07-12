"use client";

import type { ReactNode } from "react";

import { AppShell } from "@/components/app/app-shell";
import { LoyaltyProvider, useLoyalty } from "@/components/app/loyalty-provider";
import type { StaffRole } from "@/lib/data/types";

type InitialStaff = {
  displayName: string;
  role: StaffRole;
};

function ConnectedShell({
  children,
  initialStaff,
}: {
  children: ReactNode;
  initialStaff: InitialStaff;
}) {
  const { mode, snapshot } = useLoyalty();
  return (
    <AppShell
      demo={mode === "demo"}
      storeName={snapshot?.settings.storeName ?? "Loyalty Scan"}
      staffName={initialStaff.displayName}
      role={initialStaff.role}
    >
      {children}
    </AppShell>
  );
}

export function RuntimeAppShell({
  children,
  initialStaff,
}: {
  children: ReactNode;
  initialStaff: InitialStaff;
}) {
  return (
    <LoyaltyProvider>
      <ConnectedShell initialStaff={initialStaff}>{children}</ConnectedShell>
    </LoyaltyProvider>
  );
}
