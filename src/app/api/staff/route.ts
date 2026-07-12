import { NextResponse } from "next/server";

import { requireOwner } from "@/lib/auth/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

function badRequest(message: string, status = 400) {
  return NextResponse.json({ status: "error", message }, { status });
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
    const role = body.role === "owner" ? "owner" : "staff";
    if (!email || !email.includes("@")) {
      return badRequest("A valid email is required.");
    }

    const { data: invitation, error: inviteError } =
      await admin.auth.admin.inviteUserByEmail(email);
    if (inviteError || !invitation.user) {
      return badRequest(inviteError?.message ?? "Could not invite this staff member.", 409);
    }

    const { error: membershipError } = await admin.from("staff_memberships").upsert(
      {
        store_id: owner.membership.storeId,
        user_id: invitation.user.id,
        role,
        is_active: true,
        invited_by: owner.user.id,
      },
      { onConflict: "store_id,user_id" },
    );

    if (membershipError) {
      return badRequest(membershipError.message, 409);
    }

    return NextResponse.json({ status: "invited" });
  }

  if (body.action === "set_active") {
    const membershipId =
      typeof body.membershipId === "string" ? body.membershipId.trim() : "";
    const active = body.active === true;
    if (!membershipId) {
      return badRequest("Staff membership is required.");
    }

    const { error } = await admin
      .from("staff_memberships")
      .update({ is_active: active })
      .eq("store_id", owner.membership.storeId)
      .eq("id", membershipId)
      .neq("user_id", owner.user.id);

    if (error) {
      return badRequest(error.message, 409);
    }

    return NextResponse.json({ status: active ? "restored" : "deactivated" });
  }

  return badRequest("Unsupported staff action.");
}
