"use client";

import React, { useEffect, useMemo, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import localFont from "next/font/local";
import { supabase } from "../../lib/supabaseClient";
import FloatingNav from "../components/FloatingNav";

/* ===== Fonts & Kleuren (match admin) ===== */
const variableFont = localFont({ src: "../fonts/Font_Variable.otf", display: "swap" });

const COLORS = {
  bg: "#ffffff",
  card: "#f7f9fb",
  line: "#e5e7eb",
  text: "#0f172a",
  textMuted: "#475569",
  primary: "#0ea5a8",
};

const SYS_FONT = "system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif";

/* ===== Layout ===== */
const CARDS_TOP_OFFSET = 70;            // zelfde top-offset als admin
const YEARS_CARD_WIDTH = 160;
const COUNTER_CARD_MAX_WIDTH = 660;     // smaller
const GAP_BETWEEN = 20;

/* ===== Types ===== */
type LeaveEntitlement = {
  id: string;
  personnel_id: string;
  year: number;
  total_hours: number;
  reason: string | null;
};

type LeaveRequest = {
  id: string;
  personnel_id: string;
  leave_date: string;            // ISO date
  daypart: "AM" | "PM" | null;   // halve dag -> 4u
  status: string;                // gefilterd op 'approved'
  entitlement?: string | null;
  hours?: number | null;
};

type Person = {
  id: string;
  name: string;
  surname: string | null;
  avatar_url: string | null;
};

/* ===== Helpers ===== */
const hoursToDays = (hours: number, hoursPerDay = 8) => (hours / (hoursPerDay || 8)).toFixed(1);

// Formatting helpers: use comma as decimal separator and omit ",0"
const formatHours = (h: number) => {
  if (h == null || Number.isNaN(h)) return "";
  const rounded = Math.round(h * 10) / 10;
  if (Math.round(rounded * 10) % 10 === 0) return String(Math.round(rounded));
  return String(rounded.toFixed(1)).replace(".", ",");
};

const formatDays = (hours: number, hoursPerDay: number) => {
  if (hours == null || Number.isNaN(hours)) return "";
  const daysNum = hours / (hoursPerDay || 8);
  const rounded = Math.round(daysNum * 10) / 10;
  if (Math.round(rounded * 10) % 10 === 0) return String(Math.round(rounded));
  return String(rounded.toFixed(1)).replace(".", ",");
};

/* ===== Content ===== */
function CounterContent() {
  const params = useSearchParams();
  const personnelId = params.get("personnel_id");

  const [person, setPerson] = useState<Person | null>(null);
  const [entitlements, setEntitlements] = useState<LeaveEntitlement[]>([]);
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [hoursPerWholeDay, setHoursPerWholeDay] = useState<number>(8);
  const [loading, setLoading] = useState(true);

  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [hoverYear, setHoverYear] = useState<number | null>(null);

  useEffect(() => {
    if (!personnelId) return;

    const fetchData = async () => {
      setLoading(true);

      // Persoon
      const { data: p } = await supabase
        .from("personnel")
        .select("id, name, surname, avatar_url, pharmacy")
        .eq("id", personnelId)
        .maybeSingle();
      setPerson((p as Person) || null);

      // determine pharmacy hours-per-whole-day for this person (if available)
      try {
        const pharmArr = (p as any)?.pharmacy || [];
        const pharmName = Array.isArray(pharmArr) && pharmArr.length > 0 ? String(pharmArr[0]) : "";
        if (pharmName) {
          const { data: phRow } = await supabase
            .from("pharmacy")
            .select("hours, daypart, pharmacy")
            .eq("pharmacy", pharmName)
            .eq("daypart", "hele dag")
            .maybeSingle();
          const h = phRow && (phRow as any).hours ? Number((phRow as any).hours) : 8;
          setHoursPerWholeDay(h || 8);
        } else {
          setHoursPerWholeDay(8);
        }
      } catch (err) {
        setHoursPerWholeDay(8);
      }

      // Startsaldi
      const { data: ents } = await supabase
        .from("leave_entitlements")
        .select("id, personnel_id, year, total_hours, reason")
        .eq("personnel_id", personnelId);

      // Opgenomen (approved)
      const { data: reqs } = await supabase
        .from("leave_requests")
        .select("id, personnel_id, leave_date, daypart, status, entitlement, hours")
        .eq("personnel_id", personnelId)
        .in("status", ["approved"]);

      const entsArr: LeaveEntitlement[] = (ents as LeaveEntitlement[]) || [];
      setEntitlements(entsArr);
      setRequests((reqs as LeaveRequest[]) || []);

      // Default gekozen jaar: huidig jaar, anders meest recente
      const years: number[] = [...new Set(entsArr.map((e) => Number(e.year)))]
        .filter((n): n is number => Number.isFinite(n));

      const nowY = new Date().getFullYear();
      const sortedYears = [...years].sort((a, b) => b - a);
      const pick: number | null = years.includes(nowY) ? nowY : (sortedYears[0] ?? null);

      setSelectedYear(pick);
      setLoading(false);
    };

    fetchData();
  }, [personnelId]);

  // Opgenomen uren per jaar en per reden
  const requestsPerYearPerReason = useMemo(() => {
    const map: Record<number, Record<string, number>> = {};
    for (const r of requests) {
      const year = new Date(r.leave_date).getFullYear();
      const taken = Number(r.hours ?? ((r.daypart === "AM" || r.daypart === "PM") ? (hoursPerWholeDay / 2) : hoursPerWholeDay));
      // treat empty/null entitlement as 'andere'
      const reason = (r.entitlement || "andere").toString();
      if (!map[year]) map[year] = {};
      map[year][reason] = (map[year][reason] || 0) + taken;
    }
    return map;
  }, [requests, hoursPerWholeDay]);

  if (!personnelId) {
    return <div style={{ padding: 20 }}>Geen <code>personnel_id</code> meegegeven in de URL.</div>;
  }

  const allYearsDesc: number[] = [...new Set(entitlements.map((e) => Number(e.year)))]
    .filter((n): n is number => Number.isFinite(n))
    .sort((a, b) => b - a);

  // Data voor gekozen jaar
  const yearEnts = selectedYear ? entitlements.filter((e) => Number(e.year) === selectedYear) : [];
  // build totals per reason
  const reasonTotals: Record<string, number> = {};
  yearEnts.forEach((e) => {
    const key = (e.reason || "andere").toString();
    reasonTotals[key] = (reasonTotals[key] || 0) + Number(e.total_hours || 0);
  });

  // include any reasons that appear in recorded requests for the selected year
  const reqReasons: string[] = selectedYear ? Object.keys(requestsPerYearPerReason[selectedYear] || {}) : [];
  const fullSet = new Set<string>([...Object.keys(reasonTotals), ...reqReasons]);
  const reasonsList = Array.from(fullSet).filter((rk) => {
    // hide 'andere' if it has no value (no entitlement, no taken, no saldo)
    if (rk === "andere") {
      const totalForReason = reasonTotals[rk] || 0;
      const takenForReason = selectedYear ? (requestsPerYearPerReason[selectedYear]?.[rk] || 0) : 0;
      const saldoForReason = totalForReason - takenForReason;
      return totalForReason !== 0 || takenForReason !== 0 || saldoForReason !== 0;
    }
    return true;
  });

  const startsaldoHours = Object.values(reasonTotals).reduce((acc, v) => acc + v, 0);
  const takenHours = selectedYear
    ? Object.values(requestsPerYearPerReason[selectedYear] || {}).reduce((a, b) => a + b, 0)
    : 0;
  const saldoHours = startsaldoHours - takenHours;

  // === Styles ===
  const tdBase: React.CSSProperties = { padding: "8px 6px", verticalAlign: "middle" };
  const tdVal: React.CSSProperties = { ...tdBase, textAlign: "center" };       // gecentreerde values
  const tdValWhite: React.CSSProperties = { ...tdVal, background: "#fff" };

  const thBase: React.CSSProperties = { padding: "8px 6px" };
  const thCenter: React.CSSProperties = { ...thBase, textAlign: "center" };
  const thCenterWhite: React.CSSProperties = { ...thCenter, background: "#fff" };

  // 2px accent-lijnen
  const headerBottomBorder = `2px solid ${COLORS.primary}`;  // onder Startsaldo/Opgenomen/Saldo
  const totalTopBorder = `2px solid ${COLORS.primary}`;      // boven Totaal
  const thinBlack = "1px solid #000";                        // onder Categorie (dun en zwart)

  return (
    <main
      style={{
        background: COLORS.bg,
        minHeight: "100vh",
        fontFamily: SYS_FONT,
        color: COLORS.text,
        padding: 24,
        boxSizing: "border-box",
        marginTop: CARDS_TOP_OFFSET,
      }}
    >
      {/* Wrapper om beide cards gecentreerd te plaatsen */}
      <div
        style={{
          display: "flex",
          gap: GAP_BETWEEN,
          justifyContent: "center",
          alignItems: "flex-start",
        }}
      >
        {/* Linker card: Jaren */}
        <aside
          style={{
            width: YEARS_CARD_WIDTH,
            background: COLORS.card,
            border: `1px solid ${COLORS.line}`,
            borderRadius: 12,
            padding: 12,
            height: "fit-content",
          }}
        >
          {loading ? (
            <div style={{ color: COLORS.textMuted, fontSize: 14 }}>Laden…</div>
          ) : allYearsDesc.length === 0 ? (
            <div style={{ color: COLORS.textMuted, fontSize: 14 }}>Geen jaren.</div>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
              {allYearsDesc.map((y) => {
                const isSelected = y === selectedYear;
                const isHover = hoverYear === y;
                return (
                  <li key={y}>
                    <button
                      type="button"
                      onClick={() => setSelectedYear(y)}
                      onMouseEnter={() => setHoverYear(y)}
                      onMouseLeave={() => setHoverYear(null)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") setSelectedYear(y);
                      }}
                      style={{
                        width: "100%",
                        cursor: "pointer",
                        borderRadius: 10,
                        padding: "8px 10px",
                        border: `1px solid ${
                          isSelected ? COLORS.primary : isHover ? COLORS.line : "transparent"
                        }`,
                        background: isSelected ? COLORS.primary : isHover ? "#fff" : "transparent",
                        color: isSelected ? "#fff" : COLORS.text,
                        fontSize: 14,
                        textAlign: "center", // JAARTAL in het midden
                        transition: "background 120ms ease, border-color 120ms ease",
                      }}
                    >
                      {y}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>

        {/* Rechter card: Vakantieteller */}
        <section
          style={{
            background: COLORS.card,
            border: `1px solid ${COLORS.line}`,
            borderRadius: 12,
            padding: 16,
            display: "flex",
            flexDirection: "column",
            gap: 12,
            width: `min(100%, ${COUNTER_CARD_MAX_WIDTH}px)`,
          }}
        >
          {/* Titel + Persoon (alleen voornaam) */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", alignItems: "center", gap: 12 }}>
            <div style={{ display: "grid", gridTemplateColumns: "6px 1fr", alignItems: "center", columnGap: 8 }}>
              <div style={{ width: 6, height: 26, background: COLORS.primary, borderRadius: 3 }} />
              <h2 className={variableFont.className} style={{ margin: 0, fontSize: 24 }}>
                Vakantieteller
              </h2>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 48, height: 48, overflow: "hidden", borderRadius: 8 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {person?.avatar_url ? (
                  <img
                    src={person.avatar_url}
                    alt="avatar"
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                ) : null}
              </div>
              <div className={variableFont.className} style={{ fontSize: 20 }}>
                {person ? person.name : "—" /* achternaam weggelaten */}
              </div>
            </div>
          </div>

          {loading ? (
            <div style={{ color: COLORS.textMuted }}>Laden…</div>
          ) : !selectedYear ? (
            <div style={{ color: COLORS.textMuted }}>Geen jaar geselecteerd.</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                <thead>
                  {/* Rij 1: groepskoppen (Startsaldo en Saldo samengevoegd/centreren) */}
                  <tr>
                    <th style={{ ...thBase }} />
                    <th style={{ ...thCenterWhite }} colSpan={2}>Startsaldo</th>
                    <th style={{ ...thCenter }}>Opgenomen</th>
                    <th style={{ ...thCenterWhite }} colSpan={2}>Saldo</th>
                  </tr>

                  {/* Rij 2: sublabels
                      - onder Categorie: dun zwart (1px)
                      - onder de rest: 2px accentkleur (doorgetrokken) */}
                  <tr>
                    <th style={{ ...thBase, borderBottom: thinBlack, textAlign: "left" }}>Categorie</th>
                    <th style={{ ...thCenterWhite, borderBottom: headerBottomBorder }}>(uren)</th>
                    <th style={{ ...thCenterWhite, borderBottom: headerBottomBorder }}>(dagen)</th>
                    <th style={{ ...thCenter, borderBottom: headerBottomBorder }}>(uren)</th>
                    <th style={{ ...thCenterWhite, borderBottom: headerBottomBorder }}>(uren)</th>
                    <th style={{ ...thCenterWhite, borderBottom: headerBottomBorder }}>(dagen)</th>
                  </tr>
                </thead>

                <tbody>
                  {/* Per reason: startsaldo; Opgenomen en Saldo per reason */}
                  {reasonsList.map((reasonKey) => {
                    const totalForReason = reasonTotals[reasonKey] || 0;
                    const takenForReason = selectedYear ? (requestsPerYearPerReason[selectedYear]?.[reasonKey] || 0) : 0;
                    const saldoForReason = totalForReason - takenForReason;
                    return (
                      <tr key={reasonKey} style={{ borderBottom: `1px solid ${COLORS.line}` }}>
                          <td style={{ ...tdBase, textAlign: "left" }}>{reasonKey === "" ? "-" : (reasonKey[0].toUpperCase() + reasonKey.slice(1))}</td>
                          <td style={tdValWhite}>{formatHours(totalForReason)}</td>
                          <td style={tdValWhite}>{formatDays(totalForReason, hoursPerWholeDay)}</td>
                          <td style={{ ...tdVal }}>{formatHours(takenForReason)}</td>
                          <td style={{ ...tdValWhite }}>{formatHours(saldoForReason)}</td>
                          <td style={{ ...tdValWhite }}>{formatDays(saldoForReason, hoursPerWholeDay)}</td>
                        </tr>
                    );
                  })}
                </tbody>

                <tfoot>
                  {/* Accentlijn 2px boven Totaal + cijfers in accentkleur */}
                    <tr style={{ borderTop: totalTopBorder, fontWeight: 700 }}>
                      <td style={{ ...tdBase, textAlign: "left", color: COLORS.primary }}>Totaal</td>
                      <td style={{ ...tdValWhite, color: COLORS.primary }}>{formatHours(startsaldoHours)}</td>
                      <td style={{ ...tdValWhite, color: COLORS.primary }}>{formatDays(startsaldoHours, hoursPerWholeDay)}</td>
                      <td style={{ ...tdVal, color: COLORS.primary }}>{formatHours(takenHours)}</td>
                      <td style={{ ...tdValWhite, color: COLORS.primary }}>{formatHours(saldoHours)}</td>
                      <td style={{ ...tdValWhite, color: COLORS.primary }}>{formatDays(saldoHours, hoursPerWholeDay)}</td>
                    </tr>
                </tfoot>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

/* ===== Hoofdexport ===== */
export default function CounterPage() {
  return (
    <Suspense fallback={<div style={{ padding: 12 }}>Laden…</div>}>
      <Suspense fallback={<div style={{ padding: 12 }}>Laden…</div>}>
        <FloatingNav />
      </Suspense>
      <CounterContent />
    </Suspense>
  );
}

export const dynamic = "force-dynamic";
