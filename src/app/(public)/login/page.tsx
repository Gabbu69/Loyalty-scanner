import Link from "next/link";
import { KeyRound, ScanLine, ShieldCheck } from "lucide-react";

import { BrandMark } from "@/components/app/brand-mark";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signInWithPasswordAction } from "@/lib/auth/actions";
import { safeNextPath } from "@/lib/auth/server";
import { isDemoMode } from "@/lib/supabase/env";

const errors: Record<string, string> = {
  missing_credentials: "Enter your email and password.",
  invalid_credentials: "That email or password did not match.",
  inactive_staff: "This staff account has been deactivated.",
  service_unavailable: "Sign-in is temporarily unavailable. Try again shortly.",
  missing_auth_code: "This sign-in link is incomplete or expired.",
  auth_callback_failed: "This sign-in or invitation link is invalid or expired. Ask an owner to send a new invitation.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const next = safeNextPath(typeof params.next === "string" ? params.next : null);
  const error = typeof params.error === "string" ? errors[params.error] : null;
  const demo = isDemoMode();

  return (
    <main className="flex min-h-dvh items-center justify-center bg-muted/40 px-4 py-10">
      <div className="w-full max-w-md space-y-6">
        <Link href="/scan" className="mx-auto flex w-fit items-center gap-3">
          <BrandMark />
          <span className="text-xl font-bold">Loyalty Scan</span>
        </Link>

        <Card className="shadow-none">
          <CardHeader className="text-center">
            <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <KeyRound className="size-6" />
            </div>
            <CardTitle className="text-2xl">Staff sign in</CardTitle>
            <CardDescription>
              Use your individual staff account before scanning or changing points.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error ? (
              <Alert variant="destructive">
                <ShieldCheck />
                <AlertTitle>Could not sign in</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}
            {demo ? (
              <Alert className="border-amber-200 bg-amber-50">
                <ScanLine className="text-amber-700" />
                <AlertTitle className="text-amber-950">Demo mode is active</AlertTitle>
                <AlertDescription className="text-amber-900">
                  Supabase is not connected yet, so you can open the scanner without a password.
                </AlertDescription>
              </Alert>
            ) : null}
            <form action={signInWithPasswordAction} className="space-y-4">
              <input type="hidden" name="next" value={next} />
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  className="h-12"
                  required={!demo}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  className="h-12"
                  required={!demo}
                />
              </div>
              <Button type="submit" size="lg" className="h-12 w-full">
                {demo ? "Open demo scanner" : "Sign in"}
              </Button>
            </form>
            <Button variant="outline" className="w-full" asChild>
              <Link href="/setup">Setup guide</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
