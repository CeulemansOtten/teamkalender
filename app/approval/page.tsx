"use client";

import React, { useEffect, useMemo, useState, Suspense } from "react";
import localFont from "next/font/local";
import { supabase } from "@/lib/supabaseClient";
import FloatingNav from "../components/FloatingNav";

/* ========= Eenvoudige instellingen ========= */
const FLOATING_NAV_OFFSET = 70;

/* Kleuren / tokens centraal houden en doorgeven als props */
export const COLORS = {
  bg: "#ffffff",
  card: "#f7f9fb",
  line: "#e5e7eb",
  text: "#0f172a",
  textMuted: "#475569",
  primary: "#0ea5a8",
  btnBg: "#0ea5a8",
  btnHover: "#0c8e91",
  btnText: "#ffffff",
  btnBorder: "#0ea5a8",
} as const;
export const HEADER_BTN = { bg: "#ffffff", border: "#d1d5db", hover: "#f3f4f6" } as const;
export const YEARBAR = "#D2EDF2";

/* ========= Fonts ========= */
const variableFont = localFont({ src: "../fonts/Font_Variable.otf", display: "swap" });
const titleFont = localFont({ src: "../fonts/Font_VariableBold.otf", display: "swap" });

/* ========= Types ========= */
export type Personnel = {
  id: string;
  name: string;
  avatar_url?: string | null;
  holiday_teller?: number | null;
};
type PersonRef = { id: string; name: string };

export type LeaveRequest = {
  id: string;
  personnel_id: string | null;
  leave_date: string;  // YYYY-MM-DD
  status: string;      // lowercase
  daypart: string | null;     // "hele dag"|"voormiddag"|"namiddag"
  entitlement: string | null; // reason
  hours?: number | null;      // ⬅️ NIEUW
  personnel?: Personnel | null;
};

type RawJoinedRow = {
  id: string;
  personnel_id?: string | null;
  leave_date: string;
  status: string;
  daypart?: string | null;
  entitlement?: string | null;
  hours?: number | null;      // ⬅️ NIEUW
  personnel?: any;
};

export type YearDetailRow = { reason: string; start: number; used: number; saldo: number };
export type YearTotals = { start: number; used: number; saldo: number };

export type SaldoScope = "left" | "right";

/* ========= Helpers ========= */
const DOW_SHORT = ["zo", "ma", "di", "wo", "do", "vr", "za"] as const;
const MON_SHORT = ["jan", "feb", "mrt", "apr", "mei", "jun", "jul", "aug", "sep", "okt", "nov", "dec"] as const;

export function formatDateShort(iso: string) {
  const d = new Date(iso + "T00:00:00");
  const wd = DOW_SHORT[d.getDay()];
  const day = d.getDate();
  const mon = MON_SHORT[d.getMonth()];
  return `${wd} ${day} ${mon}`;
}

export function firstCap(s: string | null | undefined) {
  if (!s) return "—";
  const v = String(s).trim().toLowerCase();
  return v ? v.charAt(0).toUpperCase() + v.slice(1) : "—";
}

/* Daypart canoniek (lowercase) */
export function canonicalDaypart(dp: string | null): "hele dag" | "voormiddag" | "namiddag" {
  const v = String(dp || "").toLowerCase();
  if (v.includes("voor") || v.includes("morning")) return "voormiddag";
  if (v.includes("na") || v.includes("afternoon")) return "namiddag";
  return "hele dag";
}

/* Uren per dagdeel */
export function hoursForDaypart(dp: string | null | undefined) {
  const v = String(dp || "").toLowerCase();
  if (v.includes("voor") || v.includes("morning")) return 4;
  if (v.includes("na") || v.includes("afternoon")) return 4;
  if (v.includes("hele")) return 8;
  return 8;
}

/* Badge-tekst voor saldo (basis font) */
export function tellerSaldoLabel(hours?: number | null) {
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
    hours: r.hours == null ? null : Number(r.hours), // ⬅️ HIER
    personnel: normalizePersonnel(r.personnel),
  }));
}

/* ========= Componenten importeren ========= */
import ApprovalCard from "./approval";
import OverviewPerPersonCard from "./overview_per_person";
import ManualInputCard from "./manual_input";

