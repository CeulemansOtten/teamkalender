"use client";

import React, { useEffect, useMemo, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { titleFont, variableFont } from "../components/fonts";

const COLORS = {
  bg: "#ffffff",
  card: "#f7f9fb",
  line: "#e5e7eb",
  text: "#0f172a",
  textMuted: "#475569",
  primary: "#0ea5a8",
  btnBg: "#ffffff",
  btnBorder: "#d1d5db",
  btnHover: "#f3f4f6",
} as const;

function IconChevron({ dir, color = COLORS.primary, size = 22 }: { dir: "left" | "right"; color?: string; size?: number }) {
  const points = dir === "left" ? "15 6 9 12 15 18" : "9 6 15 12 9 18";
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points={points} />
    </svg>
  );
}

const APOTHEKEN = [
  { key: "Eeuwfeestapotheek", label: "Eeuwfeestapotheek" },
  { key: "Apotheek Generaal", label: "Apotheek Generaal" },
  { key: "Apotheek Minerva", label: "Apotheek Minerva" },
];

const DAYS = ["Ma", "Di", "Wo", "Do", "Vr", "Za", "Zo"] as const;

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

function formatDayShort(date: Date) {
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}`;
}

function capFirst(s: string) {
  const t = String(s || "").trim();
  if (!t) return "";
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function formatDayHeader(date: Date) {
  const weekday = capFirst(date.toLocaleString("nl-BE", { weekday: "long" }));
  const dd = String(date.getDate()).padStart(2, "0");
  const monRaw = String(date.toLocaleString("nl-BE", { month: "short" }) || "");
  const mon = capFirst(monRaw.replace(/\./g, ""));
  return `${weekday} ${dd} ${mon}`;
}

function normalizeApotheekKey(value: string) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");
}

const APOTHEEK_KEY_BY_NORMALIZED = new Map<string, string>(
  APOTHEKEN.map((a) => [normalizeApotheekKey(a.key), a.key])
);

type ShiftGroup = "morning" | "afternoon" | "night";

type PersonLite = {
  id: string;
  name: string;
  avatar_url: string | null;
  active?: string | null;
};

type PlanningRowJoined = {
  date: string;
  personnel_id: string;
  shift: string;
  pharmacy: string;
  personnel?: PersonLite | PersonLite[] | null;
};

function resolveAvatarUrl(raw?: string | null) {
  const url = String(raw || "").trim();
  if (!url) return null;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  const { data } = supabase.storage.from("avatar").getPublicUrl(url);
  return data?.publicUrl || null;
}

function isActiveFlag(v: unknown): boolean {
  const s = String(v ?? "").trim().toLowerCase();
  return s === "yes" || s === "ja" || s === "true" || s === "1";
}

function getBaseShiftCount(apotheekKey: string) {
  return apotheekKey === "Apotheek Generaal" || apotheekKey === "Apotheek Minerva" ? 2 : 3;
}

export default function PlanningMobilePage() {
  return (
    <Suspense fallback={null}>
      <PlanningMobileContent />
    </Suspense>
  );
}

function PlanningMobileContent() {
  const searchParams = useSearchParams();
  const highlightedPersonnelId = searchParams.get("personnel_id");

  const [weekStart, setWeekStart] = useState(getMonday(new Date()));

  const [defaultApotheekKey, setDefaultApotheekKey] = useState<string | null>(null);

  const weekDates = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  }), [weekStart]);

  const weekNumber = useMemo(() => getISOWeekNumber(weekStart), [weekStart]);

  const [onDutyByDate, setOnDutyByDate] = useState<Record<string, Record<string, true>>>({});
  const [nightByDate, setNightByDate] = useState<Record<string, Record<string, true>>>({});
  const [publicHolidaysByDate, setPublicHolidaysByDate] = useState<Record<string, true>>({});
  const [remarksByDatePharmacy, setRemarksByDatePharmacy] = useState<Record<string, string[]>>({});

  const [cells, setCells] = useState<
    Record<string, Record<string, { morning: PersonLite[]; afternoon: PersonLite[]; night: PersonLite[] }>>
  >({});

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
    let hash = 5381;
    for (let i = 0; i < id.length; i++) {
      hash = ((hash << 5) + hash) ^ id.charCodeAt(i);
    }
    return Math.abs(hash) % HIGHLIGHT_COLORS.length;
  }

  function highlightColorForId(id: string) {
    return HIGHLIGHT_COLORS[colorIndexForId(id)];
  }

  // Prefer the pharmacy of the ?personnel_id person as first column.
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

  const priorityId = String(highlightedPersonnelId || "").trim();

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

  function shouldShowForCell(date: Date, dayIdx: number, pharmacyKey: string) {
    return dayIdx < 5 ? !isPublicHoliday(date) || isOnDuty(date, pharmacyKey) : isOnDuty(date, pharmacyKey);
  }

  function getRemarksForCell(date: Date, pharmacyKey: string) {
    const dateKey = toISODateLocal(date);
    const allKey = `${dateKey}|__all__`;
    const specificKey = `${dateKey}|${pharmacyKey}`;
    return [...(remarksByDatePharmacy[allKey] || []), ...(remarksByDatePharmacy[specificKey] || [])];
  }

  useEffect(() => {
    let cancelled = false;

    async function loadMeta() {
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      const start = toISODateLocal(weekStart);
      const end = toISODateLocal(weekEnd);

      const [{ data: duty }, { data: holidays }, { data: remarks }] = await Promise.all([
        supabase.from("onduty").select("date,pharmacy,night").gte("date", start).lte("date", end),
        supabase.from("holidays").select("holiday_date,type").eq("type", "public").gte("holiday_date", start).lte("holiday_date", end),
        supabase.from("remarks_planning").select("date,remark,pharmacy,created_at").gte("date", start).lte("date", end).order("created_at", { ascending: true }),
      ]);

      if (cancelled) return;

      // onduty + night
      const map: Record<string, Record<string, true>> = {};
      const nightMap: Record<string, Record<string, true>> = {};
      for (const row of (duty || []) as Array<{ date: string; pharmacy: string; night?: string | null }>) {
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

      // holidays
      const hol: Record<string, true> = {};
      for (const row of (holidays || []) as Array<{ holiday_date?: string | null }>) {
        const d = String(row?.holiday_date || "");
        if (d) hol[d] = true;
      }
      setPublicHolidaysByDate(hol);

      // remarks
      const rem: Record<string, string[]> = {};
      for (const row of (remarks || []) as Array<{ date?: string | null; remark?: string | null; pharmacy?: string | null }>) {
        const date = String(row?.date || "").trim();
        const remark = String(row?.remark || "").trim();
        if (!date || !remark) continue;
        const rawPharmacy = String(row?.pharmacy || "").trim();
        const pharmacyKey = rawPharmacy ? APOTHEEK_KEY_BY_NORMALIZED.get(normalizeApotheekKey(rawPharmacy)) : null;
        const key = `${date}|${pharmacyKey || "__all__"}`;
        rem[key] ||= [];
        rem[key].push(remark);
      }
      setRemarksByDatePharmacy(rem);
    }

    loadMeta();
    return () => { cancelled = true; };
  }, [weekStart]);

  useEffect(() => {
    let cancelled = false;

    async function loadPlanning() {
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      const start = toISODateLocal(weekStart);
      const end = toISODateLocal(weekEnd);

      const { data, error } = await supabase
        .from("planning")
        .select("date, personnel_id, shift, pharmacy, personnel:personnel_id (id, name, avatar_url, active)")
        .gte("date", start)
        .lte("date", end);

      if (cancelled) return;
      if (error || !data) {
        console.error("[PlanningMobile] load planning failed", error);
        setCells({});
        return;
      }

      const out: Record<string, Record<string, { morning: PersonLite[]; afternoon: PersonLite[]; night: PersonLite[] }>> = {};
      const seen = new Set<string>();

      for (const row of data as PlanningRowJoined[]) {
        const date = String(row.date || "");
        const personnelId = String(row.personnel_id || "");
        const shift = String(row.shift || "").toLowerCase();
        const pharmacy = String(row.pharmacy || "");
        if (!date || !personnelId || !shift || !pharmacy) continue;
        if (!APOTHEKEN.some((a) => a.key === pharmacy)) continue;

        const group: ShiftGroup = shift.includes("nacht") ? "night" : shift.includes("voor") ? "morning" : "afternoon";

        const rawPersonnel = (row as any).personnel;
        const obj = Array.isArray(rawPersonnel) ? rawPersonnel[0] : rawPersonnel;
        const person: PersonLite = {
          id: String(obj?.id || personnelId),
          name: String(obj?.name || "Onbekend"),
          avatar_url: resolveAvatarUrl(obj?.avatar_url ?? null),
          active: obj?.active ?? null,
        };

        const dedupeKey = `${date}|${pharmacy}|${group}|${person.id}`;
        if (seen.has(dedupeKey)) continue;
        seen.add(dedupeKey);

        out[date] ||= {};
        out[date][pharmacy] ||= { morning: [], afternoon: [], night: [] };
        out[date][pharmacy][group].push(person);
      }

      // Legacy: if night duty but no explicit night rows, interpret afternoon overflow as night.
      for (const dateKey of Object.keys(out)) {
        for (const apotheek of APOTHEKEN) {
          const cell = out[dateKey]?.[apotheek.key];
          if (!cell) continue;

          const dayIdx = weekDates.findIndex((d) => toISODateLocal(d) === dateKey);
          if (dayIdx < 0) continue;

          const nightDuty = isNightDuty(weekDates[dayIdx], apotheek.key);
          if (!nightDuty) continue;

          if (cell.night.length === 0 && cell.afternoon.length > getBaseShiftCount(apotheek.key)) {
            const base = getBaseShiftCount(apotheek.key);
            cell.night = cell.afternoon.slice(base);
            cell.afternoon = cell.afternoon.slice(0, base);
          }
        }
      }

      // Sort each list by first name
      const firstNameOf = (name: string) => String(name || "").trim().split(/\s+/)[0] || String(name || "");
      for (const dateKey of Object.keys(out)) {
        for (const pharmacyKey of Object.keys(out[dateKey] || {})) {
          for (const group of ["morning", "afternoon", "night"] as const) {
            out[dateKey][pharmacyKey][group].sort((a, b) => {
              if (priorityId) {
                if (a.id === priorityId && b.id !== priorityId) return -1;
                if (b.id === priorityId && a.id !== priorityId) return 1;
              }
              return firstNameOf(a.name).localeCompare(firstNameOf(b.name), "nl", { sensitivity: "base" });
            });
          }
        }
      }

      setCells(out);
    }

    loadPlanning();
    return () => { cancelled = true; };
  }, [weekStart, weekDates, onDutyByDate, nightByDate, publicHolidaysByDate]);

  const weekTitle = useMemo(() => {
    const start = weekDates[0];
    const end = weekDates[6];
    const fmt = (d: Date) => d.toLocaleDateString("nl-BE", { day: "2-digit", month: "2-digit" });
    return `Week ${weekNumber} : ${fmt(start)} - ${fmt(end)}`;
  }, [weekDates, weekNumber]);

  const nameParts = (full: string) => {
    const parts = String(full || "").trim().split(/\s+/).filter(Boolean);
    const first = parts[0] || String(full || "");
    const rest = parts.slice(1).join(" ");
    return { first, rest };
  };

  const ITEM_H = 34;
  const LABEL_H = 18;
  const GROUP_GAP_Y = 6;

  const todayKey = useMemo(() => toISODateLocal(new Date()), []);
  const pendingScrollDayKeyRef = React.useRef<string | null>(null);
  const navScrollDeadlineMsRef = React.useRef<number>(0);
  const headerFocusRef = React.useRef<HTMLDivElement | null>(null);

  const hasWeekendDuty = (dateKey: string) => {
    if (onDutyByDate[dateKey] && Object.keys(onDutyByDate[dateKey] || {}).length > 0) return true;
    if (nightByDate[dateKey] && Object.keys(nightByDate[dateKey] || {}).length > 0) return true;
    return false;
  };

  const displayedDays = useMemo(() => {
    return weekDates
      .map((date, dayIdx) => ({ date, dayIdx, dateKey: toISODateLocal(date) }))
      .filter(({ dayIdx, dateKey }) => {
        // Hide weekend days unless there is on-duty/night duty.
        if (dayIdx >= 5) return hasWeekendDuty(dateKey);
        return true;
      });
  }, [weekDates, onDutyByDate, nightByDate]);

  useEffect(() => {
    // After changing weeks (or initial render), keep the viewport focused on:
    // - initial render: today's date if it exists in the displayed week, else first displayed day
    // - week navigation (< / >): always the first displayed day (Maandag)
    if (displayedDays.length === 0) return;

    const isTodayVisible = displayedDays.some((d) => d.dateKey === todayKey);

    const isWeekNavigation = Date.now() < navScrollDeadlineMsRef.current;
    const targetKey = pendingScrollDayKeyRef.current || (isTodayVisible ? todayKey : displayedDays[0].dateKey);

    let cancelled = false;

    const tryScroll = (attempt: number) => {
      if (cancelled) return;

      // For week navigation, always reset to the top of the page.
      if (isWeekNavigation && attempt === 0) {
        window.scrollTo({ top: 0, left: 0, behavior: "auto" });
        // Extra compatibility: some browsers prefer these.
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;

        // Keep focus somewhere stable near the top.
        try {
          headerFocusRef.current?.focus({ preventScroll: true });
        } catch {
          // ignore
        }
      }

      const node = document.getElementById(`planning-day-${targetKey}`) as HTMLDivElement | null;
      if (node) {
        // If not navigating weeks, align the target card near the top.
        if (!isWeekNavigation) node.scrollIntoView({ block: "start" });
        try {
          node.focus({ preventScroll: true });
        } catch {
          // ignore
        }
        pendingScrollDayKeyRef.current = null;
        return;
      }

      // Retry a few times in case the DOM updates slightly later.
      if (attempt < 12) window.setTimeout(() => tryScroll(attempt + 1), 50);
      else pendingScrollDayKeyRef.current = null;
    };

    const t = window.setTimeout(() => tryScroll(0), 0);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [displayedDays, todayKey, weekStart]);

  return (
    <>
      <div
        style={{
          paddingTop: 0,
          background: COLORS.bg,
          minHeight: "100vh",
        }}
      >
        <div style={{ maxWidth: 720, margin: "0 auto", padding: "10px 12px calc(24px + env(safe-area-inset-bottom))" }}>
          {/* Header */}
          <div
            ref={headerFocusRef}
            tabIndex={-1}
            style={{
              position: "sticky",
              top: 0,
              zIndex: 20,
              paddingTop: 10,
              paddingBottom: 10,
              background: COLORS.card,
              border: `1px solid ${COLORS.line}`,
              borderRadius: 14,
              padding: 12,
              display: "grid",
              gridTemplateColumns: "42px 1fr 42px",
              alignItems: "center",
              gap: 8,
              outline: "none",
            }}
          >
            <button
              type="button"
              aria-label="Vorige week"
              onClick={() => {
                window.scrollTo({ top: 0, left: 0, behavior: "auto" });
                document.documentElement.scrollTop = 0;
                document.body.scrollTop = 0;
                navScrollDeadlineMsRef.current = Date.now() + 2000;
                setWeekStart((prev) => {
                  const d = new Date(prev);
                  d.setDate(d.getDate() - 7);
                  pendingScrollDayKeyRef.current = toISODateLocal(d);
                  return d;
                });
              }}
              style={{
                width: 42,
                height: 42,
                borderRadius: 12,
                border: `1px solid ${COLORS.btnBorder}`,
                background: COLORS.btnBg,
                display: "grid",
                placeItems: "center",
                cursor: "pointer",
              }}
              onMouseOver={(e) => (e.currentTarget.style.background = COLORS.btnHover)}
              onMouseOut={(e) => (e.currentTarget.style.background = COLORS.btnBg)}
            >
              <IconChevron dir="left" />
            </button>

            <div style={{ textAlign: "center" }}>
              <div className={titleFont.className} style={{ fontSize: 16, fontWeight: 900, color: COLORS.text }}>
                {weekTitle}
              </div>
            </div>

            <button
              type="button"
              aria-label="Volgende week"
              onClick={() => {
                window.scrollTo({ top: 0, left: 0, behavior: "auto" });
                document.documentElement.scrollTop = 0;
                document.body.scrollTop = 0;
                navScrollDeadlineMsRef.current = Date.now() + 2000;
                setWeekStart((prev) => {
                  const d = new Date(prev);
                  d.setDate(d.getDate() + 7);
                  pendingScrollDayKeyRef.current = toISODateLocal(d);
                  return d;
                });
              }}
              style={{
                width: 42,
                height: 42,
                borderRadius: 12,
                border: `1px solid ${COLORS.btnBorder}`,
                background: COLORS.btnBg,
                display: "grid",
                placeItems: "center",
                cursor: "pointer",
              }}
              onMouseOver={(e) => (e.currentTarget.style.background = COLORS.btnHover)}
              onMouseOut={(e) => (e.currentTarget.style.background = COLORS.btnBg)}
            >
              <IconChevron dir="right" />
            </button>
          </div>

          {/* Days */}
          <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
            {displayedDays.map(({ date, dayIdx, dateKey }) => {

              const maxCounts = (() => {
                const base: Record<ShiftGroup, number> = { morning: 0, afternoon: 0, night: 0 };
                for (const a of apothekenForDisplay) {
                  const cell = cells[dateKey]?.[a.key] || { morning: [], afternoon: [], night: [] };
                  base.morning = Math.max(base.morning, cell.morning.length);
                  base.afternoon = Math.max(base.afternoon, cell.afternoon.length);
                  base.night = Math.max(base.night, cell.night.length);
                }
                return base;
              })();

              return (
                <div
                  key={dateKey}
                  id={`planning-day-${dateKey}`}
                  tabIndex={-1}
                  style={{
                    background: "#fff",
                    border: `1px solid ${COLORS.line}`,
                    borderRadius: 14,
                    overflow: "hidden",
                    scrollMarginTop: 90,
                    outline: "none",
                  }}
                >
                  <div
                    className={titleFont.className}
                    style={{
                      padding: "10px 12px",
                      background: COLORS.card,
                      borderBottom: `1px solid ${COLORS.line}`,
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      color: COLORS.text,
                      fontWeight: 900,
                      fontSize: 15,
                    }}
                  >
                    <span>{formatDayHeader(date)}</span>
                    {isPublicHoliday(date) ? (
                      <span style={{ fontSize: 12, color: COLORS.textMuted, fontWeight: 800 }}>Feestdag</span>
                    ) : null}
                  </div>

                  <div style={{ padding: 12 }}>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(3, 1fr)",
                        gap: 6,
                      }}
                    >
                      {apothekenForDisplay.map((a) => {
                        const showDuty = shouldShowForCell(date, dayIdx, a.key);
                        const cell = showDuty ? (cells[dateKey]?.[a.key] || { morning: [], afternoon: [], night: [] }) : { morning: [], afternoon: [], night: [] };
                        const nightDuty = isNightDuty(date, a.key);

                        const renderGroup = (label: string, group: ShiftGroup, show: boolean) => {
                          if (!show) return null;
                          const list = cell[group] || [];
                          const placeholders = Math.max(0, (maxCounts[group] || 0) - list.length);
                          const minHeight = LABEL_H + GROUP_GAP_Y + Math.max(1, maxCounts[group] || 0) * ITEM_H;
                          return (
                            <div style={{ minHeight }}>
                              <div className={variableFont.className} style={{ fontSize: 12, fontWeight: 900, color: COLORS.textMuted, marginBottom: 6 }}>
                                {label}
                              </div>
                              {list.length === 0 ? (
                                <div style={{ color: COLORS.textMuted, fontSize: 13 }}>—</div>
                              ) : (
                                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                  {list.map((p) => {
                                    const bg = highlightColorForId(p.id);
                                    const nm = nameParts(p.name);
                                    return (
                                      <div
                                        key={`${dateKey}|${a.key}|${group}|${p.id}`}
                                        style={{
                                          display: "flex",
                                          flexDirection: "column",
                                          gap: 2,
                                          borderRadius: 10,
                                          padding: "6px 10px",
                                          background: bg,
                                          opacity: 0.95,
                                          color: COLORS.text,
                                          minHeight: ITEM_H,
                                          justifyContent: "center",
                                          wordBreak: "break-word",
                                        }}
                                      >
                                        <div style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.15 }}>{nm.first}</div>
                                        {nm.rest ? (
                                          <div style={{ fontSize: 11, fontWeight: 500, color: COLORS.textMuted, lineHeight: 1.15 }}>{nm.rest}</div>
                                        ) : null}
                                      </div>
                                    );
                                  })}
                                  {Array.from({ length: placeholders }).map((_, i) => (
                                    <div key={`ph-${a.key}-${group}-${i}`} style={{ minHeight: ITEM_H }} />
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        };

                        const remarks = showDuty ? getRemarksForCell(date, a.key) : [];

                        return (
                          <div
                            key={`${dateKey}|${a.key}`}
                            style={{
                              border: `1px solid ${COLORS.line}`,
                              borderRadius: 12,
                              padding: 6,
                              background: COLORS.card,
                              minWidth: 0,
                            }}
                          >
                            <div
                              style={{
                                display: "grid",
                                gridTemplateColumns: "2px 1fr",
                                alignItems: "center",
                                columnGap: 8,
                                marginBottom: 8,
                              }}
                            >
                              <div aria-hidden style={{ width: 5, height: 16, background: COLORS.primary, borderRadius: 4 }} />
                              <div
                                className={titleFont.className}
                                style={{
                                  fontWeight: 900,
                                  fontSize: 13,
                                  color: COLORS.text,
                                  minWidth: 0,
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                <strong style={{ fontWeight: 900 }}>{a.label}</strong>
                              </div>
                            </div>

                            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                              {!showDuty ? (
                                <div style={{ color: COLORS.textMuted, fontSize: 13, padding: "6px 2px" }}>Geen dienst</div>
                              ) : null}

                              {renderGroup("Voormiddag", "morning", showDuty)}
                              {renderGroup("Namiddag", "afternoon", showDuty)}
                              {renderGroup("Nacht", "night", showDuty && nightDuty)}

                              {remarks.length ? (
                                <div style={{ marginTop: 4, paddingTop: 8, borderTop: `1px dashed ${COLORS.line}` }}>
                                  <div className={variableFont.className} style={{ fontSize: 13, fontWeight: 900, color: COLORS.textMuted, marginBottom: 6 }}>
                                    Opmerkingen
                                  </div>
                                  <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13, color: COLORS.text }}>
                                    {remarks.map((r, i) => (
                                      <div key={i}>{r}</div>
                                    ))}
                                  </div>
                                </div>
                              ) : null}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* knop verschijnt onderaan (niet sticky) */}
          <Link
            href={(() => {
              const base = "/calendar_mobile";
              if (!highlightedPersonnelId) return base;
              const sp = new URLSearchParams({ personnel_id: highlightedPersonnelId });
              return `${base}?${sp.toString()}`;
            })()}
            className={variableFont.className}
            style={{
              display: "block",
              width: "100%",
              marginTop: 14,
              textAlign: "center",
              padding: "14px 16px",
              borderRadius: 12,
              background: COLORS.primary,
              color: "#fff",
              fontWeight: 900,
              textDecoration: "none",
              letterSpacing: 0.2,
            }}
          >
            Vakantiekalender bekijken
          </Link>
        </div>
      </div>
    </>
  );
}
