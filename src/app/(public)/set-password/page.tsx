import Link from "next/link";
import { KeyRound, ShieldCheck } from "lucide-react";
import { redirect } from "next/navigation";

import { BrandMark } from "@/components/app/brand-mark";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updatePasswordAction } from "@/lib/auth/actions";
import { getAuthState } from "@/lib/auth/server";
import { isDemoMode } from "@/lib/supabase/env";

const errors: Record<string, string> = {
  password_too_short: "Use at least 8 characters for the new password.",
  password_mismatch: "The two passwords do not match.",
  update_failed: "Supabase rejected this password. Check the project password rules and try another one.",
  service_unavailable: "Password setup is temporarily unavailable.",
};

export default async function SetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (isDemoMode()) {
    redirect("/scan");
  }

  const authState = await getAuthState();
  if (authState.status === "unauthenticated") {
    redirect("/login?next=/set-password");
  }
  if (authState.status === "inactive") {
    redirect("/login?error=inactive_staff");
  }
  if (authState.status === "unavailable") {
    throw new Error(`Authentication is temporarily unavailable (${authState.reason}).`);
  }

  const params = await searchParams;
  const errorCode = typeof params.error === "string" ? params.error : null;
  const error = errorCode ? errors[errorCode] ?? "The password could not be updated." : null;

  return (
    <main className="flex min-h-dvh items-center justify-center bg-muted/40 px-4 py-10">
      <div className="w-full max-w-md space-y-6">
        <Link href="/scan" className="mx-auto flex w-fit items-center gap-3">
          <BrandMark />
          <span className="text-xl font-bold">Loyalty Scan</span>
        </Link>
        <Card className="shadow-none">
          <CardHeader className="text-center">
            <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary"><KeyRound className="size-6" /></div>
            <CardTitle className="text-2xl">Set your staff password</CardTitle>
            <CardDescription>Finish accepting the invitation, then use this password for staff sign-in.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error ? (
              <Alert variant="destructive">
                <ShieldCheck />
                <AlertTitle>Password was not updated</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}
            <form action={updatePasswordAction} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">New password</Label>
                <Input id="new-password" name="password" type="password" autoComplete="new-password" minLength={8} required className="h-12" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm password</Label>
                <Input id="confirm-password" name="passwordConfirmation" type="password" autoComplete="new-password" minLength={8} required className="h-12" />
              </div>
              <Button type="submit" size="lg" className="h-12 w-full"><KeyRound />Save password and continue</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
