// Utility to fetch leave data for a week, similar to planning/page.tsx
import { supabase } from "@/lib/supabaseClient";

export async function getLeaveByDateGroup(weekStart: Date) {
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  const start = toISODateLocal(weekStart);
  const end = toISODateLocal(weekEnd);

  const { data, error } = await supabase
    .from("leave_requests")
    .select("personnel_id,leave_date,daypart,status")
    .eq("status", "approved")
    .gte("leave_date", start)
    .lte("leave_date", end);

  if (error || !data) return {};

  const tmp = {};
  for (const row of data) {
    const pid = row.personnel_id || "";
    const d = row.leave_date || "";
    if (!pid || !d) continue;
    tmp[d] ||= { morning: new Set(), afternoon: new Set(), night: new Set() };
    for (const group of groupsForDaypart(row.daypart)) {
      tmp[d][group].add(pid);
    }
  }
  const out = {};
  for (const [dateKey, sets] of Object.entries(tmp)) {
    out[dateKey] = {
      morning: Array.from(sets.morning),
      afternoon: Array.from(sets.afternoon),
      night: Array.from(sets.night),
    };
  }
  return out;
}

function toISODateLocal(date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function groupsForDaypart(daypart) {
  const dp = String(daypart || "").trim().toLowerCase();
  if (!dp) return ["morning", "afternoon", "night"];
  if (dp.includes("hele") || dp.includes("vol") || dp.includes("full") || dp.includes("day")) {
    return ["morning", "afternoon", "night"];
  }
  if (dp.includes("voor")) return ["morning"];
  if (dp.includes("nam")) return ["afternoon", "night"];
  if (dp.includes("nacht")) return ["night"];
  return ["morning", "afternoon", "night"];
}
