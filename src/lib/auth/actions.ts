"use server";

import { redirect } from "next/navigation";

import { safeNextPath } from "@/lib/auth/server";
import { isDemoMode } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

function loginRedirect(error: string, nextPath: string): never {
  const params = new URLSearchParams({ error, next: nextPath });
  redirect(`/login?${params.toString()}`);
}

function setupRedirect(error: string): never {
  redirect(`/setup?error=${encodeURIComponent(error)}`);
}

function passwordRedirect(error: string): never {
  redirect(`/set-password?error=${encodeURIComponent(error)}`);
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
    await supabase.auth.signOut({ scope: "local" });
  }
  redirect("/");
}

export async function bootstrapStoreAction(formData: FormData): Promise<void> {
  if (isDemoMode()) {
    redirect("/scan");
  }

  const storeName = String(formData.get("storeName") ?? "").trim();
  const timezone = String(formData.get("timezone") ?? "Asia/Manila").trim();
  if (storeName.length < 2 || storeName.length > 120) {
    setupRedirect("invalid_store_name");
  }

  const supabase = await createClient();
  if (!supabase) {
    setupRedirect("missing_config");
  }

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    redirect("/login?next=/setup");
  }

  const { data, error } = await supabase.rpc("bootstrap_store", {
    p_store_name: storeName,
    p_timezone: timezone,
  });
  if (error) {
    setupRedirect("bootstrap_failed");
  }

  const payload = data && typeof data === "object" ? (data as Record<string, unknown>) : {};
  const status = typeof payload.status === "string" ? payload.status : "bootstrap_failed";
  if (status === "created" || status === "existing") {
    redirect("/scan");
  }

  setupRedirect(status);
}

export async function updatePasswordAction(formData: FormData): Promise<void> {
  if (isDemoMode()) {
    redirect("/scan");
  }

  const password = String(formData.get("password") ?? "");
  const confirmation = String(formData.get("passwordConfirmation") ?? "");
  if (password.length < 8) {
    passwordRedirect("password_too_short");
  }
  if (password !== confirmation) {
    passwordRedirect("password_mismatch");
  }

  const supabase = await createClient();
  if (!supabase) {
    passwordRedirect("service_unavailable");
  }

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    redirect("/login?next=/set-password");
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    passwordRedirect("update_failed");
  }

  redirect("/scan");
}
