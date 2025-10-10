"use client";

import React, { useEffect, useState, Suspense } from "react";
import localFont from "next/font/local";
import { supabase } from "@/lib/supabaseClient";
import FloatingNav from "../components/FloatingNav";
import LegendNavCalendar from "../components/LegendNav_Calendar";
import { School, PartyPopper, Cake } from "lucide-react";

/* Vaste offset onder FloatingNav */
const FLOATING_NAV_OFFSET = 5;

// Fonts enkel op deze pagina laden
const monthFont = localFont({ src: "../fonts/Font_Variable.otf", display: "swap" });
const titleFont = localFont({ src: "../fonts/Font_VariableBold.otf", display: "swap" });

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
  // jewishBg niet gebruikt als vulling (we tonen randje i.p.v. vulling)
  jewishBg: "#DBEAFE",
};

// Breedte van de strepen (px) – geen streepjes als er verjaardag is
const STRIPE = 6;

const MONTHS_NL = [
  "januari","februari","maart","april","mei","juni",
  "juli","augustus","september","oktober","november","december",
];
const DOW_NL = ["ma","di","wo","do","vr","za","zo"];

/* ===== Icons voor jaar-navigatie ===== */
function IconChevronLeft({ color = COLORS.primary, size = 22 }: { color?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="15 6 9 12 15 18" />
    </svg>
  );
}
function IconChevronRight({ color = COLORS.primary, size = 22 }: { color?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="9 6 15 12 9 18" />
    </svg>
  );
}

/* ===== Davidster-icoon voor Joodse feestdagen ===== */
function IconStarOfDavid({ size = 16, color = COLORS.text }: { size?: number; color?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden
      fill="none"
      stroke={color}
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 3 L4 17 H20 Z" />
      <path d="M12 21 L4 7 H20 Z" />
    </svg>
  );
}

/* ===== Helpers ===== */
function daysInMonth(year: number, month0: number) {
  return new Date(year, month0 + 1, 0).getDate();
}
function buildMonthMatrix(year: number, month0: number) {
  const totalDays = daysInMonth(year, month0);
  const firstDayIdxMonStart = (new Date(year, month0, 1).getDay() + 6) % 7;
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDayIdxMonStart; i++) cells.push(null);
  for (let d = 1; d <= totalDays; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}
function pad2(n: number) { return n < 10 ? `0${n}` : `${n}`; }
function ymd(year: number, month0: number, day: number) {
  return `${year}-${pad2(month0 + 1)}-${pad2(day)}`;
}

/* ===== Types ===== */
type HolidayType = "school" | "public" | "jewish";

/** We slaan per datum alle aanwezige types op (public/school/jewish) met optionele namen. */
type HolidayFlags = { public?: string; school?: string; jewish?: string };

type LeavePerson = { name: string; avatar_url: string | null };
type TooltipItem =
  | { kind: "holiday"; name: string; subtype: HolidayType }
  | { kind: "leave"; people: LeavePerson[] }
  | { kind: "birthday"; names: string[] };

