"use client";

import React, { useEffect, useMemo, useState, Suspense } from "react";
import localFont from "next/font/local";
import { supabase } from "@/lib/supabaseClient";
import FloatingNav from "../components/FloatingNav";

/* ========= Eenvoudige instellingen ========= */
const FLOATING_NAV_OFFSET = 70;

/* Kleuren */
const COLORS = {
  bg: "#ffffff",
  card: "#f7f9fb",
  line: "#e5e7eb",
  text: "#0f172a",       // zwart/donker
  textMuted: "#475569",
  primary: "#0ea5a8",
  btnBg: "#0ea5a8",
  btnHover: "#0c8e91",
  btnText: "#ffffff",
  btnBorder: "#0ea5a8",
};
const HEADER_BTN = { bg: "#ffffff", border: "#d1d5db", hover: "#f3f4f6" };

/* Jaarbalk-kleur (balk = #D2EDF2, jaartal = zwart) */
const YEARBAR = "#D2EDF2";

/* === Per persoon: kolombreedtes zelf instellen === */
const COLS_PERSON = {
  spacer: "5px",
  date: "100px",
  daypart: "130px",
  entitlement: "130px",
  actions: "20px",
};
const GRID_PERSON = `${COLS_PERSON.spacer} ${COLS_PERSON.date} ${COLS_PERSON.daypart} ${COLS_PERSON.entitlement} ${COLS_PERSON.actions}`;

/* Vaste breedte voor de dropdown in 'Per persoon' */
const PERSON_SELECT_WIDTH = 140; // px

/* ========= Fonts ========= */
const variableFont = localFont({ src: "../fonts/Font_Variable.otf", display: "swap" });
const titleFont = localFont({ src: "../fonts/Font_VariableBold.otf", display: "swap" });

/* ===== Icons ===== */
function IconChevronLeft({ color = COLORS.primary, size = 20 }: { color?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="15 6 9 12 15 18" />
    </svg>
  );
}
function IconChevronRight({ color = COLORS.primary, size = 20 }: { color?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="9 6 15 12 9 18" />
    </svg>
  );
}
function IconPencil({ color = COLORS.primary, size = 18 }: { color?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
    </svg>
  );
}

/* ========= Types ========= */
type Personnel = {
  id: string;
  name: string;
  avatar_url?: string | null;
  holiday_teller?: number | null;
};
type PersonRef = { id: string; name: string };

type LeaveRequest = {
  id: string;
  personnel_id: string | null;
  leave_date: string;  // YYYY-MM-DD
  status: string;      // lowercase
  daypart: string | null;     // "hele dag"|"voormiddag"|"namiddag" (lowercase)
  entitlement: string | null; // reason (lowercase)
  personnel?: Personnel | null;
};

type RawJoinedRow = {
  id: string;
  personnel_id?: string | null;
  leave_date: string;
  status: string;
  daypart?: string | null;
  entitlement?: string | null;
  personnel?: any;
};

type YearDetailRow = { reason: string; start: number; used: number; saldo: number };
type YearTotals = { start: number; used: number; saldo: number };

/* ========= Helpers ========= */
const DOW_SHORT = ["zo", "ma", "di", "wo", "do", "vr", "za"] as const;
const MON_SHORT = ["jan", "feb", "mrt", "apr", "mei", "jun", "jul", "aug", "sep", "okt", "nov", "dec"] as const;

function formatDateShort(iso: string) {
  const d = new Date(iso + "T00:00:00");
  const wd = DOW_SHORT[d.getDay()];
  const day = d.getDate();
  const mon = MON_SHORT[d.getMonth()];
  return `${wd} ${day} ${mon}`;
}

/* Tonen met 1 hoofdletter (opslaan blijft lowercase) */
function firstCap(s: string | null | undefined) {
  if (!s) return "—";
  const v = String(s).trim().toLowerCase();
  return v ? v.charAt(0).toUpperCase() + v.slice(1) : "—";
}

/* Daypart canoniek (lowercase) */
function canonicalDaypart(dp: string | null): "hele dag" | "voormiddag" | "namiddag" {
  const v = String(dp || "").toLowerCase();
  if (v.includes("voor") || v.includes("morning")) return "voormiddag";
  if (v.includes("na") || v.includes("afternoon")) return "namiddag";
  return "hele dag";
}

/* Uren per dagdeel */
function hoursForDaypart(dp: string | null | undefined) {
  const v = String(dp || "").toLowerCase();
  if (v.includes("voor") || v.includes("morning")) return 4;
  if (v.includes("na") || v.includes("afternoon")) return 4;
  if (v.includes("hele")) return 8;
  return 8;
}

/* Badge-tekst voor saldo (basis font) */
function tellerSaldoLabel(hours?: number | null) {
  const h = Number.isFinite(hours as number) ? (hours as number) : 0;
  return `Teller saldo: ${h} uren`;
}

/* Normaliseren van join-resultaat */
function normalizePersonnel(p: any): Personnel | null {
  if (!p) return null;
  const obj = Array.isArray(p) ? p[0] : p;
  if (!obj) return null;
  return { id: obj.id, name: obj.name, holiday_teller: obj.holiday_teller ?? null, avatar_url: obj.avatar_url ?? null };
}
function normalizeRequests(rows: RawJoinedRow[]): LeaveRequest[] {
  return (rows || []).map((r) => ({
    id: r.id,
    personnel_id: r.personnel_id ?? null,
    leave_date: r.leave_date,
    status: String(r.status || "").toLowerCase(),
    daypart: r.daypart ? String(r.daypart).toLowerCase() : null,
    entitlement: r.entitlement ? String(r.entitlement).toLowerCase() : null,
    personnel: normalizePersonnel(r.personnel),
  }));
}

/* ========= Hoofdcomponent ========= */
type SaldoScope = "left" | "right";

