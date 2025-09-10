"use client";

import React, { useEffect, useMemo, useState, Suspense } from "react";
import localFont from "next/font/local";
import { supabase } from "@/lib/supabaseClient";
import FloatingNav from "../components/FloatingNav";

/* ========= Instelbare vaste offset (px) onder de FloatingNav ========= */
const FLOATING_NAV_OFFSET = 70;

/* ========= Fonts & Kleuren ========= */
const variableFont = localFont({ src: "../fonts/Font_Variable.otf", display: "swap" });
const titleFont = localFont({ src: "../fonts/Font_VariableBold.otf", display: "swap" });

const COLORS = {
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
};
const HEADER_BTN = { bg: "#ffffff", border: "#d1d5db", hover: "#f3f4f6" };

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
function IconSave({ color = COLORS.primary, size = 18 }: { color?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z" />
      <path d="M17 21v-8H7v8" />
      <path d="M7 3v5h8" />
    </svg>
  );
}
function IconTrash({ color = COLORS.primary, size = 18 }: { color?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

/* ========= Types ========= */
type Personnel = {
  id: string;
  name: string;
  holiday_teller?: number | null;
  avatar_url?: string | null;
};
type PersonRef = { id: string; name: string };

type LeaveRequest = {
  id: string;
  personnel_id: string | null;
  leave_date: string;
  status: string;
  daypart: string | null;
  entitlement: string | null;
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

function formatDaypart(dp: string | null) {
  if (!dp) return "hele dag";
  const v = String(dp).toLowerCase();
  if (v.includes("morning") || v.includes("voor")) return "voormiddag";
  if (v.includes("afternoon") || v.includes("na")) return "namiddag";
  if (v.includes("hele")) return "hele dag";
  return dp;
}
function canonicalDaypartLabel(dp: string | null): "hele dag" | "voormiddag" | "namiddag" {
  const t = formatDaypart(dp);
  return t === "voormiddag" ? "voormiddag" : t === "namiddag" ? "namiddag" : "hele dag";
}
function formatEntitlement(e: string | null) {
  if (!e) return "—";
  return e.charAt(0).toUpperCase() + e.slice(1);
}
function tellerLabel(hours?: number | null) {
  const h = Number.isFinite(hours as number) ? (hours as number) : 0;
  const daysStr = new Intl.NumberFormat("nl-BE", { maximumFractionDigits: 1 }).format(h / 8);
  return `Teller: ${h} uren (${daysStr} dagen)`;
}
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
    status: r.status,
    daypart: r.daypart ?? null,
    entitlement: r.entitlement ?? null,
    personnel: normalizePersonnel(r.personnel),
  }));
}

