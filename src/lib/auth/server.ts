import "server-only";

import { redirect } from "next/navigation";

import type {
  AuthState,
  AuthUser,
  StaffIdentity,
  StaffMembership,
  StaffRole,
} from "@/lib/auth/types";
import { isDemoMode } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

const MEMBERSHIP_COLUMNS =
  "id,store_id,user_id,role,is_active,invited_by,created_at,updated_at,deactivated_at";

const DEMO_STAFF: StaffIdentity = {
  mode: "demo",
  user: {
    id: "demo-owner",
    email: "owner@example.com",
    phone: null,
  },
  membership: {
    id: "demo-owner-membership",
    storeId: "demo-store",
    userId: "demo-owner",
    role: "owner",
    isActive: true,
    invitedBy: null,
    createdAt: "1970-01-01T00:00:00.000Z",
    updatedAt: "1970-01-01T00:00:00.000Z",
    deactivatedAt: null,
  },
  isOwner: true,
};

function isRole(value: unknown): value is StaffRole {
  return value === "owner" || value === "staff";
}

function asNullableString(value: unknown) {
  return typeof value === "string" ? value : null;
}

function normalizeMembership(row: unknown): StaffMembership | null {
  if (!row || typeof row !== "object") {
    return null;
  }

  const value = row as Record<string, unknown>;
  if (
    typeof value.id !== "string" ||
    typeof value.store_id !== "string" ||
    typeof value.user_id !== "string" ||
    !isRole(value.role) ||
    typeof value.is_active !== "boolean" ||
    typeof value.created_at !== "string" ||
    typeof value.updated_at !== "string"
  ) {
    return null;
  }

  return {
    id: value.id,
    storeId: value.store_id,
    userId: value.user_id,
    role: value.role,
    isActive: value.is_active,
    invitedBy: asNullableString(value.invited_by),
    createdAt: value.created_at,
    updatedAt: value.updated_at,
    deactivatedAt: asNullableString(value.deactivated_at),
  };
}

function normalizeUser(user: { id: string; email?: string; phone?: string }): AuthUser {
  return {
    id: user.id,
    email: user.email ?? null,
    phone: user.phone ?? null,
  };
}

export function safeNextPath(value: FormDataEntryValue | string | null, fallback = "/scan") {
  if (typeof value !== "string") {
    return fallback;
  }

  const path = value.trim();
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\")) {
    return fallback;
  }

  return path;
}

/**
 * Revalidates the Auth user with Supabase, then reads authorization from the
 * database. User-editable metadata is never used for staff or owner access.
 */
export async function getAuthState(): Promise<AuthState> {
  if (isDemoMode()) {
    return { status: "authenticated", staff: DEMO_STAFF };
  }

  const supabase = await createClient();
  if (!supabase) {
    return { status: "authenticated", staff: DEMO_STAFF };
  }

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (!userData.user) {
    return {
      status: "unauthenticated",
      reason: userError ? "invalid_session" : "missing_session",
    };
  }

  const user = normalizeUser(userData.user);
  const { data: row, error: membershipError } = await supabase
    .from("staff_memberships")
    .select(MEMBERSHIP_COLUMNS)
    .eq("user_id", user.id)
    .order("is_active", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (membershipError) {
    return { status: "unavailable", reason: "staff_membership_lookup_failed" };
  }

  if (!row) {
    return { status: "unregistered", user };
  }

  const membership = normalizeMembership(row);
  if (!membership || membership.userId !== user.id) {
    return { status: "unavailable", reason: "invalid_staff_membership" };
  }

  if (!membership.isActive) {
    return { status: "inactive", user, membership };
  }

  return {
    status: "authenticated",
    staff: {
      mode: "supabase",
      user,
      membership,
      isOwner: membership.role === "owner",
    },
  };
}

export async function getCurrentStaff(): Promise<StaffIdentity | null> {
  const state = await getAuthState();
  return state.status === "authenticated" ? state.staff : null;
}

export async function requireStaff(nextPath = "/scan"): Promise<StaffIdentity> {
  const state = await getAuthState();

  if (state.status === "authenticated") {
    return state.staff;
  }

  if (state.status === "unregistered") {
    redirect("/setup");
  }

  if (state.status === "inactive") {
    redirect("/login?error=inactive_staff");
  }

  if (state.status === "unavailable") {
    throw new Error(`Authentication is temporarily unavailable (${state.reason}).`);
  }

  redirect(`/login?next=${encodeURIComponent(safeNextPath(nextPath))}`);
}

export async function requireOwner(nextPath = "/dashboard"): Promise<StaffIdentity> {
  const staff = await requireStaff(nextPath);
  if (!staff.isOwner) {
    redirect("/scan?error=owner_required");
  }
  return staff;
}
