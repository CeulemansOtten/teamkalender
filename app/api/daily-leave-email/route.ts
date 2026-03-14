import { NextResponse } from "next/server";
import { Resend } from "resend";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { buildDailyLeaveEmail, formatBrusselsDate } from "@/lib/dailyLeaveEmail";

export const runtime = "nodejs";

const TO_EMAIL = "info@apotheekgeneraal.be";

function getSecretFromRequest(req: Request) {
  const url = new URL(req.url);
  return url.searchParams.get("secret") || "";
}

function getLeaveIdFromRequest(req: Request) {
  const url = new URL(req.url);
  return url.searchParams.get("leave_id") || "";
}

export async function GET(req: Request) {
  const expected = process.env.CRON_SECRET || "";
  const got = getSecretFromRequest(req);

  // Auth via ?secret parameter
  if (!expected) return NextResponse.json({ error: "Missing CRON_SECRET" }, { status: 500 });
  if (!got || got !== expected) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Get the specific leave_id to send notification for
  const leaveId = getLeaveIdFromRequest(req);
  if (!leaveId) {
    return NextResponse.json({ error: "Missing leave_id parameter" }, { status: 400 });
  }

  const now = new Date();
  const supabaseAdmin = getSupabaseAdmin();

  // Fetch the specific leave request
  const { data, error } = await supabaseAdmin
    .from("leave_requests")
    .select(
      "id, created_at, leave_date, daypart, entitlement, status, personnel:personnel_id (id, name, surname)"
    )
    .eq("id", leaveId)
    .eq("status", "requested")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message || "Leave request not found or not in requested status" }, { status: 404 });
  }

  const todayBrussels = formatBrusselsDate(now);
  const resendKey = process.env.RESEND_API_KEY || "";
  const from = process.env.EMAIL_FROM || "";
  if (!resendKey) return NextResponse.json({ error: "Missing RESEND_API_KEY" }, { status: 500 });
  if (!from) return NextResponse.json({ error: "Missing EMAIL_FROM" }, { status: 500 });

  const resend = new Resend(resendKey);
  const msg = buildDailyLeaveEmail({ todayBrussels, rows: [data as any] });

  const result = await resend.emails.send({
    from,
    to: TO_EMAIL,
    subject: msg.subject,
    text: msg.text,
    html: msg.html,
  });

  if ((result as any)?.error) {
    return NextResponse.json({ error: (result as any).error }, { status: 500 });
  }

  return NextResponse.json({ sent: true, leave_id: leaveId }, { status: 200 });
}
