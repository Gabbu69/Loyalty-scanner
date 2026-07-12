import { NextResponse, type NextRequest } from "next/server";

import { safeNextPath } from "@/lib/auth/server";
import { isDemoMode } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

function redirectTo(request: NextRequest, path: string) {
  return NextResponse.redirect(new URL(path, request.nextUrl.origin));
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const nextPath = safeNextPath(request.nextUrl.searchParams.get("next"));

  if (isDemoMode()) {
    return redirectTo(request, nextPath);
  }

  if (!code) {
    return redirectTo(request, "/login?error=missing_auth_code");
  }

  const supabase = await createClient();
  if (!supabase) {
    return redirectTo(request, nextPath);
  }

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) {
    return redirectTo(request, "/login?error=auth_callback_failed");
  }

  const { data: membership, error: membershipError } = await supabase
    .from("staff_memberships")
    .select("is_active")
    .eq("user_id", data.user.id)
    .order("is_active", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (membershipError) {
    await supabase.auth.signOut();
    return redirectTo(request, "/login?error=service_unavailable");
  }

  if (!membership) {
    return redirectTo(request, "/setup");
  }

  if (membership.is_active !== true) {
    await supabase.auth.signOut();
    return redirectTo(request, "/login?error=inactive_staff");
  }

  return redirectTo(request, nextPath);
}
