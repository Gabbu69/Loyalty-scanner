"use client";

import { AlertCircle, LoaderCircle, RefreshCw } from "lucide-react";
import type { ReactNode } from "react";

import { AppShell } from "@/components/app/app-shell";
import { LoyaltyProvider, useLoyalty } from "@/components/app/loyalty-provider";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
  const { mode, snapshot, loading, error, refresh } = useLoyalty();
  let content = children;

  if (loading && !snapshot) {
    content = (
      <Card className="shadow-none">
        <CardContent className="flex min-h-64 flex-col items-center justify-center gap-3 p-8 text-center text-muted-foreground">
          <LoaderCircle className="size-7 animate-spin text-primary" />
          <p>Loading loyalty data...</p>
        </CardContent>
      </Card>
    );
  } else if (error && !snapshot) {
    content = (
      <Alert variant="destructive">
        <AlertCircle />
        <AlertTitle>Loyalty data is unavailable</AlertTitle>
        <AlertDescription className="space-y-3">
          <p>{error}</p>
          <Button type="button" variant="outline" size="sm" onClick={() => void refresh()}>
            <RefreshCw />Try again
          </Button>
        </AlertDescription>
      </Alert>
    );
  } else if (error) {
    content = (
      <div className="space-y-4">
        <Alert variant="destructive">
          <AlertCircle />
          <AlertTitle>Some loyalty data may be out of date</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
        {children}
      </div>
    );
  }

  return (
    <AppShell
      demo={mode === "demo"}
      storeName={snapshot?.settings.storeName ?? "Loyalty Scan"}
      staffName={initialStaff.displayName}
      role={initialStaff.role}
    >
      {content}
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
