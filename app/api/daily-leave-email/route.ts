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

function getForceFromRequest(req: Request) {
  const url = new URL(req.url);
  return url.searchParams.get("force") === "1";
}

function getDebugFromRequest(req: Request) {
  const url = new URL(req.url);
  return url.searchParams.get("debug") === "1";
}

function isVercelCron(req: Request) {
  // Vercel Cron sends this header on scheduled invocations.
  // We allow it as an authentication signal so the route can be called without query params.
  const h = req.headers.get("x-vercel-cron");
  return h === "1" || h === "true";
}

export async function GET(req: Request) {
  const expected = process.env.CRON_SECRET || "";
  const got = getSecretFromRequest(req);
  const force = getForceFromRequest(req);
  const debug = getDebugFromRequest(req);

  // Auth:
  // - Vercel cron: allow when x-vercel-cron header is set.
  // - Manual/test: allow when ?secret matches CRON_SECRET.
  const isCron = isVercelCron(req);
  if (!isCron) {
    if (!expected) return NextResponse.json({ error: "Missing CRON_SECRET" }, { status: 500 });
    if (!got || got !== expected) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Only send at 18:00 (Europe/Brussels). We run cron twice/day to handle DST; this guard prevents wrong-hour sends.
  const now = new Date();
  const brusselsHour = Number(
    new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Brussels", hour: "2-digit", hour12: false }).format(now)
  );
  // Allow forcing for manual tests when authenticated via ?secret. Never force for cron invocations.
  if (brusselsHour !== 18 && !(force && !isCron)) {
    return NextResponse.json(
      { skipped: true, reason: "Not 18:00 Europe/Brussels", brusselsHour: debug ? brusselsHour : undefined },
      { status: 200 }
    );
  }

  const todayBrussels = formatBrusselsDate(now);
  const since = new Date(now.getTime() - 30 * 60 * 60 * 1000); // last 30h, then filter by Brussels date

  const supabaseAdmin = getSupabaseAdmin();

  const { data, error } = await supabaseAdmin
    .from("leave_requests")
    .select(
      "id, created_at, leave_date, daypart, entitlement, status, personnel:personnel_id (id, name, surname)"
    )
    .eq("status", "requested")
    .gte("created_at", since.toISOString())
    .lte("created_at", now.toISOString());

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (data || []) as any[];
  const todayRows = rows.filter((r) => {
    const created = new Date(String(r.created_at));
    const createdBrussels = formatBrusselsDate(created);
    return createdBrussels === todayBrussels;
  });

  if (todayRows.length === 0) {
    // No email if nothing requested today.
    if (debug) {
      return NextResponse.json({ sent: false, count: 0, reason: "No leave requests created today" }, { status: 200 });
    }
    return new NextResponse(null, { status: 204 });
  }

  const resendKey = process.env.RESEND_API_KEY || "";
  const from = process.env.EMAIL_FROM || "";
  if (!resendKey) return NextResponse.json({ error: "Missing RESEND_API_KEY" }, { status: 500 });
  if (!from) return NextResponse.json({ error: "Missing EMAIL_FROM" }, { status: 500 });

  const resend = new Resend(resendKey);
  const msg = buildDailyLeaveEmail({ todayBrussels, rows: todayRows });

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

  return NextResponse.json({ sent: true, count: todayRows.length }, { status: 200 });
}
