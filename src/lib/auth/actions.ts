"use server";

import { redirect } from "next/navigation";

import { safeNextPath } from "@/lib/auth/server";
import { isDemoMode } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

function loginRedirect(error: string, nextPath: string): never {
  const params = new URLSearchParams({ error, next: nextPath });
  redirect(`/login?${params.toString()}`);
}

export async function signInWithPasswordAction(formData: FormData): Promise<void> {
  const nextPath = safeNextPath(formData.get("next"));

  if (isDemoMode()) {
    redirect(nextPath);
  }

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) {
    loginRedirect("missing_credentials", nextPath);
  }

  const supabase = await createClient();
  if (!supabase) {
    redirect(nextPath);
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    loginRedirect("invalid_credentials", nextPath);
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
    loginRedirect("service_unavailable", nextPath);
  }

  if (!membership) {
    redirect("/setup");
  }

  if (membership.is_active !== true) {
    await supabase.auth.signOut();
    loginRedirect("inactive_staff", nextPath);
  }

  redirect(nextPath);
}

export async function signOutAction(): Promise<void> {
  const supabase = await createClient();
  if (supabase) {
    await supabase.auth.signOut();
  }
  redirect("/");
}
