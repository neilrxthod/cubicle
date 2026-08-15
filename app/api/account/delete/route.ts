import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isLocalDemoMode } from "@/lib/data/durability";
import { createClient } from "@/lib/supabase/server";

/**
 * Self-service account deletion.
 * Removes the allowlist row (so the email cannot sign back in) and deletes
 * the Auth user. Profile and related rows cascade via FK.
 *
 * Local sandbox: no Supabase Auth user — the client deletes the local row.
 */
export async function POST() {
  try {
    if (isLocalDemoMode()) {
      return NextResponse.json({ ok: true, local: true });
    }

    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: "Sign in required." },
        { status: 401 },
      );
    }

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