/* ===== Month component ===== */
function MonthCalendar({
  year,
  month0,
  holidaysByDate,
  approvedByDate,
  birthdaysByDate,
  onHover,
}: {
  year: number;
  month0: number;
  holidaysByDate: Record<string, HolidayFlags>;
  approvedByDate: Record<string, LeavePerson[]>;
  birthdaysByDate: Record<string, string[]>;
  onHover: (e: React.MouseEvent | null, items: TooltipItem[] | null) => void;
}) {
  const weeks = buildMonthMatrix(year, month0);
  const monthName = MONTHS_NL[month0];

  return (
    <div
      style={{
        background: COLORS.card,
        border: `1px solid ${COLORS.line}`,
        borderRadius: 12,
        padding: 12,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        minWidth: 260,
      }}
    >
      {/* Titelblok met groen lijntje + maandnaam */}
      <div style={{ display: "grid", gridTemplateColumns: "8px 1fr", alignItems: "center", columnGap: 8 }}>
        <div style={{ width: 8, height: 24, background: COLORS.primary, borderRadius: 4 }} />
        <h3
          className={monthFont.className}
          style={{ margin: 0, color: COLORS.text, fontSize: 18, fontWeight: 600, textTransform: "capitalize" }}
        >
          {monthName} {year}
        </h3>
      </div>

      {/* Dagen van de week */}
      <div
        className={monthFont.className}
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          gap: 4,
          color: COLORS.textMuted,
          fontSize: 12,
          fontWeight: 600,
        }}
      >
        {DOW_NL.map((d, idx) => (
          <div
            key={d}
            style={{
              textAlign: "center",
              padding: "6px 0",
              background: idx === 5 || idx === 6 ? COLORS.weekendBg : "transparent",
              borderRadius: 6,
            }}
          >
            {d}
          </div>
        ))}
      </div>

      {/* Kalender-cellen */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {weeks.map((week, wi) => (
          <div key={wi} style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
            {week.map((day, di) => {
              const isWeekend = di === 5 || di === 6;

              // Alleen losse background-* props
              let backgroundColor = "#fff";
              let backgroundImage: string | "none" = "none";
              let backgroundRepeat: "repeat" | "no-repeat" = "no-repeat";
              let backgroundSize = "auto";
              let backgroundPosition = "0 0";
              let boxShadowVal: string = "none";

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

                // ===== Achtergrond-regels (nooit streepjes als er verjaardag is) =====
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
                    backgroundRepeat = "repeat";
                  } else if (hasPublic || hasSchool) {
                    backgroundColor = hasPublic ? COLORS.publicBg : COLORS.schoolBg;
                    backgroundImage = "none";
                  } else if (hasLeave) {
                    backgroundColor = COLORS.approvedBg;
                    backgroundImage = "none";
                  } else if (isWeekend) {
                    backgroundColor = COLORS.weekendBg;
                  }
                }

                // === Randje voor joodse feestdag (ook bovenop school), niet op verjaardag
                if (!hasBirthday && hasJewish) {
                  boxShadowVal = `inset 0 0 0 3px ${COLORS.publicBg}`; // oranje randje
                }

                // Tooltip-items (toon elk aanwezig type)
                if (bdays.length > 0) items.push({ kind: "birthday", names: bdays });
                if (flags.public) items.push({ kind: "holiday", name: flags.public, subtype: "public" });
                if (flags.school) items.push({ kind: "holiday", name: flags.school, subtype: "school" });
                if (flags.jewish) items.push({ kind: "holiday", name: flags.jewish, subtype: "jewish" });
                if (leaves.length > 0) items.push({ kind: "leave", people: leaves });
              }

              const hasInfo = items.length > 0;

              return (
                <div
                  key={di}
                  onMouseEnter={(e) => hasInfo && onHover(e, items)}
                  onMouseMove={(e) => hasInfo && onHover(e, items)}
                  onMouseLeave={() => onHover(null, null)}
                  style={{
                    height: 36,
                    backgroundColor,
                    backgroundImage,
                    backgroundRepeat,
                    backgroundSize,
                    backgroundPosition,

                    border: `1px solid ${COLORS.line}`,
                    borderRadius: 8,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 13,
                    color: day ? COLORS.text : COLORS.textMuted,
                    opacity: day ? 1 : 0.55,
                    position: "relative",
                    cursor: "default",
                    transition: "box-shadow 120ms ease-in-out",
                    boxShadow: boxShadowVal,
                    overflow: "hidden",
                  }}
                >
                  {day ?? ""}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ===== Inhoud van de pagina ===== */
function CalendarContent() {
  const [year, setYear] = useState(2025);

  // Nu: meerdere holiday-flags per datum
  const [holidaysByDate, setHolidaysByDate] = useState<Record<string, HolidayFlags>>({});
  const [approvedByDate, setApprovedByDate] = useState<Record<string, LeavePerson[]>>({});
  const [birthdaysByDate, setBirthdaysByDate] = useState<Record<string, string[]>>({});

  // Tooltip state
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    items: TooltipItem[];
  } | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      const from = `${year}-01-01`;
      const to = `${year + 1}-01-01`;

      // 1) Holidays (bewaar ALLE types per datum)
      const { data: holidays, error: hErr } = await supabase
        .from("holidays")
        .select("holiday_date,name,type")
        .gte("holiday_date", from)
        .lt("holiday_date", to);

      if (hErr) {
        console.error("[holidays fetch]", hErr);
        if (isMounted) setHolidaysByDate({});
      } else {
        const map: Record<string, HolidayFlags> = {};
        for (const row of holidays ?? []) {
          const t = (row as any).type as string | null;
          if (t !== "school" && t !== "public" && t !== "jewish") continue;
          const date = (row as any).holiday_date as string;
          if (!map[date]) map[date] = {};
          if (t === "public") map[date].public = (row as any).name as string | undefined;
          if (t === "school") map[date].school = (row as any).name as string | undefined;
          if (t === "jewish") map[date].jewish = (row as any).name as string | undefined;
        }
        if (isMounted) setHolidaysByDate(map);
      }

      // 2) Approved leave incl. naam + avatar via FK
      const { data: leaves, error: lErr } = await supabase
        .from("leave_requests")
        .select("leave_date, personnel:personnel_id (name, avatar_url)")
        .eq("status", "approved")
        .gte("leave_date", from)
        .lt("leave_date", to);

      if (lErr) {
        console.error("[leave_requests fetch]", lErr);
        if (isMounted) setApprovedByDate({});
      } else {
        const map: Record<string, LeavePerson[]> = {};
        for (const row of (leaves ?? []) as any[]) {
          const date = row.leave_date as string;
          const p = row.personnel as { name?: string; avatar_url?: string | null } | null;
          if (!p) continue;
          if (!map[date]) map[date] = [];
          map[date].push({ name: p.name ?? "Onbekend", avatar_url: p.avatar_url ?? null });
        }
        if (isMounted) setApprovedByDate(map);
      }

      // 3) Verjaardagen (personnel.birthdate = 'ddmmjjjj')
      const { data: persons, error: pErr } = await supabase
        .from("personnel")
        .select("name, birthdate");

      if (pErr) {
        console.error("[personnel fetch]", pErr);
        if (isMounted) setBirthdaysByDate({});
      } else {
        const map: Record<string, string[]> = {};
        for (const row of persons ?? []) {
          const name = (row as any).name as string | null;
          const bd = (row as any).birthdate as string | null;
          if (!name || !bd || bd.length !== 8) continue; // verwacht ddmmjjjj
          const dd = bd.slice(0, 2);
          const mm = bd.slice(2, 4);

          const dNum = Number(dd), mNum = Number(mm);
          if (!(mNum >= 1 && mNum <= 12) || !(dNum >= 1 && dNum <= 31)) continue;

          const key = `${year}-${mm}-${dd}`;
          if (!map[key]) map[key] = [];
          map[key].push(name);
        }
        if (isMounted) setBirthdaysByDate(map);
      }
    }

    load();
    return () => { isMounted = false; };
  }, [year]);

  const handleHover = (e: React.MouseEvent | null, items: TooltipItem[] | null) => {
    if (!e || !items || items.length === 0) {
      setTooltip(null);
      return;
    }
    setTooltip({ x: e.clientX + 12, y: e.clientY + 12, items });
  };

  const prev = () => setYear((y) => y - 1);
  const next = () => setYear((y) => y + 1);
  const prevYear = year - 1;
  const nextYear = year + 1;

  return (
    <>
      <FloatingNav />
      <LegendNavCalendar />   {/* rechtsboven */}

      <main
        style={{
          background: COLORS.bg,
          minHeight: "100vh",
          padding: 24,
          boxSizing: "border-box",
          marginTop: `${FLOATING_NAV_OFFSET}px`,
          position: "relative",
        }}
      >
        {/* Toolbar midden */}
        <header
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: 12,
            marginBottom: 16,
          }}
        >
          <button
            onClick={prev}
            aria-label={`Ga naar ${prevYear}`}
            className={titleFont.className}
            style={{
              padding: "8px 14px",
              background: COLORS.btnBg,
              border: `1px solid ${COLORS.btnBorder}`,
              borderRadius: 999,
              cursor: "pointer",
              minWidth: 130,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              fontWeight: 900,
              fontSize: 18,
              letterSpacing: 0.2,
              transition: "background 120ms ease-in-out",
            }}
            onMouseOver={(e) => (e.currentTarget.style.background = COLORS.btnHover)}
            onMouseOut={(e) => (e.currentTarget.style.background = COLORS.btnBg)}
          >
            <IconChevronLeft />
            <span>{prevYear}</span>
          </button>

          <h1
            className={titleFont.className}
            style={{ margin: 0, color: COLORS.text, fontSize: 28, fontWeight: 900, letterSpacing: 0.2 }}
          >
            Teamkalender
          </h1>

          <button
            onClick={next}
            aria-label={`Ga naar ${nextYear}`}
            className={titleFont.className}
            style={{
              padding: "8px 14px",
              background: COLORS.btnBg,
              border: `1px solid ${COLORS.btnBorder}`,
              borderRadius: 999,
              cursor: "pointer",
              minWidth: 130,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              fontWeight: 900,
              fontSize: 18,
              letterSpacing: 0.2,
              transition: "background 120ms ease-in-out",
            }}
            onMouseOver={(e) => (e.currentTarget.style.background = COLORS.btnHover)}
            onMouseOut={(e) => (e.currentTarget.style.background = COLORS.btnBg)}
          >
            <span>{nextYear}</span>
            <IconChevronRight />
          </button>
        </header>

        {/* 4 kolommen × 3 rijen (wrapt op small screens) */}
        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, minmax(240px, 1fr))",
            gap: 16,
          }}
        >
          {Array.from({ length: 12 }).map((_, m) => (
            <MonthCalendar
              key={m}
              year={year}
              month0={m}
              holidaysByDate={holidaysByDate}
              approvedByDate={approvedByDate}
              birthdaysByDate={birthdaysByDate}
              onHover={handleHover}
            />
          ))}
        </section>

        {/* extra witruimte onderaan om te kunnen scrollen */}
        <div style={{ height: 200 }} aria-hidden />

        {/* Tooltip */}
        {tooltip && (
          <div
            style={{
              position: "fixed",
              left: tooltip.x,
              top: tooltip.y,
              zIndex: 9999,
              background: "#ffffff",
              border: `1px solid ${COLORS.line}`,
              borderRadius: 8,
              boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
              padding: 10,
              minWidth: 220,
              pointerEvents: "none",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {tooltip.items.map((it, idx) => {
                if (it.kind === "birthday") {
                  return (
                    <div key={`b-${idx}`} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {it.names.map((nm, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <Cake size={16} strokeWidth={1.5} />
                          <div style={{ fontSize: 13, color: COLORS.text }}>
                            <strong>Verjaardag:</strong> {nm}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                }
                if (it.kind === "holiday") {
                  let label = "Feestdag";
                  let iconEl: React.ReactNode = <PartyPopper size={16} strokeWidth={1.5} />;
                  if (it.subtype === "school") {
                    label = "Schoolvakantie";
                    iconEl = <School size={16} strokeWidth={1.5} />;
                  } else if (it.subtype === "jewish") {
                    label = "Joodse feestdag";
                    iconEl = <IconStarOfDavid size={16} color={COLORS.text} />;
                  }
                  return (
                    <div key={`h-${idx}`} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {iconEl}
                      <div style={{ fontSize: 13, color: COLORS.text }}>
                        <strong>{label}:</strong> {it.name}
                      </div>
                    </div>
                  );
                }
                // Verlof
                return (
                  <div key={`l-${idx}`} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <div style={{ fontSize: 13, color: COLORS.text }}>
                      <strong>Verlof:</strong>
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {it.people.map((p, i) => {
                        const initial = p.name?.[0]?.toUpperCase();
                        return (
                          <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            {p.avatar_url ? (
                              <img
                                src={p.avatar_url}
                                alt={p.name}
                                style={{
                                  width: 25,
                                  height: 25,
                                  objectFit: "contain",
                                  background: "#fff",
                                  flex: "0 0 auto",
                                  borderRadius: 4,
                                }}
                              />
                            ) : initial ? (
                              <div
                                aria-hidden
                                style={{
                                  width: 22,
                                  height: 22,
                                  border: `1px solid ${COLORS.line}`,
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  fontSize: 12,
                                  background: "#f5f5f5",
                                  color: "#555",
                                  flex: "0 0 auto",
                                  borderRadius: 4,
                                  fontWeight: 600,
                                }}
                              >
                                {initial}
                              </div>
                            ) : (
                              <span style={{ display: "none" }} />
                            )}
                            <span style={{ fontSize: 13, color: COLORS.text }}>{p.name}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>
    </>
  );
}

/* ===== Suspense-wrapper voor de pagina ===== */
export default function Page() {
  return (
    <Suspense fallback={<div style={{ padding: 12 }}>Laden…</div>}>
      <CalendarContent />
    </Suspense>
  );
}

/* Extra: vertel Next dat dit dynamisch is (voorkomt prerender-fouten) */
export const dynamic = "force-dynamic";
