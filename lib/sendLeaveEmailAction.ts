"use server";

import { getSupabaseAdmin } from "./supabaseAdmin";
import { buildDailyLeaveEmail, formatBrusselsDate } from "./dailyLeaveEmail";

export async function sendLeaveNotificationEmail(leaveId: string) {
  try {
    const secret = process.env.CRON_SECRET;
    if (!secret) {
      console.error("CRON_SECRET not configured");
      return { success: false, error: "CRON_SECRET not configured" };
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const url = new URL(`${baseUrl}/api/daily-leave-email`);
    url.searchParams.set("secret", secret);
    url.searchParams.set("leave_id", leaveId);

    const response = await fetch(url.toString(), { method: "GET" });
    
    if (!response.ok) {
      const error = await response.json();
      console.error("Email API error:", error);
      return { success: false, error: error?.error || "Unknown error" };
    }

    const result = await response.json();
    return { success: true, result };
  } catch (err: any) {
    console.error("Failed to send leave notification email:", err?.message ?? err);
    return { success: false, error: err?.message ?? "Unknown error" };
  }
}

/**
 * Send email notifications for multiple leave requests
 */
export async function sendLeaveNotificationEmails(leaveIds: string[]) {
  const results = await Promise.allSettled(leaveIds.map(id => sendLeaveNotificationEmail(id)));
  
  const successful = results.filter(r => r.status === "fulfilled" && (r.value as any)?.success).length;
  const failed = results.filter(r => r.status === "rejected" || (r.status === "fulfilled" && !(r.value as any)?.success)).length;

  if (failed > 0) {
    console.warn(`Sent ${successful}/${leaveIds.length} leave notification emails (${failed} failed)`);
  }

  return { successful, failed, total: leaveIds.length };
}
