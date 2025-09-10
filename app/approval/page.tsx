"use client"

import React, { useEffect, useMemo, useState } from "react"
import localFont from "next/font/local"
import { supabase } from "@/lib/supabaseClient"
import FloatingNav from "../components/FloatingNav" // zwevende navigatie

/* ========= Instelbare vaste offset (px) onder de FloatingNav ========= */
const FLOATING_NAV_OFFSET = 70

/* ========= Fonts & Kleuren ========= */
const variableFont = localFont({ src: "../fonts/Font_Variable.otf", display: "swap" })
const titleFont = localFont({ src: "../fonts/Font_VariableBold.otf", display: "swap" })

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
}
const HEADER_BTN = { bg: "#ffffff", border: "#d1d5db", hover: "#f3f4f6" }
const DAYPART_COL_W = 120

/* ===== Icons ===== */
function IconChevronLeft({ color = COLORS.primary, size = 20 }: { color?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="15 6 9 12 15 18" />
    </svg>
  )
}
function IconChevronRight({ color = COLORS.primary, size = 20 }: { color?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="9 6 15 12 9 18" />
    </svg>
  )
}

/* ========= Types ========= */
type Personnel = {
  id: string
  name: string
  holiday_teller?: number | null // uren
  avatar_url?: string | null
}
type PersonRef = { id: string; name: string }

type LeaveRequest = {
  id: string
  personnel_id: string | null
  leave_date: string
  status: string
  daypart: string | null
  personnel?: Personnel | null
}

/** Ruwe join row van Supabase (kan array/object zijn bij `personnel`) */
type RawJoinedRow = {
  id: string
  personnel_id?: string | null
  leave_date: string
  status: string
  daypart?: string | null
  personnel?: any // kan array of object zijn
}

/* ========= Helpers ========= */
function formatDaypart(dp: string | null) {
  if (!dp) return "hele dag"
  const v = dp.toLowerCase()
  if (v.includes("morning") || v.includes("voor")) return "voormiddag"
  if (v.includes("afternoon") || v.includes("na")) return "namiddag"
  return dp
}

const DOW = ["zo", "ma", "di", "woe", "do", "vr", "za"] as const
const MON_ABBR = ["jan", "febr", "mrt", "apr", "mei", "jun", "jul", "aug", "sept", "okt", "nov", "dec"] as const
function formatDatePretty(iso: string) {
  const d = new Date(iso + "T00:00:00")
  const wd = DOW[d.getDay()]
  const day = d.getDate()
  const mon = MON_ABBR[d.getMonth()]
  const y2 = String(d.getFullYear()).slice(-2)
  return `${wd} ${day} ${mon} '${y2}`
}

function tellerLabel(hours?: number | null) {
  const h = Number.isFinite(hours as number) ? (hours as number) : 0
  const daysStr = new Intl.NumberFormat("nl-BE", { maximumFractionDigits: 1 }).format(h / 8)
  return `Teller: ${h} uren (${daysStr} dagen)`
}

function normalizePersonnel(p: any): Personnel | null {
  if (!p) return null
  // Supabase kan array retourneren; pak eerste item
  const obj = Array.isArray(p) ? p[0] : p
  if (!obj) return null
  return {
    id: obj.id,
    name: obj.name,
    holiday_teller: obj.holiday_teller ?? null,
    avatar_url: obj.avatar_url ?? null,
  }
}

function normalizeRequests(rows: RawJoinedRow[]): LeaveRequest[] {
  return (rows || []).map((r) => ({
    id: r.id,
    personnel_id: r.personnel_id ?? null,
    leave_date: r.leave_date,
    status: r.status,
    daypart: r.daypart ?? null,
    personnel: normalizePersonnel(r.personnel),
  }))
}