/* ========= Hoofdcomponent ========= */
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

  /* Rechts: per persoon */
  const [people, setPeople] = useState<Personnel[]>([]);
  const [selectedPersonId, setSelectedPersonId] = useState<string>("");
  const [personYear, setPersonYear] = useState<number>(new Date().getFullYear());
  const [personRequests, setPersonRequests] = useState<LeaveRequest[]>([]);
  const personRequested = useMemo(() => personRequests.filter((r) => r.status === "requested"), [personRequests]);
  const personApproved  = useMemo(() => personRequests.filter((r) => r.status === "approved"),  [personRequests]);

  /* Aggregaties per (persoon, jaar) */
  const [yearSaldo, setYearSaldo] = useState<Record<string, number>>({});
  const [yearDetails, setYearDetails] = useState<Record<string, YearDetailRow[]>>({});
  const [yearTotals, setYearTotals] = useState<Record<string, YearTotals>>({});
  const [openSaldo, setOpenSaldo] = useState<{ scope: "left" | "right"; key: string } | null>(null);

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
        const p = normalizePersonnel(row.personnel);
        if (!map[d]) map[d] = { approved: [], requested: [] };
        if (p) map[d][status].push({ id: p.id, name: p.name });
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
          hours,                              
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

      /* Entitlement-opties */
      const { data: ents, error: entsErr } = await supabase
        .from("leave_requests")
        .select("entitlement")
        .not("entitlement", "is", null);
      if (entsErr) throw entsErr;
      const opts = Array.from(
        new Set((ents || []).map((e: any) => String(e.entitlement || "").trim().toLowerCase()).filter(Boolean))
      ).sort();
      setEntitlementOptions(opts);

      await loadConflictsForDates(Array.from(new Set(reqList.map((r) => r.leave_date))));

      /* Mensenlijst */
      const { data: ppl, error: pplErr } = await supabase
        .from("personnel")
        .select("id, name, holiday_teller, avatar_url")
        .order("name", { ascending: true });
      if (pplErr) throw pplErr;
      setPeople((ppl || []) as Personnel[]);

      /* Aggregaties voor links */
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
        .select("id, leave_date, status, daypart, entitlement, hours")
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
        hours: r.hours == null ? null : Number(r.hours), // ⬅️ HIER
        personnel: null,
      })));

      const k = `${personId}:${year}`;
      if (!yearTotals[k]) await loadAggregatesForPairs([{ personId, year }]);
    } catch (e: any) {
      setError(e?.message ?? "Kon verlofdagen niet laden.");
    }
  }

  /* Selectie-handler voor links */
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
          {/* LINKS */}
          <div style={{ width: "min(410px, 100%)", display: "flex", flexDirection: "column", gap: 12 }}>
            <ApprovalCard
              COLORS={COLORS}
              HEADER_BTN={HEADER_BTN}
              YEARBAR={YEARBAR}
              variableFontClass={variableFont.className}
              titleFontClass={titleFont.className}
              loading={loading}
              requests={requests}
              entitlementOptions={entitlementOptions}
              selectedIds={selectedIds}
              editedEntitlements={editedEntitlements}
              editedDayparts={editedDayparts}
              yearSaldo={yearSaldo}
              yearDetails={yearDetails}
              yearTotals={yearTotals}
              openSaldo={openSaldo}
              conflicts={conflicts}
              onToggleSelect={toggleSelect}
              onChangeEntitlement={(id, v) => setEditedEntitlements((p) => ({ ...p, [id]: v }))}
              onChangeDaypart={(id, v) => setEditedDayparts((p) => ({ ...p, [id]: v }))}
              onClickSaldoBadge={(key) => handleSaldoBadgeClick(key, "left")}
              onBatchApprove={() => batchUpdateSelected("approved")}
              onBatchReject={() => batchUpdateSelected("rejected")}
            />

            {/* Nieuwe card onder Openstaande aanvragen */}
            <ManualInputCard
                COLORS={COLORS}
                variableFontClass={variableFont.className}
                onAfterInsert={(pid) => {
                  // Als rechts dezelfde persoon geselecteerd is, meteen herladen
                  if (pid && pid === selectedPersonId) {
                    loadPersonRequests(pid, personYear);
                  }
                  // Links de openstaande aanvragen en aggregaties ook even herladen
                  loadInitial();
                }}
              />
          </div>

          {/* RECHTS */}
          <div style={{ width: "min(560px, 100%)" }}>
            <OverviewPerPersonCard
              COLORS={COLORS}
              HEADER_BTN={HEADER_BTN}
              YEARBAR={YEARBAR}
              variableFontClass={variableFont.className}
              titleFontClass={titleFont.className}
              people={people}
              selectedPersonId={selectedPersonId}
              setSelectedPersonId={setSelectedPersonId}
              personYear={personYear}
              setPersonYear={setPersonYear}
              personApproved={personApproved}
              personRequested={personRequested}
              yearSaldo={yearSaldo}
              yearDetails={yearDetails}
              yearTotals={yearTotals}
              openSaldo={openSaldo}
              onClickSaldoBadge={(key) => handleSaldoBadgeClick(key, "right")}
            />
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

export const dynamic = "force-dynamic";
