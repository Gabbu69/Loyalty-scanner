"use client";

import Link from "next/link";
import {
  Ban,
  CheckCircle2,
  Gift,
  Keyboard,
  RotateCcw,
  ScanLine,
  Search,
  Sparkles,
  UserRoundPlus,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/app/page-header";
import { useLoyalty } from "@/components/app/loyalty-provider";
import { QrScanner } from "@/components/loyalty/qr-scanner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { AwardOutcome, RedeemOutcome, ResolvedMember } from "@/lib/data/types";
import { getErrorMessage } from "@/lib/errors";
import { displayPhone, formatDateTime } from "@/lib/format";
import { createIdempotencyKey } from "@/lib/loyalty/idempotency";

type CompletedAction =
  | { kind: "award"; outcome: Extract<AwardOutcome, { status: "awarded" }> }
  | { kind: "redeem"; outcome: Extract<RedeemOutcome, { status: "redeemed" }> };

function signalSuccess() {
  navigator.vibrate?.([80, 50, 120]);
  try {
    const context = new AudioContext();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.setValueAtTime(620, context.currentTime);
    oscillator.frequency.setValueAtTime(820, context.currentTime + 0.08);
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.08, context.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.18);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.2);
  } catch {
    // Optional feedback only.
  }
}

export function ScannerWorkspace() {
  const { snapshot, resolveToken, getMember, awardVisit, redeemReward } = useLoyalty();
  const [tab, setTab] = useState("camera");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<ResolvedMember | null>(null);
  const [selectedToken, setSelectedToken] = useState<string | null>(null);
  const [completed, setCompleted] = useState<CompletedAction | null>(null);
  const [cooldown, setCooldown] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  const matches = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return [];
    return (snapshot?.members ?? [])
      .filter((member) =>
        [member.fullName, member.memberCode, member.phone ?? "", member.maskedPhone ?? ""].some(
          (value) => value.toLowerCase().includes(normalized),
        ),
      )
      .slice(0, 6);
  }, [query, snapshot]);

  async function chooseMember(memberId: string) {
    setWorking(true);
    setError(null);
    setCooldown(null);
    setSelectedToken(null);
    try {
      const member = await getMember(memberId);
      setSelected(member);
      if (!member) setError("This customer could not be loaded.");
    } catch (error) {
      setSelected(null);
      setError(getErrorMessage(error, "This customer could not be loaded."));
    } finally {
      setWorking(false);
    }
  }

  async function detected(token: string) {
    setWorking(true);
    setError(null);
    setCooldown(null);
    try {
      const outcome = await resolveToken(token);
      if (outcome.status === "valid") {
        setSelected(outcome.member);
        setSelectedToken(token);
      } else {
        setSelected(null);
        setSelectedToken(null);
        setError(outcome.message);
      }
    } catch (error) {
      setSelected(null);
      setSelectedToken(null);
      setError(getErrorMessage(error, "This loyalty ID could not be checked."));
    } finally {
      setWorking(false);
    }
  }

  async function award() {
    if (!selected) return;
    setWorking(true);
    setError(null);
    try {
      const outcome = await awardVisit(selected.id, createIdempotencyKey(), selectedToken);
      if (outcome.status === "awarded") {
        setCompleted({ kind: "award", outcome });
        setSelected(null);
        setSelectedToken(null);
        signalSuccess();
        return;
      }
      if (outcome.status === "cooldown") {
        setCooldown(outcome.nextEligibleAt);
        setSelected(outcome.member);
        navigator.vibrate?.(180);
        return;
      }
      setError(outcome.message);
    } catch (error) {
      setError(getErrorMessage(error, "Visit points could not be added."));
    } finally {
      setWorking(false);
    }
  }

  async function redeem() {
    if (!selected) return;
    setWorking(true);
    setError(null);
    try {
      const outcome = await redeemReward(selected.id, createIdempotencyKey());
      if (outcome.status === "redeemed") {
        setCompleted({ kind: "redeem", outcome });
        setSelected(null);
        setSelectedToken(null);
        signalSuccess();
      } else if (outcome.status === "insufficient_points") {
        toast.error(`Customer needs ${outcome.required - outcome.current} more points.`);
      } else {
        setError(outcome.message);
      }
    } catch (error) {
      setError(getErrorMessage(error, "The reward could not be redeemed."));
    } finally {
      setWorking(false);
    }
  }

  function reset() {
    setSelected(null);
    setSelectedToken(null);
    setCompleted(null);
    setCooldown(null);
    setError(null);
    setQuery("");
  }

  if (completed) {
    const { outcome } = completed;
    const successTitle =
      completed.kind === "award"
        ? `+${completed.outcome.pointsAdded} point${
            completed.outcome.pointsAdded === 1 ? "" : "s"
          }`
        : "Reward redeemed";
    return (
      <div className="mx-auto flex min-h-[70dvh] max-w-xl items-center justify-center py-8">
        <Card className="w-full overflow-hidden border-emerald-200 shadow-lg shadow-emerald-950/5">
          <div className="bg-emerald-600 px-6 py-10 text-center text-white">
            <span className="mx-auto flex size-20 items-center justify-center rounded-full bg-white/15">
              <CheckCircle2 className="size-11" />
            </span>
            <p className="mt-5 text-sm font-semibold uppercase tracking-[0.2em] text-emerald-100">
              Success
            </p>
            <h1 className="mt-2 text-3xl font-black">{successTitle}</h1>
          </div>
          <CardContent className="space-y-6 p-6 text-center sm:p-8">
            <div>
              <p className="text-xl font-bold">{outcome.member.fullName}</p>
              <p className="mt-1 text-sm text-muted-foreground">{outcome.member.memberCode}</p>
            </div>
            <div className="rounded-2xl bg-muted p-5">
              <p className="text-sm font-medium text-muted-foreground">New balance</p>
              <p className="mt-1 text-5xl font-black text-primary">{outcome.newBalance}</p>
              <p className="text-sm text-muted-foreground">points</p>
            </div>
            {outcome.member.rewardAvailable ? (
              <Alert className="border-amber-200 bg-amber-50 text-left">
                <Gift className="text-amber-700" />
                <AlertTitle className="text-amber-950">Reward available</AlertTitle>
                <AlertDescription className="text-amber-900">
                  This customer can redeem {snapshot?.settings.rewardName}.
                </AlertDescription>
              </Alert>
            ) : null}
            <Button size="lg" className="h-14 w-full text-base" onClick={reset}>
              <ScanLine />
              Scan next customer
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Daily scanner"
        title="Scan a customer ID"
        description="Camera detection pauses before any points are added, so staff always confirm the correct customer."
        action={
          <Button variant="outline" asChild>
            <Link href="/customers/new">
              <UserRoundPlus />
              New customer
            </Link>
          </Button>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="overflow-hidden shadow-none">
          <Tabs
            value={tab}
            onValueChange={(value) => {
              setTab(value);
              reset();
            }}
          >
            <CardHeader className="pb-3">
              <TabsList className="grid h-12 w-full grid-cols-2">
                <TabsTrigger value="camera" className="gap-2">
                  <ScanLine />
                  Camera
                </TabsTrigger>
                <TabsTrigger value="manual" className="gap-2">
                  <Keyboard />
                  Manual lookup
                </TabsTrigger>
              </TabsList>
            </CardHeader>
            <CardContent className="pb-6">
              <TabsContent value="camera" className="mt-0">
                <QrScanner
                  onDetected={(token) => void detected(token)}
                  active={!selected && !working}
                  testToken={process.env.NEXT_PUBLIC_SCANNER_TEST_TOKEN}
                />
              </TabsContent>
              <TabsContent value="manual" className="mt-0 space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Name, phone, or member code"
                    className="h-12 pl-10 text-base"
                  />
                </div>
                <div className="divide-y rounded-xl border">
                  {matches.map((member) => (
                    <button
                      key={member.id}
                      type="button"
                      onClick={() => void chooseMember(member.id)}
                      className="flex min-h-16 w-full items-center gap-3 px-4 text-left hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                    >
                      <span className="flex size-9 items-center justify-center rounded-full bg-primary/10 font-semibold text-primary">
                        {member.fullName.slice(0, 1)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold">{member.fullName}</span>
                        <span className="block text-xs text-muted-foreground">
                          {member.memberCode} - {displayPhone(member)}
                        </span>
                      </span>
                      <span className="font-bold">{member.pointBalance} pts</span>
                    </button>
                  ))}
                  {query && matches.length === 0 ? (
                    <p className="p-6 text-center text-sm text-muted-foreground">
                      No customer found.
                    </p>
                  ) : null}
                </div>
              </TabsContent>
            </CardContent>
          </Tabs>
        </Card>

        <div className="space-y-4">
          {working ? (
            <Card className="shadow-none">
              <CardContent className="flex min-h-72 items-center justify-center p-8 text-center">
                <div>
                  <span className="mx-auto block size-8 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
                  <p className="mt-4 font-semibold">Checking loyalty ID...</p>
                </div>
              </CardContent>
            </Card>
          ) : selected ? (
            <Card className="border-primary/25 shadow-none">
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Badge variant={selected.eligible ? "secondary" : "outline"}>
                      {selected.eligible ? "Eligible now" : "Cooldown active"}
                    </Badge>
                    <CardTitle className="mt-3 text-2xl">{selected.fullName}</CardTitle>
                    <CardDescription>
                      {selected.memberCode} - {displayPhone(selected)}
                    </CardDescription>
                  </div>
                  <span className="text-right">
                    <span className="block text-4xl font-black text-primary">
                      {selected.pointBalance}
                    </span>
                    <span className="text-xs text-muted-foreground">points</span>
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {cooldown ? (
                  <Alert className="border-amber-200 bg-amber-50">
                    <Ban className="text-amber-700" />
                    <AlertTitle className="text-amber-950">Points not added</AlertTitle>
                    <AlertDescription className="text-amber-900">
                      This customer can earn again{" "}
                      {formatDateTime(cooldown, snapshot?.settings.timezone)}.
                    </AlertDescription>
                  </Alert>
                ) : null}
                <Button
                  size="lg"
                  className="h-14 w-full text-base"
                  disabled={!selected.eligible || working}
                  onClick={() => void award()}
                >
                  <Sparkles />
                  Add {snapshot?.settings.pointsPerVisit ?? 1} point
                  {snapshot?.settings.pointsPerVisit === 1 ? "" : "s"}
                </Button>
                {snapshot?.settings.rewardEnabled ? (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        size="lg"
                        variant="outline"
                        className="h-13 w-full"
                        disabled={!selected.rewardAvailable}
                      >
                        <Gift />
                        Redeem {snapshot.settings.rewardName}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Redeem this reward?</AlertDialogTitle>
                        <AlertDialogDescription>
                          {snapshot.settings.rewardCost} points will be deducted from{" "}
                          {selected.fullName}. This action is recorded in the audit trail.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => void redeem()}>
                          Confirm redemption
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                ) : null}
                <Button variant="ghost" className="w-full" onClick={reset}>
                  <RotateCcw />
                  Choose another customer
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-dashed shadow-none">
              <CardContent className="flex min-h-72 flex-col items-center justify-center p-8 text-center">
                <span className="rounded-2xl bg-primary/10 p-4 text-primary">
                  <ScanLine className="size-8" />
                </span>
                <h2 className="mt-4 text-lg font-semibold">Ready for a customer</h2>
                <p className="mt-1 max-w-sm text-sm leading-6 text-muted-foreground">
                  Scan their loyalty QR or use manual lookup. No points are added until you
                  confirm.
                </p>
              </CardContent>
            </Card>
          )}
          {error ? (
            <Alert variant="destructive">
              <Ban />
              <AlertTitle>Could not use this ID</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
        </div>
      </div>
    </div>
  );
}
