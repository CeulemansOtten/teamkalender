"use client";
import React, { useMemo, useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { variableFont, titleFont } from "../components/fonts";
import { supabase } from "@/lib/supabaseClient";
import FloatingNav from "../components/FloatingNav";
import LegendNavPlanning from "../components/LegendNav_Planning";
import HighlightPerson from "./HighlightPerson";

/* Vaste offset onder FloatingNav */
const FLOATING_NAV_OFFSET = 5;

const COLORS = {
  text: "#0f172a",
  primary: "#0ea5a8",
  line: "#e5e7eb",
  btnBg: "#ffffff",
  btnBorder: "#d1d5db",
  btnHover: "#f3f4f6",
};

function IconChevronLeft({ color = COLORS.primary, size = 22 }: { color?: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={3.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polyline points="15 6 9 12 15 18" />
    </svg>
  );
}

function IconChevronRight({ color = COLORS.primary, size = 22 }: { color?: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={3.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polyline points="9 6 15 12 9 18" />
    </svg>
  );
}

const APOTHEKEN = [
  { key: "Eeuwfeestapotheek", label: "Eeuwfeestapotheek" },
  { key: "Apotheek Generaal", label: "Apotheek Generaal" },
  { key: "Apotheek Minerva", label: "Apotheek Minerva" },
];

function normalizeApotheekKey(value: string) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");
}

const APOTHEEK_KEY_BY_NORMALIZED = new Map<string, string>(
  APOTHEKEN.map((a) => [normalizeApotheekKey(a.key), a.key])
);

const DAYS = ["Ma", "Di", "Wo", "Do", "Vr", "Za", "Zo"];

// Keep calendar rows a consistent height (similar to the old dropdown layout).
// In a table layout, `height` behaves like a minimum; the row can still grow with content.
const CALENDAR_CELL_HEIGHT = 100;
const CALENDAR_HALF_MIN_HEIGHT = 60;
// Total vertical padding inside the <td> (padding-top + padding-bottom).
// We set `padding: 10px`, so total vertical padding is 20px.
const CALENDAR_TD_PADDING_Y = 20;
// Fixed vertical track for the divider line (includes spacing).
// 10px top spacing + 1px line + 10px bottom spacing.
const CALENDAR_DIVIDER_TRACK = 21;

// Approximate pill layout height so we can pre-calc row height.
const PILL_EST_HEIGHT = 32;
const PILL_GAP = 6;

type PersonnelRow = {
  id: string;
  name: string;
  pharmacy?: string[] | null;
  status?: string | null;
  avatar_url?: string | null;
  active?: string | null;
};

type StandardPlanningRow = {
  personnel_id: string;
  weekday: string;
  daypart: string;
  pharmacy: string;
};

function getMonday(date: Date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
}

function getISOWeekNumber(date: Date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

function toISODateLocal(date: Date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default function WeekApotheekPage() {
  return (
    <Suspense fallback={null}>
      <WeekApotheekContent />
    </Suspense>
  );
}

function WeekApotheekContent() {
  const searchParams = useSearchParams();
  const highlightedPersonnelId = searchParams.get("personnel_id");

  const [defaultApotheekKey, setDefaultApotheekKey] = useState<string | null>(null);

  const [weekStart, setWeekStart] = useState(getMonday(new Date()));
  const [personnel, setPersonnel] = useState<PersonnelRow[]>([]);
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [plannedPersonnelIds, setPlannedPersonnelIds] = useState<Set<string>>(new Set());
  const [onDutyByDate, setOnDutyByDate] = useState<Record<string, Record<string, true>>>({});
  const [nightByDate, setNightByDate] = useState<Record<string, Record<string, true>>>({});
  const [publicHolidaysByDate, setPublicHolidaysByDate] = useState<Record<string, true>>({});
  const [remarksByDatePharmacy, setRemarksByDatePharmacy] = useState<Record<string, string[]>>({});

  const [savingWeek, setSavingWeek] = useState(false);

  type ShiftGroup = "morning" | "afternoon" | "night";
  const [shiftCounts, setShiftCounts] = useState<Record<string, Partial<Record<ShiftGroup, number>>>>({});

  const [leaveByDateGroup, setLeaveByDateGroup] = useState<
    Record<string, { morning: string[]; afternoon: string[]; night: string[] }>
  >({});

  const [vrijByWeekdayDaypart, setVrijByWeekdayDaypart] = useState<Record<string, Set<string>>>({});

  // By default, everyone is colored.
  // Clicking a person in the side panel toggles ONLY that person's coloring on/off.
  const [highlightDisabledById, setHighlightDisabledById] = useState<Record<string, true>>({});

  // Also use the URL personnel_id to determine that person's default pharmacy.
  useEffect(() => {
    let cancelled = false;

    async function loadDefaultApotheek() {
      const pid = String(highlightedPersonnelId || "").trim();
      if (!pid) {
        setDefaultApotheekKey(null);
        return;
      }

      const { data, error } = await supabase
        .from("personnel")
        .select("pharmacy")
        .eq("id", pid)
        .maybeSingle();

      if (cancelled) return;
      if (error || !data) {
        setDefaultApotheekKey(null);
        return;
      }

      const raw = (data as { pharmacy?: unknown })?.pharmacy;
      const candidates = Array.isArray(raw) ? raw : [raw];
      const firstMatch = candidates
        .map((v) => APOTHEEK_KEY_BY_NORMALIZED.get(normalizeApotheekKey(String(v ?? ""))))
        .find(Boolean);

      setDefaultApotheekKey(firstMatch || null);
    }

    loadDefaultApotheek();
    return () => {
      cancelled = true;
    };
  }, [highlightedPersonnelId]);

  const apothekenForDisplay = useMemo(() => {
    if (!defaultApotheekKey) return APOTHEKEN;
    const preferred = APOTHEKEN.find((a) => a.key === defaultApotheekKey);
    if (!preferred) return APOTHEKEN;
    return [preferred, ...APOTHEKEN.filter((a) => a.key !== defaultApotheekKey)];
  }, [defaultApotheekKey]);

  const HIGHLIGHT_COLORS = useMemo(
    () =>
      [
        "#fde68a",
        "#fca5a5",
        "#fdba74",
        "#a7f3d0",
        "#99f6e4",
        "#bae6fd",
        "#c7d2fe",
        "#fbcfe8",
        "#e9d5ff",
        "#d9f99d",
        "#fecaca",
        "#fed7aa",
        "#bbf7d0",
        "#a5f3fc",
        "#bfdbfe",
        "#ddd6fe",
        "#f5d0fe",
      ],
    []
  );

  function colorIndexForId(id: string) {
    // simple deterministic hash -> [0..16]
    let hash = 5381;
    for (let i = 0; i < id.length; i++) {
      hash = ((hash << 5) + hash) ^ id.charCodeAt(i);
    }
    const idx = Math.abs(hash) % HIGHLIGHT_COLORS.length;
    return idx;
  }

  function highlightBgForSelection(currentValue: string) {
    if (!currentValue) return "#f7f9fb";
    if (currentValue === "__add_shift__") return "#f7f9fb";

    if (highlightDisabledById[currentValue]) return "#f7f9fb";

    // Default: colored.
    {
      return HIGHLIGHT_COLORS[colorIndexForId(currentValue)];
    }
  }

  function highlightColorForId(id: string) {
    return HIGHLIGHT_COLORS[colorIndexForId(id)];
  }

  function getOrderedSelectedIdsForCellGroup(apotheekKey: string, dayIdx: number, group: ShiftGroup) {
    const prefix = `${apotheekKey}_${dayIdx}_`;
    const collected: Array<{ idx: number; id: string }> = [];

    for (const [key, value] of Object.entries(inputs)) {
      if (!value) continue;
      if (value === "__add_shift__") continue;
      if (!key.startsWith(prefix)) continue;

      const rest = key.slice(prefix.length); // e.g. "0", "extra_1", "night_0"
      let idx: number | null = null;
      let inferredGroup: ShiftGroup = "morning";

      if (/^\d+$/.test(rest)) {
        inferredGroup = "morning";
        idx = Number(rest);
      } else if (rest.startsWith("extra_")) {
        inferredGroup = "afternoon";
        const n = rest.slice("extra_".length);
        if (/^\d+$/.test(n)) idx = Number(n);
      } else if (rest.startsWith("night_")) {
        inferredGroup = "night";
        const n = rest.slice("night_".length);
        if (/^\d+$/.test(n)) idx = Number(n);
      } else {
        continue;
      }

      if (inferredGroup !== group) continue;
      if (idx === null || !Number.isFinite(idx)) continue;
      collected.push({ idx, id: value });
    }

    collected.sort((a, b) => a.idx - b.idx);
    return collected.map((x) => x.id);
  }

  function prioritizeId(ids: string[], priorityId: string | null, nameById?: Map<string, string>) {
    const byName = (id: string) => String(nameById?.get(id) || "").trim();
    const sorted = ids
      .slice()
      .sort((a, b) => byName(a).localeCompare(byName(b), "nl", { sensitivity: "base" }));

    if (!priorityId) return sorted;
    const idx = sorted.indexOf(priorityId);
    if (idx <= 0) return sorted;
    return [priorityId, ...sorted.slice(0, idx), ...sorted.slice(idx + 1)];
  }

  function groupsForDaypart(daypart?: string | null): ShiftGroup[] {
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

  function getBaseShiftCount(apotheekKey: string) {
    return apotheekKey === "Apotheek Generaal" || apotheekKey === "Apotheek Minerva" ? 2 : 3;
  }

  function getBaseShiftCountForGroup(apotheekKey: string, group: ShiftGroup) {
    if (group === "night") return 1;
    return getBaseShiftCount(apotheekKey);
  }

  function getShiftCount(apotheekKey: string, dayIdx: number, group: ShiftGroup) {
    const cellKey = `${apotheekKey}_${dayIdx}`;
    const base = getBaseShiftCountForGroup(apotheekKey, group);
    return shiftCounts[cellKey]?.[group] ?? base;
  }

  function addShift(apotheekKey: string, dayIdx: number, group: ShiftGroup) {
    const cellKey = `${apotheekKey}_${dayIdx}`;
    const base = getBaseShiftCountForGroup(apotheekKey, group);
    setShiftCounts((prev) => {
      const current = prev[cellKey]?.[group] ?? base;
      return {
        ...prev,
        [cellKey]: {
          ...(prev[cellKey] || {}),
          [group]: current + 1,
        },
      };
    });
  }

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.from("personnel").select("id,name,pharmacy,status,avatar_url,active");
      if (!error && data) setPersonnel(data as PersonnelRow[]);
    })();
  }, []);

  const isActiveFlag = (value: unknown) => {
    const v = String(value ?? "").trim().toLowerCase();
    return v === "yes" || v === "ja" || v === "true" || v === "1";
  };

  const activePersonnel = useMemo(() => {
    return personnel.filter((p) => isActiveFlag(p.active));
  }, [personnel]);

  const activePersonnelIdSet = useMemo(() => {
    return new Set(activePersonnel.map((p) => String(p.id)).filter(Boolean));
  }, [activePersonnel]);

  const highlightPersonnelForDisplay = useMemo(() => {
    return personnel.filter((p) => {
      const pid = String(p.id);
      return isActiveFlag(p.active) || plannedPersonnelIds.has(pid);
    });
  }, [personnel, plannedPersonnelIds]);

  useEffect(() => {
    (async () => {
      if (!personnel.length) {
        setVrijByWeekdayDaypart({});
        return;
      }

      const ids = personnel.map((p) => p.id);
      const { data, error } = await supabase
        .from("standard_planning")
        .select("personnel_id, weekday, daypart, pharmacy")
        .in("personnel_id", ids)
        .eq("pharmacy", "vrij");

      if (error || !data) {
        console.error("[Planning] load standard_planning vrij failed", error);
        setVrijByWeekdayDaypart({});
        return;
      }

      const map: Record<string, Set<string>> = {};
      for (const row of data as StandardPlanningRow[]) {
        const weekday = String(row.weekday || "").trim().toLowerCase();
        const daypart = String(row.daypart || "").trim().toLowerCase();
        const pid = String(row.personnel_id || "");
        if (!pid || !weekday || !daypart) continue;
        const key = `${weekday}:${daypart}`;
        map[key] ||= new Set();
        map[key].add(pid);
      }
      setVrijByWeekdayDaypart(map);
    })();
  }, [personnel]);

  useEffect(() => {
    (async () => {
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);

      const start = toISODateLocal(weekStart);
      const end = toISODateLocal(weekEnd);

      const { data, error } = await supabase
        .from("onduty")
        .select("date,pharmacy,night")
        .gte("date", start)
        .lte("date", end);

      if (error || !data) {
        setOnDutyByDate({});
        setNightByDate({});
        return;
      }

      const map: Record<string, Record<string, true>> = {};
      const nightMap: Record<string, Record<string, true>> = {};
      for (const row of data as Array<{ date: string; pharmacy: string; night?: string | null }>) {
        if (!row?.date || !row?.pharmacy) continue;
        map[row.date] ||= {};
        map[row.date][row.pharmacy] = true;

        if (isActiveFlag(row.night)) {
          nightMap[row.date] ||= {};
          nightMap[row.date][row.pharmacy] = true;
        }
      }
      setOnDutyByDate(map);
      setNightByDate(nightMap);
    })();
  }, [weekStart]);

  useEffect(() => {
    (async () => {
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);

      const start = toISODateLocal(weekStart);
      const end = toISODateLocal(weekEnd);

      const { data, error } = await supabase
        .from("holidays")
        .select("holiday_date,type")
        .eq("type", "public")
        .gte("holiday_date", start)
        .lte("holiday_date", end);

      if (error || !data) {
        setPublicHolidaysByDate({});
        return;
      }

      const map: Record<string, true> = {};
      for (const row of data as Array<{ holiday_date: string; type: string }>) {
        if (!row?.holiday_date) continue;
        map[row.holiday_date] = true;
      }
      setPublicHolidaysByDate(map);
    })();
  }, [weekStart]);

  useEffect(() => {
    (async () => {
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

      if (error || !data) {
        setLeaveByDateGroup({});
        return;
      }

      const tmp: Record<string, { morning: Set<string>; afternoon: Set<string>; night: Set<string> }> = {};
      for (const row of data as Array<{ personnel_id?: string | null; leave_date?: string | null; daypart?: string | null }>) {
        const pid = row.personnel_id || "";
        const d = row.leave_date || "";
        if (!pid || !d) continue;

        tmp[d] ||= { morning: new Set(), afternoon: new Set(), night: new Set() };
        for (const group of groupsForDaypart(row.daypart)) {
          tmp[d][group].add(pid);
        }
      }

      const out: Record<string, { morning: string[]; afternoon: string[]; night: string[] }> = {};
      for (const [dateKey, sets] of Object.entries(tmp)) {
        out[dateKey] = {
          morning: Array.from(sets.morning),
          afternoon: Array.from(sets.afternoon),
          night: Array.from(sets.night),
        };
      }
      setLeaveByDateGroup(out);
    })();
  }, [weekStart]);

  useEffect(() => {
    (async () => {
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);

      const start = toISODateLocal(weekStart);
      const end = toISODateLocal(weekEnd);

      const { data, error } = await supabase
        .from("remarks_planning")
        .select("date,remark,pharmacy,created_at")
        .gte("date", start)
        .lte("date", end)
        .order("created_at", { ascending: true });

      if (error || !data) {
        setRemarksByDatePharmacy({});
        return;
      }

      const map: Record<string, string[]> = {};
      for (const row of data as Array<{ date?: string | null; remark?: string | null; pharmacy?: string | null }>) {
        const date = String(row?.date || "").trim();
        const remark = String(row?.remark || "").trim();
        if (!date || !remark) continue;

        const rawPharmacy = String(row?.pharmacy || "").trim();
        const pharmacyKey = rawPharmacy
          ? APOTHEEK_KEY_BY_NORMALIZED.get(normalizeApotheekKey(rawPharmacy))
          : null;

        const key = `${date}|${pharmacyKey || "__all__"}`;
        map[key] ||= [];
        map[key].push(remark);
      }
      setRemarksByDatePharmacy(map);
    })();
  }, [weekStart]);

  function isOnDuty(date: Date, pharmacyKey: string) {
    const key = toISODateLocal(date);
    return Boolean(onDutyByDate[key]?.[pharmacyKey]);
  }

  function isNightDuty(date: Date, pharmacyKey: string) {
    const key = toISODateLocal(date);
    return Boolean(nightByDate[key]?.[pharmacyKey]);
  }

  function isPublicHoliday(date: Date) {
    const key = toISODateLocal(date);
    return Boolean(publicHolidaysByDate[key]);
  }

  function shouldShowDropdownsForCell(date: Date, dayIdx: number, pharmacyKey: string) {
    return dayIdx < 5 ? !isPublicHoliday(date) || isOnDuty(date, pharmacyKey) : isOnDuty(date, pharmacyKey);
  }

  function getRemarksForCell(date: Date, pharmacyKey: string) {
    const dateKey = toISODateLocal(date);
    const allKey = `${dateKey}|__all__`;
    const specificKey = `${dateKey}|${pharmacyKey}`;
    const all = remarksByDatePharmacy[allKey] || [];
    const specific = remarksByDatePharmacy[specificKey] || [];
    return [...all, ...specific];
  }

  function resolveAvatarUrl(raw?: string | null) {
    const url = String(raw || "").trim();
    if (!url) return null;
    if (url.startsWith("http://") || url.startsWith("https://")) return url;
    const { data } = supabase.storage.from("avatar").getPublicUrl(url);
    return data?.publicUrl || null;
  }

  function hasAtLeastOneSelection(apotheekKey: string, dayIdx: number, group: ShiftGroup) {
    const dayString = String(dayIdx);
    for (const [key, value] of Object.entries(inputs)) {
      const parts = key.split("_");
      if (parts.length < 3) continue;
      if (parts[0] !== apotheekKey) continue;
      if (parts[1] !== dayString) continue;
      if (!value) continue;
      if (value === "__add_shift__") continue;

      const keyPart = parts[2];
      const inferredGroup: ShiftGroup = keyPart === "extra" || keyPart.startsWith("extra")
        ? "afternoon"
        : keyPart === "night" || keyPart.startsWith("night")
          ? "night"
          : "morning";

      if (inferredGroup === group) return true;
    }
    return false;
  }

  function nextWeek() {
    setWeekStart((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() + 7);
      return d;
    });
  }
  function prevWeek() {
    setWeekStart((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() - 7);
      return d;
    });
  }

  function handleChange(apotheekKey: string, dayIdx: number, inputIdx: string | number, value: string) {
    setInputs((prev) => ({
      ...prev,
      [`${apotheekKey}_${dayIdx}_${inputIdx}`]: value,
    }));
  }

  function handleChangeOrAddShift(
    apotheekKey: string,
    dayIdx: number,
    inputIdx: string | number,
    value: string,
    group: ShiftGroup,
    isLast: boolean,
    previousValue: string
  ) {
    if (isLast && value === "__add_shift__") {
      addShift(apotheekKey, dayIdx, group);
      // Restore the previous value so the last dropdown doesn't get cleared.
      handleChange(apotheekKey, dayIdx, inputIdx, previousValue);
      return;
    }

    handleChange(apotheekKey, dayIdx, inputIdx, value);
  }

  // Personeel sorteren en indelen
  function getOptions(apotheekKey: string) {
    const boven = activePersonnel.filter(
      (p) => Array.isArray(p.pharmacy) && p.pharmacy.includes(apotheekKey)
    );
    const onder = activePersonnel.filter(
      (p) => !Array.isArray(p.pharmacy) || !p.pharmacy.includes(apotheekKey)
    ).sort((a, b) => {
      const na = a.name.toLowerCase();
      const nb = b.name.toLowerCase();
      return na.localeCompare(nb);
    });

    // Only show the base separator when both groups have options.
    if (boven.length === 0) return [...onder];
    if (onder.length === 0) return [...boven];
    return [...boven, { id: "sep", name: "-----" }, ...onder];
  }

  function trimSeparators<T extends { id: string }>(
    items: T[],
    opts?: {
      preserveEdgeSeps?: Set<string>;
    }
  ) {
    const preserve = opts?.preserveEdgeSeps || new Set<string>();
    const isSep = (id: string) => id === "sep" || id === "leave_sep" || id === "vrij_sep";

    // Remove leading/trailing separators and collapse redundant separators.
    // Important: do NOT let the generic "sep" (-----) overwrite specific section headers.
    const out: T[] = [];
    for (const item of items) {
      if (out.length === 0 && isSep(item.id) && !preserve.has(item.id)) continue;

      if (out.length > 0 && isSep(out[out.length - 1].id) && isSep(item.id)) {
        const prevId = out[out.length - 1].id;
        const nextId = item.id;

        // Exact duplicate separator -> skip.
        if (prevId === nextId) continue;

        // Prefer specific headers over generic separator.
        if (prevId === "sep" && nextId !== "sep") {
          out[out.length - 1] = item;
          continue;
        }
        if (prevId !== "sep" && nextId === "sep") {
          continue;
        }

        // Different specific headers (leave/vrij) should both be allowed.
        out.push(item);
        continue;
      }

      out.push(item);
    }
    while (out.length > 0 && isSep(out[0].id) && !preserve.has(out[0].id)) out.shift();
    while (out.length > 0 && isSep(out[out.length - 1].id) && !preserve.has(out[out.length - 1].id)) out.pop();
    return out;
  }

  function getSelectedIdsForDayGroup(dayIdx: number, group: ShiftGroup) {
    const selected = new Set<string>();
    const dayString = String(dayIdx);
    for (const [key, value] of Object.entries(inputs)) {
      const parts = key.split("_");
      if (parts.length < 3) continue;
      if (parts[1] !== dayString) continue;
      if (!value) continue;
      if (value === "__add_shift__") continue;

      const keyPart = parts[2];
      const inferredGroup: ShiftGroup = keyPart === "extra" || keyPart.startsWith("extra")
        ? "afternoon"
        : keyPart === "night" || keyPart.startsWith("night")
          ? "night"
          : "morning";

      if (inferredGroup !== group) continue;
      selected.add(value);
    }
    return selected;
  }

  function getFilteredOptions(apotheekKey: string, dayIdx: number, group: ShiftGroup, currentValue: string) {
    const selected = getSelectedIdsForDayGroup(dayIdx, group);
    if (currentValue) selected.delete(currentValue);

    const dateKey = toISODateLocal(weekDates[dayIdx]);
    const leaveIds = leaveByDateGroup[dateKey]?.[group] ?? [];
    const leaveSet = new Set<string>(leaveIds);

    const weekdayLower = dayIdx >= 0 && dayIdx <= 4
      ? ["maandag", "dinsdag", "woensdag", "donderdag", "vrijdag"][dayIdx]
      : "";
    const daypartLower = group === "morning" ? "voormiddag" : "namiddag";
    const vrijKey = weekdayLower ? `${weekdayLower}:${daypartLower}` : "";
    const vrijSet = (vrijKey && vrijByWeekdayDaypart[vrijKey]) ? vrijByWeekdayDaypart[vrijKey] : new Set<string>();

    // Build "normal" options without keeping the base separator blindly.
    // We only insert the generic separator when both groups still have options after filtering.
    const bovenAll = activePersonnel.filter((p) => Array.isArray(p.pharmacy) && p.pharmacy.includes(apotheekKey));
    const onderAll = activePersonnel
      .filter((p) => !Array.isArray(p.pharmacy) || !p.pharmacy.includes(apotheekKey))
      .sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));

    const isExcludedNormal = (pid: string) => {
      if (!pid) return true;
      if (leaveSet.has(pid)) return true;
      if (vrijSet.has(pid)) return true;
      return selected.has(pid);
    };

    const boven = bovenAll.filter((p) => !isExcludedNormal(String(p.id))).map((p) => ({ id: p.id, name: p.name }));
    const onder = onderAll.filter((p) => !isExcludedNormal(String(p.id))).map((p) => ({ id: p.id, name: p.name }));

    const normal = [
      ...boven,
      ...(boven.length > 0 && onder.length > 0 ? ([{ id: "sep", name: "-----" }] as Array<{ id: string; name: string }>) : []),
      ...onder,
    ];

    const leavePeople = activePersonnel
      .filter((p) => leaveSet.has(p.id) && !selected.has(p.id))
      .sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()))
      .map((p) => ({ id: p.id, name: p.name }));

    const vrijPeople = weekdayLower
      ? activePersonnel
          .filter((p) => vrijSet.has(p.id) && !leaveSet.has(p.id) && !selected.has(p.id))
          .sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()))
          .map((p) => ({ id: p.id, name: p.name }))
      : [];

    const out: Array<{ id: string; name: string; disabled?: boolean }> = [...normal];
    if (currentValue && !activePersonnelIdSet.has(currentValue)) {
      const nm = personnel.find((p) => String(p.id) === currentValue)?.name || currentValue;
      out.unshift({ id: currentValue, name: nm, disabled: true });
    }
    if (leaveSet.size > 0) out.push({ id: "leave_sep", name: "---- verlof ----" }, ...leavePeople);
    if (weekdayLower && vrijSet.size > 0) out.push({ id: "vrij_sep", name: "---- vrij ----" }, ...vrijPeople);
    return trimSeparators(out, { preserveEdgeSeps: new Set(["leave_sep", "vrij_sep"]) });
  }

  // Weekdagen berekenen
  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  const weekNumber = useMemo(() => getISOWeekNumber(weekStart), [weekStart]);

  const rowLayoutByApotheek = useMemo(() => {
    const stackHeight = (pillCount: number) => {
      if (pillCount <= 0) return 0;
      return pillCount * PILL_EST_HEIGHT + Math.max(0, pillCount - 1) * PILL_GAP;
    };

    const out: Record<string, { rowHeight: number; dividerTop: number; afternoonStackHeight: number; hasNightDuty: boolean }> = {};
    for (const apotheek of APOTHEKEN) {
      let maxTopNeeded = 0;
      let maxAfternoonStackNeeded = 0;
      let maxNightStackNeeded = 0;
      let hasAnyNightDuty = false;

      for (let dayIdx = 0; dayIdx < 7; dayIdx++) {
        const date = weekDates[dayIdx];
        if (!shouldShowDropdownsForCell(date, dayIdx, apotheek.key)) continue;

        const morningCount = getOrderedSelectedIdsForCellGroup(apotheek.key, dayIdx, "morning").length;
        const afternoonCount = getOrderedSelectedIdsForCellGroup(apotheek.key, dayIdx, "afternoon").length;
        const showNight = isNightDuty(date, apotheek.key);
        const nightCount = showNight ? getOrderedSelectedIdsForCellGroup(apotheek.key, dayIdx, "night").length : 0;

        maxTopNeeded = Math.max(maxTopNeeded, stackHeight(morningCount));
        maxAfternoonStackNeeded = Math.max(maxAfternoonStackNeeded, stackHeight(afternoonCount));
        if (showNight) {
          hasAnyNightDuty = true;
          maxNightStackNeeded = Math.max(maxNightStackNeeded, stackHeight(nightCount));
        }
      }

      // Divider between namiddag/nacht should be aligned under the *max* afternoon stack of the week,
      // and we reserve space below it for at least one night pill label (even if night is still empty).
      const nightMin = hasAnyNightDuty ? Math.max(PILL_EST_HEIGHT, maxNightStackNeeded) : 0;
      const bottomNeeded = maxAfternoonStackNeeded + (hasAnyNightDuty ? CALENDAR_DIVIDER_TRACK + nightMin : 0);
      const bottomMin = Math.max(CALENDAR_HALF_MIN_HEIGHT, bottomNeeded);

      // Divider positioning rule per apotheek-row:
      // - If there is at least 1 voormiddag pill in this apotheek-row (any day),
      //   place the divider at the height of the lowest voormiddag pill (maxTopNeeded).
      // - If there are no voormiddag pills at all, place the divider in the middle of the cell.
      const hasAnyMorningPills = maxTopNeeded > 0;

      if (hasAnyMorningPills) {
        // Keep divider aligned to the lowest morning pill in this apotheek row.
        // The divider line itself is centered in the track, so it ends up 10px below `dividerTop`.
        const topFixed = maxTopNeeded;
        const contentNeeded = topFixed + CALENDAR_DIVIDER_TRACK + bottomMin;
        const rowHeight = Math.max(CALENDAR_CELL_HEIGHT, contentNeeded + CALENDAR_TD_PADDING_Y);
        out[apotheek.key] = {
          rowHeight,
          dividerTop: topFixed,
          afternoonStackHeight: maxAfternoonStackNeeded,
          hasNightDuty: hasAnyNightDuty,
        };
      } else {
        const halfNeeded = Math.max(CALENDAR_HALF_MIN_HEIGHT, bottomMin);
        const contentNeeded = 2 * halfNeeded + CALENDAR_DIVIDER_TRACK;
        const rowHeight = Math.max(CALENDAR_CELL_HEIGHT, contentNeeded + CALENDAR_TD_PADDING_Y);
        const contentHeight = Math.max(0, rowHeight - CALENDAR_TD_PADDING_Y);
        const dividerTop = Math.max(
          CALENDAR_HALF_MIN_HEIGHT,
          Math.floor((contentHeight - CALENDAR_DIVIDER_TRACK) / 2)
        );
        out[apotheek.key] = {
          rowHeight,
          dividerTop,
          afternoonStackHeight: maxAfternoonStackNeeded,
          hasNightDuty: hasAnyNightDuty,
        };
      }
    }
    return out;
  }, [inputs, weekDates, onDutyByDate, nightByDate, publicHolidaysByDate]);

  async function onSaveWeekToDb() {
    setSavingWeek(true);
    try {
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      const start = toISODateLocal(weekStart);
      const end = toISODateLocal(weekEnd);

      // Build rows from dropdown inputs.
      // Key format: `${apotheekKey}_${dayIdx}_${inputIdxOrKeyPart}`
      const rows: Array<{ date: string; personnel_id: string; shift: "voormiddag" | "namiddag" | "nacht"; pharmacy: string }> = [];
      for (const [key, value] of Object.entries(inputs)) {
        if (!value) continue;
        if (value === "__add_shift__") continue;
        const parts = key.split("_");
        if (parts.length < 3) continue;

        const apotheekKey = parts[0];
        const dayIdx = Number(parts[1]);
        const inputPart = parts.slice(2).join("_");

        if (!Number.isFinite(dayIdx) || dayIdx < 0 || dayIdx > 6) continue;
        if (!APOTHEKEN.some((a) => a.key === apotheekKey)) continue;

        const date = toISODateLocal(weekDates[dayIdx]);
        const inferredShift: "voormiddag" | "namiddag" | "nacht" = inputPart.startsWith("night")
          ? "nacht"
          : inputPart.startsWith("extra")
            ? "namiddag"
            : "voormiddag";

        rows.push({ date, personnel_id: value, shift: inferredShift, pharmacy: apotheekKey });
      }

      // De-duplicate desired rows (date+personnel_id+shift)
      const desiredKey = (r: { date: string; personnel_id: string; shift: string }) => `${r.date}|${r.personnel_id}|${r.shift}`;
      const desiredMap = new Map<
        string,
        { date: string; personnel_id: string; shift: "voormiddag" | "namiddag" | "nacht"; pharmacy: string }
      >();
      for (const r of rows) desiredMap.set(desiredKey(r), r);
      const desired = Array.from(desiredMap.values());

      // Load existing for this week, so we can delete removed entries.
      const { data: existing, error: selErr } = await supabase
        .from("planning")
        .select("date, personnel_id, shift")
        .gte("date", start)
        .lte("date", end);
      if (selErr) throw selErr;

      const existingKeys = new Set<string>();
      for (const r of (existing || []) as Array<{ date: string; personnel_id: string; shift: string }>) {
        if (!r?.date || !r?.personnel_id || !r?.shift) continue;
        existingKeys.add(desiredKey(r));
      }

      const desiredKeys = new Set<string>(desired.map((r) => desiredKey(r)));

      // Delete rows that no longer exist in the UI
      for (const k of existingKeys) {
        if (desiredKeys.has(k)) continue;
        const [date, personnel_id, shift] = k.split("|");
        const { error: delErr } = await supabase.from("planning").delete().match({ date, personnel_id, shift });
        if (delErr) throw delErr;
      }

      // Update if exists, else insert
      for (const r of desired) {
        const { data: updated, error: updErr } = await supabase
          .from("planning")
          .update({ pharmacy: r.pharmacy })
          .match({ date: r.date, personnel_id: r.personnel_id, shift: r.shift })
          .select("date");

        if (updErr) throw updErr;

        if (!updated || updated.length === 0) {
          const { error: insErr } = await supabase.from("planning").insert(r);
          if (insErr) throw insErr;
        }
      }
    } catch (e) {
      console.error("[Planning] save week failed", e);
    } finally {
      setSavingWeek(false);
    }
  }

  async function applyStandardPlanningToWeek() {
    try {
      const ids = personnel.map((p) => p.id);
      if (ids.length === 0) {
        setInputs({});
        setShiftCounts({});
        return;
      }

      const { data, error } = await supabase
        .from("standard_planning")
        .select("personnel_id, weekday, daypart, pharmacy")
        .in("personnel_id", ids);

      if (error || !data) {
        console.error("[Planning] apply standard_planning failed", error);
        return;
      }

      const nameById = new Map<string, string>(personnel.map((p) => [p.id, p.name]));
      const weekdayToIdx: Record<string, number> = {
        maandag: 0,
        dinsdag: 1,
        woensdag: 2,
        donderdag: 3,
        vrijdag: 4,
      };

      const byCell: Record<string, Record<number, { morning: string[]; afternoon: string[] }>> = {};
      const seen = new Set<string>();

      for (const row of data as StandardPlanningRow[]) {
        const pid = String(row.personnel_id || "");
        const weekday = String(row.weekday || "").trim().toLowerCase();
        const daypart = String(row.daypart || "").trim().toLowerCase();
        const pharmacy = String(row.pharmacy || "");

        if (!pid || !weekday || !daypart || !pharmacy) continue;
        if (pharmacy === "vrij") continue;
        if (!APOTHEKEN.some((a) => a.key === pharmacy)) continue;

        const dayIdx = weekdayToIdx[weekday];
        if (dayIdx === undefined) continue;

        const group = daypart.includes("voor") ? "morning" : "afternoon";
        const dedupeKey = `${weekday}|${daypart}|${pharmacy}|${pid}`;
        if (seen.has(dedupeKey)) continue;
        seen.add(dedupeKey);

        byCell[pharmacy] ||= {};
        byCell[pharmacy][dayIdx] ||= { morning: [], afternoon: [] };
        byCell[pharmacy][dayIdx][group].push(pid);
      }

      // Apply leave filters (remove people on leave for that day group)
      for (const apotheek of APOTHEKEN) {
        for (let dayIdx = 0; dayIdx < 7; dayIdx++) {
          const dateKey = toISODateLocal(weekDates[dayIdx]);
          const leaveMorning = new Set<string>(leaveByDateGroup[dateKey]?.morning ?? []);
          const leaveAfternoon = new Set<string>(leaveByDateGroup[dateKey]?.afternoon ?? []);

          const saved = byCell[apotheek.key]?.[dayIdx];
          if (!saved) continue;

          saved.morning = saved.morning.filter((pid) => !leaveMorning.has(pid));
          saved.afternoon = saved.afternoon.filter((pid) => !leaveAfternoon.has(pid));
        }
      }

      // Sort consistently by name
      for (const apotheek of APOTHEKEN) {
        for (let dayIdx = 0; dayIdx < 7; dayIdx++) {
          const cell = byCell[apotheek.key]?.[dayIdx];
          if (!cell) continue;
          cell.morning.sort((a, b) => (nameById.get(a) || "").localeCompare(nameById.get(b) || ""));
          cell.afternoon.sort((a, b) => (nameById.get(a) || "").localeCompare(nameById.get(b) || ""));
        }
      }

      // Reset inputs based on standard planning.
      // Shift counts: only increase when there are too few visible dropdowns.
      const nextInputs: Record<string, string> = {};
      const neededCounts: Record<string, { baseDay: number; baseNight: number; morning: number; afternoon: number; night: number }> = {};

      for (const apotheek of APOTHEKEN) {
        const baseDay = getBaseShiftCount(apotheek.key);
        const baseNight = 1;
        for (let dayIdx = 0; dayIdx < 7; dayIdx++) {
          const date = weekDates[dayIdx];
          if (!shouldShowDropdownsForCell(date, dayIdx, apotheek.key)) continue;

          const cellKey = `${apotheek.key}_${dayIdx}`;
          const saved = byCell[apotheek.key]?.[dayIdx] || { morning: [], afternoon: [] };

          const morningNeed = Math.max(baseDay, saved.morning.length);
          const nightDuty = isNightDuty(date, apotheek.key);

          // Standard planning only defines voormiddag/namiddag.
          // Even on night-duty days, do NOT auto-fill the night dropdowns;
          // instead add extra namiddag dropdowns if needed.
          const afternoonNeed = Math.max(baseDay, saved.afternoon.length);
          const nightNeed = nightDuty ? baseNight : baseNight;

          neededCounts[cellKey] = {
            baseDay,
            baseNight,
            morning: morningNeed,
            afternoon: afternoonNeed,
            night: nightNeed,
          };

          saved.morning.forEach((pid, i) => {
            nextInputs[`${apotheek.key}_${dayIdx}_${i}`] = pid;
          });

          saved.afternoon.forEach((pid, i) => {
            nextInputs[`${apotheek.key}_${dayIdx}_extra_${i}`] = pid;
          });
        }
      }
      setShiftCounts((prev) => {
        const next = { ...prev };
        for (const [cellKey, need] of Object.entries(neededCounts)) {
          const current = next[cellKey] || {};
          const currentMorning = current.morning ?? need.baseDay;
          const currentAfternoon = current.afternoon ?? need.baseDay;
          const currentNight = current.night ?? need.baseNight;
          next[cellKey] = {
            ...current,
            morning: Math.max(currentMorning, need.morning),
            afternoon: Math.max(currentAfternoon, need.afternoon),
            night: Math.max(currentNight, need.night),
          };
        }
        return next;
      });
      setInputs(nextInputs);
    } catch (e) {
      console.error("[Planning] apply standard planning failed", e);
    }
  }

  // When changing week, reset to default base dropdown counts.
  // The load-from-DB effect will expand counts if needed to show saved planning.
  useEffect(() => {
    setShiftCounts({});
    setInputs({});
  }, [weekStart]);

  useEffect(() => {
    (async () => {
      const weekDatesLocal = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(weekStart);
        d.setDate(d.getDate() + i);
        return d;
      });

      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);

      const start = toISODateLocal(weekStart);
      const end = toISODateLocal(weekEnd);

      const { data, error } = await supabase
        .from("planning")
        .select("date, personnel_id, shift, pharmacy")
        .gte("date", start)
        .lte("date", end);

      if (error || !data) {
        console.error("[Planning] load planning failed", error);
        return;
      }

      const dateToIdx: Record<string, number> = {};
      for (let i = 0; i < 7; i++) dateToIdx[toISODateLocal(weekDatesLocal[i])] = i;

      const byCell: Record<string, Record<number, { morning: string[]; afternoon: string[]; night: string[] }>> = {};
      const seen = new Set<string>();
      const plannedIds = new Set<string>();

      for (const row of data as Array<{ date?: string; personnel_id?: string; shift?: string; pharmacy?: string | null }>) {
        const date = String(row.date || "");
        const personnel_id = String(row.personnel_id || "");
        const shift = String(row.shift || "").toLowerCase();
        const pharmacy = String(row.pharmacy || "");
        if (!date || !personnel_id || !shift || !pharmacy) continue;
        if (!APOTHEKEN.some((a) => a.key === pharmacy)) continue;

        plannedIds.add(personnel_id);

        const dayIdx = dateToIdx[date];
        if (dayIdx === undefined) continue;

        const group = shift.includes("nacht") ? "night" : shift.includes("voor") ? "morning" : "afternoon";
        const dedupeKey = `${date}|${pharmacy}|${group}|${personnel_id}`;
        if (seen.has(dedupeKey)) continue;
        seen.add(dedupeKey);

        byCell[pharmacy] ||= {};
        byCell[pharmacy][dayIdx] ||= { morning: [], afternoon: [], night: [] };
        byCell[pharmacy][dayIdx][group].push(personnel_id);
      }

      setPlannedPersonnelIds(plannedIds);

      // Ensure there are enough dropdowns to show saved planning
      setShiftCounts((prev) => {
        const next = { ...prev };
        for (const apotheek of APOTHEKEN) {
          for (let dayIdx = 0; dayIdx < 7; dayIdx++) {
            const cellKey = `${apotheek.key}_${dayIdx}`;
            const baseDay = getBaseShiftCount(apotheek.key);
            const baseNight = 1;
            const saved = byCell[apotheek.key]?.[dayIdx] || { morning: [], afternoon: [], night: [] };

            const morningNeed = Math.max(baseDay, saved.morning.length);

            const nightDuty = isNightDuty(weekDatesLocal[dayIdx], apotheek.key);
            const useLegacyOverflowAsNight = nightDuty && saved.night.length === 0;

            const afternoonNeed = useLegacyOverflowAsNight
              ? Math.max(baseDay, Math.min(saved.afternoon.length, baseDay))
              : Math.max(baseDay, saved.afternoon.length);

            const legacyNightOverflowCount = useLegacyOverflowAsNight ? Math.max(0, saved.afternoon.length - baseDay) : 0;
            const nightNeed = nightDuty
              ? Math.max(baseNight, saved.night.length + legacyNightOverflowCount)
              : baseNight;

            next[cellKey] = {
              ...(next[cellKey] || {}),
              morning: Math.max(next[cellKey]?.morning ?? baseDay, morningNeed),
              afternoon: Math.max(next[cellKey]?.afternoon ?? baseDay, afternoonNeed),
              night: Math.max(next[cellKey]?.night ?? baseNight, nightNeed),
            };
          }
        }
        return next;
      });

      // Prefill inputs
      const nextInputs: Record<string, string> = {};
      for (const apotheek of APOTHEKEN) {
        const base = getBaseShiftCount(apotheek.key);
        for (let dayIdx = 0; dayIdx < 7; dayIdx++) {
          const saved = byCell[apotheek.key]?.[dayIdx] || { morning: [], afternoon: [], night: [] };

          saved.morning.forEach((pid, i) => {
            nextInputs[`${apotheek.key}_${dayIdx}_${i}`] = pid;
          });

          const nightDuty = isNightDuty(weekDatesLocal[dayIdx], apotheek.key);
          const useLegacyOverflowAsNight = nightDuty && saved.night.length === 0;

          const afternoonFirst = useLegacyOverflowAsNight ? saved.afternoon.slice(0, base) : saved.afternoon;
          const legacyNightOverflow = useLegacyOverflowAsNight ? saved.afternoon.slice(base) : [];
          const nightCombined = nightDuty ? (useLegacyOverflowAsNight ? legacyNightOverflow : saved.night) : [];

          afternoonFirst.forEach((pid, i) => {
            nextInputs[`${apotheek.key}_${dayIdx}_extra_${i}`] = pid;
          });

          nightCombined.forEach((pid, i) => {
            nextInputs[`${apotheek.key}_${dayIdx}_night_${i}`] = pid;
          });
        }
      }

      setInputs(nextInputs);
    })();
  }, [weekStart, nightByDate]);

  const missingShifts = useMemo(() => {
    const out: string[] = [];
    for (const apotheek of APOTHEKEN) {
      for (let dayIdx = 0; dayIdx < 7; dayIdx++) {
        const date = weekDates[dayIdx];
        const shouldShowDropdowns =
          dayIdx < 5
            ? !isPublicHoliday(date) || isOnDuty(date, apotheek.key)
            : isOnDuty(date, apotheek.key);

        if (!shouldShowDropdowns) continue;

        const dateLabel = `${DAYS[dayIdx]} ${formatDay(date)}`;

        if (!hasAtLeastOneSelection(apotheek.key, dayIdx, "morning")) {
          out.push(`${dateLabel} • ${apotheek.label} • voormiddag`);
        }
        if (!hasAtLeastOneSelection(apotheek.key, dayIdx, "afternoon")) {
          out.push(`${dateLabel} • ${apotheek.label} • namiddag`);
        }
        if (isNightDuty(date, apotheek.key) && !hasAtLeastOneSelection(apotheek.key, dayIdx, "night")) {
          out.push(`${dateLabel} • ${apotheek.label} • nacht`);
        }
      }
    }
    return out;
  }, [inputs, weekDates, onDutyByDate, nightByDate, publicHolidaysByDate]);

  const allPharmaciesMinOneShift = missingShifts.length === 0;

  const missingPersonnel = useMemo(() => {
    const out: string[] = [];

    const weekdayLower = ["maandag", "dinsdag", "woensdag", "donderdag", "vrijdag"];
    const plannedByDay: Array<{ morning: Set<string>; afternoon: Set<string> }> = Array.from({ length: 5 }, () => ({
      morning: new Set<string>(),
      afternoon: new Set<string>(),
    }));

    for (const [key, value] of Object.entries(inputs)) {
      if (!value) continue;
      if (value === "__add_shift__") continue;
      const parts = key.split("_");
      if (parts.length < 3) continue;
      const dayIdx = Number(parts[1]);
      if (!Number.isFinite(dayIdx)) continue;
      if (dayIdx < 0 || dayIdx > 4) continue;

      const keyPart = parts[2];
      const group: "morning" | "afternoon" | "night" =
        keyPart === "extra" || keyPart.startsWith("extra")
          ? "afternoon"
          : keyPart === "night" || keyPart.startsWith("night")
            ? "night"
            : "morning";

      if (group === "morning") plannedByDay[dayIdx].morning.add(value);
      if (group === "afternoon") plannedByDay[dayIdx].afternoon.add(value);
    }

    for (let dayIdx = 0; dayIdx < 5; dayIdx++) {
      const date = weekDates[dayIdx];
      const dateKey = toISODateLocal(date);
      const dayHasPlanning = APOTHEKEN.some((a) => shouldShowDropdownsForCell(date, dayIdx, a.key));
      if (!dayHasPlanning) continue;

      const weekday = weekdayLower[dayIdx];
      const vrijMorning = vrijByWeekdayDaypart[`${weekday}:voormiddag`];
      const vrijAfternoon = vrijByWeekdayDaypart[`${weekday}:namiddag`];

      const leaveMorning = new Set<string>(leaveByDateGroup[dateKey]?.morning ?? []);
      const leaveAfternoon = new Set<string>(leaveByDateGroup[dateKey]?.afternoon ?? []);

      for (const p of personnel) {
        const pid = String(p.id);
        if (!pid) continue;

        const mustMorning = !(vrijMorning && vrijMorning.has(pid)) && !leaveMorning.has(pid);
        const mustAfternoon = !(vrijAfternoon && vrijAfternoon.has(pid)) && !leaveAfternoon.has(pid);

        const hasMorning = plannedByDay[dayIdx].morning.has(pid);
        const hasAfternoon = plannedByDay[dayIdx].afternoon.has(pid);

        const dateLabel = `${DAYS[dayIdx]} ${formatDay(date)}`;

        if (mustMorning && !hasMorning) {
          out.push(`${p.name} • ${dateLabel} • voormiddag`);
        }
        if (mustAfternoon && !hasAfternoon) {
          out.push(`${p.name} • ${dateLabel} • namiddag`);
        }
      }
    }

    return out;
  }, [inputs, weekDates, personnel, vrijByWeekdayDaypart, leaveByDateGroup, onDutyByDate, publicHolidaysByDate]);

  const allPersonnelPlanned = missingPersonnel.length === 0;

  const otherRemarksLines = useMemo(() => {
    const out: string[] = [];

    const statusById = new Map<string, string>(
      personnel.map((p) => [String(p.id), String(p.status || "").trim().toLowerCase()])
    );
    const nameById = new Map<string, string>(personnel.map((p) => [String(p.id), p.name]));

    const weekdayLower = ["maandag", "dinsdag", "woensdag", "donderdag", "vrijdag", "zaterdag", "zondag"];

    function getSelectedIdsForCellGroup(apotheekKey: string, dayIdx: number, group: "morning" | "afternoon" | "night") {
      const outIds: string[] = [];
      const dayString = String(dayIdx);
      for (const [key, value] of Object.entries(inputs)) {
        if (!value) continue;
        if (value === "__add_shift__") continue;
        const parts = key.split("_");
        if (parts.length < 3) continue;
        if (parts[0] !== apotheekKey) continue;
        if (parts[1] !== dayString) continue;

        const keyPart = parts[2];
        const inferredGroup: "morning" | "afternoon" | "night" =
          keyPart === "extra" || keyPart.startsWith("extra")
            ? "afternoon"
            : keyPart === "night" || keyPart.startsWith("night")
              ? "night"
              : "morning";

        if (inferredGroup === group) outIds.push(value);
      }
      return outIds;
    }

    // Check 1: each visible shift has at least one pharmacist/owner
    for (const apotheek of APOTHEKEN) {
      for (let dayIdx = 0; dayIdx < 7; dayIdx++) {
        const date = weekDates[dayIdx];
        if (!shouldShowDropdownsForCell(date, dayIdx, apotheek.key)) continue;

        const dateLabel = `${DAYS[dayIdx]} ${formatDay(date)}`;

        for (const group of ["morning", "afternoon"] as const) {
          const selected = getSelectedIdsForCellGroup(apotheek.key, dayIdx, group);
          const hasPharmacistOrOwner = selected.some((pid) => {
            const st = statusById.get(pid) || "";
            return st === "pharmacist" || st === "owner" || st === "replacement";
          });

          if (!hasPharmacistOrOwner) {
            out.push(`${dateLabel} • ${apotheek.label} • ${group === "morning" ? "voormiddag" : "namiddag"} • geen apotheker`);
          }
        }

        if (isNightDuty(date, apotheek.key)) {
          const selected = getSelectedIdsForCellGroup(apotheek.key, dayIdx, "night");
          const hasPharmacistOrOwner = selected.some((pid) => {
            const st = statusById.get(pid) || "";
            return st === "pharmacist" || st === "owner" || st === "replacement";
          });
          if (!hasPharmacistOrOwner) {
            out.push(`${dateLabel} • ${apotheek.label} • nacht • geen apotheker`);
          }
        }
      }
    }

    // Check 2: no selected dropdown contains someone who is vrij or on approved leave for that day/shift
    for (const [key, value] of Object.entries(inputs)) {
      if (!value) continue;
      if (value === "__add_shift__") continue;
      const parts = key.split("_");
      if (parts.length < 3) continue;

      const apotheekKey = parts[0];
      const dayIdx = Number(parts[1]);
      const inputPart = parts.slice(2).join("_");
      if (!Number.isFinite(dayIdx) || dayIdx < 0 || dayIdx > 6) continue;
      if (!APOTHEKEN.some((a) => a.key === apotheekKey)) continue;

      const date = weekDates[dayIdx];
      if (!shouldShowDropdownsForCell(date, dayIdx, apotheekKey)) continue;

      const group: "morning" | "afternoon" | "night" = inputPart.startsWith("night")
        ? "night"
        : inputPart.startsWith("extra")
          ? "afternoon"
          : "morning";

      const dateKey = toISODateLocal(date);
      const weekday = weekdayLower[dayIdx] || "";
      const daypartLower = group === "morning" ? "voormiddag" : "namiddag";

      const isVrij = Boolean(vrijByWeekdayDaypart[`${weekday}:${daypartLower}`]?.has(value));
      const leaveGroup = group === "morning" ? "morning" : group === "afternoon" ? "afternoon" : "night";
      const isLeave = Boolean((leaveByDateGroup[dateKey]?.[leaveGroup] || []).includes(value));

      if (isVrij || isLeave) {
        const who = nameById.get(value) || value;
        const dateLabel = `${DAYS[dayIdx]} ${formatDay(date)}`;
        const shiftLabel = group === "morning" ? "voormiddag" : group === "afternoon" ? "namiddag" : "nacht";
        out.push(`${who} • ${dateLabel} • ${APOTHEKEN.find((a) => a.key === apotheekKey)?.label || apotheekKey} • ${shiftLabel} • geselecteerd maar vrij/verlof`);
      }
    }

    return out;
  }, [
    inputs,
    personnel,
    weekDates,
    vrijByWeekdayDaypart,
    leaveByDateGroup,
    onDutyByDate,
    nightByDate,
    publicHolidaysByDate,
  ]);

  const otherRemarksOk = otherRemarksLines.length === 0;

  const prevWeekNr = getISOWeekNumber(new Date(weekStart.getTime() - 7 * 86400000));
  const nextWeekNr = getISOWeekNumber(new Date(weekStart.getTime() + 7 * 86400000));

  // Helper voor datumformat
  function formatDay(date: Date) {
    const dd = date.getDate().toString().padStart(2, "0");
    const mmm = date.toLocaleString("nl-BE", { month: "short" });
    return `${dd}/${mmm}`;
  }

  return (
    <>
      <FloatingNav />
      <LegendNavPlanning />
      <main
        style={{
          background: "#fff",
          minHeight: "100vh",
          padding: "40px 24px 24px",
          width: "100vw",
          boxSizing: "border-box",
          marginTop: -15,
          position: "relative",
        }}
      >
        <header
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: 12,
            marginBottom: 32,
          }}
        >
          <button
            onClick={prevWeek}
            aria-label="Vorige week"
            className={titleFont.className}
            style={{
              padding: "8px 14px",
              background: COLORS.btnBg,
              border: `1px solid ${COLORS.btnBorder}`,
              borderRadius: 999,
              cursor: "pointer",
              minWidth: 160,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              fontWeight: 900,
              fontSize: 18,
              letterSpacing: 0.2,
              transition: "background 120ms ease-in-out",
              color: COLORS.text,
            }}
            onMouseOver={(e) => (e.currentTarget.style.background = COLORS.btnHover)}
            onMouseOut={(e) => (e.currentTarget.style.background = COLORS.btnBg)}
          >
            <IconChevronLeft />
            <span>Week {prevWeekNr}</span>
          </button>

          <h2
            className={titleFont.className}
            style={{ fontSize: 26, fontWeight: 900, color: COLORS.text, letterSpacing: 0.2, margin: 0 }}
          >
            Week van {weekDates[0].toLocaleDateString("nl-BE", { day: "2-digit", month: "2-digit", year: "numeric" })}
          </h2>

          <button
            onClick={nextWeek}
            aria-label="Volgende week"
            className={titleFont.className}
            style={{
              padding: "8px 14px",
              background: COLORS.btnBg,
              border: `1px solid ${COLORS.btnBorder}`,
              borderRadius: 999,
              cursor: "pointer",
              minWidth: 160,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              fontWeight: 900,
              fontSize: 18,
              letterSpacing: 0.2,
              transition: "background 120ms ease-in-out",
              color: COLORS.text,
            }}
            onMouseOver={(e) => (e.currentTarget.style.background = COLORS.btnHover)}
            onMouseOut={(e) => (e.currentTarget.style.background = COLORS.btnBg)}
          >
            <span>Week {nextWeekNr}</span>
            <IconChevronRight />
          </button>
        </header>
      <div
        style={{
          display: "flex",
          gap: 24,
          alignItems: "flex-start",
          width: "100%",
        }}
      >
        <div
          style={{
            background: "#f7f9fb",
            border: `1px solid ${COLORS.line}`,
            borderRadius: 18,
            padding: "10px 8px 24px",
            flex: 1,
            minWidth: 0,
            overflow: "auto",
          }}
        >
          <table style={{ width: "100%", tableLayout: "fixed", borderCollapse: "separate", borderSpacing: "10px 6px" }}>
          <thead>
            <tr>
              <th
                className={variableFont.className}
                style={{
                  background: "transparent",
                  //padding: "20px 12px 4px",
                  fontWeight: 900,
                  fontSize: 17,
                  color: COLORS.text,
                  borderRadius: 12,
                  border: "none",
                  width: 60,
                  textAlign: "center",
                  verticalAlign: "middle",
                }}
              >
                {/* geen kolomheader tekst */}
              </th>
              {weekDates.map((date, idx) => (
                <th
                  key={DAYS[idx]}
                  className={variableFont.className}
                  style={{
                    background: "transparent",
                    padding: "2px 12px 4px",
                    fontWeight: 900,
                    fontSize: 17,
                    color: COLORS.text,
                    borderRadius: 12,
                    border: "none",
                    textAlign: "center",
                    width: "calc((100% - 60px) / 7)",
                  }}
                >
                  <div
                    style={{
                      display: "inline-grid",
                      gridTemplateColumns: "8px auto",
                      alignItems: "center",
                      columnGap: 10,
                      margin: "0 auto",
                    }}
                  >
                    <div style={{ width: 8, height: 18, background: COLORS.primary, borderRadius: 4 }} />
                    <div style={{ whiteSpace: "nowrap" }}>
                      <span>{DAYS[idx]} </span>
                      <span className={variableFont.className} style={{ fontSize: 17, color: COLORS.text, fontWeight: 900, marginLeft: 4 }}>
                        {formatDay(date)}
                      </span>
                    </div>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {apothekenForDisplay.map((apotheek) => {
              const rowLayout = rowLayoutByApotheek[apotheek.key];
              const rowHeight = rowLayout?.rowHeight ?? CALENDAR_CELL_HEIGHT;
              const dividerTop = rowLayout?.dividerTop ?? Math.floor((CALENDAR_CELL_HEIGHT - CALENDAR_DIVIDER_TRACK) / 2);
              const afternoonStackHeightForRow = rowLayout?.afternoonStackHeight ?? 0;
              return (
              <tr key={apotheek.key}>
                <td
                  className={variableFont.className}
                  style={{
                    fontWeight: 900,
                    fontSize: 16,
                    background: "#0ea5a8",
                    borderRadius: 12,
                    color: "#fff",
                    border: "none",
                    padding: 0,
                    textAlign: "center",
                    verticalAlign: "middle",
                    position: "relative",
                    overflow: "hidden",
                    width: 60,
                    height: rowHeight,
                    boxSizing: "border-box",
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: 8,
                    }}
                  >
                    <div
                      style={{
                        writingMode: "vertical-rl",
                        textOrientation: "mixed",
                        transform: "rotate(180deg)",
                        whiteSpace: "nowrap",
                        lineHeight: 1,
                      }}
                    >
                      {apotheek.label}
                    </div>
                  </div>
                </td>
                {weekDates.map((date, dayIdx) => {
                  const shouldShowDropdowns =
                    dayIdx < 5
                      ? !isPublicHoliday(date) || isOnDuty(date, apotheek.key)
                      : isOnDuty(date, apotheek.key);

                  const isDuty = isOnDuty(date, apotheek.key);
                  const isHoliday = isPublicHoliday(date);

                  const nameById = new Map<string, string>(personnel.map((p) => [String(p.id), p.name]));

                  const priorityId = highlightedPersonnelId;

                  const morningIds = prioritizeId(
                    getOrderedSelectedIdsForCellGroup(apotheek.key, dayIdx, "morning"),
                    priorityId,
                    nameById
                  );
                  const afternoonIds = prioritizeId(
                    getOrderedSelectedIdsForCellGroup(apotheek.key, dayIdx, "afternoon"),
                    priorityId,
                    nameById
                  );
                  const nightIds = prioritizeId(
                    getOrderedSelectedIdsForCellGroup(apotheek.key, dayIdx, "night"),
                    priorityId,
                    nameById
                  );

                  const remarkLines = getRemarksForCell(date, apotheek.key);

                  const showNight = isNightDuty(date, apotheek.key);
                  const hasMorning = morningIds.length > 0;
                  const hasAfternoon = afternoonIds.length > 0;
                  const hasNight = showNight && nightIds.length > 0;
                  const computedAfternoonStackHeight = hasAfternoon
                    ? afternoonIds.length * PILL_EST_HEIGHT + Math.max(0, afternoonIds.length - 1) * PILL_GAP
                    : 0;
                  const afternoonBlockMinHeight = Math.max(afternoonStackHeightForRow, computedAfternoonStackHeight);

                  const pillStyle = (id: string) => ({
                    width: "100%",
                    padding: "6px 10px",
                    borderRadius: 8,
                    border: "1px solid #e5e7eb",
                    fontSize: 15,
                    background: highlightBgForSelection(id),
                    color: "#0f172a",
                    fontWeight: 500,
                    boxShadow: "0 1px 4px rgba(0,0,0,0.03)",
                    textAlign: "left" as const,
                    whiteSpace: "nowrap" as const,
                    overflow: "hidden" as const,
                    textOverflow: "ellipsis" as const,
                  });

                  const remarkPillStyle = {
                    width: "100%",
                    padding: "6px 10px",
                    borderRadius: 8,
                    border: "1px solid #e5e7eb",
                    fontSize: 12,
                    background: "#ffffff",
                    color: "#0f172a",
                    fontWeight: 400,
                    fontStyle: "italic" as const,
                    boxShadow: "0 1px 4px rgba(0,0,0,0.03)",
                    textAlign: "left" as const,
                    whiteSpace: "normal" as const,
                    overflow: "hidden" as const,
                    wordBreak: "break-word" as const,
                    lineHeight: 1.25,
                  };

                  const formatRemark = (line: string) => {
                    const t = String(line || "").trim();
                    if (!t) return "";
                    return t.startsWith("*") ? t : `* ${t}`;
                  };

                  return (
                    <td
                      key={dayIdx}
                      style={{
                        padding: 10,
                        width: "calc((100% - 60px) / 7)",
                        textAlign: "center",
                        background: isDuty ? "#fce7f3" : isHoliday ? "#fff9c4" : dayIdx >= 5 ? "#eef2f7" : "#fff",
                        borderRadius: 12,
                        border: `1px solid ${COLORS.line}`,
                        verticalAlign: "top",
                        height: rowHeight,
                        boxSizing: "border-box",
                      }}
                    >
                      {shouldShowDropdowns ? (
                        <div
                          style={{
                            display: "grid",
                            gridTemplateRows: `${dividerTop}px ${CALENDAR_DIVIDER_TRACK}px minmax(0, 1fr)`,
                            height: "100%",
                            minHeight: 0,
                          }}
                        >
                          {/* Voormiddag (bovenste helft) */}
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: 6,
                              minHeight: 0,
                              overflowY: "auto",
                            }}
                          >
                            {hasMorning
                              ? morningIds.map((id, i) => (
                                  <div key={`m_${i}_${id}`} style={pillStyle(id)}>
                                    {nameById.get(id) || id}
                                  </div>
                                ))
                              : null}
                          </div>

                          {/* Altijd scheidingslijn tussen voormiddag/namiddag */}
                          <div style={{ height: CALENDAR_DIVIDER_TRACK, display: "flex", alignItems: "center" }}>
                            <div style={{ width: "100%", height: 1, background: "#000" }} />
                          </div>

                          {/* Namiddag (onderste helft) + eventueel nacht */}
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: 0,
                              minHeight: 0,
                              overflowY: "auto",
                            }}
                          >
                            {showNight ? (
                              <>
                                <div
                                  style={{
                                    minHeight: afternoonBlockMinHeight,
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: 6,
                                  }}
                                >
                                  {hasAfternoon
                                    ? afternoonIds.map((id, i) => (
                                        <div key={`a_${i}_${id}`} style={pillStyle(id)}>
                                          {nameById.get(id) || id}
                                        </div>
                                      ))
                                    : null}
                                </div>

                                <div style={{ height: CALENDAR_DIVIDER_TRACK, display: "flex", alignItems: "center" }}>
                                  <div style={{ width: "100%", height: 1, background: "#000" }} />
                                </div>

                                <div style={{ minHeight: PILL_EST_HEIGHT, display: "flex", flexDirection: "column", gap: 6 }}>
                                  {hasNight
                                    ? nightIds.map((id, i) => (
                                        <div key={`n_${i}_${id}`} style={pillStyle(id)}>
                                          {nameById.get(id) || id}
                                        </div>
                                      ))
                                    : null}
                                </div>
                              </>
                            ) : (
                              <>
                                {hasAfternoon ? (
                                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                    {afternoonIds.map((id, i) => (
                                      <div key={`a_${i}_${id}`} style={pillStyle(id)}>
                                        {nameById.get(id) || id}
                                      </div>
                                    ))}
                                  </div>
                                ) : null}
                              </>
                            )}

                            {remarkLines.length ? (
                              <div
                                style={{
                                  marginTop: 10,
                                  display: "flex",
                                  flexDirection: "column",
                                  gap: 4,
                                }}
                              >
                                {remarkLines.map((line, idx) => (
                                  <div key={`remark_${idx}`} style={remarkPillStyle}>
                                    {formatRemark(line)}
                                  </div>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      ) : null}

                      {!shouldShowDropdowns && remarkLines.length ? (
                        <div
                          style={{
                            marginTop: 2,
                            display: "flex",
                            flexDirection: "column",
                            gap: 4,
                          }}
                        >
                          {remarkLines.map((line, idx) => (
                            <div key={`remark_${idx}`} style={remarkPillStyle}>
                              {formatRemark(line)}
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </td>
                  );
                })}
              </tr>
              );
            })}
          </tbody>
          </table>
        </div>

        <HighlightPerson
          width={420}
          allPharmaciesMinOneShift={allPharmaciesMinOneShift}
          missingShifts={missingShifts}
          allPersonnelPlanned={allPersonnelPlanned}
          missingPersonnel={missingPersonnel}
          otherRemarksOk={otherRemarksOk}
          otherRemarksLines={otherRemarksLines}
          highlightPersonnel={highlightPersonnelForDisplay.map((p) => ({
            id: String(p.id),
            name: p.name,
            avatar_url: resolveAvatarUrl(p.avatar_url ?? null),
          }))}
          highlightDisabledById={highlightDisabledById}
          highlightColorForId={highlightColorForId}
          onToggleHighlight={(id) => {
            setHighlightDisabledById((prev) => {
              if (id === "__everyone__") {
                // Toggle all: if everything is currently enabled, disable everyone.
                // Otherwise, enable everyone.
                if (Object.keys(prev).length === 0) {
                  const ids = Array.from(
                    new Set(highlightPersonnelForDisplay.map((p) => String(p.id)).filter(Boolean))
                  );
                  if (ids.length === 0) return prev;
                  const allOff: Record<string, true> = {};
                  for (const pid of ids) allOff[pid] = true;
                  return allOff;
                }
                return {};
              }
              const next = { ...prev };
              if (next[id]) delete next[id];
              else next[id] = true;
              return next;
            });
          }}
          colors={{
            primary: COLORS.primary,
            line: COLORS.line,
            btnBg: COLORS.btnBg,
            btnBorder: COLORS.btnBorder,
            btnHover: COLORS.btnHover,
            text: COLORS.text,
          }}
          weekNumber={weekNumber}
          onSaveWeek={onSaveWeekToDb}
          savingWeek={savingWeek}
          onClick={() => {
            void applyStandardPlanningToWeek();
          }}
        />
      </div>
      </main>
    </>
  );
}
