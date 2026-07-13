import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

import { safeNextPath } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";

const emailOtpTypes: EmailOtpType[] = [
  "email",
  "invite",
  "magiclink",
  "recovery",
  "signup",
  "email_change",
];

function isEmailOtpType(value: string | null): value is EmailOtpType {
  return value !== null && emailOtpTypes.includes(value as EmailOtpType);
}

export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type");
  const fallback = type === "invite" || type === "recovery" ? "/set-password" : "/scan";
  const nextPath = safeNextPath(request.nextUrl.searchParams.get("next"), fallback);
  const supabase = await createClient();

  if (tokenHash && isEmailOtpType(type) && supabase) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      return NextResponse.redirect(new URL(nextPath, request.nextUrl.origin));
    }
  }

  return NextResponse.redirect(new URL("/login?error=auth_callback_failed", request.nextUrl.origin));
}
