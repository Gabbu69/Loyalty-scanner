import type { User } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { requireOwner } from "@/lib/auth/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

function badRequest(message: string, status = 400) {
  return NextResponse.json({ status: "error", message }, { status });
}

async function listAuthUsers(admin: NonNullable<ReturnType<typeof getSupabaseAdminClient>>) {
  const users: User[] = [];
  const perPage = 1_000;

  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    users.push(...data.users);
    if (data.users.length < perPage) break;
  }

  return users;
}

export async function GET() {
  const owner = await requireOwner("/staff");
  const admin = getSupabaseAdminClient();
  if (!admin) {
    return badRequest("Supabase admin key is not configured.", 503);
  }

  const [{ data: memberships, error: membershipError }, users] = await Promise.all([
    admin
      .from("staff_memberships")
      .select("id,user_id,role,is_active,created_at")
      .eq("store_id", owner.membership.storeId)
      .order("created_at", { ascending: true }),
    listAuthUsers(admin),
  ]);

  if (membershipError) {
    return badRequest(membershipError.message, 500);
  }

  const usersById = new Map(users.map((user) => [user.id, user]));
  const staff = (memberships ?? []).map((membership) => {
    const user = usersById.get(membership.user_id);
    const metadataName = user?.user_metadata?.display_name;
    const email = user?.email ?? membership.user_id;
    return {
      id: membership.id,
      isCurrent: membership.user_id === owner.user.id,
      displayName:
        typeof metadataName === "string" && metadataName.trim()
          ? metadataName.trim()
          : email.split("@")[0] || "Staff member",
      email,
      role: membership.role === "owner" ? "owner" : "staff",
      active: membership.is_active === true,
      createdAt: membership.created_at,
    };
  });

  return NextResponse.json({ status: "ok", staff });
}

export async function POST(request: Request) {
  const owner = await requireOwner("/staff");
  const admin = getSupabaseAdminClient();
  if (!admin) {
    return badRequest("Supabase admin key is not configured.", 503);
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body.action !== "string") {
    return badRequest("Invalid staff request.");
  }

  if (body.action === "invite") {
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const displayName =
      typeof body.displayName === "string" ? body.displayName.trim().slice(0, 120) : "";
    const role = body.role === "owner" ? "owner" : "staff";
    if (!displayName || !email || !email.includes("@")) {
      return badRequest("A display name and valid email are required.");
    }

    let user = (await listAuthUsers(admin)).find(
      (candidate) => candidate.email?.toLowerCase() === email,
    );
    let status = "linked";

    if (!user) {
      const callbackUrl = new URL("/auth/callback", request.url);
      callbackUrl.searchParams.set("next", "/set-password");
      const { data: invitation, error: inviteError } =
        await admin.auth.admin.inviteUserByEmail(email, {
          data: { display_name: displayName },
          redirectTo: callbackUrl.toString(),
        });
      if (inviteError || !invitation.user) {
        return badRequest(inviteError?.message ?? "Could not invite this staff member.", 409);
      }
      user = invitation.user;
      status = "invited";
    }

    const { error: profileError } = await admin.auth.admin.updateUserById(user.id, {
      user_metadata: { ...user.user_metadata, display_name: displayName },
    });
    if (profileError) {
      return badRequest(profileError.message, 409);
    }

    const { error: membershipError } = await admin.from("staff_memberships").upsert(
      {
        store_id: owner.membership.storeId,
        user_id: user.id,
        role,
        is_active: true,
        invited_by: owner.user.id,
      },
      { onConflict: "store_id,user_id" },
    );

    if (membershipError) {
      return badRequest(membershipError.message, 409);
    }

    return NextResponse.json({ status });
  }

  if (body.action === "set_active") {
    const membershipId =
      typeof body.membershipId === "string" ? body.membershipId.trim() : "";
    const active = body.active === true;
    if (!membershipId) {
      return badRequest("Staff membership is required.");
    }

    const { data, error } = await admin
      .from("staff_memberships")
      .update({ is_active: active })
      .eq("store_id", owner.membership.storeId)
      .eq("id", membershipId)
      .neq("user_id", owner.user.id)
      .select("id")
      .maybeSingle();

    if (error) {
      return badRequest(error.message, 409);
    }
    if (!data) {
      return badRequest("You cannot change your own owner access.", 409);
    }

    return NextResponse.json({ status: active ? "restored" : "deactivated" });
  }

  return badRequest("Unsupported staff action.");
}