function ApprovalContent() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /* Links: openstaande aanvragen */
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [conflicts, setConflicts] = useState<Record<string, { approved: PersonRef[]; requested: PersonRef[] }>>({});

  /* Dropdowns (alleen actief als checkbox aan staat) */
  const [entitlementOptions, setEntitlementOptions] = useState<string[]>([]);
  const [editedEntitlements, setEditedEntitlements] = useState<Record<string, string | null>>({});
  const [editedDayparts, setEditedDayparts] = useState<Record<string, "hele dag" | "voormiddag" | "namiddag">>({});

  /* Rechts: per persoon (alleen weergave + hover-potlood) */
  const [people, setPeople] = useState<Personnel[]>([]);
  const [selectedPersonId, setSelectedPersonId] = useState<string>("");
  const [personYear, setPersonYear] = useState<number>(new Date().getFullYear());
  const [personRequests, setPersonRequests] = useState<LeaveRequest[]>([]);
  const [hoverRowId, setHoverRowId] = useState<string | null>(null);

  /* Aggregaties per (persoon, jaar) */
  const [yearSaldo, setYearSaldo] = useState<Record<string, number>>({});
  const [yearDetails, setYearDetails] = useState<Record<string, YearDetailRow[]>>({});
  const [yearTotals, setYearTotals] = useState<Record<string, YearTotals>>({});

  /* Eén paneel tegelijk open, met scope (left/right) */
  const [openSaldo, setOpenSaldo] = useState<{ scope: SaldoScope; key: string } | null>(null);

  /* Buiten klik = paneel sluiten */
  useEffect(() => {
    function onDocClick(ev: MouseEvent | TouchEvent) {
      if (!openSaldo) return;
      const target = ev.target as HTMLElement | null;
      if (!target) return;
      const inside = !!target.closest("[data-saldo-pop='true']");
      if (!inside) setOpenSaldo(null);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("touchstart", onDocClick);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("touchstart", onDocClick);
    };
  }, [openSaldo]);

  const personRequested = useMemo(() => personRequests.filter((r) => r.status === "requested"), [personRequests]);
  const personApproved = useMemo(() => personRequests.filter((r) => r.status === "approved"), [personRequests]);

  /* Openstaande aanvragen groeperen: per persoon → per jaar */
  const groupedByPersonAndYear = useMemo(() => {
    const personMap = new Map<string, { person: Personnel; byYear: Map<number, LeaveRequest[]> }>();
    for (const r of requests) {
      const p = r.personnel;
      const key = p?.id || "onbekend";
      if (!personMap.has(key)) {
        personMap.set(key, {
          person: { id: p?.id || "?", name: p?.name || "Onbekend", holiday_teller: p?.holiday_teller ?? null, avatar_url: p?.avatar_url ?? null },
          byYear: new Map(),
        });
      }
      const year = new Date(r.leave_date + "T00:00:00").getFullYear();
      const entry = personMap.get(key)!;
      if (!entry.byYear.has(year)) entry.byYear.set(year, []);
      entry.byYear.get(year)!.push(r);
    }
    return Array.from(personMap.values())
      .sort((a, b) => a.person.name.localeCompare(b.person.name))
      .map(({ person, byYear }) => {
        const years = Array.from(byYear.keys()).sort((a, b) => a - b);
        const yearBlocks = years.map((y) => ({
          year: y,
          items: (byYear.get(y) || []).slice().sort((a, b) => a.leave_date.localeCompare(b.leave_date)),
        }));
        return { person, yearBlocks };
      });
  }, [requests]);

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        setEditedEntitlements((prevEnt) => { const n = { ...prevEnt }; delete n[id]; return n; });
        setEditedDayparts((prevDp) => { const n = { ...prevDp }; delete n[id]; return n; });
      } else {
        next.add(id);
      }
      return next;
    });
  }

  /* Conflicten (wie nog meer vrij heeft/aanvroeg op dezelfde datum) */
  async function loadConflictsForDates(dates: string[]) {
    if (!dates.length) { setConflicts({}); return; }
    try {
      const { data, error } = await supabase
        .from("leave_requests")
        .select("leave_date, status, personnel:personnel_id (id, name)")
        .in("leave_date", dates)
        .in("status", ["approved", "requested"]);
      if (error) throw error;

      const map: Record<string, { approved: PersonRef[]; requested: PersonRef[] }> = {};
      for (const row of (data || []) as any[]) {
        const d = String(row.leave_date);
        const status = String(row.status || "").toLowerCase() as "approved" | "requested";
        const personObj = normalizePersonnel(row.personnel);
        if (!map[d]) map[d] = { approved: [], requested: [] };
        if (personObj) map[d][status].push({ id: personObj.id, name: personObj.name });
      }
      setConflicts(map);
    } catch {
      setConflicts({});
    }
  }

  /* ===== Centrale aggregator: entitlements + gebruikt + totals ===== */
  async function loadAggregatesForPairs(pairs: Array<{ personId: string; year: number }>) {
    const personIds = Array.from(new Set(pairs.map(p => p.personId))).filter(Boolean);
    const years = Array.from(new Set(pairs.map(p => p.year)));
    if (personIds.length === 0 || years.length === 0) return;

    try {
      // 1) Entitlements per reason
      const { data: entRows, error: entErr } = await supabase
        .from("leave_entitlements")
        .select("personnel_id, year, reason, total_hours")
        .in("personnel_id", personIds)
        .in("year", years);
      if (entErr) throw entErr;

      const startByKeyReason = new Map<string, number>(); // key: pid:year:reason
      const startTotals = new Map<string, number>();       // key: pid:year
      for (const row of (entRows || []) as any[]) {
        const pid = String(row.personnel_id);
        const y = Number(row.year);
        const reason = String(row.reason || "").trim().toLowerCase() || "(onbekend)";
        const kReason = `${pid}:${y}:${reason}`;
        const kPair = `${pid}:${y}`;
        const val = Number(row.total_hours ?? 0);
        startByKeyReason.set(kReason, (startByKeyReason.get(kReason) || 0) + val);
        startTotals.set(kPair, (startTotals.get(kPair) || 0) + val);
      }

      // 2) Approved requests → uren (per reason)
      const minYear = Math.min(...years);
      const maxYear = Math.max(...years);
      const { data: reqRows, error: reqErr } = await supabase
        .from("leave_requests")
        .select("personnel_id, leave_date, daypart, status, entitlement")
        .in("personnel_id", personIds)
        .gte("leave_date", `${minYear}-01-01`)
        .lt("leave_date", `${maxYear + 1}-01-01`)
        .eq("status", "approved");
      if (reqErr) throw reqErr;

      const usedByKeyReason = new Map<string, number>();
      const usedTotals = new Map<string, number>();
      for (const r of (reqRows || []) as any[]) {
        const pid = String(r.personnel_id);
        const y = new Date(String(r.leave_date) + "T00:00:00").getFullYear();
        const reason = String(r.entitlement || "").trim().toLowerCase() || "(onbekend)";
        const kReason = `${pid}:${y}:${reason}`;
        const kPair = `${pid}:${y}`;
        const h = hoursForDaypart(r.daypart);
        usedByKeyReason.set(kReason, (usedByKeyReason.get(kReason) || 0) + h);
        usedTotals.set(kPair, (usedTotals.get(kPair) || 0) + h);
      }

      // 3) Details + totals per pair
      const detailsAccum: Record<string, YearDetailRow[]> = {};
      const totalsAccum: Record<string, YearTotals> = {};
      const saldoAccum: Record<string, number> = {};

      const pairKeySet = new Set<string>();
      for (const { personId, year } of pairs) pairKeySet.add(`${personId}:${year}`);
      for (const k of startTotals.keys()) pairKeySet.add(k);
      for (const k of usedTotals.keys()) pairKeySet.add(k);

      for (const pairKey of pairKeySet) {
        const [pid, yearStr] = pairKey.split(":");
        const y = Number(yearStr);

        const reasonSet = new Set<string>();
        for (const k of startByKeyReason.keys()) {
          const [p, yy, r] = k.split(":");
          if (p === pid && Number(yy) === y) reasonSet.add(r);
        }
        for (const k of usedByKeyReason.keys()) {
          const [p, yy, r] = k.split(":");
          if (p === pid && Number(yy) === y) reasonSet.add(r);
        }

        const rows: YearDetailRow[] = [];
        reasonSet.forEach((reason) => {
          const kR = `${pid}:${y}:${reason}`;
          const start = startByKeyReason.get(kR) || 0;
          const used = usedByKeyReason.get(kR) || 0;
          rows.push({ reason, start, used, saldo: start - used });
        });

        // Z → A sorteren
        rows.sort((a, b) => b.reason.localeCompare(a.reason));

        const startTotal = startTotals.get(pairKey) || 0;
        const usedTotal = usedTotals.get(pairKey) || 0;
        const saldoTotal = startTotal - usedTotal;

        detailsAccum[pairKey] = rows;
        totalsAccum[pairKey] = { start: startTotal, used: usedTotal, saldo: saldoTotal };
        saldoAccum[pairKey] = saldoTotal;
      }

      setYearDetails((prev) => ({ ...prev, ...detailsAccum }));
      setYearTotals((prev) => ({ ...prev, ...totalsAccum }));
      setYearSaldo((prev) => ({ ...prev, ...saldoAccum }));
    } catch {
      // laat vorige waardes staan
    }
  }

  /* Badge open/dicht + on-demand laden (links/rechts los van elkaar) */
  async function handleSaldoBadgeClick(key: string, scope: SaldoScope) {
    setOpenSaldo((prev) => (prev && prev.scope === scope && prev.key === key ? null : { scope, key }));
    if (!yearDetails[key] || !yearTotals[key]) {
      const [pid, y] = key.split(":");
      await loadAggregatesForPairs([{ personId: pid, year: Number(y) }]);
    }
  }

  /* Eerste load */
  async function loadInitial() {
    setLoading(true);
    setError(null);
    try {
      const { data: reqs, error: reqErr } = await supabase
        .from("leave_requests")
        .select(`
          id,
          personnel_id,
          leave_date,
          status,
          daypart,
          entitlement,
          personnel:personnel_id (
            id,
            name,
            holiday_teller,
            avatar_url
          )
        `)
        .eq("status", "requested")
        .order("leave_date", { ascending: true });
      if (reqErr) throw reqErr;

      const reqList = normalizeRequests((reqs || []) as RawJoinedRow[]);
      setRequests(reqList);

      /* Entitlement-opties (lowercase opslaan) */
      const { data: ents, error: entsErr } = await supabase
        .from("leave_requests")
        .select("entitlement")
        .not("entitlement", "is", null);
      if (entsErr) throw entsErr;
      const opts = Array.from(
        new Set((ents || []).map((e: any) => String(e.entitlement || "").trim().toLowerCase()).filter(Boolean))
      ).sort();
      setEntitlementOptions(opts);

      /* Conflicten ophalen */
      await loadConflictsForDates(Array.from(new Set(reqList.map((r) => r.leave_date))));

      /* Mensenlijst */
      const { data: ppl, error: pplErr } = await supabase
        .from("personnel")
        .select("id, name, holiday_teller, avatar_url")
        .order("name", { ascending: true });
      if (pplErr) throw pplErr;
      setPeople((ppl || []) as Personnel[]);

      /* (persoon, jaar) paren uit links */
      const pairsKeySet = new Set<string>();
      const pairs: Array<{ personId: string; year: number }> = [];
      for (const r of reqList) {
        const pid = r.personnel?.id || r.personnel_id || "";
        if (!pid) continue;
        const y = new Date(r.leave_date + "T00:00:00").getFullYear();
        const key = `${pid}:${y}`;
        if (!pairsKeySet.has(key)) {
          pairsKeySet.add(key);
          pairs.push({ personId: pid, year: y });
        }
      }
      await loadAggregatesForPairs(pairs);
    } catch (e: any) {
      setError(e?.message ?? "Er ging iets mis bij laden.");
    } finally {
      setLoading(false);
    }
  }

  /* Per persoon: aanvragen + aggregaties laden */
  async function loadPersonRequests(personId: string, year: number) {
    if (!personId) { setPersonRequests([]); return; }
    setError(null);
    try {
      const from = `${year}-01-01`;
      const to = `${year + 1}-01-01`;
      const { data, error: prErr } = await supabase
        .from("leave_requests")
        .select("id, leave_date, status, daypart, entitlement")
        .eq("personnel_id", personId)
        .gte("leave_date", from)
        .lt("leave_date", to)
        .in("status", ["requested", "approved"])
        .order("leave_date", { ascending: true });
      if (prErr) throw prErr;

      setPersonRequests((data || []).map((r: any) => ({
        id: r.id,
        personnel_id: personId,
        leave_date: r.leave_date,
        status: String(r.status || "").toLowerCase(),
        daypart: r.daypart ? String(r.daypart).toLowerCase() : null,
        entitlement: r.entitlement ? String(r.entitlement).toLowerCase() : null,
        personnel: null,
      })));

      // aggregatie voor deze persoon/jaar (voor badge rechts)
      const k = `${personId}:${year}`;
      if (!yearTotals[k]) await loadAggregatesForPairs([{ personId, year }]);
    } catch (e: any) {
      setError(e?.message ?? "Kon verlofdagen niet laden.");
    }
  }

  /* Batch update: goedkeuren/afkeuren (opslaan = lowercase) */
  async function batchUpdateSelected(nextStatus: "approved" | "rejected") {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setError(null);
    try {
      if (nextStatus === "approved") {
        const ops = ids.map(async (id) => {
          const original = requests.find((r) => r.id === id);
          const newEntLower = (editedEntitlements[id] ?? original?.entitlement ?? null)
            ? String(editedEntitlements[id] ?? original?.entitlement).trim().toLowerCase()
            : null;
          const newDpLower = canonicalDaypart(original?.daypart ?? null);
          const chosenDpLower = editedDayparts[id] ?? newDpLower;

          const { error } = await supabase
            .from("leave_requests")
            .update({
              status: "approved",
              entitlement: newEntLower,
              daypart: chosenDpLower,
            })
            .eq("id", id);
          if (error) throw error;
        });
        await Promise.all(ops);
      } else {
        const { error: upErr } = await supabase
          .from("leave_requests")
          .update({ status: "rejected" })
          .in("id", ids);
        if (upErr) throw upErr;
      }

      setSelectedIds(new Set());
      setEditedEntitlements({});
      setEditedDayparts({});
      await loadInitial();
      if (selectedPersonId) await loadPersonRequests(selectedPersonId, personYear);
    } catch (e: any) {
      setError(e?.message ?? "Updaten mislukt.");
    }
  }

  /* Lifecycle */
  useEffect(() => { loadInitial(); }, []);
  useEffect(() => { if (selectedPersonId) loadPersonRequests(selectedPersonId, personYear); }, [selectedPersonId, personYear]);

  /* ========= UI ========= */
  return (
    <>
      <FloatingNav />
      <main
        style={{
          background: COLORS.bg,
          minHeight: "100vh",
          padding: 24,
          boxSizing: "border-box",
          color: COLORS.text,
          display: "flex",
          flexDirection: "column",
          gap: 20,
        }}
      >
        {error && (
          <div style={{ background: "#fff7ed", border: `1px solid ${COLORS.line}`, padding: 12, borderRadius: 12 }}>
            <strong>Oeps:</strong> {error}
          </div>
        )}

        <section
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 410px) minmax(0, 500px)",
            justifyContent: "center",
            justifyItems: "center",
            columnGap: "1%",
            rowGap: 12,
            marginTop: `${FLOATING_NAV_OFFSET}px`,
          }}
        >
          {/* ===== LINKS: Openstaande aanvragen ===== */}
          <div
            style={{
              width: "min(410px, 100%)",
              background: COLORS.card,
              border: `1px solid ${COLORS.line}`,
              borderRadius: 12,
              padding: 16,
              display: "flex",
              flexDirection: "column",
              gap: 14,
            }}
          >
            <div style={{ display: "grid", gridTemplateColumns: "6px 1fr auto", alignItems: "center", columnGap: 8 }}>
              <div style={{ width: 6, height: 20, background: COLORS.primary, borderRadius: 3 }} />
              <h2 className={variableFont.className} style={{ margin: 0, fontSize: 18 }}>Openstaande aanvragen</h2>
              <span style={{ color: COLORS.textMuted, fontSize: 13 }}>({requests.length})</span>
            </div>

            {/* Lijst */}
            {loading ? (
              <div style={{ color: COLORS.textMuted }}>Laden…</div>
            ) : groupedByPersonAndYear.length === 0 ? (
              <div style={{ color: COLORS.textMuted }}>Geen aanvragen.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {groupedByPersonAndYear.map(({ person, yearBlocks }) => (
                  <div key={person.id} style={{ background: "#fff", border: `1px solid ${COLORS.line}`, borderRadius: 10, overflow: "hidden" }}>
                    {/* Kop per persoon */}
                    <div
                      style={{
                        display: "flex", justifyContent: "space-between", alignItems: "center",
                        padding: "10px 12px", background: COLORS.card, borderBottom: `1px solid ${COLORS.line}`,
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        {person.avatar_url ? (
                          <img src={person.avatar_url} alt={person.name} style={{ width: 18, height: 18, objectFit: "cover" }} />
                        ) : (<div aria-hidden style={{ width: 18, height: 18 }} />)}
                        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                          <strong style={{ fontSize: 15 }}>{person.name}</strong>
                          <span style={{ color: COLORS.textMuted, fontSize: 13 }}>({yearBlocks.reduce((acc, y) => acc + y.items.length, 0)} aanvragen)</span>
                        </div>
                      </div>
                      <div />
                    </div>

                    {/* Jaarblokken */}
                    {yearBlocks.map(({ year, items }) => {
                      const saldoKey = `${person.id}:${year}`;
                      const saldoHours = yearSaldo[saldoKey] ?? 0;
                      const details = yearDetails[saldoKey] || [];
                      const totals = yearTotals[saldoKey];
                      const isOpen = openSaldo?.scope === "left" && openSaldo.key === saldoKey;

                      // veilige totals (altijd tonen)
                      const safeTotals: YearTotals = totals ?? {
                        start: details.reduce((s, r) => s + r.start, 0),
                        used: details.reduce((s, r) => s + r.used, 0),
                        saldo: details.reduce((s, r) => s + r.saldo, 0),
                      };

                      return (
                        <div key={year} style={{ position: "relative" }}>
                          {/* dun streepje */}
                          <div aria-hidden style={{ width: "100%", borderTop: `3px solid ${YEARBAR}` }} />

                          {/* JAARBALK */}
                          <div
                            style={{
                              padding: "8px 12px",
                              background: YEARBAR,
                              borderBottom: `1px solid ${COLORS.line}`,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              gap: 8,
                              position: "relative",
                            }}
                          >
                            <span style={{ fontWeight: 400, fontSize: 15, color: COLORS.text }}>{year}</span>

                            {/* Saldobadge (klikbaar) */}
                            <div data-saldo-pop="true" style={{ position: "relative", display: "inline-flex", alignItems: "flex-start" }}>
                              <button
                                type="button"
                                onClick={() => handleSaldoBadgeClick(saldoKey, "left")}
                                title="Toon details"
                                style={{
                                  fontSize: 12,
                                  background: "#ffffff",
                                  color: COLORS.text,
                                  border: "1px solid rgba(0,0,0,0.08)",
                                  padding: "4px 10px",
                                  borderRadius: 999,
                                  whiteSpace: "nowrap",
                                  cursor: "pointer",
                                }}
                              >
                                {tellerSaldoLabel(saldoHours)}
                              </button>

                              {/* Detailpaneel */}
                              <div
                                data-saldo-pop="true"
                                style={{
                                  position: "absolute",
                                  right: 0,
                                  top: "calc(100% + 6px)",
                                  transformOrigin: "top right",
                                  transform: isOpen ? "scale(1)" : "scale(0.9)",
                                  opacity: isOpen ? 1 : 0,
                                  pointerEvents: isOpen ? "auto" : "none",
                                  transition: "opacity 140ms ease, transform 160ms ease",
                                  background: "#ffffff",
                                  border: `1px solid ${COLORS.line}`,
                                  borderRadius: 12,
                                  boxShadow: "0 8px 20px rgba(0,0,0,0.06)",
                                  padding: 10,
                                  minWidth: 300,
                                  zIndex: 10,
                                }}
                              >
                                {/* Header (geen 'Categorie' label links) */}
                                <div
                                  style={{
                                    display: "grid",
                                    gridTemplateColumns: "1fr 90px 90px 90px",
                                    gap: 8,
                                    alignItems: "center",
                                    paddingBottom: 6,
                                    borderBottom: `1px solid ${COLORS.line}`,
                                    fontSize: 12,
                                    fontWeight: 600,
                                  }}
                                >
                                  <div />
                                  <div style={{ textAlign: "right" }}>Startsaldo</div>
                                  <div style={{ textAlign: "right" }}>Opgenomen</div>
                                  <div style={{ textAlign: "right" }}>Saldo</div>
                                </div>

                                {/* Body */}
                                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
                                  {details.length === 0 ? (
                                    <div style={{ fontSize: 12, color: COLORS.textMuted }}>Geen categorieën.</div>
                                  ) : (
                                    details.map((row) => (
                                      <div
                                        key={row.reason}
                                        style={{
                                          display: "grid",
                                          gridTemplateColumns: "1fr 90px 90px 90px",
                                          gap: 8,
                                          alignItems: "center",
                                          fontSize: 12,
                                        }}
                                      >
                                        <div>{firstCap(row.reason)}</div>
                                        <div style={{ textAlign: "right" }}>{row.start}</div>
                                        <div style={{ textAlign: "right" }}>{row.used}</div>
                                        <div style={{ textAlign: "right" }}>{row.saldo}</div>
                                      </div>
                                    ))
                                  )}

                                  {/* Totaalrij: altijd tonen */}
                                  <div
                                    style={{
                                      display: "grid",
                                      gridTemplateColumns: "1fr 90px 90px 90px",
                                      gap: 8,
                                      alignItems: "center",
                                      fontSize: 12,
                                      marginTop: 6,
                                      paddingTop: 6,
                                      borderTop: `1px dashed ${COLORS.line}`,
                                      fontWeight: 600,
                                    }}
                                  >
                                    <div>Totaal</div>
                                    <div style={{ textAlign: "right" }}>{safeTotals.start || 0}</div>
                                    <div style={{ textAlign: "right" }}>{safeTotals.used || 0}</div>
                                    <div style={{ textAlign: "right" }}>{safeTotals.saldo || 0}</div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Items */}
                          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                            {items.map((r) => {
                              const c = conflicts[r.leave_date];
                              const othersApproved = (c?.approved || []).filter((p) => p.id !== r.personnel?.id);
                              const othersRequested = (c?.requested || []).filter((p) => p.id !== r.personnel?.id);
                              const apprLine = othersApproved.length > 0 ? `${othersApproved[0].name}${othersApproved.length > 1 ? ` (+${othersApproved.length - 1})` : ""} heeft op dezelfde dag verlof` : null;
                              const reqLine = othersRequested.length > 0 ? `${othersRequested[0].name}${othersRequested.length > 1 ? ` (+${othersRequested.length - 1})` : ""} heeft voor dezelfde dag verlof aangevraagd` : null;
                              const hasConflict = !!(apprLine || reqLine);

                              const isSelected = selectedIds.has(r.id);
                              const entValue = (editedEntitlements[r.id] ?? r.entitlement ?? "") as string;
                              const entOptions = Array.from(new Set((entValue ? [entValue] : []).concat(entitlementOptions)));
                              const daypartValue = (editedDayparts[r.id] ?? canonicalDaypart(r.daypart)) as "hele dag" | "voormiddag" | "namiddag";

                              return (
                                <li
                                  key={r.id}
                                  style={{
                                    display: "grid",
                                    gridTemplateColumns: "20px 75px 115px 110px",
                                    alignItems: "center",
                                    gap: 10,
                                    padding: "10px 12px",
                                    borderBottom: `1px dashed ${COLORS.line}`,
                                  }}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => toggleSelect(r.id)}
                                    aria-label="selecteer"
                                    style={{ width: 18, height: 18 }}
                                  />

                                  {/* Datum */}
                                  <div style={{ fontSize: 15, color: COLORS.text }}>{formatDateShort(r.leave_date)}</div>

                                  {/* Dagdeel */}
                                  <div>
                                    <select
                                      value={daypartValue}
                                      disabled={!isSelected}
                                      onChange={(e) => {
                                        if (!isSelected) return;
                                        const v = e.target.value as "hele dag" | "voormiddag" | "namiddag";
                                        setEditedDayparts((prev) => ({ ...prev, [r.id]: v }));
                                      }}
                                      style={{
                                        width: "100%",
                                        padding: "6px 8px",
                                        borderRadius: 8,
                                        border: `1px solid ${COLORS.line}`,
                                        background: "#fff",
                                        fontSize: 14,
                                        color: COLORS.text,
                                        height: 32,
                                        opacity: isSelected ? 1 : 0.5,
                                        cursor: isSelected ? "pointer" : "not-allowed",
                                      }}
                                      aria-label="Dagdeel kiezen"
                                      title={isSelected ? "Kies dagdeel" : "Vink eerst de rij aan"}
                                    >
                                      <option value="hele dag">Hele dag</option>
                                      <option value="voormiddag">Voormiddag</option>
                                      <option value="namiddag">Namiddag</option>
                                    </select>
                                  </div>

                                  {/* Entitlement */}
                                  <div>
                                    <select
                                      value={entValue}
                                      disabled={!isSelected}
                                      onChange={(e) => {
                                        if (!isSelected) return;
                                        const v = (e.target.value || "").trim().toLowerCase() || null;
                                        setEditedEntitlements((prev) => ({ ...prev, [r.id]: v }));
                                      }}
                                      style={{
                                        width: "100%",
                                        padding: "6px 8px",
                                        borderRadius: 8,
                                        border: `1px solid ${COLORS.line}`,
                                        background: "#fff",
                                        fontSize: 14,
                                        color: COLORS.text,
                                        height: 32,
                                        opacity: isSelected ? 1 : 0.5,
                                        cursor: isSelected ? "pointer" : "not-allowed",
                                      }}
                                      aria-label="Entitlement kiezen"
                                      title={isSelected ? "Kies type" : "Vink eerst de rij aan"}
                                    >
                                      <option value="">—</option>
                                      {entitlementOptions.map((opt) => (
                                        <option key={opt} value={opt}>
                                          {firstCap(opt)}
                                        </option>
                                      ))}
                                    </select>
                                  </div>

                                  {/* Conflicten */}
                                  {hasConflict && (
                                    <div style={{ gridColumn: "1 / -1", color: "#b91c1c", fontSize: 12, marginTop: 6 }}>
                                      {apprLine && <div>{apprLine}</div>}
                                      {reqLine && <div>{reqLine}</div>}
                                    </div>
                                  )}
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}

            {/* Acties */}
            <div style={{ display: "flex", gap: 8, marginTop: 4, justifyContent: "flex-end" }}>
              <button
                onClick={() => batchUpdateSelected("rejected")}
                disabled={selectedIds.size === 0 || loading}
                className={titleFont.className}
                style={{
                  padding: "10px 14px",
                  background: "#ffffff",
                  border: `1px solid ${HEADER_BTN.border}`,
                  borderRadius: 999,
                  cursor: selectedIds.size === 0 || loading ? "not-allowed" : "pointer",
                  fontWeight: 800,
                  fontSize: 14,
                  letterSpacing: 0.2,
                  minWidth: 120,
                }}
                onMouseOver={(e) => (e.currentTarget.style.background = HEADER_BTN.hover)}
                onMouseOut={(e) => (e.currentTarget.style.background = "#ffffff")}
              >
                Afkeuren
              </button>

              <button
                onClick={() => batchUpdateSelected("approved")}
                disabled={selectedIds.size === 0 || loading}
                className={titleFont.className}
                style={{
                  padding: "10px 14px",
                  background: selectedIds.size === 0 || loading ? "#d2edf2" : COLORS.btnBg,
                  color: COLORS.btnText,
                  border: `1px solid ${COLORS.btnBorder}`,
                  borderRadius: 999,
                  cursor: selectedIds.size === 0 || loading ? "not-allowed" : "pointer",
                  fontWeight: 900,
                  fontSize: 14,
                  letterSpacing: 0.2,
                  minWidth: 120,
                }}
                onMouseOver={(e) => {
                  if (!(selectedIds.size === 0 || loading)) e.currentTarget.style.background = COLORS.btnHover;
                }}
                onMouseOut={(e) => {
                  if (!(selectedIds.size === 0 || loading)) e.currentTarget.style.background = COLORS.btnBg;
                }}
              >
                Goedkeuren
              </button>
            </div>
          </div>

          {/* ===== RECHTS: Per persoon (dropdown vast, jaar ernaast, badge rechts + uitklap) ===== */}
          <div
            style={{
              width: "min(560px, 100%)",
              background: COLORS.card,
              border: `1px solid ${COLORS.line}`,
              borderRadius: 12,
              padding: 16,
              display: "flex",
              flexDirection: "column",
              gap: 14,
            }}
          >
            <div style={{ display: "grid", gridTemplateColumns: "6px 1fr auto", alignItems: "center", columnGap: 8 }}>
              <div style={{ width: 6, height: 20, background: COLORS.primary, borderRadius: 3 }} />
              <h2 className={variableFont.className} style={{ margin: 0, fontSize: 18 }}>Per persoon</h2>
              <div />
            </div>

            {/* Rij met vaste dropdown + jaar-nav + badge rechts */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: `${PERSON_SELECT_WIDTH}px 1fr`, // vaste breedte + rest
                alignItems: "end",
                gap: 10,
                marginTop: 2,
              }}
            >
              {/* VASTE dropdown */}
              <div style={{ width: PERSON_SELECT_WIDTH }}>
                <label style={{ fontSize: 13, color: COLORS.textMuted, display: "block", marginBottom: 6 }}>Kies medewerker</label>
                <select
                  value={selectedPersonId}
                  onChange={(e) => setSelectedPersonId(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: 10,
                    border: `1px solid ${COLORS.line}`,
                    background: "#fff",
                    height: 36,
                  }}
                >
                  <option value="">—</option>
                  {people.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
                </select>
              </div>

              {/* Rechts: jaar-nav links, badge helemaal rechts */}
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {/* Jaar-nav */}
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <button
                    onClick={() => setPersonYear((y) => y - 1)}
                    aria-label={`Ga naar ${personYear - 1}`}
                    className={titleFont.className}
                    style={{
                      padding: "6px 10px",
                      background: HEADER_BTN.bg,
                      border: `1px solid ${HEADER_BTN.border}`,
                      borderRadius: 999,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                      fontWeight: 900,
                      fontSize: 14,
                      letterSpacing: 0.2,
                    }}
                    onMouseOver={(e) => (e.currentTarget.style.background = HEADER_BTN.hover)}
                    onMouseOut={(e) => (e.currentTarget.style.background = HEADER_BTN.bg)}
                  >
                    <IconChevronLeft />
                  </button>

                  <span className={titleFont.className} style={{ fontSize: 16, fontWeight: 900, minWidth: 52, textAlign: "center" }}>
                    {personYear}
                  </span>

                  <button
                    onClick={() => setPersonYear((y) => y + 1)}
                    aria-label={`Ga naar ${personYear + 1}`}
                    className={titleFont.className}
                    style={{
                      padding: "6px 10px",
                      background: HEADER_BTN.bg,
                      border: `1px solid ${HEADER_BTN.border}`,
                      borderRadius: 999,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                      fontWeight: 900,
                      fontSize: 14,
                      letterSpacing: 0.2,
                    }}
                    onMouseOver={(e) => (e.currentTarget.style.background = HEADER_BTN.hover)}
                    onMouseOut={(e) => (e.currentTarget.style.background = HEADER_BTN.bg)}
                  >
                    <IconChevronRight />
                  </button>
                </div>

                {/* opvuller */}
                <div style={{ flex: 1 }} />

                {/* Badge rechts (met uitklap, zelfde als links) */}
                {selectedPersonId && (
                  <div data-saldo-pop="true" style={{ position: "relative", display: "inline-flex", alignItems: "flex-start" }}>
                    {(() => {
                      const key = `${selectedPersonId}:${personYear}`;
                      const saldoHours = yearSaldo[key] ?? 0;
                      const details = yearDetails[key] || [];
                      const totals = yearTotals[key];
                      const isOpen = openSaldo?.scope === "right" && openSaldo.key === key;

                      const safeTotals: YearTotals = totals ?? {
                        start: details.reduce((s, r) => s + r.start, 0),
                        used: details.reduce((s, r) => s + r.used, 0),
                        saldo: details.reduce((s, r) => s + r.saldo, 0),
                      };

                      return (
                        <>
                          <button
                            type="button"
                            onClick={() => handleSaldoBadgeClick(key, "right")}
                            title="Toon details"
                            style={{
                              fontSize: 12,
                              background: "#ffffff",
                              color: COLORS.text,
                              border: "1px solid rgba(0,0,0,0.08)",
                              padding: "4px 10px",
                              borderRadius: 999,
                              whiteSpace: "nowrap",
                              cursor: "pointer",
                            }}
                          >
                            {tellerSaldoLabel(saldoHours)}
                          </button>

                          {/* Paneel, rechts uitgelijnd onder de badge */}
                          <div
                            data-saldo-pop="true"
                            style={{
                              position: "absolute",
                              right: 0,
                              top: "calc(100% + 6px)",
                              transformOrigin: "top right",
                              transform: isOpen ? "scale(1)" : "scale(0.9)",
                              opacity: isOpen ? 1 : 0,
                              pointerEvents: isOpen ? "auto" : "none",
                              transition: "opacity 140ms ease, transform 160ms ease",
                              background: "#ffffff",
                              border: `1px solid ${COLORS.line}`,
                              borderRadius: 12,
                              boxShadow: "0 8px 20px rgba(0,0,0,0.06)",
                              padding: 10,
                              minWidth: 300,
                              zIndex: 10,
                            }}
                          >
                            {/* Header */}
                            <div
                              style={{
                                display: "grid",
                                gridTemplateColumns: "1fr 90px 90px 90px",
                                gap: 8,
                                alignItems: "center",
                                paddingBottom: 6,
                                borderBottom: `1px solid ${COLORS.line}`,
                                fontSize: 12,
                                fontWeight: 600,
                              }}
                            >
                              <div />
                              <div style={{ textAlign: "right" }}>Startsaldo</div>
                              <div style={{ textAlign: "right" }}>Opgenomen</div>
                              <div style={{ textAlign: "right" }}>Saldo</div>
                            </div>

                            {/* Body */}
                            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
                              {details.length === 0 ? (
                                <div style={{ fontSize: 12, color: COLORS.textMuted }}>Geen categorieën.</div>
                              ) : (
                                details.map((row) => (
                                  <div
                                    key={row.reason}
                                    style={{
                                      display: "grid",
                                      gridTemplateColumns: "1fr 90px 90px 90px",
                                      gap: 8,
                                      alignItems: "center",
                                      fontSize: 12,
                                    }}
                                  >
                                    <div>{firstCap(row.reason)}</div>
                                    <div style={{ textAlign: "right" }}>{row.start}</div>
                                    <div style={{ textAlign: "right" }}>{row.used}</div>
                                    <div style={{ textAlign: "right" }}>{row.saldo}</div>
                                  </div>
                                ))
                              )}

                              {/* Totaalrij: altijd tonen */}
                              <div
                                style={{
                                  display: "grid",
                                  gridTemplateColumns: "1fr 90px 90px 90px",
                                  gap: 8,
                                  alignItems: "center",
                                  fontSize: 12,
                                  marginTop: 6,
                                  paddingTop: 6,
                                  borderTop: `1px dashed ${COLORS.line}`,
                                  fontWeight: 600,
                                }}
                              >
                                <div>Totaal</div>
                                <div style={{ textAlign: "right" }}>{safeTotals.start || 0}</div>
                                <div style={{ textAlign: "right" }}>{safeTotals.used || 0}</div>
                                <div style={{ textAlign: "right" }}>{safeTotals.saldo || 0}</div>
                              </div>
                            </div>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                )}
              </div>
            </div>

            {/* Overzicht voor gekozen persoon/jaar */}
            {selectedPersonId && (
              <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 12 }}>
                {/* Goedgekeurd */}
                <section>
                  <div style={{ background: "#fff", border: `1px solid ${COLORS.line}`, borderRadius: 10, overflow: "hidden" }}>
                    <div style={{ padding: "10px 12px", background: COLORS.card, borderBottom: `1px solid ${COLORS.line}`, fontWeight: 700, fontSize: 14 }}>
                      Goedgekeurd
                    </div>

                    {personApproved.length === 0 ? (
                      <div style={{ color: COLORS.textMuted, padding: "10px 12px" }}>Nog geen verlof.</div>
                    ) : (
                      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                        {personApproved.map((r) => (
                          <li
                            key={r.id}
                            onMouseEnter={() => setHoverRowId(r.id)}
                            onMouseLeave={() => setHoverRowId(null)}
                            style={{
                              display: "grid",
                              gridTemplateColumns: GRID_PERSON,
                              alignItems: "center",
                              gap: 10,
                              padding: "10px 12px",
                              borderBottom: `1px dashed ${COLORS.line}`,
                              fontSize: 15,
                            }}
                          >
                            <div /> {/* spacer */}
                            <div>{formatDateShort(r.leave_date)}</div>
                            <div style={{ color: COLORS.textMuted, textAlign: "center" }}>{firstCap(canonicalDaypart(r.daypart))}</div>
                            <div style={{ color: COLORS.textMuted, textAlign: "center" }}>{firstCap(r.entitlement)}</div>

                            <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", height: 24 }}>
                              <span
                                title="Aanpassen"
                                style={{
                                  width: 24,
                                  height: 24,
                                  display: "inline-flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  opacity: hoverRowId === r.id ? 1 : 0,
                                  pointerEvents: "none",
                                  transition: "opacity 120ms ease",
                                }}
                              >
                                <IconPencil />
                              </span>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </section>

                {/* Aangevraagd */}
                {personRequested.length > 0 && (
                  <section>
                    <div style={{ background: "#fff", border: `1px solid ${COLORS.line}`, borderRadius: 10, overflow: "hidden" }}>
                      <div style={{ padding: "10px 12px", background: COLORS.card, borderBottom: `1px solid ${COLORS.line}`, fontWeight: 700, fontSize: 14 }}>
                        Aangevraagd
                      </div>

                      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                        {personRequested.map((r) => (
                          <li
                            key={r.id}
                            onMouseEnter={() => setHoverRowId(r.id)}
                            onMouseLeave={() => setHoverRowId(null)}
                            style={{
                              display: "grid",
                              gridTemplateColumns: GRID_PERSON,
                              alignItems: "center",
                              gap: 10,
                              padding: "10px 12px",
                              borderBottom: `1px dashed ${COLORS.line}`,
                              fontSize: 15,
                            }}
                          >
                            <div /> {/* spacer */}
                            <div>{formatDateShort(r.leave_date)}</div>
                            <div style={{ color: COLORS.textMuted, textAlign: "center" }}>{firstCap(canonicalDaypart(r.daypart))}</div>
                            <div style={{ color: COLORS.textMuted, textAlign: "center" }}>{firstCap(r.entitlement)}</div>

                            <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", height: 24 }}>
                              <span
                                title="Aanpassen"
                                style={{
                                  width: 24,
                                  height: 24,
                                  display: "inline-flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  opacity: hoverRowId === r.id ? 1 : 0,
                                  pointerEvents: "none",
                                  transition: "opacity 120ms ease",
                                }}
                              >
                                <IconPencil />
                              </span>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </section>
                )}
              </div>
            )}
          </div>
        </section>
      </main>
    </>
  );
}

/* ========= Suspense-wrapper ========= */
export default function Page() {
  return (
    <Suspense fallback={<div style={{ padding: 12 }}>Laden…</div>}>
      <ApprovalContent />
    </Suspense>
  );
}

/* Hooks in client children → voorkom prerender-fouten */
export const dynamic = "force-dynamic";
