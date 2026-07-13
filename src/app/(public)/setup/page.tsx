import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2, Database, KeyRound, Play, ShieldCheck, Store } from "lucide-react";

import { BrandMark } from "@/components/app/brand-mark";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { bootstrapStoreAction } from "@/lib/auth/actions";
import { getAuthState } from "@/lib/auth/server";
import { isDemoMode } from "@/lib/supabase/env";

const errors: Record<string, string> = {
  invalid_store_name: "Enter a store name between 2 and 120 characters.",
  invalid_timezone: "Choose a valid reporting timezone.",
  missing_config: "Supabase environment values are incomplete.",
  bootstrap_failed: "The store could not be created. Confirm that the database migration was applied, then try again.",
  forbidden: "Your sign-in expired. Sign in again before creating the store.",
};

const steps = [
  {
    icon: Database,
    title: "Create a Supabase project",
    description: "Use a region near your store, then run the included migrations from the Supabase SQL editor or CLI.",
  },
  {
    icon: KeyRound,
    title: "Add the environment keys",
    description: "Copy the project URL, publishable key, and server-only secret key into your local and Vercel environment settings.",
  },
  {
    icon: ShieldCheck,
    title: "Configure staff invitation links",
    description: "In the Supabase Invite user email template, link to /auth/confirm with TokenHash, type=invite, and next=/set-password.",
  },
  {
    icon: Store,
    title: "Create the first owner store",
    description: "Create the first Auth user in Supabase, sign in here, then use the form below to create the store and owner membership.",
  },
];

export default async function SetupPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const errorCode = typeof params.error === "string" ? params.error : null;
  const error = errorCode ? errors[errorCode] ?? "Setup could not be completed. Try again." : null;
  const demo = isDemoMode();
  const authState = demo ? null : await getAuthState();

  if (authState?.status === "authenticated") {
    redirect("/scan");
  }

  const canBootstrap = authState?.status === "unregistered";

  return (
    <main className="min-h-dvh bg-muted/40 px-4 py-8 sm:py-14">
      <div className="mx-auto max-w-3xl space-y-7">
        <div className="flex items-center gap-3">
          <BrandMark />
          <div>
            <p className="text-xl font-bold">Loyalty Scan</p>
            <p className="text-sm text-muted-foreground">First-time setup</p>
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Connect production data</p>
          <h1 className="mt-2 text-4xl font-black tracking-tight">Finish your store setup</h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-muted-foreground">
            Demo mode is ready immediately. Production mode adds secure staff accounts, persistent balances, and database-backed audit history.
          </p>
        </div>

        {error ? (
          <Alert variant="destructive">
            <ShieldCheck />
            <AlertTitle>Setup could not be completed</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {demo ? (
          <Alert className="border-sky-200 bg-sky-50">
            <Play className="text-sky-700" />
            <AlertTitle className="text-sky-950">Demo mode is active</AlertTitle>
            <AlertDescription className="text-sky-900">
              Sample data stays only in this browser. <Link href="/scan" className="font-semibold underline underline-offset-4">Open the demo scanner</Link>.
            </AlertDescription>
          </Alert>
        ) : authState?.status === "unauthenticated" ? (
          <Alert className="border-amber-200 bg-amber-50">
            <KeyRound className="text-amber-700" />
            <AlertTitle className="text-amber-950">Sign in as the first owner</AlertTitle>
            <AlertDescription className="text-amber-900">After signing in, you will return here to create the store.</AlertDescription>
          </Alert>
        ) : authState?.status === "inactive" ? (
          <Alert variant="destructive">
            <ShieldCheck />
            <AlertTitle>This account is inactive</AlertTitle>
            <AlertDescription>Ask another owner to restore this staff membership.</AlertDescription>
          </Alert>
        ) : authState?.status === "unavailable" ? (
          <Alert variant="destructive">
            <Database />
            <AlertTitle>Supabase is unavailable</AlertTitle>
            <AlertDescription>Confirm the environment values and database migration, then reload this page.</AlertDescription>
          </Alert>
        ) : null}

        {canBootstrap ? (
          <Card className="border-primary/25 shadow-none">
            <CardHeader>
              <CardTitle>Create your store</CardTitle>
            </CardHeader>
            <CardContent>
              <form action={bootstrapStoreAction} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="store-name">Store name</Label>
                  <Input id="store-name" name="storeName" maxLength={120} placeholder="e.g. Gabbu Cafe" required className="h-12" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="setup-timezone">Reporting timezone</Label>
                  <select id="setup-timezone" name="timezone" defaultValue="Asia/Manila" className="h-12 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50">
                    <option value="Asia/Manila">Asia/Manila</option>
                    <option value="Asia/Singapore">Asia/Singapore</option>
                    <option value="UTC">UTC</option>
                  </select>
                </div>
                <Button type="submit" size="lg" className="h-12 w-full">
                  <Store />
                  Create store and owner access
                </Button>
              </form>
            </CardContent>
          </Card>
        ) : null}

        <div className="grid gap-4">
          {steps.map((step, index) => (
            <Card key={step.title} className="shadow-none">
              <CardContent className="flex gap-4 p-5">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 font-bold text-primary">{index + 1}</span>
                <div>
                  <p className="flex items-center gap-2 font-semibold"><step.icon className="size-4 text-primary" />{step.title}</p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">{step.description}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="shadow-none">
          <CardHeader><CardTitle>Required environment values</CardTitle></CardHeader>
          <CardContent className="space-y-2 font-mono text-sm">
            <p className="rounded-lg bg-muted px-3 py-2">NEXT_PUBLIC_SUPABASE_URL</p>
            <p className="rounded-lg bg-muted px-3 py-2">NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</p>
            <p className="rounded-lg bg-muted px-3 py-2">SUPABASE_SECRET_KEY <span className="font-sans text-xs text-muted-foreground">(server only, for staff invitations)</span></p>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-3 sm:flex-row">
          {demo ? (
            <Button asChild size="lg"><Link href="/scan"><CheckCircle2 />Open demo app</Link></Button>
          ) : authState?.status === "unauthenticated" ? (
            <Button asChild size="lg"><Link href="/login?next=/setup"><KeyRound />Sign in as owner</Link></Button>
          ) : null}
          <Button asChild variant="outline" size="lg"><Link href="/login">Staff sign in</Link></Button>
        </div>
      </div>
    </main>
  );
}
