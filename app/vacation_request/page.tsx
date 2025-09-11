"use client";

import React, { useEffect, useMemo, useState, Suspense } from "react";
import localFont from "next/font/local";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import FloatingNav from "../components/FloatingNav";
import LegendNavVacationRequest from "../components/LegendNav_Vacation_Request";

/* ===== Basis UI ===== */
const FLOATING_NAV_OFFSET = 5;
const BUTTON_H = 42; // vaste hoogte voor knop én gesloten label

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
const MONTHS_NL = [
  "januari","februari","maart","april","mei","juni","juli","augustus","september","oktober","november","december",
];
const DOW_NL = ["ma","di","wo","do","vr","za","zo"];

/* ===== Constants voor saldo ===== */
const HOURS_PER_FULL_DAY = 8;
const HOURS_PER_HALF_DAY = 4;
const SALDO_TO_DAYS_DIVISOR = 4;
const SALDO_STATUSES = ["requested", "approved"] as const;

/* ===== Icons ===== */
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

/* ===== Helpers ===== */
function daysInMonth(y: number, m0: number) { return new Date(y, m0 + 1, 0).getDate(); }
function buildMonthMatrix(y: number, m0: number) {
  const total = daysInMonth(y, m0);
  const firstIdx = (new Date(y, m0, 1).getDay() + 6) % 7; // maandag = 0
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

/* ===== Selectiestatus ===== */
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

/* ===== Dagcel ===== */
type HoverMode = "interactive" | "x-only" | "none";

function DayCell({
  day, bg, label, hoverMode, state, onCycle, existing, isBirthday, birthdateConflict,
}: {
  day: number | null;
  bg: string;
  label?: string;
  hoverMode: HoverMode;
  state: SelState;
  onCycle?: () => void;
  existing?: { am?: PartStatus; pm?: PartStatus };
  isBirthday?: boolean;
  birthdateConflict?: boolean;
}) {
  const [hover, setHover] = useState(false);
  const interactive = hoverMode === "interactive";
  const showHover = !!day && hoverMode !== "none";

  const baseBg = isBirthday ? COLORS.birthdateBg : bg;
  const hoverBg = interactive && hover && state === "none" && !existing ? COLORS.dayHoverBg : baseBg;

  function overlayHalf(which: "am" | "pm", status: PartStatus) {
    const st: React.CSSProperties = {
      position: "absolute",
      left: 0,
      right: 0,
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
  const hasExisting = !!(existing?.am || existing?.pm);

  let borderColor = COLORS.line;
  let borderWidth = 1;
  if (hasNew) { borderColor = COLORS.applyBorder; borderWidth = 2; }
  else if (hasExisting) { borderColor = COLORS.line; borderWidth = 1; }

  return (
    <div
      title={label}
      aria-label={label}
      onMouseEnter={() => showHover && setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={() => { if (interactive && day && onCycle) onCycle(); }}
      role={interactive ? "button" : undefined}
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
        transition: "background 120ms ease, border-color 120ms ease",
        cursor: interactive ? "pointer" : "default",
        overflow: "hidden",
      }}
    >
      {bothReq && (
        <div style={{
          position: "absolute", inset: 0, borderRadius: 8, pointerEvents: "none",
          background: `repeating-linear-gradient(45deg, ${LEAVE_COLOR} 0, ${LEAVE_COLOR} 8px, #ffffff 8px, #ffffff 16px)`,
        }} />
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

      {state === "full" && !existing && (
        <div style={{ position: "absolute", inset: 0, background: COLORS.daySelectedBg, borderRadius: 8, pointerEvents: "none" }} />
      )}
      {state === "am" && !(existing && existing.am) && (
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "50%", background: COLORS.daySelectedBg, borderTopLeftRadius: 8, borderTopRightRadius: 8, pointerEvents: "none" }} />
      )}
      {state === "pm" && !(existing && existing.pm) && (
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "50%", background: COLORS.daySelectedBg, borderBottomLeftRadius: 8, borderBottomRightRadius: 8, pointerEvents: "none" }} />
      )}

      <span style={{ position: "relative", zIndex: 3 }}>{day ?? ""}</span>

      {isBirthday && birthdateConflict && (
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 2,
            borderRadius: 6,
            border: `2px solid ${COLORS.birthdateBorder}`,
            pointerEvents: "none",
            zIndex: 3,
          }}
        />
      )}

      {showHover && interactive && (
        <button
          aria-hidden={!hover}
          tabIndex={-1}
          style={{
            position: "absolute",
            top: "50%", left: "50%", transform: "translate(-50%, -50%)",
            width: 28, height: 28, borderRadius: 999,
            border: `1px solid ${COLORS.primary}`,
            background: COLORS.btnBg,
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 1px 2px rgba(0,0,0,0.08)",
            opacity: hover ? 1 : 0,
            pointerEvents: hover ? "auto" : "none",
            transition: "opacity 120ms ease, background 120ms ease",
            cursor: "pointer",
            fontSize: 12, fontWeight: 800, color: COLORS.primary,
            zIndex: 4,
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = COLORS.btnHover)}
          onMouseLeave={(e) => (e.currentTarget.style.background = COLORS.btnBg)}
          onClick={(e) => { e.stopPropagation(); onCycle?.(); }}
        >
          {nextBadge(state)}
        </button>
      )}
    </div>
  );
}

