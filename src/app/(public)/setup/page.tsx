import Link from "next/link";
import { CheckCircle2, Database, KeyRound, Play, ShieldCheck } from "lucide-react";

import { BrandMark } from "@/components/app/brand-mark";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const steps = [
  { icon: Database, title: "Create a Supabase project", description: "Use a region near your store, then run the included migration from the Supabase SQL editor or CLI." },
  { icon: KeyRound, title: "Add the environment keys", description: "Copy the project URL and publishable key into your local and Vercel environment settings." },
  { icon: ShieldCheck, title: "Bootstrap the owner", description: "Create the first Auth user, sign in, then run the one-time store bootstrap flow." },
];

export default function SetupPage() {
  return (
    <main className="min-h-dvh bg-muted/40 px-4 py-8 sm:py-14">
      <div className="mx-auto max-w-3xl space-y-7">
        <div className="flex items-center gap-3"><BrandMark /><div><p className="text-xl font-bold">Loyalty Scan</p><p className="text-sm text-muted-foreground">First-time setup</p></div></div>
        <div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Connect production data</p><h1 className="mt-2 text-4xl font-black tracking-tight">Your system is ready to connect</h1><p className="mt-3 max-w-2xl text-base leading-7 text-muted-foreground">The interface works in local demo mode now. Complete these three steps to use secure staff accounts and persistent customer balances.</p></div>
        <Alert className="border-sky-200 bg-sky-50"><Play className="text-sky-700" /><AlertTitle className="text-sky-950">Want to explore first?</AlertTitle><AlertDescription className="text-sky-900">Demo mode stores sample data only in this browser. <Link href="/scan" className="font-semibold underline underline-offset-4">Open the demo scanner</Link>.</AlertDescription></Alert>
        <div className="grid gap-4">
          {steps.map((step, index) => <Card key={step.title} className="shadow-none"><CardContent className="flex gap-4 p-5"><span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 font-bold text-primary">{index + 1}</span><div><p className="flex items-center gap-2 font-semibold"><step.icon className="size-4 text-primary" />{step.title}</p><p className="mt-1 text-sm leading-6 text-muted-foreground">{step.description}</p></div></CardContent></Card>)}
        </div>
        <Card className="shadow-none"><CardHeader><CardTitle>Required environment values</CardTitle></CardHeader><CardContent className="space-y-2 font-mono text-sm"><p className="rounded-lg bg-muted px-3 py-2">NEXT_PUBLIC_SUPABASE_URL</p><p className="rounded-lg bg-muted px-3 py-2">NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</p><p className="rounded-lg bg-muted px-3 py-2">SUPABASE_SECRET_KEY <span className="font-sans text-xs text-muted-foreground">(server only, for staff invitations)</span></p></CardContent></Card>
        <div className="flex flex-col gap-3 sm:flex-row"><Button asChild size="lg"><Link href="/scan"><CheckCircle2 />Open demo app</Link></Button><Button asChild variant="outline" size="lg"><Link href="/login">Staff sign in</Link></Button></div>
      </div>
    </main>
  );
}
