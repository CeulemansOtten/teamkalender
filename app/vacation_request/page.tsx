"use client";

import React, { useEffect, useMemo, useState, Suspense } from "react";
import localFont from "next/font/local";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import FloatingNav from "../components/FloatingNav";
import LegendNavVacationRequest from "../components/LegendNav_Vacation_Request";
import { School, PartyPopper, Cake, MoonStar } from "lucide-react";

/* ===== Basis UI ===== */
const FLOATING_NAV_OFFSET = 5;
const BUTTON_H = 42;

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
  dayHoverBg: "#FEE2E2",
  daySelectedBg: "#FECACA",
  applyBorder: "#B91C1C",
  birthdateBg: "#FCE7F3",
  birthdateBorder: "#F9A8D4",
};

const LEAVE_COLOR = "#C3E8E9";
const MONTHS_NL = ["januari","februari","maart","april","mei","juni","juli","augustus","september","oktober","november","december"];
const DOW_NL = ["ma","di","wo","do","vr","za","zo"];

/* ===== Helpers ===== */
function daysInMonth(y: number, m0: number) { return new Date(y, m0 + 1, 0).getDate(); }
function buildMonthMatrix(y: number, m0: number) {
  const total = daysInMonth(y, m0);
  const firstIdx = (new Date(y, m0, 1).getDay() + 6) % 7; // ma = 0
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstIdx; i++) cells.push(null);
  for (let d = 1; d <= total; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}
function pad2(n: number) { return n < 10 ? `0${n}` : `${n}`; }
function ymd(y: number, m0: number, d: number) { return `${y}-${pad2(m0 + 1)}-${pad2(d)}`; }
const round05 = (x: number) => Math.round(x * 2) / 2;

/* ===== Selectiestatus (voor AANVRAGEN) ===== */
type SelState = "none" | "full" | "am" | "pm";
function nextState(s: SelState): SelState { return s === "none" ? "full" : s === "full" ? "am" : s === "am" ? "pm" : "none"; }
function nextBadge(s: SelState) {
  const nx = nextState(s);
  if (nx === "full") return "+";
  if (nx === "am") return "VM";
  if (nx === "pm") return "NM";
  return "×";
}

/* ===== Bestaande leave overlays ===== */
type PartStatus = "requested" | "approved" | undefined;
type ExistingByDate = Record<string, { am?: PartStatus; pm?: PartStatus }>;

/* ===== Feestdagen ===== */
type HolidaySubtype = "school" | "public" | "jewish" | "islam";

/** We bewaren ALLE types per dag, i.p.v. 1 type te overschrijven. */
type HolidayFlags = {
  public?: string; // naam
  school?: string; // naam
  jewish?: string; // naam
  islam?: string;  // naam
};
type HolidayMap = Record<string, HolidayFlags>;

/* ===== Tooltip items ===== */
type TooltipItem =
  | { kind: "birthday" }
  | { kind: "holiday"; name?: string; subtype: HolidaySubtype }
  | { kind: "leave"; label: string; avatar?: string | null };

/* ===== Iconen ===== */
function IconStarOfDavid({ size = 16, color = COLORS.text }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3 L4 17 H20 Z" />
      <path d="M12 21 L4 7 H20 Z" />
    </svg>
  );
}

/* ===== Pharmacy helpers (uren per dagdeel) ===== */
function normPart(v: string): "full" | "am" | "pm" | null {
  const s = (v || "").toString().trim().toLowerCase();
  if (["hele dag","heledag","full","full day","dag"].includes(s)) return "full";
  if (["voormiddag","vm","am","morning"].includes(s)) return "am";
  if (["namiddag","nm","pm","afternoon"].includes(s)) return "pm";
  return null;
}

async function fetchPharmacyHours(pharmacyId: string) {
  // Probeer eerst detail-rijen (daypart,hours) in tabellen die dat kunnen bevatten.
  const candidateTables = [
    { table: "pharmacy_hours", filterCols: ["pharmacy_id", "pharmacy"] },
    { table: "pharmacy",       filterCols: ["pharmacy", "pharmacy_id", "id"] }, // jouw pharmacy-tabel kan hier daypart/hours bevatten
  ];

  for (const src of candidateTables) {
    for (const col of src.filterCols) {
      const { data, error } = await supabase
        .from(src.table)
        .select("daypart, hours")
        .eq(col, pharmacyId);
      if (error || !Array.isArray(data) || data.length === 0) continue;

      let full = NaN, am = NaN, pm = NaN;
      for (const row of data as any[]) {
        const p = normPart(row.daypart);
        const hrs = Number(row.hours);
        if (p && !isNaN(hrs)) {
          if (p === "full") full = hrs;
          if (p === "am")   am   = hrs;
          if (p === "pm")   pm   = hrs;
        }
      }
      if (isNaN(full) && !isNaN(am) && !isNaN(pm)) full = am + pm;
      if (!isNaN(full) && isNaN(am) && isNaN(pm)) { am = full/2; pm = full/2; }
      if (!isNaN(full) || !isNaN(am) || !isNaN(pm)) {
        return {
          full: !isNaN(full) ? full : 8,
          am:   !isNaN(am)   ? am   : (!isNaN(full) ? full/2 : 4),
          pm:   !isNaN(pm)   ? pm   : (!isNaN(full) ? full/2 : 4),
        };
      }
    }
  }

  // Fallback: probeer expliciete kolommen op pharmacy (indien aanwezig)
  const { data: ph } = await supabase
    .from("pharmacy")
    .select("full_day_hours, am_hours, pm_hours")
    .eq("id", pharmacyId)
    .maybeSingle();
  if (ph) {
    const full = Number((ph as any).full_day_hours ?? 8) || 8;
    const am   = Number((ph as any).am_hours ?? full/2) || full/2;
    const pm   = Number((ph as any).pm_hours ?? full/2) || full/2;
    return { full, am, pm };
  }

  // Vangnet
  return { full: 8, am: 4, pm: 4 };
}

/* ===== Dagcel ===== */
type HoverMode = "interactive" | "x-only" | "none";

