"use client";

import Link from "next/link";
import { Ban, Gift, ScanLine, Sparkles, Users } from "lucide-react";

import { MetricCard } from "@/components/app/metric-card";
import { PageHeader } from "@/components/app/page-header";
import { useLoyalty } from "@/components/app/loyalty-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { activityLabel, formatRelative } from "@/lib/format";

export function DashboardOverview() {
  const { snapshot, summary } = useLoyalty();
  const recent = snapshot?.activity.slice(0, 6) ?? [];
  return (
    <div className="space-y-7">
      <PageHeader
        eyebrow="Owner dashboard"
        title="Store loyalty overview"
        description="See today's activity at a glance and catch duplicate attempts before they become a problem."
        action={<Button asChild><Link href="/scan"><ScanLine />Open scanner</Link></Button>}
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5" aria-label="Today's loyalty metrics">
        <MetricCard icon={Users} label="Active customers" value={summary?.activeMembers ?? "-"} detail="All time" />
        <MetricCard icon={ScanLine} label="Visits today" value={summary?.visitsToday ?? "-"} tone="positive" />
        <MetricCard icon={Sparkles} label="Points issued" value={summary?.pointsIssuedToday ?? "-"} tone="accent" />
        <MetricCard icon={Gift} label="Rewards redeemed" value={summary?.rewardsRedeemedToday ?? "-"} tone="positive" />
        <MetricCard icon={Ban} label="Duplicates blocked" value={summary?.blockedToday ?? "-"} tone="warning" />
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
        <Card className="shadow-none">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>Recent activity</CardTitle>
            <Button variant="ghost" size="sm" asChild><Link href="/activity">View all</Link></Button>
          </CardHeader>
          <CardContent className="space-y-1">
            {recent.map((item) => (
              <div key={item.id} className="flex items-center gap-3 rounded-xl px-2 py-3 hover:bg-muted/60">
                <span className="flex size-10 items-center justify-center rounded-full bg-muted font-semibold">
                  {item.memberName.slice(0, 1)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{item.memberName}</p>
                  <p className="truncate text-xs text-muted-foreground">{activityLabel(item.kind)} - {formatRelative(item.createdAt)}</p>
                </div>
                <span className={item.delta > 0 ? "font-bold text-emerald-700" : item.delta < 0 ? "font-bold text-sky-700" : "text-sm text-muted-foreground"}>
                  {item.delta > 0 ? "+" : ""}{item.delta || "-"}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-primary/20 bg-primary/[0.045] shadow-none">
          <CardHeader><CardTitle className="flex items-center gap-2"><Gift className="size-5 text-primary" />Current reward</CardTitle></CardHeader>
          <CardContent>
            {snapshot?.settings.rewardEnabled ? (
              <>
                <p className="text-2xl font-bold tracking-tight">{snapshot.settings.rewardName}</p>
                <p className="mt-2 text-sm text-muted-foreground">Customers can redeem this reward for</p>
                <p className="mt-1 text-4xl font-black text-primary">{snapshot.settings.rewardCost} <span className="text-base font-semibold">points</span></p>
                <Badge className="mt-5 bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Active</Badge>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Reward redemption is currently disabled.</p>
            )}
            <Button variant="outline" className="mt-6 w-full bg-background" asChild><Link href="/settings">Edit program</Link></Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
