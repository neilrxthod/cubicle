import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Permanently purge a *revoked* staff member from the directory.
 * Requires admin. Target must not be on the allowlist (already removed access).
 * Deletes Auth user → profile cascades (and related FK rows).
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      userId?: string;
    };
    const userId = typeof body.userId === "string" ? body.userId.trim() : "";
    if (!userId || !UUID_RE.test(userId)) {
      return NextResponse.json(
        { error: "Invalid staff id." },
        { status: 400 },
      );
    }

    const supabase = await createClient();
    const {
      data: { user: actor },
      error: actorError,
    } = await supabase.auth.getUser();

    if (actorError || !actor) {
      return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    }

    const { data: actorProfile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", actor.id)
      .maybeSingle();

    if (actorProfile?.role !== "admin") {
      return NextResponse.json({ error: "Admin only." }, { status: 403 });
    }

    if (userId === actor.id) {
      return NextResponse.json(
        { error: "You cannot delete your own account here." },
        { status: 400 },
      );
    }

    let admin;
    try {
      admin = createAdminClient();
    } catch {
      return NextResponse.json(
        {
          error:
            "Permanent delete is not configured on this server. Contact school IT.",
        },
        { status: 503 },
      );
    }

    const { data: target, error: targetError } = await admin
      .from("profiles")
      .select("id, email, name")
      .eq("id", userId)
      .maybeSingle();

    if (targetError) {
      console.error("[staff/purge] profile load failed:", targetError.message);
      return NextResponse.json(
        { error: "Could not load staff member." },
        { status: 500 },
      );
    }
    if (!target) {
      return NextResponse.json(
        { error: "Staff member not found." },
        { status: 404 },
      );
    }

    const email =
      typeof target.email === "string"
        ? target.email.toLowerCase().trim()
        : "";

    // Only purge people who are already off the allowlist (revoked).
    if (email) {
      const { data: allowed } = await admin
        .from("allowed_emails")
        .select("email")
        .eq("email", email)
        .maybeSingle();
      if (allowed) {
        return NextResponse.json(
          {
            error:
              "Remove access first. Only revoked accounts can be deleted permanently.",
          },
          { status: 400 },
        );
      }
    }

    // Belt-and-suspenders: clear allowlist if a row still exists under another case.
    if (email) {
      await admin.from("allowed_emails").delete().eq("email", email);
    }

    const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
    if (deleteError) {
      console.error("[staff/purge] auth delete failed:", deleteError.message);
      // Profile-only cleanup if auth user already gone.
      const { error: profileDeleteError } = await admin
        .from("profiles")
        .delete()
        .eq("id", userId);
      if (profileDeleteError) {
        return NextResponse.json(
          { error: deleteError.message || "Could not delete account." },
          { status: 500 },
        );
      }
    }

    return NextResponse.json({
      ok: true,
      name: typeof target.name === "string" ? target.name : undefined,
    });
  } catch (err) {
    console.error("[staff/purge] unexpected:", err);
    return NextResponse.json(
      { error: "Could not delete staff member." },
      { status: 500 },
    );
  }
}