function DayCell({
  day, bg, hoverMode, state, onCycle, existing, isBirthday,
  showReligiousBorder,
  onHover, items, isFutureDay, revokeSelected, onToggleRevoke,
}: {
  day: number | null;
  bg: string;
  hoverMode: HoverMode;
  state: SelState;
  onCycle?: () => void;
  existing?: { am?: PartStatus; pm?: PartStatus };
  isBirthday?: boolean;
  showReligiousBorder?: boolean;
  onHover?: (e: React.MouseEvent | null, items: TooltipItem[] | null) => void;
  items?: TooltipItem[];
  isFutureDay?: boolean;
  revokeSelected?: boolean;
  onToggleRevoke?: () => void;
}) {
  const [hover, setHover] = useState(false);
  const interactive = hoverMode === "interactive";
  const xOnly = hoverMode === "x-only";
  const blocked = hoverMode === "none";
  const showHover = !!day;

  const hasExisting = !!(existing?.am || existing?.pm);
  const baseBg = isBirthday ? COLORS.birthdateBg : bg;
  const showRedHover = hover && (interactive || xOnly);
  const hoverBg = showRedHover ? COLORS.dayHoverBg : baseBg;

  function overlayHalf(which: "am" | "pm", status: PartStatus) {
    const st: React.CSSProperties = {
      position: "absolute",
      left: 0, right: 0,
      height: "50%",
      background: "transparent",
      pointerEvents: "none",
      borderRadius: 8,
    };
    if (which === "am") Object.assign(st, { top: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 0 });
    if (which === "pm") Object.assign(st, { bottom: 0, borderTopLeftRadius: 0, borderTopRightRadius: 0 });
    if (status === "approved") st.background = LEAVE_COLOR;
    else if (status === "requested") st.background = `repeating-linear-gradient(45deg, ${LEAVE_COLOR} 0, ${LEAVE_COLOR} 8px, #ffffff 8px, #ffffff 16px)`;
    else return null;
    return <div key={`${which}-${status}`} style={st} />;
  }

  const bothReq = existing?.am === "requested" && existing?.pm === "requested";
  const bothApp = existing?.am === "approved" && existing?.pm === "approved";
  const hasNew = state !== "none";

  let borderColor = COLORS.line;
  let borderWidth = 1;
  if (hasNew) { borderColor = COLORS.applyBorder; borderWidth = 2; }

  const onCentralClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (blocked) return;
    if (interactive && onCycle) onCycle();
    if (xOnly && isFutureDay && onToggleRevoke) onToggleRevoke();
  };

  return (
    <div
      onMouseEnter={(e) => { if (showHover) { setHover(true); onHover?.(e, items ?? null); } }}
      onMouseMove={(e) => { if (showHover) onHover?.(e, items ?? null); }}
      onMouseLeave={() => { setHover(false); onHover?.(null, null); }}
      onClick={() => {
        if (blocked) return;
        if (interactive && day && onCycle) onCycle();
        if (xOnly && isFutureDay && onToggleRevoke) onToggleRevoke();
      }}
      role={(interactive || xOnly) ? "button" : undefined}
      style={{
        position: "relative",
        height: 36,
        background: hoverBg,
        border: `${borderWidth}px solid ${borderColor}`,
        borderRadius: 8,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 13,
        color: "#000",
        opacity: day ? 1 : 0.55,
        userSelect: "none",
        transition: "background 120ms ease, border-color 120ms ease, opacity 120ms ease",
        cursor: blocked ? "default" : (interactive || xOnly) ? "pointer" : "default",
        overflow: "hidden",
        pointerEvents: "auto",
      }}
    >
      {bothReq && (
        <div style={{ position: "absolute", inset: 0, borderRadius: 8, pointerEvents: "none",
          background: `repeating-linear-gradient(45deg, ${LEAVE_COLOR} 0, ${LEAVE_COLOR} 8px, #ffffff 8px, #ffffff 16px)` }} />
      )}
      {bothApp && (
        <div style={{ position: "absolute", inset: 0, borderRadius: 8, pointerEvents: "none", background: LEAVE_COLOR }} />
      )}
      {!bothReq && !bothApp && (
        <>
          {existing?.am && overlayHalf("am", existing.am)}
          {existing?.pm && overlayHalf("pm", existing.pm)}
        </>
      )}

      {state === "full" && !hasExisting && (
        <div style={{ position: "absolute", inset: 0, background: COLORS.daySelectedBg, borderRadius: 8, pointerEvents: "none" }} />
      )}
      {state === "am" && !(existing && existing.am) && (
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "50%", background: COLORS.daySelectedBg, borderTopLeftRadius: 8, borderTopRightRadius: 8, pointerEvents: "none" }} />
      )}
      {state === "pm" && !(existing && existing.pm) && (
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "50%", background: COLORS.daySelectedBg, borderBottomLeftRadius: 8, borderBottomRightRadius: 8, pointerEvents: "none" }} />
      )}

      {/* Verjaardag-rand */}
      {isBirthday && (
        <div aria-hidden style={{ position: "absolute", inset: 2, borderRadius: 6, border: `2px solid ${COLORS.birthdateBorder}`, pointerEvents: "none", zIndex: 3 }} />
      )}

      {/* Religieuze rand (joods of islam) — toon altijd, ook bij verjaardag */}
      {showReligiousBorder && (
        <div aria-hidden style={{ position: "absolute", inset: 2, borderRadius: 6, border: `3px solid ${COLORS.publicBg}`, pointerEvents: "none", zIndex: 4 }} />
      )}

      {/* intrekken-visual */}
      {xOnly && revokeSelected && (
        <div style={{ position: "absolute", inset: 0, background: COLORS.daySelectedBg, borderRadius: 8, pointerEvents: "none" }} />
      )}

      <span style={{ position: "relative", zIndex: 3 }}>{day ?? ""}</span>

      {/* Centrale knop */}
      {showHover && (interactive || (xOnly && isFutureDay)) && (
        <button
          aria-hidden={!hover}
          tabIndex={-1}
          style={{
            position: "absolute",
            top: "50%", left: "50%", transform: "translate(-50%, -50%)",
            width: 28, height: 28, borderRadius: 999,
            border: `1px solid ${xOnly ? COLORS.applyBorder : COLORS.primary}`,
            background: COLORS.btnBg,
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 1px 2px rgba(0,0,0,0.08)",
            opacity: hover ? 1 : 0,
            pointerEvents: hover ? "auto" : "none",
            transition: "opacity 120ms ease, background 120ms ease",
            cursor: "pointer",
            fontSize: 12, fontWeight: 900, color: xOnly ? COLORS.applyBorder : COLORS.primary,
            zIndex: 4,
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = COLORS.btnHover)}
          onMouseLeave={(e) => (e.currentTarget.style.background = COLORS.btnBg)}
          onClick={onCentralClick}
          title={xOnly ? (revokeSelected ? "Niet meer intrekken" : "Selecteer om in te trekken") : "Selecteer dagdeel"}
        >
          {xOnly ? "×" : nextBadge(state)}
        </button>
      )}
    </div>
  );
}