/* ===== Maand ===== */
function MonthCalendar({
  year, month0, holidayTypes, selections, onCycleDate, existingByDate,
  birthdateDD, birthdateMM, todayYMD,
}: {
  year: number;
  month0: number;
  holidayTypes: Record<string, "school" | "public">;
  selections: Record<string, SelState>;
  onCycleDate: (key: string) => void;
  existingByDate: ExistingByDate;
  birthdateDD: string | null;
  birthdateMM: string | null;
  todayYMD: string;
}) {
  const weeks = buildMonthMatrix(year, month0);
  const monthName = MONTHS_NL[month0];

  return (
    <div style={{
      background: COLORS.card, border: `1px solid ${COLORS.line}`, borderRadius: 12, padding: 12,
      display: "flex", flexDirection: "column", gap: 8, minWidth: 260,
    }}>
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
              const isWeekend = di === 5 || di === 6;
              if (!day) return <DayCell key={di} day={null} bg={"#fff"} hoverMode={"none"} state={"none"} />;

              const key = ymd(year, month0, day);
              const isPast = key < todayYMD;

              const isBirthday =
                !!birthdateDD && !!birthdateMM &&
                pad2(day) === birthdateDD && pad2(month0 + 1) === birthdateMM;

              const holidayType = holidayTypes[key];
              const hasExisting = !!(existingByDate[key]?.am || existingByDate[key]?.pm);

              let baseBg = "#fff";
              if (isBirthday) baseBg = COLORS.birthdateBg;
              else if (holidayType === "school") baseBg = COLORS.schoolBg;
              else if (holidayType === "public") baseBg = COLORS.publicBg;
              else if (isWeekend) baseBg = COLORS.weekendBg;

              let hoverMode: HoverMode = "interactive";
              if (isPast) hoverMode = "none";
              else if (holidayType === "public" || isWeekend) hoverMode = "none";
              else if (hasExisting) hoverMode = "x-only";

              const state: SelState = selections[key] ?? "none";
              let label: string | undefined;
              if (holidayType === "school") label = "Schoolvakantie";
              if (holidayType === "public") label = "Officiële feestdag";
              if (isBirthday) label = label ? `Verjaardag 🎂 • ${label}` : "Verjaardag 🎂";

              const ex = existingByDate[key];
              if (ex?.am || ex?.pm) {
                const amTxt = ex?.am === "approved" ? "goedgekeurd" : ex?.am === "requested" ? "aangevraagd" : undefined;
                const pmTxt = ex?.pm === "approved" ? "goedgekeurd" : ex?.pm === "requested" ? "aangevraagd" : undefined;
                if (amTxt && pmTxt) label = (label ? label + " • " : "") + `VM ${amTxt}, NM ${pmTxt}`;
                else if (amTxt)     label = (label ? label + " • " : "") + `VM ${amTxt}`;
                else if (pmTxt)     label = (label ? label + " • " : "") + `NM ${pmTxt}`;
              }

              const birthdateConflict = isBirthday && ((holidayType === "school" || holidayType === "public" || isWeekend) || hasExisting);

              return (
                <DayCell
                  key={di}
                  day={day}
                  bg={baseBg}
                  label={label}
                  hoverMode={hoverMode}
                  state={state}
                  existing={ex}
                  onCycle={() => onCycleDate(key)}
                  isBirthday={isBirthday}
                  birthdateConflict={birthdateConflict}
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
function VacationRequestContent() {
  const search = useSearchParams();
  const personnelId = search.get("personnel_id");

  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [personName, setPersonName] = useState<string>("…");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [holidayTypes, setHolidayTypes] = useState<Record<string, "school" | "public">>({});
  const [existingByDate, setExistingByDate] = useState<ExistingByDate>({});
  const [selections, setSelections] = useState<Record<string, SelState>>({});

  // Verjaardag
  const [birthDM, setBirthDM] = useState<{ d: string | null; m: string | null }>({ d: null, m: null });

  // Entitlements UI open?
  const [showEntitlements, setShowEntitlements] = useState(false);

  // Verdeling (in "dagen" stapjes van 0.5)
  type Alloc = { wettelijk: number; overuren: number; adv: number; andere: number; };
  const [alloc, setAlloc] = useState<Alloc>({ wettelijk: 0, overuren: 0, adv: 0, andere: 0 });

  // Saldi per categorie — in "dagen" (na /4), mag negatief
  const [balances, setBalances] = useState<Alloc>({ wettelijk: 0, overuren: 0, adv: 0, andere: 0 });

  // Loader voor opslaan
  const [saving, setSaving] = useState(false);

  // Vandaag (YYYY-MM-DD)
  const todayYMD = useMemo(() => {
    const t = new Date();
    return ymd(t.getFullYear(), t.getMonth(), t.getDate());
  }, []);

  // Formatter (EU): enkel decimaal als nodig, met komma
  const fmt1 = useMemo(
    () => new Intl.NumberFormat("nl-BE", { minimumFractionDigits: 0, maximumFractionDigits: 1 }),
    []
  );

  // Persoon
  useEffect(() => {
    let active = true;
    async function loadPerson() {
      if (!personnelId) { setPersonName("Onbekend"); setAvatarUrl(null); setBirthDM({ d: null, m: null }); return; }
      const { data, error } = await supabase
        .from("personnel")
        .select("name, avatar_url, birthdate")
        .eq("id", personnelId)
        .single();
      if (!active) return;
      if (error || !data) {
        setPersonName("Onbekend"); setAvatarUrl(null); setBirthDM({ d: null, m: null });
      } else {
        setPersonName(data.name || "Onbekend");
        setAvatarUrl(data.avatar_url || null);
        const b = (data as any).birthdate as string | null;
        if (b && /^\d{8}$/.test(b)) setBirthDM({ d: b.slice(0,2), m: b.slice(2,4) });
        else setBirthDM({ d: null, m: null });
      }
    }
    loadPerson();
    return () => { active = false; };
  }, [personnelId]);

  // Feestdagen
  useEffect(() => {
    let mounted = true;
    async function load() {
      const from = `${year}-01-01`;
      const to = `${year + 1}-01-01`;
      const { data, error } = await supabase
        .from("holidays")
        .select("holiday_date,type")
        .gte("holiday_date", from)
        .lt("holiday_date", to);
      if (error || !data) { if (mounted) setHolidayTypes({}); return; }
      const map: Record<string, "school" | "public"> = {};
      for (const r of data as any[]) if (r.type === "school" || r.type === "public") map[r.holiday_date as string] = r.type;
      if (mounted) setHolidayTypes(map);
    }
    load();
    return () => { mounted = false; };
  }, [year]);

  // Bestaande leaves (alleen tonen)
  useEffect(() => {
    let mounted = true;
    async function load() {
      if (!personnelId) { setExistingByDate({}); return; }
      const from = `${year}-01-01`;
      const to = `${year + 1}-01-01`;
      const { data, error } = await supabase
        .from("leave_requests")
        .select("leave_date,status,daypart")
        .eq("personnel_id", personnelId)
        .gte("leave_date", from)
        .lt("leave_date", to)
        .in("status", ["requested", "approved"]);
      if (error || !data) { if (mounted) setExistingByDate({}); return; }

      const map: ExistingByDate = {};
      const prefer = (prev: PartStatus, cur: PartStatus): PartStatus => (prev === "approved" || cur === "approved") ? "approved" : (prev || cur);

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

  // Saldo per categorie = entitlements.total_hours - som leave_requests (dagdelen), daarna /4 => dagen (mag < 0)
  useEffect(() => {
    let active = true;
    async function loadBalances() {
      if (!personnelId) { setBalances({ wettelijk: 0, overuren: 0, adv: 0, andere: 0 }); return; }

      const from = `${year}-01-01`;
      const to = `${year + 1}-01-01`;

      // 1) Totale rechten (in uren) per categorie
      const { data: entData, error: entErr } = await supabase
        .from("leave_entitlements")
        .select("reason,total_hours,year")
        .eq("personnel_id", personnelId)
        .eq("year", year);

      // 2) Gebruikte uren via leave_requests (requested + approved) dit jaar
      const { data: reqData } = await supabase
        .from("leave_requests")
        .select("leave_date,daypart,status")
        .eq("personnel_id", personnelId)
        .gte("leave_date", from)
        .lt("leave_date", to)
        .in("status", SALDO_STATUSES as unknown as string[]);

      if (!active) return;

      if (entErr || !entData) { setBalances({ wettelijk: 0, overuren: 0, adv: 0, andere: 0 }); return; }

      // Som rechten per categorie (uren)
      const totalsByReason = { wettelijk: 0, overuren: 0, adv: 0, andere: 0 } as Alloc;
      for (const r of entData as any[]) {
        const key = (String(r.reason || "").toLowerCase() as keyof Alloc) || "andere";
        const hrs = Number(r.total_hours || 0);
        if (key in totalsByReason) totalsByReason[key] += hrs;
        else totalsByReason.andere += hrs;
      }

      // Som verbruikte uren over alle aanvragen (hele dag=8, VM/NM=4)
      let usedHours = 0;
      for (const rr of (reqData ?? []) as any[]) {
        const dp = String(rr.daypart || "hele dag").toLowerCase();
        if (dp === "hele dag") usedHours += HOURS_PER_FULL_DAY;
        else usedHours += HOURS_PER_HALF_DAY; // "voormiddag" of "namiddag"
      }

      // Saldo per categorie (uren) -> dagen door /4  (geen clamp, mag negatief)
      const toDays = (hrs: number) => Number(((hrs - usedHours) / SALDO_TO_DAYS_DIVISOR).toFixed(2));
      setBalances({
        wettelijk: toDays(totalsByReason.wettelijk),
        overuren: toDays(totalsByReason.overuren),
        adv:      toDays(totalsByReason.adv),
        andere:   toDays(totalsByReason.andere),
      });
    }
    loadBalances();
    return () => { active = false; };
  }, [personnelId, year]);

  /* ===== Klik op een dag in de kalender (FIX) ===== */
  const onCycleDate = (key: string) => {
    if (key < todayYMD) return;
    if (existingByDate[key]?.am || existingByDate[key]?.pm) return;
    setSelections(prev => {
      const cur = (prev[key] ?? "none") as SelState;
      const nx = nextState(cur);
      const next = { ...prev };
      if (nx === "none") delete next[key];
      else next[key] = nx;
      return next;
    });
  };

  // Totaal dagen uit de selectie (full = 1, VM/NM = 0.5)
  const totalDays = useMemo(
    () => Object.values(selections).reduce((s, st) => s + (st === "full" ? 1 : 0.5), 0),
    [selections]
  );
  const totalLabel = useMemo(
    () => new Intl.NumberFormat("nl-BE", { minimumFractionDigits: 0, maximumFractionDigits: 1 }).format(totalDays),
    [totalDays]
  );

  // ===== Suggestie: verdeel totalDays -> wettelijk -> overuren -> adv -> andere =====
  const snap05 = (x: number) => Math.floor(x * 2 + 1e-6) / 2; // naar beneden in 0,5
  function suggestAllocation(total: number, bal: Alloc): Alloc {
    let rem = snap05(total);
    const cap = {
      wettelijk: Math.max(0, snap05(bal.wettelijk)),
      overuren:  Math.max(0, snap05(bal.overuren)),
      adv:       Math.max(0, snap05(bal.adv)),
      andere:    Math.max(0, snap05(bal.andere)),
    };
    const out: Alloc = { wettelijk: 0, overuren: 0, adv: 0, andere: 0 };

    const take = (k: keyof Alloc) => {
      const t = Math.min(rem, cap[k]);
      out[k] = snap05(t);
      rem = Number((rem - out[k]).toFixed(2));
    };

    take("wettelijk");
    take("overuren");
    take("adv");
    if (rem > 0) { out.andere = snap05(rem); rem = 0; }
    return out;
  }

  // Verdeling — som en resterend te verdelen
  const sumAlloc = (a: Alloc) => a.wettelijk + a.overuren + a.adv + a.andere;
  const remaining = useMemo(() => {
    const r = Number((totalDays - sumAlloc(alloc)).toFixed(2));
    return r < 0 ? 0 : r;
  }, [totalDays, alloc]);

  // Als panel dicht is en totaal verandert: zet alles tijdelijk op wettelijk (compacte “start”)
  useEffect(() => {
    if (!showEntitlements) {
      setAlloc({ wettelijk: Number(totalDays.toFixed(2)), overuren: 0, adv: 0, andere: 0 });
    }
  }, [totalDays, showEntitlements]);

  // Alles weggeklikt? -> reset UI
  useEffect(() => {
    if (totalDays === 0) {
      setShowEntitlements(false);
      setAlloc({ wettelijk: 0, overuren: 0, adv: 0, andere: 0 });
    }
  }, [totalDays]);

  const step = 0.5;
  const canInc = remaining >= step;
  const canDec = (k: keyof Alloc) => (alloc[k] >= step);

  function inc(key: keyof Alloc) {
    if (!canInc) return;
    setAlloc(prev => ({ ...prev, [key]: Number((prev[key] + step).toFixed(2)) }));
  }
  function dec(key: keyof Alloc) {
    if (!canDec(key)) return;
    setAlloc(prev => ({ ...prev, [key]: Number((prev[key] - step).toFixed(2)) }));
  }

  // ===== Opslaan =====
  function daypartFromState(s: SelState) {
    return s === "full" ? "hele dag" : s === "am" ? "voormiddag" : "namiddag";
  }
  type K = keyof Alloc;
  const ORDER: K[] = ["wettelijk", "overuren", "adv", "andere"];

  async function onPrimaryButton() {
    if (!personnelId) return;

    if (!showEntitlements) {
      // eerste klik -> open en stel startverdeling voor op basis van saldo
      setAlloc(suggestAllocation(totalDays, balances));
      setShowEntitlements(true);
      return;
    }

    // tweede klik -> opslaan (alleen als verdeling klopt)
    if (remaining !== 0 || totalDays <= 0) return;

    // 1) Maak lijst entries (op datum oplopend)
    const entries = Object.entries(selections)
      .filter(([d]) => d >= todayYMD)
      .map(([d, st]) => ({
        leave_date: d,
        size: st === "full" ? 1 : 0.5,
        daypart: daypartFromState(st),
      }))
      .sort((a, b) => (a.leave_date < b.leave_date ? -1 : a.leave_date > b.leave_date ? 1 : 0));

    if (entries.length === 0) return;

    // 2) Verdeel entitlements over entries (eerst wettelijk, dan overuren, dan ADV, dan andere)
    const avail: Alloc = { ...alloc };
    let bucketIdx = 0;
    const rows = entries.map(e => {
      // zoek een pot waar minstens e.size in past; overslaan mag, negatief laten we toe als laatste redmiddel
      let idx = bucketIdx;
      while (idx < ORDER.length && (avail[ORDER[idx]] < e.size - 1e-9)) idx++;
      if (idx >= ORDER.length) idx = ORDER.length - 1; // geen plek? -> laatste pot gebruiken (mag < 0)
      bucketIdx = idx; // onthouden waar we zitten

      const entKey = ORDER[idx];
      avail[entKey] = Number((avail[entKey] - e.size).toFixed(2));

      return {
        leave_date: e.leave_date,
        status: "requested" as const,
        personnel_id: personnelId,
        daypart: e.daypart,
        entitlement: entKey, // <= belangrijk
      };
    });

    setSaving(true);
    try {
      let { error } = await supabase.from("leave_requests").insert(rows);
      if (error) {
        // fallback alternatieve tabelnaam
        const alt = await supabase.from("leave_request").insert(rows);
        if (alt.error) throw alt.error;
      }

      // UI reset & data verversen
      setSelections({});
      setShowEntitlements(false);
      setAlloc({ wettelijk: 0, overuren: 0, adv: 0, andere: 0 });

      // overlays herladen
      const from = `${year}-01-01`;
      const to = `${year + 1}-01-01`;
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
      alert("Opslaan mislukt. Kijk de console (F12) voor details.");
    } finally {
      setSaving(false);
    }
  }

  const prevYear = () => setYear(y => y - 1);
  const nextYear = () => setYear(y => y + 1);

  // Stijl helper voor grijze (disabled) pijltjes
  function ctrlBtnStyle(disabled: boolean): React.CSSProperties {
    return {
      width: 28,
      height: 28,
      borderRadius: 999,
      border: `1px solid ${disabled ? COLORS.line : COLORS.btnBorder}`,
      background: disabled ? COLORS.btnHover : COLORS.btnBg,
      color: disabled ? COLORS.textMuted : "inherit",
      cursor: disabled ? "default" : "pointer",
      fontWeight: 800,
      opacity: disabled ? 0.6 : 1,
    };
  }

  return (
    <>
      <FloatingNav />
      <LegendNavVacationRequest />
      <main
        style={{
          background: COLORS.bg,
          minHeight: "100vh",
          padding: 24,
          boxSizing: "border-box",
          marginTop: `${FLOATING_NAV_OFFSET}px`,
        }}
      >
        {/* Header */}
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
            onClick={prevYear}
            aria-label="Ga naar vorig jaar"
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
              transition: "background 120ms ease",
            }}
            onMouseOver={(e) => (e.currentTarget.style.background = COLORS.btnHover)}
            onMouseOut={(e) => (e.currentTarget.style.background = COLORS.btnBg)}
          >
            <IconChevronLeft />
            <span>{year - 1}</span>
          </button>

          <h1
            className={titleFont.className}
            style={{
              margin: 0,
              color: COLORS.text,
              fontSize: 28,
              fontWeight: 900,
              letterSpacing: 0.2,
              display: "inline-flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <span>Persoonlijke kalender van</span>
            <span>{personName}</span>
            {avatarUrl && (
              <img src={avatarUrl} alt={personName} style={{ height: "1em", width: "1em", borderRadius: "50%" }} />
            )}
          </h1>

          <button
            onClick={nextYear}
            aria-label="Ga naar volgend jaar"
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
              transition: "background 120ms ease",
            }}
            onMouseOver={(e) => (e.currentTarget.style.background = COLORS.btnHover)}
            onMouseOut={(e) => (e.currentTarget.style.background = COLORS.btnBg)}
          >
            <span>{year + 1}</span>
            <IconChevronRight />
          </button>
        </header>

        {/* 12 maanden */}
        <section style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(240px, 1fr))", gap: 16 }}>
          {Array.from({ length: 12 }).map((_, m) => (
            <MonthCalendar
              key={m}
              year={year}
              month0={m}
              holidayTypes={holidayTypes}
              selections={selections}
              onCycleDate={onCycleDate}
              existingByDate={existingByDate}
              birthdateDD={birthDM.d}
              birthdateMM={birthDM.m}
              todayYMD={todayYMD}
            />
          ))}
        </section>

        {/* ===== Rechts onderaan: label + vaste knop ===== */}
        {totalDays > 0 && (
          <div
            style={{
              position: "fixed",
              right: 24,
              bottom: 24,
              display: "inline-flex",
              alignItems: "flex-end", // knop blijft onderaan
              gap: 12,
              zIndex: 9999,
            }}
          >
            {/* LABEL — gesloten even hoog als knop, open groeit naar links/omhoog */}
            <div
              className={titleFont.className}
              style={{
                background: "#fff",
                border: `1px solid ${COLORS.line}`,
                borderRadius: 16,
                boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
                height: showEntitlements ? ("auto" as const) : BUTTON_H,
                padding: showEntitlements ? "14px 16px" : "0 16px",
                minWidth: 180,
                maxWidth: showEntitlements ? 420 : 280,
                transition: "max-width 200ms ease, padding 200ms ease, height 150ms ease",
                overflow: "hidden",
                order: 0, // links van de knop
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
              }}
            >
              {/* Kop (altijd zichtbaar) — zelfde hoogte als knop wanneer gesloten */}
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                minHeight: BUTTON_H,
              }}>
                <div style={{ width: 8, height: 16, background: COLORS.primary, borderRadius: 4 }} />
                <span style={{ fontWeight: 800, color: COLORS.text, fontSize: 14 }}>
                  {totalLabel} dag{totalDays === 1 ? "" : "en"} geselecteerd
                </span>
              </div>

              {/* Verdelen + saldo (in dagen) */}
              <div
                style={{
                  height: showEntitlements ? "auto" : 0,
                  opacity: showEntitlements ? 1 : 0,
                  marginTop: showEntitlements ? 8 : 0,
                  transition: "opacity 200ms ease, height 200ms ease, margin-top 200ms ease",
                }}
                aria-hidden={!showEntitlements}
              >
                {[
                  ["wettelijk", "Wettelijk"] as const,
                  ["overuren", "Overuren"] as const,
                  ["adv", "ADV"] as const,
                  ["andere", "Andere"] as const,
                ].map(([key, label]) => {
                  type KK = keyof Alloc;
                  const k = key as KK;
                  const disableDec = !(alloc[k] >= 0.5);
                  const disableInc = !(remaining >= 0.5);
                  return (
                    <div key={key} style={{ padding: "6px 0" }}>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 14, color: COLORS.text }}>{label}</span>
                        <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                          <button
                            onClick={() => !disableDec && dec(k)}
                            disabled={disableDec}
                            style={ctrlBtnStyle(disableDec)}
                            aria-label={`Verlaag ${label} met 0,5`}
                            onMouseOver={(e) => { if (!disableDec) e.currentTarget.style.background = COLORS.btnHover; }}
                            onMouseOut={(e) => { if (!disableDec) e.currentTarget.style.background = COLORS.btnBg; }}
                          >
                            ‹
                          </button>
                          <div
                            style={{
                              minWidth: 54,
                              textAlign: "center",
                              fontVariantNumeric: "tabular-nums",
                              padding: "6px 10px",
                              border: `1px solid ${COLORS.line}`,
                              borderRadius: 10,
                              background: COLORS.card,
                              fontWeight: 800,
                            }}
                            aria-label={`${label} aantal`}
                          >
                            {fmt1.format((alloc as any)[key] as number)}
                          </div>
                          <button
                            onClick={() => !disableInc && inc(k)}
                            disabled={disableInc}
                            style={ctrlBtnStyle(disableInc)}
                            aria-label={`Verhoog ${label} met 0,5`}
                            onMouseOver={(e) => { if (!disableInc) e.currentTarget.style.background = COLORS.btnHover; }}
                            onMouseOut={(e) => { if (!disableInc) e.currentTarget.style.background = COLORS.btnBg; }}
                          >
                            ›
                          </button>
                        </div>
                      </div>

                      {/* Saldo (in dagen, EU-notatie, mag negatief) */}
                      <div style={{ gridColumn: "1 / -1", fontSize: 12, color: COLORS.textMuted, marginTop: 4 }}>
                        Huidige saldo: {fmt1.format((balances as any)[key] as number)} dag
                      </div>
                    </div>
                  );
                })}

                {/* Rest te verdelen / OK */}
                <div style={{ marginTop: 6, fontSize: 12 }}>
                  {remaining === 0 ? (
                    <span style={{ color: COLORS.primary, fontWeight: 800 }}>✔ Alles is netjes verdeeld.</span>
                  ) : (
                    <span style={{ color: COLORS.applyBorder, fontWeight: 800 }}>
                      Nog {fmt1.format(remaining)} te verdelen.
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* KNOP (blijft vast rechts onderaan; vaste hoogte) */}
            <button
              onClick={onPrimaryButton}
              disabled={saving || totalDays <= 0 || (showEntitlements && remaining !== 0)}
              className={titleFont.className}
              style={{
                height: BUTTON_H,
                padding: "0 16px",
                background: saving || totalDays <= 0 || (showEntitlements && remaining !== 0) ? "#94d6d7" : COLORS.primary,
                color: "#fff",
                border: "none",
                borderRadius: 999,
                cursor: saving || totalDays <= 0 || (showEntitlements && remaining !== 0) ? "not-allowed" : "pointer",
                fontWeight: 900,
                fontSize: 14,
                letterSpacing: 0.2,
                minWidth: 180,
                alignSelf: "flex-end",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "background 120ms ease",
                order: 1,
              }}
              title={showEntitlements && remaining !== 0 ? "Verdeel eerst al je dagen" : undefined}
            >
              {saving ? "Bezig…" : (showEntitlements ? "Aanvraag doorsturen" : "Verlof aanvragen")}
            </button>
          </div>
        )}
        <div style={{ minHeight: "50px" }}>
</div>
      </main>
    </>
  );
}

/* ===== Suspense wrapper ===== */
export default function Page() {
  return (
    <Suspense fallback={<div style={{ padding: 12 }}>Laden…</div>}>
      <VacationRequestContent />
    </Suspense>
  );
}

export const dynamic = "force-dynamic";
