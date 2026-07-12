"use client";

import { ArrowLeft, Clock3, Gift, RefreshCw, Sparkles } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/app/page-header";
import { useLoyalty } from "@/components/app/loyalty-provider";
import { LoyaltyCard } from "@/components/loyalty/loyalty-card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { IssuedCard, ResolvedMember } from "@/lib/data/types";
import { activityLabel, displayPhone, formatDateTime } from "@/lib/format";
import { createIdempotencyKey } from "@/lib/loyalty/idempotency";

export function CustomerProfile({ memberId }: { memberId: string }) {
  const { snapshot, getMember, awardVisit, redeemReward, reissueCard } = useLoyalty();
  const [member, setMember] = useState<ResolvedMember | null>(null);
  const [issued, setIssued] = useState<IssuedCard | null>(null);
  const [working, setWorking] = useState(false);

  useEffect(() => {
    void getMember(memberId).then(setMember);
  }, [getMember, memberId, snapshot]);

  const activity = useMemo(() => (snapshot?.activity ?? []).filter((item) => item.memberId === memberId).slice(0, 8), [memberId, snapshot]);
  if (!member) return <Card className="shadow-none"><CardContent className="p-8 text-center text-muted-foreground">Loading customer...</CardContent></Card>;

  async function award() {
    if (!member) return;
    setWorking(true);
    const outcome = await awardVisit(member.id, createIdempotencyKey());
    setWorking(false);
    if (outcome.status === "awarded") { setMember(outcome.member); toast.success(`${outcome.pointsAdded} point${outcome.pointsAdded === 1 ? "" : "s"} added`); }
    else if (outcome.status === "cooldown") toast.warning("This customer is still inside the duplicate-scan cooldown.");
    else toast.error(outcome.message);
  }

  async function redeem() {
    if (!member) return;
    setWorking(true);
    const outcome = await redeemReward(member.id, createIdempotencyKey());
    setWorking(false);
    if (outcome.status === "redeemed") { setMember(outcome.member); toast.success("Reward redeemed"); }
    else if (outcome.status === "insufficient_points") toast.error(`Customer needs ${outcome.required - outcome.current} more points.`);
    else toast.error(outcome.message);
  }

  async function reissue() {
    if (!member) return;
    setWorking(true);
    const card = await reissueCard(member.id);
    setWorking(false);
    if (card) { setIssued(card); toast.success("Old card revoked; replacement ready"); }
  }

  const rewardCost = snapshot?.settings.rewardCost ?? 10;
  const rewardProgress = Math.min(100, (member.pointBalance / rewardCost) * 100);

  return (
    <div className="space-y-6">
      <PageHeader eyebrow={member.memberCode} title={member.fullName} description={member.createdAt ? `${displayPhone(member)} - Member since ${formatDateTime(member.createdAt, snapshot?.settings.timezone)}` : displayPhone(member)} action={<Button variant="outline" asChild><Link href="/customers"><ArrowLeft />Customers</Link></Button>} />
      <div className="grid gap-6 xl:grid-cols-[0.75fr_1.25fr]">
        <div className="space-y-5">
          <Card className="border-primary/20 bg-primary/[0.035] shadow-none"><CardContent className="p-6 text-center"><p className="text-sm font-semibold text-muted-foreground">Current balance</p><p className="mt-2 text-7xl font-black tracking-tight text-primary">{member.pointBalance}</p><p className="text-sm text-muted-foreground">loyalty points</p><div className="mt-6 space-y-2 text-left"><div className="flex justify-between text-xs"><span>Reward progress</span><span className="font-semibold">{Math.min(member.pointBalance, rewardCost)} / {rewardCost}</span></div><Progress value={rewardProgress} /></div>{member.rewardAvailable ? <Badge className="mt-5 bg-amber-100 text-amber-900 hover:bg-amber-100"><Gift />Reward ready</Badge> : null}</CardContent></Card>
          <Card className="shadow-none"><CardHeader><CardTitle>Customer actions</CardTitle></CardHeader><CardContent className="space-y-3"><AlertDialog><AlertDialogTrigger asChild><Button className="h-12 w-full" disabled={!member.eligible || working}><Sparkles />Add {snapshot?.settings.pointsPerVisit ?? 1} visit point</Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Add visit points?</AlertDialogTitle><AlertDialogDescription>The configured store rule will be applied and recorded under the signed-in staff account.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => void award()}>Confirm points</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>{!member.eligible && member.nextEligibleAt ? <p className="flex items-center gap-2 text-xs text-amber-700"><Clock3 className="size-3.5" />Eligible again {formatDateTime(member.nextEligibleAt, snapshot?.settings.timezone)}</p> : null}<AlertDialog><AlertDialogTrigger asChild><Button variant="outline" className="h-12 w-full" disabled={!member.rewardAvailable || working}><Gift />Redeem reward</Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Redeem {snapshot?.settings.rewardName}?</AlertDialogTitle><AlertDialogDescription>{rewardCost} points will be deducted. The ledger entry cannot be edited afterward.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => void redeem()}>Redeem reward</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog><AlertDialog><AlertDialogTrigger asChild><Button variant="ghost" className="h-11 w-full"><RefreshCw />Replace lost card</Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Replace this loyalty card?</AlertDialogTitle><AlertDialogDescription>The current QR will stop working immediately. Share or print the replacement before closing it.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => void reissue()}>Revoke and replace</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></CardContent></Card>
        </div>
        <Card className="shadow-none"><CardHeader><CardTitle>Recent customer activity</CardTitle></CardHeader><CardContent className="divide-y p-0">{activity.length ? activity.map((item) => <div key={item.id} className="flex items-center gap-3 px-6 py-4"><span className={`size-2.5 rounded-full ${item.status === "blocked" ? "bg-amber-500" : item.delta < 0 ? "bg-sky-500" : "bg-emerald-500"}`} /><div className="min-w-0 flex-1"><p className="font-medium">{activityLabel(item.kind)}</p><p className="text-xs text-muted-foreground">{formatDateTime(item.createdAt, snapshot?.settings.timezone)} - {item.staffName}</p></div><div className="text-right"><p className="font-bold">{item.delta > 0 ? "+" : ""}{item.delta}</p><p className="text-xs text-muted-foreground">Bal. {item.balanceAfter}</p></div></div>) : <p className="p-8 text-center text-sm text-muted-foreground">No activity yet.</p>}</CardContent></Card>
      </div>
      {issued ? <div className="mx-auto max-w-3xl"><LoyaltyCard issuedCard={issued} storeName={snapshot?.settings.storeName ?? "Loyalty Scan"} /></div> : null}
    </div>
  );
}
