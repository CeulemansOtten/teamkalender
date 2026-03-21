"use client";
import React, { useMemo, useState, useEffect } from "react";
import { variableFont, titleFont } from "../components/fonts";
import { supabase } from "@/lib/supabaseClient";
import FloatingNav from "../components/FloatingNav";
import LegendNavPlanning from "../components/LegendNav_Planning";
import PlanningCheck from "./PlanningCheck";

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
  { key: "Eeuwfeestapotheek", label: "Eeuwfeest Apotheek" },
  { key: "Apotheek Generaal", label: "Apotheek Generaal" },
  { key: "Apotheek Minerva", label: "Apotheek Minerva" },
];

const DAYS = ["Ma", "Di", "Wo", "Do", "Vr", "Za", "Zo"];

// Layout helpers: align divider lines across all days within the same apotheek row.
// We base heights on the maximum number of dropdowns per shift in that apotheek.
const CALENDAR_TD_PADDING_Y = 20; // td uses padding: 10px -> 20px vertical total
const SHIFT_GAP = 6;
const DIVIDER_LINE_HEIGHT = 1;
const CALENDAR_DIVIDER_TRACK = SHIFT_GAP * 2 + DIVIDER_LINE_HEIGHT; // preserve current visual spacing (6px above/below)
const SELECT_HEIGHT = 36; // fixed height so divider alignment is deterministic

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
  type RemarkItem = { id: string; text: string };

  const [weekStart, setWeekStart] = useState(getMonday(new Date()));
  const [personnel, setPersonnel] = useState<PersonnelRow[]>([]);
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [onDutyByDate, setOnDutyByDate] = useState<Record<string, Record<string, true>>>({});
  const [nightByDate, setNightByDate] = useState<Record<string, Record<string, true>>>({});
  const [publicHolidaysByDate, setPublicHolidaysByDate] = useState<Record<string, true>>({});
  const [remarksByDatePharmacy, setRemarksByDatePharmacy] = useState<Record<string, RemarkItem[]>>({});
  const [hoveredRemarkId, setHoveredRemarkId] = useState<string | null>(null);
  const [deletingRemarkId, setDeletingRemarkId] = useState<string | null>(null);

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

  const personNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of personnel) {
      if (!p?.id) continue;
      m.set(p.id, String(p.name || ""));
    }
    return m;
  }, [personnel]);

  const personStatusById = useMemo(() => {
    const m = new Map<string, string | null>();
    for (const p of personnel) {
      if (!p?.id) continue;
      m.set(p.id, p.status ?? null);
    }
    return m;
  }, [personnel]);

  const comparePersonnelIds = (a: string, b: string) => {
    const statusDiff = statusOrder(personStatusById.get(a)) - statusOrder(personStatusById.get(b));
    if (statusDiff !== 0) return statusDiff;
    const an = (personNameById.get(a) || a).toLocaleLowerCase();
    const bn = (personNameById.get(b) || b).toLocaleLowerCase();
    const c = an.localeCompare(bn);
    return c !== 0 ? c : a.localeCompare(b);
  };

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
    return colorIndexById.get(id) ?? 0;
  }

  function highlightBgForSelection(currentValue: string) {
    if (!currentValue) return "#f7f9fb";
    if (currentValue === "__add_shift__") return "#f7f9fb";

    if (highlightDisabledById[currentValue]) return "#f7f9fb";
    return HIGHLIGHT_COLORS[colorIndexForId(currentValue)];
  }

  function highlightColorForId(id: string) {
    return HIGHLIGHT_COLORS[colorIndexForId(id)];
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

  const colorIndexById = useMemo(() => {
    const sorted = [...activePersonnel].sort((a, b) =>
      String(a.id).localeCompare(String(b.id))
    );
    const map = new Map<string, number>();
    sorted.forEach((p, i) => {
      map.set(String(p.id), i % HIGHLIGHT_COLORS.length);
    });
    return map;
  }, [activePersonnel, HIGHLIGHT_COLORS]);

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
        .select("id,date,remark,pharmacy,created_at")
        .gte("date", start)
        .lte("date", end)
        .order("created_at", { ascending: true });

      if (error || !data) {
        setRemarksByDatePharmacy({});
        return;
      }

      const allowed = new Set(APOTHEKEN.map((a) => a.key));
      const map: Record<string, RemarkItem[]> = {};
      for (const row of data as Array<{ id?: string | null; date?: string | null; remark?: string | null; pharmacy?: string | null }>) {
        const id = String(row?.id || "").trim();
        const date = String(row?.date || "").trim();
        const remark = String(row?.remark || "").trim();
        if (!id || !date || !remark) continue;

        const pharmacy = String(row?.pharmacy || "").trim();
        const pharmacyKey = pharmacy && allowed.has(pharmacy) ? pharmacy : null;
        const key = `${date}|${pharmacyKey || "__all__"}`;
        map[key] ||= [];
        map[key].push({ id, text: remark });
      }
      setRemarksByDatePharmacy(map);
    })();
  }, [weekStart]);

  async function deleteRemarkById(id: string) {
    const rid = String(id || "").trim();
    if (!rid) return;
    if (deletingRemarkId) return;
    setDeletingRemarkId(rid);
    try {
      const { error } = await supabase.from("remarks_planning").delete().eq("id", rid);
      if (error) throw error;

      setRemarksByDatePharmacy((prev) => {
        const next: Record<string, RemarkItem[]> = {};
        for (const [key, arr] of Object.entries(prev)) {
          const filtered = (arr || []).filter((r) => r.id !== rid);
          if (filtered.length) next[key] = filtered;
        }
        return next;
      });
    } catch (e) {
      console.error("[Planning] delete remark failed", e);
    } finally {
      setDeletingRemarkId(null);
      setHoveredRemarkId((cur) => (cur === rid ? null : cur));
    }
  }

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

    const slotKeyFor = (slotIdx: number) => {
      if (group === "afternoon") return `${apotheekKey}_${dayIdx}_extra_${slotIdx}`;
      if (group === "night") return `${apotheekKey}_${dayIdx}_night_${slotIdx}`;
      return `${apotheekKey}_${dayIdx}_${slotIdx}`;
    };

    setInputs((prev) => {
      const next: Record<string, string> = { ...prev, [`${apotheekKey}_${dayIdx}_${inputIdx}`]: value };

      // Sort filled selections within this cell+shift (alphabetical by first name).
      const count = getShiftCount(apotheekKey, dayIdx, group);
      const slots = Array.from({ length: count }, (_, i) => slotKeyFor(i));
      const filled = slots
        .map((k) => String(next[k] || "").trim())
        .filter((v) => v && v !== "__add_shift__")
        .sort(comparePersonnelIds);

      let changed = false;
      for (let i = 0; i < slots.length; i++) {
        const k = slots[i];
        const desired = filled[i] || "";
        const current = String(next[k] || "").trim();
        if (desired) {
          if (current !== desired) {
            next[k] = desired;
            changed = true;
          }
        } else {
          if (k in next) {
            delete next[k];
            changed = true;
          }
        }
      }

      // If we only changed the clicked value (no reordering), still return updated object.
      return changed ? next : next;
    });
  }

  // Once personnel is loaded, normalize existing selections (e.g., after DB load) so filled dropdowns are alphabetical.
  useEffect(() => {
    if (!personnel.length) return;


    setInputs((prev) => {
      let next = prev;
      let changedAny = false;

      for (const apotheek of APOTHEKEN) {
        for (let dayIdx = 0; dayIdx < 7; dayIdx++) {
          for (const group of ["morning", "afternoon", "night"] as const) {
            const count = getShiftCount(apotheek.key, dayIdx, group);
            const slotKeyFor = (slotIdx: number) => {
              if (group === "afternoon") return `${apotheek.key}_${dayIdx}_extra_${slotIdx}`;
              if (group === "night") return `${apotheek.key}_${dayIdx}_night_${slotIdx}`;
              return `${apotheek.key}_${dayIdx}_${slotIdx}`;
            };
            const slots = Array.from({ length: count }, (_, i) => slotKeyFor(i));
            const filled = slots
              .map((k) => String(next[k] || "").trim())
              .filter((v) => v && v !== "__add_shift__")
              .sort(comparePersonnelIds);

            const updated: Record<string, string> = next === prev ? { ...next } : { ...next };
            let changed = false;
            for (let i = 0; i < slots.length; i++) {
              const k = slots[i];
              const desired = filled[i] || "";
              const current = String(updated[k] || "").trim();
              if (desired) {
                if (current !== desired) {
                  updated[k] = desired;
                  changed = true;
                }
              } else {
                if (k in updated) {
                  delete updated[k];
                  changed = true;
                }
              }
            }
            if (changed) {
              next = updated;
              changedAny = true;
            }
          }
        }
      }

      return changedAny ? next : prev;
    });
  }, [personnel.length, personNameById]);

  function statusOrder(status: string | null | undefined): number {
    if (status === "owner") return 0;
    if (status === "pharmacist") return 1;
    if (status === "replacement") return 2;
    return 3;
  }

  function sortByStatusThenName(a: PersonnelRow, b: PersonnelRow) {
    const statusDiff = statusOrder(a.status) - statusOrder(b.status);
    if (statusDiff !== 0) return statusDiff;
    return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
  }

  // Personeel sorteren en indelen
  function getOptions(apotheekKey: string) {
    const boven = activePersonnel
      .filter((p) => Array.isArray(p.pharmacy) && p.pharmacy.includes(apotheekKey))
      .sort(sortByStatusThenName);
    const onder = activePersonnel
      .filter((p) => !Array.isArray(p.pharmacy) || !p.pharmacy.includes(apotheekKey))
      .sort(sortByStatusThenName);

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
    const bovenAll = activePersonnel
      .filter((p) => Array.isArray(p.pharmacy) && p.pharmacy.includes(apotheekKey))
      .sort(sortByStatusThenName);
    const onderAll = activePersonnel
      .filter((p) => !Array.isArray(p.pharmacy) || !p.pharmacy.includes(apotheekKey))
      .sort(sortByStatusThenName);

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
      .sort(sortByStatusThenName)
      .map((p) => ({ id: p.id, name: p.name }));

    const vrijPeople = weekdayLower
      ? activePersonnel
          .filter((p) => vrijSet.has(p.id) && !leaveSet.has(p.id) && !selected.has(p.id))
          .sort(sortByStatusThenName)
          .map((p) => ({ id: p.id, name: p.name }))
      : [];

    const out: Array<{ id: string; name: string; disabled?: boolean }> = [...normal];
    if (currentValue && !activePersonnelIdSet.has(currentValue)) {
      const nm = personNameById.get(currentValue) || currentValue;
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
    const stackHeight = (count: number) => {
      if (count <= 0) return 0;
      return count * SELECT_HEIGHT + Math.max(0, count - 1) * SHIFT_GAP;
    };

    const out: Record<
      string,
      {
        rowHeight: number;
        morningHeight: number;
        afternoonHeight: number;
        nightHeight: number;
      }
    > = {};

    for (const apotheek of APOTHEKEN) {
      let maxMorning = 0;
      let maxAfternoon = 0;
      let maxNight = 0;
      let hasAnyNightDuty = false;

      for (let dayIdx = 0; dayIdx < 7; dayIdx++) {
        const date = weekDates[dayIdx];
        if (!shouldShowDropdownsForCell(date, dayIdx, apotheek.key)) continue;

        maxMorning = Math.max(maxMorning, getShiftCount(apotheek.key, dayIdx, "morning"));
        maxAfternoon = Math.max(maxAfternoon, getShiftCount(apotheek.key, dayIdx, "afternoon"));

        if (isNightDuty(date, apotheek.key)) {
          hasAnyNightDuty = true;
          maxNight = Math.max(maxNight, getShiftCount(apotheek.key, dayIdx, "night"));
        }
      }

      const morningHeight = stackHeight(maxMorning);
      const afternoonHeight = stackHeight(maxAfternoon);
      const nightHeight = stackHeight(maxNight);

      const contentNeeded =
        morningHeight +
        CALENDAR_DIVIDER_TRACK +
        afternoonHeight +
        (hasAnyNightDuty ? CALENDAR_DIVIDER_TRACK + nightHeight : 0);

      // Table row height behaves like a min-height; it can still grow if needed.
      const rowHeight = contentNeeded + CALENDAR_TD_PADDING_Y;

      out[apotheek.key] = { rowHeight, morningHeight, afternoonHeight, nightHeight };
    }

    return out;
  }, [shiftCounts, weekDates, onDutyByDate, nightByDate, publicHolidaysByDate]);

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

  async function onSaveRemark(dayIdx: number, remark: string, pharmacy: string | null): Promise<boolean> {
    try {
      const idx = Number(dayIdx);
      if (!Number.isFinite(idx) || idx < 0 || idx > 6) return false;
      const text = String(remark || "").trim();
      if (!text) return false;

      const allowed = new Set(APOTHEKEN.map((a) => a.key));
      const pharmacyText = String(pharmacy || "").trim();
      const pharmacyValue = pharmacyText && allowed.has(pharmacyText) ? pharmacyText : null;

      const date = toISODateLocal(weekDates[idx]);
      const { data, error } = await supabase
        .from("remarks_planning")
        .insert({ date, remark: text, pharmacy: pharmacyValue })
        .select("id,date,remark,pharmacy")
        .single();
      if (error) throw error;

      const id = String(data?.id || "").trim();
      if (id) {
        const key = `${date}|${pharmacyValue || "__all__"}`;
        const savedText = String((data as { remark?: string | null } | null)?.remark || text).trim() || text;
        setRemarksByDatePharmacy((prev) => {
          const next = { ...prev };
          const existing = next[key] ? [...next[key]] : [];
          if (!existing.some((r) => r.id === id)) {
            existing.push({ id, text: savedText });
          }
          next[key] = existing;
          return next;
        });
      }

      return true;
    } catch (e) {
      console.error("[Planning] save remark failed", e);
      return false;
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

  async function copyPreviousWeekPlanningToCurrentWeek() {
    try {
      const prevWeekStart = new Date(weekStart);
      prevWeekStart.setDate(prevWeekStart.getDate() - 7);

      const prevWeekEnd = new Date(prevWeekStart);
      prevWeekEnd.setDate(prevWeekEnd.getDate() + 6);

      const prevStart = toISODateLocal(prevWeekStart);
      const prevEnd = toISODateLocal(prevWeekEnd);

      const { data, error } = await supabase
        .from("planning")
        .select("date, personnel_id, shift, pharmacy")
        .gte("date", prevStart)
        .lte("date", prevEnd);

      if (error) {
        console.error("[Planning] copy previous week load failed", error);
        return;
      }

      const prevWeekDates = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(prevWeekStart);
        d.setDate(d.getDate() + i);
        return d;
      });

      const dateToIdxPrev: Record<string, number> = {};
      for (let i = 0; i < 7; i++) dateToIdxPrev[toISODateLocal(prevWeekDates[i])] = i;

      const byCell: Record<string, Record<number, { morning: string[]; afternoon: string[]; night: string[] }>> = {};
      const seen = new Set<string>();

      for (const row of (data || []) as Array<{ date?: string; personnel_id?: string; shift?: string; pharmacy?: string | null }>) {
        const date = String(row.date || "");
        const personnel_id = String(row.personnel_id || "");
        const shift = String(row.shift || "").toLowerCase();
        const pharmacy = String(row.pharmacy || "");
        if (!date || !personnel_id || !shift || !pharmacy) continue;
        if (!APOTHEKEN.some((a) => a.key === pharmacy)) continue;

        const dayIdx = dateToIdxPrev[date];
        if (dayIdx === undefined) continue;

        const group = shift.includes("nacht") ? "night" : shift.includes("voor") ? "morning" : "afternoon";
        const dedupeKey = `${date}|${pharmacy}|${group}|${personnel_id}`;
        if (seen.has(dedupeKey)) continue;
        seen.add(dedupeKey);

        byCell[pharmacy] ||= {};
        byCell[pharmacy][dayIdx] ||= { morning: [], afternoon: [], night: [] };
        byCell[pharmacy][dayIdx][group].push(personnel_id);
      }

      const nextInputs: Record<string, string> = {};
      const neededCounts: Record<string, { baseDay: number; baseNight: number; morning: number; afternoon: number; night: number }> = {};

      for (const apotheek of APOTHEKEN) {
        const baseDay = getBaseShiftCount(apotheek.key);
        const baseNight = 1;

        for (let dayIdx = 0; dayIdx < 7; dayIdx++) {
          const date = weekDates[dayIdx];
          if (!shouldShowDropdownsForCell(date, dayIdx, apotheek.key)) continue;

          const cellKey = `${apotheek.key}_${dayIdx}`;
          const saved = byCell[apotheek.key]?.[dayIdx] || { morning: [], afternoon: [], night: [] };

          const morningNeed = Math.max(baseDay, saved.morning.length);

          const nightDuty = isNightDuty(date, apotheek.key);
          const useLegacyOverflowAsNight = nightDuty && saved.night.length === 0;

          const afternoonNeed = useLegacyOverflowAsNight
            ? Math.max(baseDay, Math.min(saved.afternoon.length, baseDay))
            : Math.max(baseDay, saved.afternoon.length);

          const legacyNightOverflowCount = useLegacyOverflowAsNight ? Math.max(0, saved.afternoon.length - baseDay) : 0;
          const nightNeed = nightDuty
            ? Math.max(baseNight, saved.night.length + legacyNightOverflowCount)
            : baseNight;

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

          const afternoonFirst = useLegacyOverflowAsNight ? saved.afternoon.slice(0, baseDay) : saved.afternoon;
          const legacyNightOverflow = useLegacyOverflowAsNight ? saved.afternoon.slice(baseDay) : [];
          const nightCombined = nightDuty ? (useLegacyOverflowAsNight ? legacyNightOverflow : saved.night) : [];

          afternoonFirst.forEach((pid, i) => {
            nextInputs[`${apotheek.key}_${dayIdx}_extra_${i}`] = pid;
          });

          nightCombined.forEach((pid, i) => {
            nextInputs[`${apotheek.key}_${dayIdx}_night_${i}`] = pid;
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
      console.error("[Planning] copy previous week failed", e);
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

      for (const row of data as Array<{ date?: string; personnel_id?: string; shift?: string; pharmacy?: string | null }>) {
        const date = String(row.date || "");
        const personnel_id = String(row.personnel_id || "");
        const shift = String(row.shift || "").toLowerCase();
        const pharmacy = String(row.pharmacy || "");
        if (!date || !personnel_id || !shift || !pharmacy) continue;
        if (!APOTHEKEN.some((a) => a.key === pharmacy)) continue;

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
            {APOTHEKEN.map((apotheek) => {
              const layout = rowLayoutByApotheek[apotheek.key];
              const rowHeight = layout?.rowHeight;
              const morningHeight = layout?.morningHeight ?? 0;
              const afternoonHeight = layout?.afternoonHeight ?? 0;

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
                    minHeight: rowHeight,
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

                  const morningCount = getShiftCount(apotheek.key, dayIdx, "morning");
                  const afternoonCount = getShiftCount(apotheek.key, dayIdx, "afternoon");
                  const nightCount = getShiftCount(apotheek.key, dayIdx, "night");
                  const showNight = isNightDuty(date, apotheek.key);

                  const remarkLines = getRemarksForCell(date, apotheek.key);

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
                        minHeight: rowHeight,
                        boxSizing: "border-box",
                      }}
                    >
                      {shouldShowDropdowns ? (
                        <div
                          style={{
                            display: "grid",
                            gridTemplateRows: showNight
                              ? `${morningHeight}px ${CALENDAR_DIVIDER_TRACK}px ${afternoonHeight}px ${CALENDAR_DIVIDER_TRACK}px auto`
                              : `${morningHeight}px ${CALENDAR_DIVIDER_TRACK}px minmax(${afternoonHeight}px, auto)`,
                            minHeight: 0,
                          }}
                        >
                          {/* Voormiddag */}
                          <div style={{ display: "flex", flexDirection: "column", gap: SHIFT_GAP, minHeight: 0 }}>
                            {Array.from({ length: morningCount }, (_, i) => i).map((inputIdx) => {
                              const isLast = inputIdx === morningCount - 1;
                              const currentValue = inputs[`${apotheek.key}_${dayIdx}_${inputIdx}`] || "";
                              return (
                                <select
                                  key={inputIdx}
                                  value={currentValue}
                                  onChange={(e) =>
                                    handleChangeOrAddShift(
                                      apotheek.key,
                                      dayIdx,
                                      inputIdx,
                                      e.target.value,
                                      "morning",
                                      isLast,
                                      currentValue
                                    )
                                  }
                                  style={{
                                    width: "100%",
                                    height: SELECT_HEIGHT,
                                    boxSizing: "border-box",
                                    padding: "6px 10px",
                                    borderRadius: 8,
                                    border: "1px solid #e5e7eb",
                                    fontSize: 15,
                                    background: highlightBgForSelection(currentValue),
                                    color: "#0f172a",
                                    fontWeight: 500,
                                    boxShadow: "0 1px 4px rgba(0,0,0,0.03)",
                                    transition: "border 120ms",
                                  }}
                                >
                                  <option value=""></option>
                                  {getFilteredOptions(apotheek.key, dayIdx, "morning", currentValue).map((p) =>
                                    p.id === "sep" || p.id === "leave_sep" || p.id === "vrij_sep" ? (
                                      <option key={p.id} disabled>
                                        {p.id === "leave_sep" ? "---- verlof ----" : p.id === "vrij_sep" ? "---- vrij ----" : "-----"}
                                      </option>
                                    ) : (p as any).disabled ? (
                                      <option key={p.id} value={p.id} disabled>
                                        {p.name}
                                      </option>
                                    ) : (
                                      <option key={p.id} value={p.id}>
                                        {p.name}
                                      </option>
                                    )
                                  )}
                                  {isLast ? (
                                    <>
                                      <option disabled>----</option>
                                      <option value="__add_shift__">+ voeg shift toe</option>
                                    </>
                                  ) : null}
                                </select>
                              );
                            })}
                          </div>

                          {/* Scheidingslijn voormiddag/namiddag */}
                          <div style={{ height: CALENDAR_DIVIDER_TRACK, display: "flex", alignItems: "center" }}>
                            <div style={{ width: "100%", height: 1, background: "#000" }} />
                          </div>

                          {/* Namiddag */}
                          <div style={{ display: "flex", flexDirection: "column", gap: SHIFT_GAP, minHeight: 0 }}>
                            {Array.from({ length: afternoonCount }, (_, i) => i).map((extraIdx) => {
                              const isLast = extraIdx === afternoonCount - 1;
                              const keyPart = `extra_${extraIdx}`;
                              const currentValue = inputs[`${apotheek.key}_${dayIdx}_${keyPart}`] || "";
                              return (
                                <select
                                  key={keyPart}
                                  value={currentValue}
                                  onChange={(e) =>
                                    handleChangeOrAddShift(
                                      apotheek.key,
                                      dayIdx,
                                      keyPart,
                                      e.target.value,
                                      "afternoon",
                                      isLast,
                                      currentValue
                                    )
                                  }
                                  style={{
                                    width: "100%",
                                    height: SELECT_HEIGHT,
                                    boxSizing: "border-box",
                                    padding: "6px 10px",
                                    borderRadius: 8,
                                    border: "1px solid #e5e7eb",
                                    fontSize: 15,
                                    background: highlightBgForSelection(currentValue),
                                    color: "#0f172a",
                                    fontWeight: 500,
                                    boxShadow: "0 1px 4px rgba(0,0,0,0.03)",
                                    transition: "border 120ms",
                                  }}
                                >
                                  <option value=""></option>
                                  {getFilteredOptions(apotheek.key, dayIdx, "afternoon", currentValue).map((p) =>
                                    p.id === "sep" || p.id === "leave_sep" || p.id === "vrij_sep" ? (
                                      <option key={p.id} disabled>
                                        {p.id === "leave_sep" ? "---- verlof ----" : p.id === "vrij_sep" ? "---- vrij ----" : "-----"}
                                      </option>
                                    ) : (p as any).disabled ? (
                                      <option key={p.id} value={p.id} disabled>
                                        {p.name}
                                      </option>
                                    ) : (
                                      <option key={p.id} value={p.id}>
                                        {p.name}
                                      </option>
                                    )
                                  )}
                                  {isLast ? (
                                    <>
                                      <option disabled>----</option>
                                      <option value="__add_shift__">+ voeg shift toe</option>
                                    </>
                                  ) : null}
                                </select>
                              );
                            })}

                            {!showNight && remarkLines.length ? (
                              <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 10 }}>
                                {remarkLines.map((r) => (
                                  <div
                                    key={r.id}
                                    style={{ ...remarkPillStyle, position: "relative" as const }}
                                    onMouseEnter={() => setHoveredRemarkId(r.id)}
                                    onMouseLeave={() => setHoveredRemarkId((cur) => (cur === r.id ? null : cur))}
                                  >
                                    <span
                                      style={{
                                        color: hoveredRemarkId === r.id ? "#9ca3af" : undefined,
                                        transition: "color 120ms ease",
                                      }}
                                    >
                                      {formatRemark(r.text)}
                                    </span>
                                    {hoveredRemarkId === r.id ? (
                                      <button
                                        type="button"
                                        className={variableFont.className}
                                        onClick={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          void deleteRemarkById(r.id);
                                        }}
                                        disabled={deletingRemarkId === r.id}
                                        style={{
                                          position: "absolute",
                                          top: "50%",
                                          left: "50%",
                                          transform: "translate(-50%, -50%)",
                                          padding: "6px 10px",
                                          borderRadius: 10,
                                          border: "none",
                                          background: COLORS.primary,
                                          color: "#ffffff",
                                          fontSize: 13,
                                          fontStyle: "normal",
                                          fontWeight: 700,
                                          cursor: deletingRemarkId === r.id ? "not-allowed" : "pointer",
                                          opacity: deletingRemarkId === r.id ? 0.6 : 1,
                                          zIndex: 2,
                                          transition: "opacity 120ms ease",
                                        }}
                                      >
                                        Verwijder
                                      </button>
                                    ) : null}
                                  </div>
                                ))}
                              </div>
                            ) : null}
                          </div>

                          {showNight ? (
                            <>
                              {/* Scheidingslijn namiddag/nacht */}
                              <div style={{ height: CALENDAR_DIVIDER_TRACK, display: "flex", alignItems: "center" }}>
                                <div style={{ width: "100%", height: 1, background: "#000" }} />
                              </div>

                              {/* Nacht */}
                              <div style={{ display: "flex", flexDirection: "column", gap: SHIFT_GAP, minHeight: 0 }}>
                                {Array.from({ length: nightCount }, (_, i) => i).map((nightIdx) => {
                                  const isLast = nightIdx === nightCount - 1;
                                  const keyPart = `night_${nightIdx}`;
                                  const currentValue = inputs[`${apotheek.key}_${dayIdx}_${keyPart}`] || "";
                                  return (
                                    <select
                                      key={keyPart}
                                      value={currentValue}
                                      onChange={(e) =>
                                        handleChangeOrAddShift(
                                          apotheek.key,
                                          dayIdx,
                                          keyPart,
                                          e.target.value,
                                          "night",
                                          isLast,
                                          currentValue
                                        )
                                      }
                                      style={{
                                        width: "100%",
                                        height: SELECT_HEIGHT,
                                        boxSizing: "border-box",
                                        padding: "6px 10px",
                                        borderRadius: 8,
                                        border: "1px solid #e5e7eb",
                                        fontSize: 15,
                                        background: highlightBgForSelection(currentValue),
                                        color: "#0f172a",
                                        fontWeight: 500,
                                        boxShadow: "0 1px 4px rgba(0,0,0,0.03)",
                                        transition: "border 120ms",
                                      }}
                                    >
                                      <option value=""></option>
                                      {getFilteredOptions(apotheek.key, dayIdx, "night", currentValue).map((p) =>
                                        p.id === "sep" || p.id === "leave_sep" || p.id === "vrij_sep" ? (
                                          <option key={p.id} disabled>
                                            {p.id === "leave_sep" ? "---- verlof ----" : p.id === "vrij_sep" ? "---- vrij ----" : "-----"}
                                          </option>
                                        ) : (p as any).disabled ? (
                                          <option key={p.id} value={p.id} disabled>
                                            {p.name}
                                          </option>
                                        ) : (
                                          <option key={p.id} value={p.id}>
                                            {p.name}
                                          </option>
                                        )
                                      )}
                                      {isLast ? (
                                        <>
                                          <option disabled>----</option>
                                          <option value="__add_shift__">+ voeg shift toe</option>
                                        </>
                                      ) : null}
                                    </select>
                                  );
                                })}

                                {remarkLines.length ? (
                                  <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 10 }}>
                                    {remarkLines.map((r) => (
                                      <div
                                        key={r.id}
                                        style={{ ...remarkPillStyle, position: "relative" as const }}
                                        onMouseEnter={() => setHoveredRemarkId(r.id)}
                                        onMouseLeave={() => setHoveredRemarkId((cur) => (cur === r.id ? null : cur))}
                                      >
                                        <span
                                          style={{
                                            color: hoveredRemarkId === r.id ? "#9ca3af" : undefined,
                                            transition: "color 120ms ease",
                                          }}
                                        >
                                          {formatRemark(r.text)}
                                        </span>
                                        {hoveredRemarkId === r.id ? (
                                          <button
                                            type="button"
                                            className={variableFont.className}
                                            onClick={(e) => {
                                              e.preventDefault();
                                              e.stopPropagation();
                                              void deleteRemarkById(r.id);
                                            }}
                                            disabled={deletingRemarkId === r.id}
                                            style={{
                                              position: "absolute",
                                              top: "50%",
                                              left: "50%",
                                              transform: "translate(-50%, -50%)",
                                              padding: "6px 10px",
                                              borderRadius: 10,
                                              border: "none",
                                              background: COLORS.primary,
                                              color: "#ffffff",
                                              fontSize: 13,
                                              fontStyle: "normal",
                                              fontWeight: 700,
                                              cursor: deletingRemarkId === r.id ? "not-allowed" : "pointer",
                                              opacity: deletingRemarkId === r.id ? 0.6 : 1,
                                              zIndex: 2,
                                              transition: "opacity 120ms ease",
                                            }}
                                          >
                                            Verwijder
                                          </button>
                                        ) : null}
                                      </div>
                                    ))}
                                  </div>
                                ) : null}
                              </div>
                            </>
                          ) : null}
                        </div>
                      ) : null}

                      {!shouldShowDropdowns && remarkLines.length ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          {remarkLines.map((r) => (
                            <div
                              key={r.id}
                              style={{ ...remarkPillStyle, position: "relative" as const }}
                              onMouseEnter={() => setHoveredRemarkId(r.id)}
                              onMouseLeave={() => setHoveredRemarkId((cur) => (cur === r.id ? null : cur))}
                            >
                              <span
                                style={{
                                  color: hoveredRemarkId === r.id ? "#9ca3af" : undefined,
                                  transition: "color 120ms ease",
                                }}
                              >
                                {formatRemark(r.text)}
                              </span>
                              {hoveredRemarkId === r.id ? (
                                <button
                                  type="button"
                                  className={variableFont.className}
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    void deleteRemarkById(r.id);
                                  }}
                                  disabled={deletingRemarkId === r.id}
                                  style={{
                                    position: "absolute",
                                    top: "50%",
                                    left: "50%",
                                    transform: "translate(-50%, -50%)",
                                    padding: "6px 10px",
                                    borderRadius: 10,
                                    border: "none",
                                    background: COLORS.primary,
                                    color: "#ffffff",
                                    fontSize: 13,
                                    fontStyle: "normal",
                                    fontWeight: 700,
                                    cursor: deletingRemarkId === r.id ? "not-allowed" : "pointer",
                                    opacity: deletingRemarkId === r.id ? 0.6 : 1,
                                    zIndex: 2,
                                    transition: "opacity 120ms ease",
                                  }}
                                >
                                  Verwijder
                                </button>
                              ) : null}
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

        <PlanningCheck
          width={420}
          allPharmaciesMinOneShift={allPharmaciesMinOneShift}
          missingShifts={missingShifts}
          allPersonnelPlanned={allPersonnelPlanned}
          missingPersonnel={missingPersonnel}
          otherRemarksOk={otherRemarksOk}
          otherRemarksLines={otherRemarksLines}
          weekDates={weekDates}
          onSaveRemark={onSaveRemark}
          highlightPersonnel={activePersonnel.map((p) => ({
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
                  const ids = Array.from(new Set(activePersonnel.map((p) => String(p.id)).filter(Boolean)));
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
          onCopyPreviousWeek={() => {
            void copyPreviousWeekPlanningToCurrentWeek();
          }}
        />
      </div>
      </main>
    </>
  );
}
