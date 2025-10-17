"use client";

import React, { useEffect, useMemo, useRef, useState, Suspense } from "react";
import localFont from "next/font/local";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { School, PartyPopper, Cake, X } from "lucide-react";

/* ===== Fonts ===== */
const monthFont = localFont({ src: "../fonts/Font_Variable.otf", display: "swap" });       // Variable
const titleFont = localFont({ src: "../fonts/Font_VariableBold.otf", display: "swap" });   // Bold

/* ===== Kleuren ===== */
const COLORS = {
  bg: "#ffffff",
  card: "#f7f9fb",
  line: "#e5e7eb",
  text: "#0f172a",
  textMuted: "#475569",
  primary: "#0ea5a8",
  weekendBg: "#eef2f7",
  btnBg: "#ffffff",
  btnBorder: "#d1d5db",
  btnHover: "#f3f4f6",
  schoolBg: "#FFF9C4",
  publicBg: "#FDE68A",
  approvedBg: "#C3E8E9",
  birthdayBg: "#FCE7F3",
  jewishRing: "#FDE68A", // zelfde geel als feestdag
};

const STRIPE = 6;

const MONTHS_NL = [
  "januari","februari","maart","april","mei","juni",
  "juli","augustus","september","oktober","november","december",
];
const DOW_NL = ["ma","di","wo","do","vr","za","zo"];

/* ===== Icons ===== */
function IconChevron({
  dir = "left",
  color = COLORS.primary,
  size = 22,
}: { dir?: "left" | "right"; color?: string; size?: number }) {
  const points = dir === "left" ? "15 6 9 12 15 18" : "9 6 15 12 9 18";
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points={points} />
    </svg>
  );
}
function IconStarOfDavid({ size = 16, color = COLORS.text }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3 L4 17 H20 Z" />
      <path d="M12 21 L4 7 H20 Z" />
    </svg>
  );
}

/* ===== Helpers ===== */
const capFirst = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);
function pad2(n: number) { return n < 10 ? `0${n}` : `${n}`; }
function ymd(year: number, month0: number, day: number) { return `${year}-${pad2(month0 + 1)}-${pad2(day)}`; }
function daysInMonth(year: number, month0: number) { return new Date(year, month0 + 1, 0).getDate(); }
function buildMonthMatrix(year: number, month0: number) {
  const totalDays = daysInMonth(year, month0);
  const firstDayIdxMonStart = (new Date(year, month0, 1).getDay() + 6) % 7; // maandag=0
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDayIdxMonStart; i++) cells.push(null);
  for (let d = 1; d <= totalDays; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}
function getCookie(name: string): string | undefined {
  if (typeof document === "undefined") return;
  const m = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
  return m ? decodeURIComponent(m[2]) : undefined;
}

/* ===== Types ===== */
type HolidayType = "public" | "school" | "jewish";
type HolidayFlags = { public?: string; school?: string; jewish?: string };
type LeavePerson = { name: string; avatar_url: string | null };
type TooltipItem =
  | { kind: "holiday"; name: string; subtype: HolidayType }
  | { kind: "leave"; people: LeavePerson[] }
  | { kind: "birthday"; names: string[] };

function normalizeHolidayType(t: string | null | undefined): HolidayType | null {
  if (!t) return null;
  if (t === "public" || t === "school") return t;
  if (t === "jewish" || t === "other") return "jewish";
  return null;
}