/* ========= Pagina ========= */
export default function ApprovalPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Card 1
  const [requests, setRequests] = useState<LeaveRequest[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [conflicts, setConflicts] = useState<
    Record<string, { approved: PersonRef[]; requested: PersonRef[] }>
  >({})

  // Card 2
  const [people, setPeople] = useState<Personnel[]>([])
  const [selectedPersonId, setSelectedPersonId] = useState<string>("")
  const [personYear, setPersonYear] = useState<number>(new Date().getFullYear())
  const [personRequests, setPersonRequests] = useState<LeaveRequest[]>([])

  const personRequested = useMemo(
    () => personRequests.filter(r => r.status === "requested"),
    [personRequests]
  )
  const personApproved = useMemo(
    () => personRequests.filter(r => r.status === "approved"),
    [personRequests]
  )
  const selectedPerson = useMemo(
    () => people.find(p => p.id === selectedPersonId) || null,
    [people, selectedPersonId]
  )

  // Groeperen per personeelslid (Card 1)
  const groupedByPerson = useMemo(() => {
    const map = new Map<string, { person: Personnel; items: LeaveRequest[] }>()
    for (const r of requests) {
      const p = r.personnel
      const key = p?.id || "onbekend"
      if (!map.has(key)) {
        map.set(key, {
          person: {
            id: p?.id || "?",
            name: p?.name || "Onbekend",
            holiday_teller: p?.holiday_teller ?? null,
            avatar_url: p?.avatar_url ?? null,
          },
          items: [],
        })
      }
      map.get(key)!.items.push(r)
    }
    return Array.from(map.values()).sort((a, b) => a.person.name.localeCompare(b.person.name))
  }, [requests])

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function loadConflictsForDates(dates: string[]) {
    if (!dates.length) { setConflicts({}); return }
    try {
      const { data, error } = await supabase
        .from("leave_requests")
        .select("leave_date, status, personnel:personnel_id (id, name)")
        .in("leave_date", dates)
        .in("status", ["approved", "requested"])
      if (error) throw error

      const map: Record<string, { approved: PersonRef[]; requested: PersonRef[] }> = {}
      for (const row of (data || []) as any[]) {
        const d = row.leave_date as string
        const status = row.status as "approved" | "requested"
        const personObj = normalizePersonnel(row.personnel)
        if (!map[d]) map[d] = { approved: [], requested: [] }
        if (personObj) map[d][status].push({ id: personObj.id, name: personObj.name })
      }
      setConflicts(map)
    } catch (e) {
      console.error("conflict-fetch failed", e)
      setConflicts({})
    }
  }

  async function loadInitial() {
    setLoading(true)
    setError(null)
    try {
      // Belangrijk: personnel_id selecteren en personnel normaliseren
      const { data: reqs, error: reqErr } = await supabase
        .from("leave_requests")
        .select(`
          id,
          personnel_id,
          leave_date,
          status,
          daypart,
          personnel:personnel_id (
            id,
            name,
            holiday_teller,
            avatar_url
          )
        `)
        .eq("status", "requested")
        .order("leave_date", { ascending: true })
      if (reqErr) throw reqErr

      const reqList = normalizeRequests((reqs || []) as RawJoinedRow[])
      setRequests(reqList)

      const dates = Array.from(new Set(reqList.map(r => r.leave_date)))
      await loadConflictsForDates(dates)

      const { data: ppl, error: pplErr } = await supabase
        .from("personnel")
        .select("id, name, holiday_teller, avatar_url")
        .order("name", { ascending: true })
      if (pplErr) throw pplErr
      setPeople((ppl || []) as Personnel[])
    } catch (e: any) {
      setError(e?.message ?? "Er ging iets mis bij laden.")
    } finally {
      setLoading(false)
    }
  }

  async function loadPersonRequests(personId: string, year: number) {
    if (!personId) { setPersonRequests([]); return }
    setError(null)
    try {
      const from = `${year}-01-01`
      const to = `${year + 1}-01-01`
      const { data, error: prErr } = await supabase
        .from("leave_requests")
        .select("id, leave_date, status, daypart")
        .eq("personnel_id", personId)
        .gte("leave_date", from)
        .lt("leave_date", to)
        .in("status", ["requested", "approved"])
        .order("leave_date", { ascending: true })
      if (prErr) throw prErr

      const mapped: LeaveRequest[] = (data || []).map((r: any) => ({
        id: r.id,
        personnel_id: personId,         // we weten dit hier al
        leave_date: r.leave_date,
        status: r.status,
        daypart: r.daypart ?? null,
        personnel: null,
      }))
      setPersonRequests(mapped)
    } catch (e: any) {
      setError(e?.message ?? "Kon verlofdagen niet laden.")
    }
  }

  async function batchUpdateSelected(nextStatus: "approved" | "rejected") {
    const ids = Array.from(selectedIds)
    if (ids.length === 0) return
    setError(null)
    try {
      const { error: upErr } = await supabase
        .from("leave_requests")
        .update({ status: nextStatus })
        .in("id", ids)
      if (upErr) throw upErr
      setSelectedIds(new Set())
      await loadInitial()
      if (selectedPersonId) await loadPersonRequests(selectedPersonId, personYear)
    } catch (e: any) {
      setError(e?.message ?? "Updaten mislukt.")
    }
  }

  useEffect(() => { loadInitial() }, [])
  useEffect(() => { if (selectedPersonId) loadPersonRequests(selectedPersonId, personYear) }, [selectedPersonId, personYear])

  /* ======== UI ======== */
  return (
    <>
      <FloatingNav /> {/* zwevende navigatie linksboven */}
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
            gridTemplateColumns: "minmax(0, 410px) minmax(0, 432px)",
            justifyContent: "center",
            justifyItems: "center",
            columnGap: "1%",
            rowGap: 12,
            marginTop: `${FLOATING_NAV_OFFSET}px`, // vaste ruimte onder FloatingNav
          }}
        >
          {/* ===== Links: Openstaande aanvragen (gegroepeerd) ===== */}
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
            ) : groupedByPerson.length === 0 ? (
              <div style={{ color: COLORS.textMuted }}>Geen aanvragen.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {groupedByPerson.map(({ person, items }) => (
                  <div
                    key={person.id}
                    style={{
                      background: "#fff",
                      border: `1px solid ${COLORS.line}`,
                      borderRadius: 10,
                      overflow: "hidden",
                    }}
                  >
                    {/* Kop per persoon + avatar + teller */}
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "10px 12px",
                        background: COLORS.card,
                        borderBottom: `1px solid ${COLORS.line}`,
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        {/* kleine avatar */}
                        {person.avatar_url ? (
                          <img
                            src={person.avatar_url}
                            alt={person.name}
                            style={{
                              width: 18,
                              height: 18,
                              borderRadius: 999,
                              objectFit: "cover",
                              flex: "0 0 18px",
                            }}
                          />
                        ) : (
                          <div
                            aria-hidden
                            style={{
                              width: 18,
                              height: 18,
                              borderRadius: 999,
                              background: "#e2e8f0",
                              flex: "0 0 18px",
                            }}
                          />
                        )}
                        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                          <strong style={{ fontSize: 15 }}>{person.name}</strong>
                          <span style={{ color: COLORS.textMuted, fontSize: 13 }}>
                            ({items.length} aanvragen)
                          </span>
                        </div>
                      </div>

                      <span
                        title="Holiday teller"
                        style={{
                          fontSize: 12,
                          border: `1px solid ${COLORS.btnBorder}`,
                          padding: "4px 8px",
                          borderRadius: 999,
                          background: "#fff",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {tellerLabel(person.holiday_teller)}
                      </span>
                    </div>

                    {/* Lijst: checkbox | datum(+conflict) | daypart */}
                    <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                      {items.map((r) => {
                        const c = conflicts[r.leave_date]
                        const othersApproved = (c?.approved || []).filter(p => p.id !== r.personnel?.id)
                        const othersRequested = (c?.requested || []).filter(p => p.id !== r.personnel?.id)
                        const apprLine =
                          othersApproved.length > 0
                            ? `${othersApproved[0].name}${othersApproved.length > 1 ? ` (+${othersApproved.length - 1})` : ""} heeft op dezelfde dag verlof`
                            : null
                        const reqLine =
                          othersRequested.length > 0
                            ? `${othersRequested[0].name}${othersRequested.length > 1 ? ` (+${othersRequested.length - 1})` : ""} heeft voor dezelfde dag verlof aangevraagd`
                            : null

                        return (
                          <li
                            key={r.id}
                            style={{
                              display: "grid",
                              gridTemplateColumns: `24px 1fr ${DAYPART_COL_W}px`,
                              alignItems: "center",
                              gap: 10,
                              padding: "10px 12px",
                              borderBottom: `1px dashed ${COLORS.line}`,
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={selectedIds.has(r.id)}
                              onChange={() => toggleSelect(r.id)}
                              aria-label="selecteer"
                              style={{ width: 18, height: 18 }}
                            />
                            <div style={{ fontSize: 15, color: COLORS.text }}>
                              <div>{formatDatePretty(r.leave_date)}</div>
                              {(apprLine || reqLine) && (
                                <div style={{ color: "#b91c1c", fontSize: 12, marginTop: 2 }}>
                                  {apprLine && <div>{apprLine}</div>}
                                  {reqLine && <div>{reqLine}</div>}
                                </div>
                              )}
                            </div>
                            <div style={{ fontSize: 14, color: COLORS.textMuted }}>
                              {formatDaypart(r.daypart)}
                            </div>
                          </li>
                        )
                      })}
                    </ul>
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
                  background: (selectedIds.size === 0 || loading) ? "#94d6d7" : COLORS.btnBg,
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
                  if (!(selectedIds.size === 0 || loading)) e.currentTarget.style.background = COLORS.btnHover
                }}
                onMouseOut={(e) => {
                  if (!(selectedIds.size === 0 || loading)) e.currentTarget.style.background = COLORS.btnBg
                }}
              >
                Goedkeuren
              </button>
            </div>
          </div>

          {/* ===== Rechts: Per persoon ===== */}
          <div
            style={{
              width: "min(432px, 100%)",
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
                <span
                  title="Holiday teller"
                  style={{
                    fontSize: 12,
                    border: `1px solid ${COLORS.btnBorder}`,
                    padding: "4px 8px",
                    borderRadius: 999,
                    background: "#fff",
                    justifySelf: "end",
                    whiteSpace: "nowrap",
                  }}
                >
                  {tellerLabel(selectedPerson.holiday_teller)}
                </span>
              )}
            </div>

            {/* Dropdown + compacte jaarpijlen */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr auto",
                alignItems: "end",
                gap: 10,
                marginTop: 2,
              }}
            >
              <div>
                <label style={{ fontSize: 13, color: COLORS.textMuted, display: "block", marginBottom: 6 }}>
                  Kies medewerker
                </label>
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
                  <option value="">— Selecteer —</option>
                  {people.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 6, height: 36 }}>
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
            </div>

            {selectedPersonId && (
              <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 12 }}>
                {/* Goedgekeurd (zonder daypart-kolom) */}
                <section>
                  <div
                    style={{
                      background: "#fff",
                      border: `1px solid ${COLORS.line}`,
                      borderRadius: 10,
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: `1fr`,
                        gap: 10,
                        alignItems: "center",
                        padding: "10px 12px",
                        background: COLORS.card,
                        borderBottom: `1px solid ${COLORS.line}`,
                        fontWeight: 700,
                        fontSize: 14,
                      }}
                    >
                      <div>Goedgekeurd</div>
                    </div>

                    {personApproved.length === 0 ? (
                      <div style={{ color: COLORS.textMuted, padding: "10px 12px" }}>Nog geen verlof.</div>
                    ) : (
                      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                        {personApproved.map((r) => (
                          <li
                            key={r.id}
                            style={{
                              display: "grid",
                              gridTemplateColumns: `1fr`, // alleen datum
                              alignItems: "center",
                              gap: 10,
                              padding: "10px 12px",
                              borderBottom: `1px dashed ${COLORS.line}`,
                              fontSize: 15,
                            }}
                          >
                            <div>{formatDatePretty(r.leave_date)}</div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </section>

                {/* Aangevraagd (zonder daypart-kolom) */}
                {personRequested.length > 0 && (
                  <section>
                    <div
                      style={{
                        background: "#fff",
                        border: `1px solid ${COLORS.line}`,
                        borderRadius: 10,
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: `1fr`,
                          gap: 10,
                          alignItems: "center",
                          padding: "10px 12px",
                          background: COLORS.card,
                          borderBottom: `1px solid ${COLORS.line}`,
                          fontWeight: 700,
                          fontSize: 14,
                        }}
                      >
                        <div>Aangevraagd</div>
                      </div>

                      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                        {personRequested.map((r) => (
                          <li
                            key={r.id}
                            style={{
                              display: "grid",
                              gridTemplateColumns: `1fr`, // alleen datum
                              alignItems: "center",
                              gap: 10,
                              padding: "10px 12px",
                              borderBottom: `1px dashed ${COLORS.line}`,
                              fontSize: 15,
                            }}
                          >
                            <div>{formatDatePretty(r.leave_date)}</div>
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
  )
}
