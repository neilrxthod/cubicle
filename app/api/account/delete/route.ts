import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isLocalDemoMode } from "@/lib/data/durability";
import {
  allowRate,
  clientKey,
  forbidden,
  isSameOriginRequest,
  requireAllowlistedStaff,
  tooMany,
} from "@/lib/security/api-guard";

/**
 * Self-service account deletion.
 * Removes the allowlist row (so the email cannot sign back in) and deletes
 * the Auth user. Profile and related rows cascade via FK.
 *
 * Local sandbox: no Supabase Auth user — the client deletes the local row.
 */
export async function POST(request: Request) {
  try {
    if (isLocalDemoMode()) {
      return NextResponse.json({ ok: true, local: true });
    }

    if (!isSameOriginRequest(request)) {
      return forbidden("Invalid origin.");
    }
    if (!allowRate(clientKey(request, "account-delete"), 3, 60 * 60 * 1000)) {
      return tooMany();
    }

    const staff = await requireAllowlistedStaff();
    if (!staff.ok) return staff.response;
    const user = { id: staff.actor.id, email: staff.actor.email };

    let admin;
    try {
      admin = createAdminClient();
    } catch {
      return NextResponse.json(
        {
          error:
            "Account deletion is not configured on this server. Contact school IT.",
        },
        { status: 503 },
      );
    }

    const email = user.email?.toLowerCase().trim();
    if (staff.actor.role === "admin") {
      const { count } = await admin
        .from("allowed_emails")
        .select("email", { count: "exact", head: true })
        .eq("role", "admin");
      if ((count ?? 0) <= 1) {
        return NextResponse.json(
          {
            error:
              "You are the last admin. Add another admin before deleting this account.",
          },
          { status: 400 },
        );
      }
    }
    if (email) {
      const { error: allowlistError } = await admin
        .from("allowed_emails")
        .delete()
        .eq("email", email);
      if (allowlistError) {
        console.error(
          "[account/delete] allowlist remove failed:",
          allowlistError.message,
        );
        return NextResponse.json(
          { error: "Could not remove school access. Try again or contact IT." },
          { status: 500 },
        );
      }
    }

    const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
    if (deleteError) {
      console.error(
        "[account/delete] auth delete failed:",
        deleteError.message,
      );
      return NextResponse.json(
        { error: deleteError.message || "Could not delete account." },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[account/delete] unexpected:", err);
    return NextResponse.json(
      { error: "Could not delete account." },
      { status: 500 },
    );
  }
}