/* ========= Inhoud van de pagina (client) ========= */
function ApprovalContent() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Card 1
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [conflicts, setConflicts] = useState<Record<string, { approved: PersonRef[]; requested: PersonRef[] }>>({});

  // Openstaande dropdown state (uitgesteld wegschrijven)
  const [entitlementOptions, setEntitlementOptions] = useState<string[]>([]);
  const [editedEntitlements, setEditedEntitlements] = useState<Record<string, string | null>>({});
  const [editedDayparts, setEditedDayparts] = useState<Record<string, string | null>>({});

  // Card 2 (per persoon)
  const [people, setPeople] = useState<Personnel[]>([]);
  const [selectedPersonId, setSelectedPersonId] = useState<string>("");
  const [personYear, setPersonYear] = useState<number>(new Date().getFullYear());
  const [personRequests, setPersonRequests] = useState<LeaveRequest[]>([]);
  const [hoverApprovedId, setHoverApprovedId] = useState<string | null>(null);

  // Inline edit (Goedgekeurd)
  const [editingApprovedId, setEditingApprovedId] = useState<string | null>(null);
  const [approvedEditValues, setApprovedEditValues] = useState<{
    leave_date: string;
    daypart: "hele dag" | "voormiddag" | "namiddag";
    entitlement: string | null;
  }>({ leave_date: "", daypart: "hele dag", entitlement: null });

  const personRequested = useMemo(() => personRequests.filter((r) => r.status === "requested"), [personRequests]);
  const personApproved = useMemo(() => personRequests.filter((r) => r.status === "approved"), [personRequests]);
  const selectedPerson = useMemo(() => people.find((p) => p.id === selectedPersonId) || null, [people, selectedPersonId]);

  // Groeperen openstaande: per persoon → per jaar
  const groupedByPersonAndYear = useMemo(() => {
    const personMap = new Map<string, { person: Personnel; byYear: Map<number, LeaveRequest[]> }>();
    for (const r of requests) {
      const p = r.personnel;
      const key = p?.id || "onbekend";
      if (!personMap.has(key)) {
        personMap.set(key, { person: { id: p?.id || "?", name: p?.name || "Onbekend", holiday_teller: p?.holiday_teller ?? null, avatar_url: p?.avatar_url ?? null }, byYear: new Map() });
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
        const yearBlocks = years.map((y) => ({ year: y, items: (byYear.get(y) || []).slice().sort((a, b) => a.leave_date.localeCompare(b.leave_date)) }));
        return { person, yearBlocks };
      });
  }, [requests]);

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

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
        const d = row.leave_date as string;
        const status = row.status as "approved" | "requested";
        const personObj = normalizePersonnel(row.personnel);
        if (!map[d]) map[d] = { approved: [], requested: [] };
        if (personObj) map[d][status].push({ id: personObj.id, name: personObj.name });
      }
      setConflicts(map);
    } catch (e) {
      console.error("conflict-fetch failed", e);
      setConflicts({});
    }
  }

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

      const { data: ents, error: entsErr } = await supabase
        .from("leave_requests")
        .select("entitlement")
        .not("entitlement", "is", null);
      if (entsErr) throw entsErr;
      const opts = Array.from(new Set((ents || []).map((e: any) => String(e.entitlement).trim()).filter(Boolean))).sort();
      setEntitlementOptions(opts);

      await loadConflictsForDates(Array.from(new Set(reqList.map((r) => r.leave_date))));

      const { data: ppl, error: pplErr } = await supabase
        .from("personnel")
        .select("id, name, holiday_teller, avatar_url")
        .order("name", { ascending: true });
      if (pplErr) throw pplErr;
      setPeople((ppl || []) as Personnel[]);
    } catch (e: any) {
      setError(e?.message ?? "Er ging iets mis bij laden.");
    } finally {
      setLoading(false);
    }
  }

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
        status: r.status,
        daypart: r.daypart ?? null,
        entitlement: r.entitlement ?? null,
        personnel: null,
      })));
    } catch (e: any) {
      setError(e?.message ?? "Kon verlofdagen niet laden.");
    }
  }

  async function batchUpdateSelected(nextStatus: "approved" | "rejected") {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setError(null);
    try {
      if (nextStatus === "approved") {
        const ops = ids.map(async (id) => {
          const original = requests.find((r) => r.id === id);
          const newEnt = (editedEntitlements[id] ?? original?.entitlement ?? null) || null;
          const newDp = (editedDayparts[id] ?? canonicalDaypartLabel(original?.daypart ?? null)) as
            | "hele dag" | "voormiddag" | "namiddag";
          const { error } = await supabase
            .from("leave_requests")
            .update({ status: "approved", entitlement: newEnt, daypart: newDp })
            .eq("id", id);
          if (error) throw error;
        });
        await Promise.all(ops);
      } else {
        const { error: upErr } = await supabase.from("leave_requests").update({ status: nextStatus }).in("id", ids);
        if (upErr) throw upErr;
      }

      setSelectedIds(new Set());
      setEditedEntitlements((prev) => { const n = { ...prev }; ids.forEach((id) => delete n[id]); return n; });
      setEditedDayparts((prev) => { const n = { ...prev }; ids.forEach((id) => delete n[id]); return n; });
      await loadInitial();
      if (selectedPersonId) await loadPersonRequests(selectedPersonId, personYear);
    } catch (e: any) {
      setError(e?.message ?? "Updaten mislukt.");
    }
  }

  // Per-persoon > Goedgekeurd inline edit
  function startEditApproved(r: LeaveRequest) {
    setEditingApprovedId(r.id);
    setApprovedEditValues({
      leave_date: r.leave_date,
      daypart: canonicalDaypartLabel(r.daypart),
      entitlement: r.entitlement ?? "",
    });
  }
  async function saveEditApproved(id: string) {
    try {
      const { error } = await supabase
        .from("leave_requests")
        .update({
          leave_date: approvedEditValues.leave_date,
          daypart: approvedEditValues.daypart,
          entitlement: approvedEditValues.entitlement || null,
        })
        .eq("id", id);
      if (error) throw error;
      setEditingApprovedId(null);
      if (selectedPersonId) await loadPersonRequests(selectedPersonId, personYear);
    } catch (e: any) {
      setError(e?.message ?? "Bewaren mislukt.");
    }
  }
  async function deleteApproved(id: string) {
    try {
      if (!window.confirm("Deze aanvraag verwijderen?")) return;
      const { error } = await supabase.from("leave_requests").delete().eq("id", id);
      if (error) throw error;
      if (selectedPersonId) await loadPersonRequests(selectedPersonId, personYear);
    } catch (e: any) {
      setError(e?.message ?? "Verwijderen mislukt.");
    }
  }

  useEffect(() => { loadInitial(); }, []);
  useEffect(() => { if (selectedPersonId) loadPersonRequests(selectedPersonId, personYear); }, [selectedPersonId, personYear]);

  /* ======== UI ======== */
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
            // ▼ Per Persoon kaart breder gemaakt (510px i.p.v. 432px)
            gridTemplateColumns: "minmax(0, 410px) minmax(0, 500px)",
            justifyContent: "center",
            justifyItems: "center",
            columnGap: "1%",
            rowGap: 12,
            marginTop: `${FLOATING_NAV_OFFSET}px`,
          }}
        >
          {/* ===== Links: Openstaande aanvragen ===== */}
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
                          <img src={person.avatar_url} alt={person.name} style={{ width: 18, height: 18, borderRadius: 0, objectFit: "cover", flex: "0 0 18px", background: "transparent", border: "none" }} />
                        ) : (<div aria-hidden style={{ width: 18, height: 18 }} />)}
                        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                          <strong style={{ fontSize: 15 }}>{person.name}</strong>
                          <span style={{ color: COLORS.textMuted, fontSize: 13 }}>({yearBlocks.reduce((acc, y) => acc + y.items.length, 0)} aanvragen)</span>
                        </div>
                      </div>
                      <span title="Holiday teller" style={{ fontSize: 12, border: `1px solid ${COLORS.btnBorder}`, padding: "4px 8px", borderRadius: 999, background: "#fff", whiteSpace: "nowrap" }}>
                        {tellerLabel(person.holiday_teller)}
                      </span>
                    </div>

                    {/* Jaarblokken */}
                    {yearBlocks.map(({ year, items }) => (
                      <div key={year}>
                        {/* lijn vóór jaartal */}
                        <div aria-hidden style={{ width: "100%", borderTop: `3px solid ${COLORS.card}` }} />
                        <div style={{ padding: "8px 12px", background: "#fff", borderBottom: `1px solid ${COLORS.line}`, fontSize: 13, color: COLORS.textMuted, fontWeight: 600 }}>{year}</div>

                        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                          {items.map((r) => {
                            const c = conflicts[r.leave_date];
                            const othersApproved = (c?.approved || []).filter((p) => p.id !== r.personnel?.id);
                            const othersRequested = (c?.requested || []).filter((p) => p.id !== r.personnel?.id);
                            const apprLine = othersApproved.length > 0 ? `${othersApproved[0].name}${othersApproved.length > 1 ? ` (+${othersApproved.length - 1})` : ""} heeft op dezelfde dag verlof` : null;
                            const reqLine = othersRequested.length > 0 ? `${othersRequested[0].name}${othersRequested.length > 1 ? ` (+${othersRequested.length - 1})` : ""} heeft voor dezelfde dag verlof aangevraagd` : null;
                            const hasConflict = !!(apprLine || reqLine);

                            const entValue = editedEntitlements[r.id] ?? r.entitlement ?? "";
                            const entOptions: string[] = Array.from(new Set((entValue ? [entValue] : []).concat(entitlementOptions)));
                            const daypartValue = editedDayparts[r.id] ?? canonicalDaypartLabel(r.daypart);

                            return (
                              <li
                                key={r.id}
                                style={{
                                  display: "grid",
                                  // ← kolombreedtes (Openstaande): checkbox | datum | daypart | entitlement
                                  gridTemplateColumns: "20px 75px 115px 110px",
                                  alignItems: "center",
                                  gap: 10,
                                  padding: "10px 12px",
                                  borderBottom: `1px dashed ${COLORS.line}`,
                                }}
                              >
                                <input type="checkbox" checked={selectedIds.has(r.id)} onChange={() => toggleSelect(r.id)} aria-label="selecteer" style={{ width: 18, height: 18 }} />

                                {/* Datum */}
                                <div style={{ fontSize: 15, color: COLORS.text }}>{formatDateShort(r.leave_date)}</div>

                                {/* Daypart dropdown (wegschrijven bij Goedkeuren) */}
                                <div>
                                  <select
                                    value={daypartValue}
                                    onChange={(e) => setEditedDayparts((prev) => ({ ...prev, [r.id]: e.target.value as "hele dag" | "voormiddag" | "namiddag" }))}
                                    style={{ width: "100%", padding: "6px 8px", borderRadius: 8, border: `1px solid ${COLORS.line}`, background: "#fff", fontSize: 14, color: COLORS.text, height: 32 }}
                                    aria-label="Daypart kiezen"
                                  >
                                    <option value="hele dag">Hele dag</option>
                                    <option value="voormiddag">Voormiddag</option>
                                    <option value="namiddag">Namiddag</option>
                                  </select>
                                </div>

                                {/* Entitlement dropdown (wegschrijven bij Goedkeuren) */}
                                <div>
                                  <select
                                    value={entValue}
                                    onChange={(e) => setEditedEntitlements((prev) => ({ ...prev, [r.id]: e.target.value || null }))}
                                    style={{ width: "100%", padding: "6px 8px", borderRadius: 8, border: `1px solid ${COLORS.line}`, background: "#fff", fontSize: 14, color: COLORS.text, height: 32 }}
                                    aria-label="Entitlement kiezen"
                                  >
                                    <option value="">—</option>
                                    {entOptions.map((opt) => (
                                      <option key={opt} value={opt}>{opt.charAt(0).toUpperCase() + opt.slice(1)}</option>
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
                    ))}
                  </div>
                ))}
              </div>
            )}

            {/* Actieknoppen */}
            <div style={{ display: "flex", gap: 8, marginTop: 4, justifyContent: "flex-end" }}>
              <button
                onClick={() => batchUpdateSelected("rejected")}
                disabled={selectedIds.size === 0 || loading}
                className={titleFont.className}
                style={{ padding: "10px 14px", background: "#ffffff", border: `1px solid ${HEADER_BTN.border}`, borderRadius: 999, cursor: selectedIds.size === 0 || loading ? "not-allowed" : "pointer", fontWeight: 800, fontSize: 14, letterSpacing: 0.2, minWidth: 120 }}
                onMouseOver={(e) => (e.currentTarget.style.background = HEADER_BTN.hover)}
                onMouseOut={(e) => (e.currentTarget.style.background = "#ffffff")}
              >
                Afkeuren
              </button>

              <button
                onClick={() => batchUpdateSelected("approved")}
                disabled={selectedIds.size === 0 || loading}
                className={titleFont.className}
                style={{ padding: "10px 14px", background: selectedIds.size === 0 || loading ? "#94d6d7" : COLORS.btnBg, color: COLORS.btnText, border: `1px solid ${COLORS.btnBorder}`, borderRadius: 999, cursor: selectedIds.size === 0 || loading ? "not-allowed" : "pointer", fontWeight: 900, fontSize: 14, letterSpacing: 0.2, minWidth: 120 }}
                onMouseOver={(e) => { if (!(selectedIds.size === 0 || loading)) e.currentTarget.style.background = COLORS.btnHover; }}
                onMouseOut={(e) => { if (!(selectedIds.size === 0 || loading)) e.currentTarget.style.background = COLORS.btnBg; }}
              >
                Goedkeuren
              </button>
            </div>
          </div>

          {/* ===== Rechts: Per persoon (BREED) ===== */}
          <div
            style={{
              width: "min(560px, 100%)",   // ▼ breder gemaakt
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
              {selectedPerson && (
                <span title="Holiday teller" style={{ fontSize: 12, border: `1px solid ${COLORS.btnBorder}`, padding: "4px 8px", borderRadius: 999, background: "#fff", justifySelf: "end", whiteSpace: "nowrap" }}>
                  {tellerLabel(selectedPerson.holiday_teller)}
                </span>
              )}
            </div>

            {/* Dropdown + jaarpijlen */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto", alignItems: "end", gap: 10, marginTop: 2 }}>
              <div>
                <label style={{ fontSize: 13, color: COLORS.textMuted, display: "block", marginBottom: 6 }}>Kies medewerker</label>
                <select value={selectedPersonId} onChange={(e) => setSelectedPersonId(e.target.value)} style={{ width: "100%", padding: "8px 10px", borderRadius: 10, border: `1px solid ${COLORS.line}`, background: "#fff", height: 36 }}>
                  <option value="">— Selecteer —</option>
                  {people.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
                </select>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, height: 36 }}>
                <button
                  onClick={() => setPersonYear((y) => y - 1)}
                  aria-label={`Ga naar ${personYear - 1}`}
                  className={titleFont.className}
                  style={{ padding: "6px 10px", background: HEADER_BTN.bg, border: `1px solid ${HEADER_BTN.border}`, borderRadius: 999, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, fontWeight: 900, fontSize: 14, letterSpacing: 0.2 }}
                  onMouseOver={(e) => (e.currentTarget.style.background = HEADER_BTN.hover)}
                  onMouseOut={(e) => (e.currentTarget.style.background = HEADER_BTN.bg)}
                >
                  <IconChevronLeft />
                </button>
                <span className={titleFont.className} style={{ fontSize: 16, fontWeight: 900, minWidth: 52, textAlign: "center" }}>{personYear}</span>
                <button
                  onClick={() => setPersonYear((y) => y + 1)}
                  aria-label={`Ga naar ${personYear + 1}`}
                  className={titleFont.className}
                  style={{ padding: "6px 10px", background: HEADER_BTN.bg, border: `1px solid ${HEADER_BTN.border}`, borderRadius: 999, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, fontWeight: 900, fontSize: 14, letterSpacing: 0.2 }}
                  onMouseOver={(e) => (e.currentTarget.style.background = HEADER_BTN.hover)}
                  onMouseOut={(e) => (e.currentTarget.style.background = HEADER_BTN.bg)}
                >
                  <IconChevronRight />
                </button>
              </div>
            </div>

            {selectedPersonId && (
              <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 12 }}>
                {/* Goedgekeurd (inline edit) */}
                <section>
                  <div style={{ background: "#fff", border: `1px solid ${COLORS.line}`, borderRadius: 10, overflow: "hidden" }}>
                    <div style={{ padding: "10px 12px", background: COLORS.card, borderBottom: `1px solid ${COLORS.line}`, fontWeight: 700, fontSize: 14 }}>
                      Goedgekeurd
                    </div>

                    {personApproved.length === 0 ? (
                      <div style={{ color: COLORS.textMuted, padding: "10px 12px" }}>Nog geen verlof.</div>
                    ) : (
                      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                        {personApproved.map((r) => {
                          const isEditing = editingApprovedId === r.id;
                          return (
                            <li
                              key={r.id}
                              onMouseEnter={() => setHoverApprovedId(r.id)}
                              onMouseLeave={() => setHoverApprovedId(null)}
                              style={{
                                display: "grid",
                                // ← kolombreedtes (Per persoon > Goedgekeurd): spacer | datum | daypart | entitlement | icoonvak
                                gridTemplateColumns: "5px 85px 110px 110px 60px",
                                alignItems: "center",
                                gap: 10,
                                padding: "10px 12px",
                                borderBottom: `1px dashed ${COLORS.line}`,
                                fontSize: 15,
                              }}
                            >
                              <div /> {/* spacer */}

                              {/* Datum */}
                              <div style={{ textAlign: "left" }}>
                                {isEditing ? (
                                  <input
                                    type="date"
                                    value={approvedEditValues.leave_date}
                                    onChange={(e) => setApprovedEditValues((prev) => ({ ...prev, leave_date: e.target.value }))}
                                    style={{ width: "100%", padding: "6px 8px", borderRadius: 8, border: `1px solid ${COLORS.line}`, background: "#fff", fontSize: 14, color: COLORS.text, height: 32 }}
                                  />
                                ) : (
                                  formatDateShort(r.leave_date)
                                )}
                              </div>

                              {/* Daypart */}
                              <div style={{ color: COLORS.textMuted, textAlign: "center" }}>
                                {isEditing ? (
                                  <select
                                    value={approvedEditValues.daypart}
                                    onChange={(e) => setApprovedEditValues((prev) => ({ ...prev, daypart: e.target.value as "hele dag" | "voormiddag" | "namiddag" }))}
                                    style={{ width: "100%", padding: "6px 8px", borderRadius: 8, border: `1px solid ${COLORS.line}`, background: "#fff", fontSize: 14, color: COLORS.text, height: 32 }}
                                  >
                                    <option value="hele dag">Hele dag</option>
                                    <option value="voormiddag">Voormiddag</option>
                                    <option value="namiddag">Namiddag</option>
                                  </select>
                                ) : (
                                  formatDaypart(r.daypart)
                                )}
                              </div>

                              {/* Entitlement */}
                              <div style={{ color: COLORS.textMuted, textAlign: "center" }}>
                                {isEditing ? (
                                  <select
                                    value={approvedEditValues.entitlement ?? ""}
                                    onChange={(e) => setApprovedEditValues((prev) => ({ ...prev, entitlement: e.target.value || null }))}
                                    style={{ width: "100%", padding: "6px 8px", borderRadius: 8, border: `1px solid ${COLORS.line}`, background: "#fff", fontSize: 14, color: COLORS.text, height: 32 }}
                                  >
                                    <option value="">—</option>
                                    {Array.from(new Set([r.entitlement ?? "", ...entitlementOptions].filter(Boolean))).map((opt) => (
                                      <option key={String(opt)} value={String(opt)}>
                                        {String(opt).charAt(0).toUpperCase() + String(opt).slice(1)}
                                      </option>
                                    ))}
                                  </select>
                                ) : (
                                  formatEntitlement(r.entitlement)
                                )}
                              </div>

                              {/* Acties */}
                              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                                {isEditing ? (
                                  <>
                                    <span title="Bewaren" onClick={() => saveEditApproved(r.id)} style={{ width: 24, height: 24, display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                                      <IconSave />
                                    </span>
                                    <span title="Verwijderen" onClick={() => deleteApproved(r.id)} style={{ width: 24, height: 24, display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                                      <IconTrash />
                                    </span>
                                  </>
                                ) : (
                                  <span
                                    title="Aanpassen"
                                    onClick={() => startEditApproved(r)}
                                    style={{
                                      width: 24, height: 24,
                                      display: hoverApprovedId === r.id ? "inline-flex" : "none",
                                      alignItems: "center", justifyContent: "center", cursor: "pointer",
                                    }}
                                  >
                                    <IconPencil />
                                  </span>
                                )}
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                </section>

                {/* Aangevraagd (kop zonder Daypart/Entitlement labels) */}
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
                            style={{
                              display: "grid",
                              // ← kolombreedtes (Per persoon > Aangevraagd): spacer | datum | daypart | entitlement | icoonvak (leeg)
                              gridTemplateColumns: "5px 85px 110px 110px 60px",
                              alignItems: "center",
                              gap: 10,
                              padding: "10px 12px",
                              borderBottom: `1px dashed ${COLORS.line}`,
                              fontSize: 15,
                            }}
                          >
                            <div />
                            <div>{formatDateShort(r.leave_date)}</div>
                            <div style={{ color: COLORS.textMuted, textAlign: "center" }}>{formatDaypart(r.daypart)}</div>
                            <div style={{ color: COLORS.textMuted, textAlign: "center" }}>{formatEntitlement(r.entitlement)}</div>
                            <div />
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

/* Voorkom prerender-fouten wanneer hooks in client children gebruikt worden */
export const dynamic = "force-dynamic";