/* ===== Maandgrid ===== */
function MonthGrid({
  year,
  month0,
  holidaysByDate,
  approvedByDate,
  birthdaysByDate,
  onTapDay,
}: {
  year: number;
  month0: number;
  holidaysByDate: Record<string, HolidayFlags>;
  approvedByDate: Record<string, LeavePerson[]>;
  birthdaysByDate: Record<string, string[]>;
  onTapDay: (key: string, items: TooltipItem[]) => void;
}) {
  const weeks = useMemo(() => buildMonthMatrix(year, month0), [year, month0]);

  // vandaag-ymd (één keer berekenen)
  const today = new Date();
  const todayYMD = ymd(today.getFullYear(), today.getMonth(), today.getDate());

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {/* DOW */}
      <div className={monthFont.className} style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6, color: COLORS.textMuted, fontSize: 12, fontWeight: 600 }}>
        {DOW_NL.map((d, idx) => (
          <div key={d} style={{
            textAlign: "center", padding: "6px 0",
            background: idx >= 5 ? COLORS.weekendBg : "transparent",
            borderRadius: 6,
          }}>
            {d}
          </div>
        ))}
      </div>

      {/* Days */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {weeks.map((week, wi) => (
          <div key={wi} style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6 }}>
            {week.map((day, di) => {
              const isWeekend = di >= 5;

              let backgroundColor = "#fff";
              let backgroundImage: string | "none" = "none";
              let boxShadowVal = "none";

              const items: TooltipItem[] = [];

              if (day) {
                const key = ymd(year, month0, day);
                const flags = holidaysByDate[key] || {};
                const leaves = approvedByDate[key] || [];
                const bdays = birthdaysByDate[key] || [];

                const hasPublic = !!flags.public;
                const hasSchool = !!flags.school;
                const hasJewish = !!flags.jewish;
                const hasLeave = leaves.length > 0;
                const hasBirthday = bdays.length > 0;

                if (hasBirthday) {
                  if (!hasPublic && !hasSchool && !hasLeave) {
                    backgroundColor = COLORS.birthdayBg;
                    boxShadowVal = "none";
                  } else if ((hasPublic || hasSchool) && !hasLeave) {
                    backgroundColor = hasPublic ? COLORS.publicBg : COLORS.schoolBg;
                    boxShadowVal = `inset 0 0 0 3px ${COLORS.birthdayBg}`;
                  } else {
                    backgroundColor = COLORS.approvedBg;
                    boxShadowVal = `inset 0 0 0 3px ${COLORS.birthdayBg}`;
                  }
                } else {
                  if ((hasPublic || hasSchool) && hasLeave) {
                    const holidayColor = hasPublic ? COLORS.publicBg : COLORS.schoolBg;
                    backgroundColor = COLORS.approvedBg;
                    backgroundImage = `repeating-linear-gradient(
                      45deg,
                      ${holidayColor},
                      ${holidayColor} ${STRIPE}px,
                      ${COLORS.approvedBg} ${STRIPE}px,
                      ${COLORS.approvedBg} ${STRIPE * 2}px
                    )`;
                  } else if (hasPublic || hasSchool) {
                    backgroundColor = hasPublic ? COLORS.publicBg : COLORS.schoolBg;
                  } else if (hasLeave) {
                    backgroundColor = COLORS.approvedBg;
                  } else if (isWeekend) {
                    backgroundColor = COLORS.weekendBg;
                  }
                }

                // geel randje voor joodse feestdag (tenzij birthday)
                if (!hasBirthday && hasJewish) {
                  boxShadowVal = `inset 0 0 0 3px ${COLORS.jewishRing}`;
                }

                if (bdays.length > 0) items.push({ kind: "birthday", names: bdays });
                if (flags.public) items.push({ kind: "holiday", name: flags.public, subtype: "public" });
                if (flags.school) items.push({ kind: "holiday", name: flags.school, subtype: "school" });
                if (flags.jewish) items.push({ kind: "holiday", name: flags.jewish, subtype: "jewish" });
                if (leaves.length > 0) items.push({ kind: "leave", people: leaves });
              }

              const clickable = day && items.length > 0;
              const key = day ? ymd(year, month0, day) : "";

              // extra: zwarte rand voor "vandaag", gecombineerd met bestaande ringen
              const isToday = key === todayYMD;
              const boxShadowCombined =
                (boxShadowVal !== "none" ? boxShadowVal + (isToday ? ", " : "") : "") +
                (isToday ? "0 0 0 2px #000" : "");

              return (
                <button
                  key={di}
                  disabled={!clickable}
                  onClick={() => clickable && onTapDay(key, items)}
                  style={{
                    height: 44,
                    backgroundColor,
                    backgroundImage,
                    backgroundRepeat: "repeat",
                    border: `1px solid ${COLORS.line}`,
                    borderRadius: 10,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 14,
                    color: day ? COLORS.text : COLORS.textMuted,
                    opacity: day ? 1 : 0.55,
                    position: "relative",
                    boxShadow: boxShadowCombined,
                    overflow: "hidden",
                    cursor: clickable ? "pointer" : "default",
                    touchAction: "manipulation",
                  }}
                >
                  {day ?? ""}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ===== Hoofdcomponent (swipe + inline details + zoom reset) ===== */
function CalendarMobileContent() {
  const searchParams = useSearchParams();
  const qsPersonnel = searchParams.get("personnel_id") || undefined;
  const cookiePersonnel = typeof window !== "undefined" ? getCookie("personnel_id") : undefined;
  const personnelId = qsPersonnel || cookiePersonnel; // volgorde: query > cookie

  // 👉 Zoom-reset bij mount: forceer 100%, dan terug vrij
  useEffect(() => {
    const vp = document.querySelector('meta[name="viewport"]') as HTMLMetaElement | null;
    const prev = vp?.getAttribute("content") ?? "width=device-width, initial-scale=1, viewport-fit=cover";

    // 1) fixeer even op 100% (voorkomt “oude” zoom van login)
    vp?.setAttribute(
      "content",
      "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover"
    );

    // 2) na kort moment terug vrijgeven (zo kan men weer inzoomen)
    const t = setTimeout(() => {
      vp?.setAttribute("content", "width=device-width, initial-scale=1, viewport-fit=cover");
    }, 250);

    // 3) naar top scrollen (soms blijft er offset hangen)
    window.scrollTo(0, 0);

    return () => {
      clearTimeout(t);
      vp?.setAttribute("content", prev);
    };
  }, []);

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month0, setMonth0] = useState(now.getMonth());

  const [holidaysByDate, setHolidaysByDate] = useState<Record<string, HolidayFlags>>({});
  const [approvedByDate, setApprovedByDate] = useState<Record<string, LeavePerson[]>>({});
  const [birthdaysByDate, setBirthdaysByDate] = useState<Record<string, string[]>>({});

  // inline detailpaneel
  const [detail, setDetail] = useState<{ open: boolean; items: TooltipItem[]; dateLabel: string }>(
    { open: false, items: [], dateLabel: "" }
  );

  // swipe refs
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const touchStartTime = useRef<number | null>(null);

  const monthName = capFirst(MONTHS_NL[month0]); // hoofdletter
  const firstDay = `${year}-${pad2(month0 + 1)}-01`;
  const next = new Date(year, month0 + 1, 1);
  const to = `${next.getFullYear()}-${pad2(next.getMonth() + 1)}-01`;

  useEffect(() => {
    let mounted = true;

    async function load() {
      // holidays
      const { data: holidays, error: hErr } = await supabase
        .from("holidays")
        .select("holiday_date,name,type")
        .gte("holiday_date", firstDay)
        .lt("holiday_date", to);

      if (hErr) {
        console.error("[holidays]", hErr);
        if (mounted) setHolidaysByDate({});
      } else {
        const map: Record<string, HolidayFlags> = {};
        for (const row of holidays ?? []) {
          const t = normalizeHolidayType((row as any).type);
          if (!t) continue;
          const date = (row as any).holiday_date as string;
          if (!map[date]) map[date] = {};
          if (t === "public") map[date].public = (row as any).name as string | undefined;
          if (t === "school") map[date].school = (row as any).name as string | undefined;
          if (t === "jewish") map[date].jewish = (row as any).name as string | undefined;
        }
        if (mounted) setHolidaysByDate(map);
      }

      // leave
      const { data: leaves, error: lErr } = await supabase
        .from("leave_requests")
        .select("leave_date, personnel:personnel_id (name, avatar_url)")
        .eq("status", "approved")
        .gte("leave_date", firstDay)
        .lt("leave_date", to);

      if (lErr) {
        console.error("[leave_requests]", lErr);
        if (mounted) setApprovedByDate({});
      } else {
        const map: Record<string, LeavePerson[]> = {};
        for (const row of (leaves ?? []) as any[]) {
          const date = row.leave_date as string;
          const p = row.personnel as { name?: string; avatar_url?: string | null } | null;
          if (!p) continue;
          if (!map[date]) map[date] = [];
          map[date].push({ name: p.name ?? "Onbekend", avatar_url: p.avatar_url ?? null });
        }
        if (mounted) setApprovedByDate(map);
      }

      // birthdays
      const { data: persons, error: pErr } = await supabase
        .from("personnel")
        .select("name, birthdate");

      if (pErr) {
        console.error("[personnel]", pErr);
        if (mounted) setBirthdaysByDate({});
      } else {
        const map: Record<string, string[]> = {};
        for (const row of persons ?? []) {
          const name = (row as any).name as string | null;
          const bd = (row as any).birthdate as string | null; // ddmmjjjj
          if (!name || !bd || bd.length !== 8) continue;
          const dd = bd.slice(0, 2);
          const mm = bd.slice(2, 4);
          const y = String(year);
          if (Number(mm) === month0 + 1) {
            const key = `${y}-${mm}-${dd}`;
            if (!map[key]) map[key] = [];
            map[key].push(name);
          }
        }
        if (mounted) setBirthdaysByDate(map);
      }
    }

    load();
    // detail sluiten bij maandwissel
    setDetail({ open: false, items: [], dateLabel: "" });

    return () => { mounted = false; };
  }, [year, month0]);

  function go(delta: number) {
    const d = new Date(year, month0 + delta, 1);
    setYear(d.getFullYear());
    setMonth0(d.getMonth());
  }

  const onTapDay = (key: string, items: TooltipItem[]) => {
    const d = new Date(key);
    const label = `${d.getDate()} ${capFirst(MONTHS_NL[d.getMonth()])} ${d.getFullYear()}`;
    setDetail({ open: true, items, dateLabel: label });
  };

  /* ===== Swipe handlers ===== */
  const SWIPE_THRESHOLD = 50;   // px
  const SWIPE_TIME_MAX = 600;   // ms
  const VERTICAL_RESTRAINT = 60; // px

  const onTouchStart: React.TouchEventHandler = (e) => {
    const t = e.changedTouches[0];
    touchStartX.current = t.clientX;
    touchStartY.current = t.clientY;
    touchStartTime.current = Date.now();
  };
  const onTouchEnd: React.TouchEventHandler = (e) => {
    const t = e.changedTouches[0];
    if (touchStartX.current == null || touchStartY.current == null || touchStartTime.current == null) return;
    const dx = t.clientX - touchStartX.current;
    const dy = t.clientY - touchStartY.current;
    const dt = Date.now() - touchStartTime.current;

    if (Math.abs(dx) > SWIPE_THRESHOLD && Math.abs(dy) < VERTICAL_RESTRAINT && dt < SWIPE_TIME_MAX) {
      if (dx < 0) go(1);     // veeg naar links => volgende
      else go(-1);           // veeg naar rechts => vorige
    }

    touchStartX.current = touchStartY.current = touchStartTime.current = null;
  };

  // helper om knopkleur na klik terug wit te zetten
  const resetBtn = (btn: HTMLButtonElement) => {
    if (!btn) return;
    btn.style.background = COLORS.btnBg;
    btn.blur();
  };

  // bouw href naar vacation_request_mobile met personnel_id
  const vacationHref = useMemo(() => {
    const base = "/vacation_request_mobile";
    if (!personnelId) return base;
    const sp = new URLSearchParams({ personnel_id: personnelId });
    return `${base}?${sp.toString()}`;
  }, [personnelId]);

  return (
    <>
      <main
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        style={{
          background: COLORS.bg,
          minHeight: "100vh",
          padding: "16px 14px 96px",
          boxSizing: "border-box",
        }}
      >
        {/* header met maand-naam en pijltjes */}
        <header style={{ display: "grid", gridTemplateColumns: "48px 1fr 48px", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <button
            aria-label="Vorige maand"
            onClick={(e) => { go(-1); resetBtn(e.currentTarget); }}
            onMouseOver={(e) => (e.currentTarget.style.background = COLORS.btnHover)}
            onMouseOut={(e) => (e.currentTarget.style.background = COLORS.btnBg)}
            style={{
              height: 40, width: 48, display: "grid", placeItems: "center",
              background: COLORS.btnBg, border: `1px solid ${COLORS.btnBorder}`, borderRadius: 10,
            }}
          >
            <IconChevron dir="left" color={COLORS.primary} />
          </button>

          <h1
            className={titleFont.className}
            style={{ margin: 0, textAlign: "center", fontSize: 20, fontWeight: 900, color: COLORS.text }}
          >
            {monthName} {year}
          </h1>

          <button
            aria-label="Volgende maand"
            onClick={(e) => { go(1); resetBtn(e.currentTarget); }}
            onMouseOver={(e) => (e.currentTarget.style.background = COLORS.btnHover)}
            onMouseOut={(e) => (e.currentTarget.style.background = COLORS.btnBg)}
            style={{
              height: 40, width: 48, display: "grid", placeItems: "center",
              background: COLORS.btnBg, border: `1px solid ${COLORS.btnBorder}`, borderRadius: 10,
            }}
          >
            <IconChevron dir="right" color={COLORS.primary} />
          </button>
        </header>

        {/* kalenderkaart */}
        <section style={{
          background: COLORS.card,
          border: `1px solid ${COLORS.line}`,
          borderRadius: 14,
          padding: 12,
          boxShadow: "0 2px 10px rgba(0,0,0,0.04)"
        }}>
          <MonthGrid
            year={year}
            month0={month0}
            holidaysByDate={holidaysByDate}
            approvedByDate={approvedByDate}
            birthdaysByDate={birthdaysByDate}
            onTapDay={onTapDay}
          />
        </section>

        {/* inline details */}
        {detail.open && (
          <section
            style={{
              marginTop: 12,
              background: "#fff",
              border: `1px solid ${COLORS.line}`,
              borderRadius: 12,
              boxShadow: "0 6px 18px rgba(0,0,0,0.06)",
              padding: 12,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <div className={titleFont.className} style={{ fontSize: 16, fontWeight: 900, color: COLORS.text }}>
                {detail.dateLabel}
              </div>
              <button
                aria-label="Sluiten"
                onClick={() => setDetail({ open: false, items: [], dateLabel: "" })}
                style={{ border: "none", background: "transparent", padding: 6, borderRadius: 8, color: COLORS.textMuted }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {detail.items.map((it, idx) => {
                if (it.kind === "birthday") {
                  return it.names.map((nm, i) => (
                    <div key={`b-${idx}-${i}`} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <Cake size={18} strokeWidth={1.7} />
                      <div style={{ fontSize: 14, color: COLORS.text }}><strong>Verjaardag:</strong> {nm}</div>
                    </div>
                  ));
                }
                if (it.kind === "holiday") {
                  const label =
                    it.subtype === "school" ? "Schoolvakantie" :
                    it.subtype === "jewish" ? "Joodse feestdag" : "Feestdag";
                  const icon =
                    it.subtype === "school" ? <School size={18} strokeWidth={1.7} /> :
                    it.subtype === "jewish" ? <IconStarOfDavid size={18} /> :
                    <PartyPopper size={18} strokeWidth={1.7} />;
                  return (
                    <div key={`h-${idx}`} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      {icon}
                      <div style={{ fontSize: 14, color: COLORS.text }}>
                        <strong>{label}:</strong> {it.name}
                      </div>
                    </div>
                  );
                }
                // verlof
                return (
                  <div key={`l-${idx}`} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <div style={{ fontSize: 14, color: COLORS.text }}><strong>Verlof:</strong></div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                      {it.people.map((p, i) => {
                        const initial = p.name?.[0]?.toUpperCase();
                        return (
                          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            {p.avatar_url ? (
                              <img src={p.avatar_url} alt={p.name} style={{ width: 26, height: 26, objectFit: "contain", background: "#fff", borderRadius: 4 }} />
                            ) : (
                              <div aria-hidden style={{
                                width: 24, height: 24, border: `1px solid ${COLORS.line}`,
                                display: "flex", alignItems: "center", justifyContent: "center",
                                fontSize: 12, background: "#f5f5f5", color: "#555", borderRadius: 4, fontWeight: 600,
                              }}>
                                {initial}
                              </div>
                            )}
                            <span style={{ fontSize: 14, color: COLORS.text }}>{p.name}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </main>

      {/* vaste brede knop onderaan — Variable font + bold + personnel_id in URL */}
      <div
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(255,255,255,0.96)",
          borderTop: `1px solid ${COLORS.line}`,
          padding: "10px 12px calc(10px + env(safe-area-inset-bottom))",
          backdropFilter: "saturate(150%) blur(6px)",
          zIndex: 60,
        }}
      >
        <Link
          href={(() => {
            const base = "/vacation_request_mobile";
            if (!personnelId) return base;
            const sp = new URLSearchParams({ personnel_id: personnelId });
            return `${base}?${sp.toString()}`;
          })()}
          className={monthFont.className}
          style={{
            display: "block",
            width: "100%",
            textAlign: "center",
            padding: "14px 16px",
            borderRadius: 12,
            background: COLORS.primary,
            color: "#fff",
            fontWeight: 900, // BOLD
            textDecoration: "none",
            letterSpacing: 0.2,
          }}
        >
          Verlof aanvragen
        </Link>
      </div>
    </>
  );
}

/* ===== Pagina-export ===== */
export default function Page() {
  return (
    <Suspense fallback={<div style={{ padding: 12 }}>Laden…</div>}>
      <CalendarMobileContent />
    </Suspense>
  );
}

export const dynamic = "force-dynamic";