/* ===== Maand ===== */
function MonthCalendar({
  year, month0, holidayMap, selections, onCycleDate, existingByDate,
  birthdateDD, birthdateMM, onHover, todayYMD,
  revokeSel, onToggleRevokeDate, personAvatar,
}: {
  year: number;
  month0: number;
  holidayMap: HolidayMap;
  selections: Record<string, SelState>;
  onCycleDate: (key: string) => void;
  existingByDate: ExistingByDate;
  birthdateDD: string | null;
  birthdateMM: string | null;
  onHover: (e: React.MouseEvent | null, items: TooltipItem[] | null) => void;
  todayYMD: string;
  revokeSel: Record<string, boolean>;
  onToggleRevokeDate: (key: string) => void;
  personAvatar: string | null;
}) {
  const weeks = buildMonthMatrix(year, month0);
  const monthName = MONTHS_NL[month0];

  return (
    <div style={{ background: COLORS.card, border: `1px solid ${COLORS.line}`, borderRadius: 12, padding: 12, display: "flex", flexDirection: "column", gap: 8, minWidth: 260 }}>
      <div style={{ display: "grid", gridTemplateColumns: "8px 1fr", alignItems: "center", columnGap: 8 }}>
        <div style={{ width: 8, height: 24, background: COLORS.primary, borderRadius: 4 }} />
        <h3 className={monthFont.className} style={{ margin: 0, color: COLORS.text, fontSize: 18, fontWeight: 600, textTransform: "capitalize" }}>
          {monthName} {year}
        </h3>
      </div>

      <div className={monthFont.className} style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, color: COLORS.textMuted, fontSize: 12, fontWeight: 600 }}>
        {DOW_NL.map((d, idx) => (
          <div key={d} style={{ textAlign: "center", padding: "6px 0", background: idx >= 5 ? COLORS.weekendBg : "transparent", borderRadius: 6 }}>
            {d}
          </div>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {weeks.map((week, wi) => (
          <div key={wi} style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
            {week.map((day, di) => {
              const isWeekendCol = di === 5 || di === 6;
              if (!day) {
                return <DayCell key={di} day={null} bg={"#fff"} hoverMode={"none"} state={"none"} onHover={onHover} items={null as any} />;
              }

              const key = ymd(year, month0, day);
              const isPast = key < todayYMD;
              const isFutureDay = key >= todayYMD;

              const isBirthday = !!birthdateDD && !!birthdateMM && pad2(day) === birthdateDD && pad2(month0 + 1) === birthdateMM;

              const flags = holidayMap[key] || {};
              const ex = existingByDate[key];
              const hasExisting = !!(ex?.am || ex?.pm);

              // achtergrond: public > (anders) school > (anders) weekend > wit
              let baseBg = "#fff";
              if (flags.public) baseBg = COLORS.publicBg;
              else if (flags.school) baseBg = COLORS.schoolBg;
              else if (isWeekendCol) baseBg = COLORS.weekendBg;
              if (isBirthday) baseBg = COLORS.birthdateBg; // verjaardag blijft boven

              // klikbaarheid: blokkeer weekend, public, verleden
              let hoverMode: HoverMode = "interactive";
              if (isPast || isWeekendCol || !!flags.public) {
                hoverMode = "none";
              } else if (hasExisting) {
                hoverMode = "x-only";
              }

              const state: SelState = selections[key] ?? "none";
              const revokeSelected = !!revokeSel[key];

              // tooltip (toon alle aanwezige types)
              const items: TooltipItem[] = [];
              if (isBirthday) items.push({ kind: "birthday" });
              if (flags.public) items.push({ kind: "holiday", name: flags.public, subtype: "public" });
              if (flags.school) items.push({ kind: "holiday", name: flags.school, subtype: "school" });
              if (flags.jewish) items.push({ kind: "holiday", name: flags.jewish, subtype: "jewish" });
              if (flags.islam)  items.push({ kind: "holiday", name: flags.islam,  subtype: "islam" });

              if (ex?.am || ex?.pm) {
                if (ex?.am && ex?.pm && ex.am === ex.pm) {
                  const txt = ex.am === "approved" ? "goedgekeurd" : "aangevraagd";
                  items.push({ kind: "leave", label: `Hele dag: ${txt}`, avatar: personAvatar });
                } else {
                  const lines: string[] = [];
                  if (ex?.am) lines.push(`Voormiddag: ${ex.am === "approved" ? "goedgekeurd" : "aangevraagd"}`);
                  if (ex?.pm) lines.push(`Namiddag: ${ex.pm === "approved" ? "goedgekeurd" : "aangevraagd"}`);
                  const label = lines.length === 2 ? `${lines[0]} • ${lines[1]}` : lines[0];
                  if (label) items.push({ kind: "leave", label, avatar: personAvatar });
                }
              }

              // Religieuze rand tonen als er Joods of Islamitisch is (altijd), óók bovenop school/verjaardag
              const showReligiousBorder = !!flags.jewish || !!flags.islam;

               return (
                 <DayCell
                   key={di}
                   day={day}
                   bg={baseBg}
                   hoverMode={hoverMode}
                   state={state}
                   existing={ex}
                   onCycle={() => onCycleDate(key)}
                   isBirthday={isBirthday}
                   showReligiousBorder={showReligiousBorder}
                   onHover={onHover}
                   items={items}
                   isFutureDay={isFutureDay}
                   revokeSelected={revokeSelected}
                   onToggleRevoke={() => onToggleRevokeDate(key)}
                 />
               );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ===== Pagina ===== */
export default function Page() {
  return (
    <Suspense fallback={<div style={{ padding: 12 }}>Laden…</div>}>
      <VacationRequestContent />
    </Suspense>
  );
}

function VacationRequestContent() {
  const search = useSearchParams();
  const personnelId = search.get("personnel_id");

  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [personName, setPersonName] = useState<string>("…");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  // uren uit pharmacy (decimaal ok, bv 8.5)
  const [pharmacyHours, setPharmacyHours] = useState<{ full: number; am: number; pm: number }>({ full: 8, am: 4, pm: 4 });

  // data
  const [holidayMap, setHolidayMap] = useState<HolidayMap>({});
  const [existingByDate, setExistingByDate] = useState<ExistingByDate>({});

  // selecties
  const [selections, setSelections] = useState<Record<string, SelState>>({});
  const [revokeSel, setRevokeSel] = useState<Record<string, boolean>>({});

  // bday
  const [birthDM, setBirthDM] = useState<{ d: string | null; m: string | null }>({ d: null, m: null });

  // tooltip & meldingen
  const [tooltip, setTooltip] = useState<{ x: number; y: number; items: TooltipItem[] } | null>(null);
  const [panelError, setPanelError] = useState<string | null>(null);

  // panel
  const [showEntitlements, setShowEntitlements] = useState(false);

  // verdeling in uren
  type Alloc = { wettelijk: number; overuren: number; adv: number; andere: number; };
  const [alloc, setAlloc] = useState<Alloc>({ wettelijk: 0, overuren: 0, adv: 0, andere: 0 });

  // saldo in uren
  const [balancesHrs, setBalancesHrs] = useState<Alloc>({ wettelijk: 0, overuren: 0, adv: 0, andere: 0 });

  // loader
  const [saving, setSaving] = useState(false);

  // vandaag (YYYY-MM-DD)
  const todayYMD = useMemo(() => {
    const t = new Date();
    return ymd(t.getFullYear(), t.getMonth(), t.getDate());
  }, []);

  const fmtHalf = useMemo(() => new Intl.NumberFormat("nl-BE", { minimumFractionDigits: 0, maximumFractionDigits: 1 }), []);
  const fmtIntOrHalf = (n: number) => fmtHalf.format(round05(n));

  /* Persoon + pharmacy (met daypart-hours) */
  useEffect(() => {
    let active = true;
    async function loadPersonAndPharmacy() {
      if (!personnelId) {
        setPersonName("Onbekend"); setAvatarUrl(null); setBirthDM({ d: null, m: null });
        setPharmacyHours({ full: 8, am: 4, pm: 4 });
        return;
      }
      const { data: person } = await supabase
        .from("personnel")
        .select("name, avatar_url, birthdate, pharmacy")
        .eq("id", personnelId)
        .single();

      if (!active) return;

      if (!person) {
        setPersonName("Onbekend"); setAvatarUrl(null); setBirthDM({ d: null, m: null });
        setPharmacyHours({ full: 8, am: 4, pm: 4 });
        return;
      }

      setPersonName(person.name || "Onbekend");
      setAvatarUrl(person.avatar_url || null);

      const b = (person as any).birthdate as string | null;
      if (b && /^\d{8}$/.test(b)) setBirthDM({ d: b.slice(0,2), m: b.slice(2,4) });

      const pharmacyId = (person as any).pharmacy;
      if (pharmacyId) {
        const hours = await fetchPharmacyHours(pharmacyId);
        if (active) setPharmacyHours(hours);
      } else {
        setPharmacyHours({ full: 8, am: 4, pm: 4 });
      }
    }
    loadPersonAndPharmacy();
    return () => { active = false; };
  }, [personnelId]);

  /* Feestdagen: verzamel ALLEN per datum (public / school / jewish) */
  useEffect(() => {
    let mounted = true;
    async function load() {
      const from = `${year}-01-01`;
      const to = `${year + 1}-01-01`;
      const { data } = await supabase
        .from("holidays")
        .select("holiday_date,type,name")
        .gte("holiday_date", from)
        .lt("holiday_date", to);
      if (!data) { if (mounted) setHolidayMap({}); return; }

      const map: HolidayMap = {};
      for (const r of data as any[]) {
        const t = (r.type || "").toString().toLowerCase() as HolidaySubtype;
        if (t !== "school" && t !== "public" && t !== "jewish" && t !== "islam") continue;
        const date = r.holiday_date as string;
        if (!map[date]) map[date] = {};
        if (t === "public") map[date].public = r.name as string | undefined;
        if (t === "school") map[date].school = r.name as string | undefined;
        if (t === "jewish") map[date].jewish = r.name as string | undefined;
        if (t === "islam")   map[date].islam   = r.name as string | undefined;
      }
      if (mounted) setHolidayMap(map);
    }
    load();
    return () => { mounted = false; };
  }, [year]);

  /* Bestaande leave overlays */
  useEffect(() => {
    let mounted = true;
    async function load() {
      if (!personnelId) { setExistingByDate({}); return; }
      const from = `${year}-01-01`;
      const to = `${year + 1}-01-01`;
      const { data } = await supabase
        .from("leave_requests")
        .select("leave_date,status,daypart")
        .eq("personnel_id", personnelId)
        .gte("leave_date", from)
        .lt("leave_date", to)
        .in("status", ["requested", "approved"]);

      if (!data) { if (mounted) setExistingByDate({}); return; }

      const map: ExistingByDate = {};
      const prefer = (prev: PartStatus, cur: PartStatus): PartStatus =>
        (prev === "approved" || cur === "approved") ? "approved" : (prev || cur);

      for (const row of data) {
        const date = (row as any).leave_date as string;
        const status = (row as any).status === "approved" ? "approved" : "requested";
        const part = (row as any).daypart || "hele dag";
        if (!map[date]) map[date] = {};
        if (part === "hele dag") { map[date].am = prefer(map[date].am, status); map[date].pm = prefer(map[date].pm, status); }
        else if (part === "voormiddag") map[date].am = prefer(map[date].am, status);
        else if (part === "namiddag")  map[date].pm = prefer(map[date].pm, status);
      }
      if (mounted) setExistingByDate(map);
    }
    load();
    return () => { mounted = false; };
  }, [personnelId, year]);

  /* Saldi (uren) */
  useEffect(() => {
    let active = true;
    async function loadBalances() {
      if (!personnelId) { setBalancesHrs({ wettelijk: 0, overuren: 0, adv: 0, andere: 0 }); return; }

      const from = `${year}-01-01`;
      const to = `${year + 1}-01-01`;

      const { data: entData } = await supabase
        .from("leave_entitlements")
        .select("reason,total_hours,year")
        .eq("personnel_id", personnelId)
        .eq("year", year);

      const { data: reqData } = await supabase
        .from("leave_requests")
        .select("leave_date,daypart,status,hours")
        .eq("personnel_id", personnelId)
        .gte("leave_date", from)
        .lt("leave_date", to)
        .in("status", ["requested","approved"]);

      if (!active) return;

      const totalsByReason = { wettelijk: 0, overuren: 0, adv: 0, andere: 0 } as any;
      for (const r of (entData ?? []) as any[]) {
        const key = (String(r.reason || "").toLowerCase() || "andere") as keyof typeof totalsByReason;
        const hrs = Number(r.total_hours || 0);
        if (key in totalsByReason) totalsByReason[key] += hrs;
        else totalsByReason.andere += hrs;
      }

      const usedHours = (reqData ?? []).reduce((sum, rr: any) => {
        if (typeof rr.hours === "number" && !isNaN(rr.hours)) return sum + rr.hours;
        const dp = String(rr.daypart || "hele dag").toLowerCase();
        if (dp === "hele dag") return sum + pharmacyHours.full;
        if (dp === "voormiddag") return sum + pharmacyHours.am;
        if (dp === "namiddag") return sum + pharmacyHours.pm;
        return sum;
      }, 0);

      const result: Alloc = {
        wettelijk: Math.max(0, round05(totalsByReason.wettelijk - usedHours)),
        overuren:  Math.max(0, round05(totalsByReason.overuren  - 0)),
        adv:       Math.max(0, round05(totalsByReason.adv       - 0)),
        andere:    Math.max(0, round05(totalsByReason.andere    - 0)),
      };

      setBalancesHrs(result);
    }
    loadBalances();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [personnelId, year, pharmacyHours.full, pharmacyHours.am, pharmacyHours.pm]);

  /* Niet-selecteerbare check in code die daadwerkelijk togglet */
  const onCycleDate = (key: string) => {
    if (Object.keys(revokeSel).length > 0) {
      setPanelError("Je hebt dagen geselecteerd om in te trekken. Rond dat eerst af of maak de selectie leeg.");
      return;
    }
    const dt = new Date(key);
    const isWeekend = dt.getDay() === 0 || dt.getDay() === 6;
    const flags = holidayMap[key] || {};
    const isPublic = !!flags.public;

    if (key < todayYMD || isWeekend || isPublic) return;
    if (existingByDate[key]?.am || existingByDate[key]?.pm) return;

    setPanelError(null);
    setSelections(prev => {
      const cur = (prev[key] ?? "none") as SelState;
      const nx = nextState(cur);
      const next = { ...prev };
      if (nx === "none") delete next[key];
      else next[key] = nx;
      return next;
    });
  };

  const onToggleRevokeDate = (key: string) => {
    if (Object.keys(selections).length > 0) {
      setPanelError("Je hebt dagen geselecteerd om verlof aan te vragen. Rond dat eerst af of maak de selectie leeg.");
      return;
    }
    if (key < todayYMD) return;
    setPanelError(null);
    setRevokeSel(prev => {
      const next = { ...prev };
      if (next[key]) delete next[key];
      else next[key] = true;
      return next;
    });
  };

  async function onConfirmRevoke() {
    if (!personnelId) return;
    const dates = Object.keys(revokeSel).filter(d => d >= todayYMD);
    if (dates.length === 0) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("leave_requests")
        .delete()
        .eq("personnel_id", personnelId)
        .in("leave_date", dates)
        .in("status", ["requested","approved"]);
      if (error) throw error;

      setRevokeSel({});
      // refresh overlays
      const from = `${year}-01-01`, to = `${year + 1}-01-01`;
      const { data } = await supabase
        .from("leave_requests")
        .select("leave_date,status,daypart")
        .eq("personnel_id", personnelId)
        .gte("leave_date", from)
        .lt("leave_date", to)
        .in("status", ["requested", "approved"]);
      const map: ExistingByDate = {};
      const prefer = (p: PartStatus, c: PartStatus): PartStatus => (p === "approved" || c === "approved") ? "approved" : (p || c);
      for (const row of data ?? []) {
        const date = (row as any).leave_date as string;
        const status = (row as any).status === "approved" ? "approved" : "requested";
        const part = (row as any).daypart || "hele dag";
        if (!map[date]) map[date] = {};
        if (part === "hele dag") { map[date].am = prefer(map[date].am, status); map[date].pm = prefer(map[date].pm, status); }
        else if (part === "voormiddag") map[date].am = prefer(map[date].am, status);
        else if (part === "namiddag")  map[date].pm = prefer(map[date].pm, status);
      }
      setExistingByDate(map);
      setPanelError(null);
    } catch (err) {
      console.error("Intrekken mislukt:", err);
      setPanelError("Intrekken mislukt. Probeer opnieuw.");
    } finally {
      setSaving(false);
    }
  }

  // tooltip
  const handleHover = (e: React.MouseEvent | null, items: TooltipItem[] | null) => {
    if (!e || !items || items.length === 0) { setTooltip(null); return; }
    setTooltip({ x: e.clientX + 12, y: e.clientY + 12, items });
  };

  // TOTALEN (dagen + uren) meteen op pharmacy-basis
  const totalDays = useMemo(
    () => Object.values(selections).reduce((s, st) => s + (st === "full" ? 1 : 0.5), 0),
    [selections]
  );
  const totalHoursSelected = useMemo(() => {
    let sum = 0;
    for (const st of Object.values(selections)) {
      if (st === "full") sum += pharmacyHours.full;
      else if (st === "am") sum += pharmacyHours.am;
      else if (st === "pm") sum += pharmacyHours.pm;
    }
    return round05(sum);
  }, [selections, pharmacyHours]);

  const sumAlloc = (a: Alloc) => a.wettelijk + a.overuren + a.adv + a.andere;
  const remainingHours = useMemo(() => {
    const rem = round05(totalHoursSelected - sumAlloc(alloc));
    return rem < 0 ? 0 : rem;
  }, [totalHoursSelected, alloc]);

  useEffect(() => {
    if (!showEntitlements) {
      setAlloc({ wettelijk: 0, overuren: 0, adv: 0, andere: 0 });
    } else {
      let rem = totalHoursSelected;
      const out: Alloc = { wettelijk: 0, overuren: 0, adv: 0, andere: 0 };
      const take = (k: keyof Alloc, cap: number) => { const t = Math.min(rem, Math.max(0, cap)); out[k] = round05(t); rem = round05(rem - out[k]); };
      take("wettelijk", balancesHrs.wettelijk);
      take("overuren", balancesHrs.overuren);
      take("adv",      balancesHrs.adv);
      out.andere = round05(Math.max(0, rem));
      setAlloc(out);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showEntitlements, totalHoursSelected, balancesHrs.wettelijk, balancesHrs.overuren, balancesHrs.adv]);

  const canInc = (k: keyof Alloc) => remainingHours >= 0.5 - 1e-9;
  const canDec = (k: keyof Alloc) => alloc[k] >= 0.5 - 1e-9;
  function inc(key: keyof Alloc) { if (!canInc(key)) return; setAlloc(prev => ({ ...prev, [key]: round05(prev[key] + 0.5) })); }
  function dec(key: keyof Alloc) { if (!canDec(key)) return; setAlloc(prev => ({ ...prev, [key]: round05(prev[key] - 0.5) })); }

  // Opslaan aanvraag
  function daypartFromState(s: SelState) { return s === "full" ? "hele dag" : s === "am" ? "voormiddag" : "namiddag"; }
  type K = keyof Alloc; const ORDER: K[] = ["wettelijk", "overuren", "adv", "andere"];

  async function onPrimaryButton() {
    if (!personnelId) return;

    if (!showEntitlements) {
      setShowEntitlements(true);
      setPanelError(null);
      return;
    }

    if (Object.keys(revokeSel).length > 0) {
      setPanelError("Je hebt dagen geselecteerd om in te trekken. Rond dat eerst af of maak de selectie leeg.");
      return;
    }

    if (remainingHours !== 0 || totalHoursSelected <= 0) return;

    const entries = Object.entries(selections)
      .filter(([d]) => d >= todayYMD)
      .map(([d, st]) => {
        const hours = st === "full" ? pharmacyHours.full : st === "am" ? pharmacyHours.am : pharmacyHours.pm;
        return { leave_date: d, daypart: daypartFromState(st), hours: round05(hours) };
      })
      .sort((a, b) => (a.leave_date < b.leave_date ? -1 : a.leave_date > b.leave_date ? 1 : 0));

    if (entries.length === 0) return;

    const avail: Alloc = { ...alloc };
    let bucketIdx = 0;
    const rows = entries.map(e => {
      let idx = bucketIdx;
      while (idx < ORDER.length && (round05(avail[ORDER[idx]] - e.hours) < -1e-9)) idx++;
      if (idx >= ORDER.length) idx = ORDER.length - 1;
      bucketIdx = idx;

      const entKey = ORDER[idx];
      avail[entKey] = round05(Math.max(0, avail[entKey] - e.hours));

      return {
        leave_date: e.leave_date,
        status: "requested" as const,
        personnel_id: personnelId,
        daypart: e.daypart,
        entitlement: entKey,
        hours: e.hours,
      };
    });

    setSaving(true);
    try {
      let { error } = await supabase.from("leave_requests").insert(rows);
      if (error) {
        const alt = await supabase.from("leave_request").insert(rows);
        if (alt.error) throw alt.error;
      }

      setSelections({});
      setShowEntitlements(false);
      setAlloc({ wettelijk: 0, overuren: 0, adv: 0, andere: 0 });
      setPanelError(null);

      // refresh overlays
      const from = `${year}-01-01`, to = `${year + 1}-01-01`;
      const { data } = await supabase
        .from("leave_requests")
        .select("leave_date,status,daypart")
        .eq("personnel_id", personnelId)
        .gte("leave_date", from)
        .lt("leave_date", to)
        .in("status", ["requested", "approved"]);
      const map: ExistingByDate = {};
      const prefer = (p: PartStatus, c: PartStatus): PartStatus => (p === "approved" || c === "approved") ? "approved" : (p || c);
      for (const row of data ?? []) {
        const date = (row as any).leave_date as string;
        const status = (row as any).status === "approved" ? "approved" : "requested";
        const part = (row as any).daypart || "hele dag";
        if (!map[date]) map[date] = {};
        if (part === "hele dag") { map[date].am = prefer(map[date].am, status); map[date].pm = prefer(map[date].pm, status); }
        else if (part === "voormiddag") map[date].am = prefer(map[date].am, status);
        else if (part === "namiddag")  map[date].pm = prefer(map[date].pm, status);
      }
      setExistingByDate(map);

    } catch (err: any) {
      console.error("Opslaan mislukt:", err?.message ?? err);
      setPanelError("Opslaan mislukt. Kijk de console (F12) voor details.");
    } finally {
      setSaving(false);
    }
  }

  const prevYear = () => setYear(y => y - 1);
  const nextYear = () => setYear(y => y + 1);
  function ctrlBtnStyle(disabled: boolean): React.CSSProperties {
    return {
      width: 28, height: 28, borderRadius: 999,
      border: `1px solid ${disabled ? COLORS.line : COLORS.btnBorder}`,
      background: disabled ? COLORS.btnHover : COLORS.btnBg,
      color: disabled ? COLORS.textMuted : "inherit",
      cursor: disabled ? "default" : "pointer",
      fontWeight: 800, opacity: disabled ? 0.6 : 1,
    };
  }

  return (
    <>
      <FloatingNav />
      <LegendNavVacationRequest />

      <main style={{ background: COLORS.bg, minHeight: "100vh", padding: 24, boxSizing: "border-box", marginTop: `${FLOATING_NAV_OFFSET}px`, position: "relative" }}>
        {/* Header */}
        <header style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <button
            onClick={prevYear}
            aria-label="Ga naar vorig jaar"
            className={titleFont.className}
            style={{ padding: "8px 14px", background: COLORS.btnBg, border: `1px solid ${COLORS.btnBorder}`, borderRadius: 999, cursor: "pointer", minWidth: 130, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 10, fontWeight: 900, fontSize: 18, letterSpacing: 0.2, transition: "background 120ms ease" }}
            onMouseOver={(e) => (e.currentTarget.style.background = COLORS.btnHover)}
            onMouseOut={(e) => (e.currentTarget.style.background = COLORS.btnBg)}
          >
            <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={COLORS.primary} strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <polyline points="15 6 9 12 15 18" />
            </svg>
            <span>{year - 1}</span>
          </button>

          <h1 className={titleFont.className} style={{ margin: 0, color: COLORS.text, fontSize: 28, fontWeight: 900, letterSpacing: 0.2, display: "inline-flex", alignItems: "center", gap: 10 }}>
            <span>Persoonlijke kalender van</span>
            <span>{personName}</span>
            {avatarUrl && (<img src={avatarUrl} alt={personName} style={{ height: "1em", width: "1em", borderRadius: "50%" }} />)}
          </h1>

          <button
            onClick={nextYear}
            aria-label="Ga naar volgend jaar"
            className={titleFont.className}
            style={{ padding: "8px 14px", background: COLORS.btnBg, border: `1px solid ${COLORS.btnBorder}`, borderRadius: 999, cursor: "pointer", minWidth: 130, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 10, fontWeight: 900, fontSize: 18, letterSpacing: 0.2, transition: "background 120ms ease" }}
            onMouseOver={(e) => (e.currentTarget.style.background = COLORS.btnHover)}
            onMouseOut={(e) => (e.currentTarget.style.background = COLORS.btnBg)}
          >
            <span>{year + 1}</span>
            <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={COLORS.primary} strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <polyline points="9 6 15 12 9 18" />
            </svg>
          </button>
        </header>

        {/* 12 maanden */}
        <section style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(240px, 1fr))", gap: 16 }}>
          {Array.from({ length: 12 }).map((_, m) => (
            <MonthCalendar
              key={m}
              year={year}
              month0={m}
              holidayMap={holidayMap}
              selections={selections}
              onCycleDate={onCycleDate}
              existingByDate={existingByDate}
              birthdateDD={birthDM.d}
              birthdateMM={birthDM.m}
              onHover={handleHover}
              todayYMD={todayYMD}
              revokeSel={revokeSel}
              onToggleRevokeDate={onToggleRevokeDate}
              personAvatar={avatarUrl}
            />
          ))}
        </section>

        {/* Rechts onderaan panel */}
        {(totalDays > 0 || Object.keys(revokeSel).length > 0) && (
          <div style={{ position: "fixed", right: 24, bottom: 24, display: "inline-flex", alignItems: "flex-end", gap: 12, zIndex: 9999, maxWidth: 540 }}>
            <div className={titleFont.className} style={{ background: "#fff", border: `1px solid ${COLORS.line}`, borderRadius: 16, boxShadow: "0 8px 24px rgba(0,0,0,0.12)", padding: "14px 16px", minWidth: 260 }}>
              {panelError && <div style={{ color: COLORS.applyBorder, fontWeight: 800, marginBottom: 8 }}>{panelError}</div>}

              {/* Aanvragen */}
              {totalDays > 0 && Object.keys(revokeSel).length === 0 && (
                <>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <div style={{ width: 8, height: 16, background: COLORS.primary, borderRadius: 4 }} />
                    <span style={{ fontWeight: 800, color: COLORS.text, fontSize: 14 }}>
                      {totalDays.toLocaleString("nl-BE", { maximumFractionDigits: 1 })} dag(en) geselecteerd
                    </span>
                  </div>
                  <div style={{ fontSize: 13, color: COLORS.textMuted, marginBottom: 8 }}>
                    Totaal: <strong>{fmtIntOrHalf(totalHoursSelected)} u</strong>
                  </div>

                  {showEntitlements && (
                    <div style={{ marginBottom: 8 }}>
                      <div style={{ fontSize: 13, color: COLORS.textMuted, marginBottom: 6 }}>
                        Te verdelen: <strong>{fmtIntOrHalf(totalHoursSelected)} u</strong>
                      </div>
                      {([
                        ["wettelijk", "Wettelijk"] as const,
                        ["overuren", "Overuren"] as const,
                        ["adv", "ADV"] as const,
                        ["andere", "Andere"] as const,
                      ]).map(([key, label]) => {
                        type KK = keyof typeof alloc;
                        const k = key as KK;
                        const disableDec = !(alloc[k] >= 0.5 - 1e-9);
                        const disableInc = !(remainingHours >= 0.5 - 1e-9);
                        return (
                          <div key={key} style={{ padding: "6px 0" }}>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr auto", alignItems: "center", gap: 8 }}>
                              <span style={{ fontSize: 14, color: COLORS.text }}>{label}</span>
                              <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                                <button onClick={() => !disableDec && dec(k)} disabled={disableDec} style={ctrlBtnStyle(disableDec)} aria-label={`Verlaag ${label} met 0,5u`} onMouseOver={(e) => { if (!disableDec) e.currentTarget.style.background = COLORS.btnHover; }} onMouseOut={(e) => { if (!disableDec) e.currentTarget.style.background = COLORS.btnBg; }}>
                                  ‹
                                </button>
                                <div style={{ minWidth: 64, textAlign: "center", fontVariantNumeric: "tabular-nums", padding: "6px 10px", border: `1px solid ${COLORS.line}`, borderRadius: 10, background: COLORS.card, fontWeight: 800 }} aria-label={`${label} aantal uren`}>
                                  {fmtIntOrHalf(alloc[k])} u
                                </div>
                                <button onClick={() => !disableInc && inc(k)} disabled={disableInc} style={ctrlBtnStyle(disableInc)} aria-label={`Verhoog ${label} met 0,5u`} onMouseOver={(e) => { if (!disableInc) e.currentTarget.style.background = COLORS.btnHover; }} onMouseOut={(e) => { if (!disableInc) e.currentTarget.style.background = COLORS.btnBg; }}>
                                  ›
                                </button>
                              </div>
                            </div>
                            <div style={{ fontSize: 12, color: COLORS.textMuted, marginTop: 4 }}>
                              Huidige saldo: {fmtIntOrHalf((balancesHrs as any)[key] as number)} u
                            </div>
                          </div>
                        );
                      })}
                      <div style={{ marginTop: 6, fontSize: 12 }}>
                        {remainingHours === 0 ? (
                          <span style={{ color: COLORS.primary, fontWeight: 800 }}>✔ Alles is netjes verdeeld (in uren).</span>
                        ) : (
                          <span style={{ color: COLORS.applyBorder, fontWeight: 800 }}>
                            Nog {fmtIntOrHalf(remainingHours)} u te verdelen.
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Intrekken */}
              {Object.keys(revokeSel).length > 0 && totalDays === 0 && (
                <>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <div style={{ width: 8, height: 16, background: COLORS.applyBorder, borderRadius: 4 }} />
                    <span style={{ fontWeight: 800, color: COLORS.text, fontSize: 14 }}>
                      {Object.keys(revokeSel).length} dag(en) geselecteerd om in te trekken
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: COLORS.textMuted }}>
                    Klik nogmaals op een dag om die uit de selectie te halen.
                  </div>
                </>
              )}
            </div>

            {/* Actieknoppen */}
            {totalDays > 0 && Object.keys(revokeSel).length === 0 && (
              <button
                onClick={async () => {
                  if (!showEntitlements) { setShowEntitlements(true); return; }
                  await onPrimaryButton();
                }}
                disabled={saving || (showEntitlements && remainingHours !== 0)}
                className={titleFont.className}
                style={{ height: BUTTON_H, padding: "0 16px", background: saving || (showEntitlements && remainingHours !== 0) ? "#94d6d7" : COLORS.primary, color: "#fff", border: "none", borderRadius: 999, cursor: saving || (showEntitlements && remainingHours !== 0) ? "not-allowed" : "pointer", fontWeight: 900, fontSize: 14, letterSpacing: 0.2, minWidth: 180, alignSelf: "flex-end", display: "inline-flex", alignItems: "center", justifyContent: "center", transition: "background 120ms ease" }}
                title={showEntitlements && remainingHours !== 0 ? "Verdeel eerst al je uren" : undefined}
              >
                {saving ? "Bezig…" : (showEntitlements ? "Aanvraag doorsturen" : "Verlof aanvragen")}
              </button>
            )}

            {Object.keys(revokeSel).length > 0 && totalDays === 0 && (
              <button
                onClick={onConfirmRevoke}
                disabled={saving}
                className={titleFont.className}
                style={{ height: BUTTON_H, padding: "0 16px", background: saving ? "#f2bcbc" : COLORS.applyBorder, color: "#fff", border: "none", borderRadius: 999, cursor: saving ? "not-allowed" : "pointer", fontWeight: 900, fontSize: 14, letterSpacing: 0.2, minWidth: 180, alignSelf: "flex-end", display: "inline-flex", alignItems: "center", justifyContent: "center", transition: "background 120ms ease" }}
                title="Geselecteerde verlofdagen intrekken"
              >
                {saving ? "Bezig…" : "Verlof intrekken"}
              </button>
            )}
          </div>
        )}

        {/* Tooltip met avatar */}
        {tooltip && (
          <div style={{ position: "fixed", left: tooltip.x, top: tooltip.y, zIndex: 9999, background: "#ffffff", border: `1px solid ${COLORS.line}`, borderRadius: 8, boxShadow: "0 8px 24px rgba(0,0,0,0.12)", padding: 10, minWidth: 240, pointerEvents: "none" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {tooltip.items.map((it, idx) => {
                if (it.kind === "birthday") {
                  return (
                    <div key={`b-${idx}`} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <Cake size={16} strokeWidth={1.5} />
                      <div style={{ fontSize: 13, color: COLORS.text }}>
                        <strong>Verjaardag:</strong> {personName}
                      </div>
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
                  } else if (it.subtype === "islam") {
                    label = "Islamitische feestdag";
                    iconEl = <MoonStar size={16} strokeWidth={1.5} />;
                  }
                  return (
                    <div key={`h-${idx}`} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {iconEl}
                      <div style={{ fontSize: 13, color: COLORS.text }}>
                        <strong>{label}:</strong> {it.name ?? "—"}
                      </div>
                    </div>
                  );
                }
                return (
                  <div key={`l-${idx}`} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {it.avatar ? (
                      <img src={it.avatar} alt="avatar" style={{ width: 18, height: 18, borderRadius: 4, objectFit: "cover", border: `1px solid ${COLORS.line}` }} />
                    ) : (
                      <div style={{ width: 10, height: 10, borderRadius: 999, background: LEAVE_COLOR, border: `1px solid ${COLORS.line}` }} />
                    )}
                    <div style={{ fontSize: 13, color: COLORS.text }}>
                      <strong>Verlof:</strong> {it.label}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div style={{ height: 240 }} aria-hidden />
      </main>
    </>
  );
}

/* force dynamic */
export const dynamic = "force-dynamic";
