// Utility to fetch leave data for a week, similar to planning/page.tsx
import { supabase } from "@/lib/supabaseClient";

type DayGroup = "morning" | "afternoon" | "night";

type DayBuckets = {
  morning: Set<string>;
  afternoon: Set<string>;
  night: Set<string>;
};

type Tmp = Record<string, DayBuckets>;

type LeaveByDateGroup = Record<
  string,
  {
    morning: string[];
    afternoon: string[];
    night: string[];
  }
>;

export async function getLeaveByDateGroup(weekStart: Date): Promise<LeaveByDateGroup> {
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

  const tmp: Tmp = {};

  for (const row of data) {
    const pid = String(row.personnel_id ?? "");
    const d = String(row.leave_date ?? "");
    if (!pid || !d) continue;

    tmp[d] ??= {
      morning: new Set<string>(),
      afternoon: new Set<string>(),
      night: new Set<string>(),
    };

    for (const group of groupsForDaypart(row.daypart)) {
      tmp[d][group].add(pid);
    }
  }

  const out: LeaveByDateGroup = {};
  for (const [dateKey, sets] of Object.entries(tmp)) {
    out[dateKey] = {
      morning: Array.from(sets.morning),
      afternoon: Array.from(sets.afternoon),
      night: Array.from(sets.night),
    };
  }

  return out;
}

function toISODateLocal(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function groupsForDaypart(daypart: unknown): DayGroup[] {
  const dp = String(daypart ?? "").trim().toLowerCase();

  // als leeg: neem alles
  if (!dp) return ["morning", "afternoon", "night"];

  // hele dag
  if (dp.includes("hele") || dp.includes("vol") || dp.includes("full") || dp.includes("day")) {
    return ["morning", "afternoon", "night"];
  }

  // voormiddag
  if (dp.includes("voor")) return ["morning"];

  // namiddag (bij jou is dat namiddag + night)
  if (dp.includes("nam")) return ["afternoon", "night"];

  // nacht
  if (dp.includes("nacht")) return ["night"];

  return ["morning", "afternoon", "night"];
}
