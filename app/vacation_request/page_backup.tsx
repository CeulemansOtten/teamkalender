"use client"

import React, { useEffect, useMemo, useState } from "react"
import localFont from "next/font/local"
import { useSearchParams } from "next/navigation"
import { supabase } from "@/lib/supabaseClient"

// Fonts
const monthFont = localFont({ src: "../fonts/Font_Variable.otf", display: "swap" })
const titleFont = localFont({ src: "../fonts/Font_VariableBold.otf", display: "swap" })

const COLORS = {
  bg: "#ffffff",
  card: "#f7f9fb",
  line: "#e5e7eb",
  text: "#0f172a",
  textMuted: "#475569",
  primary: "#0ea5a8",        // accentgroen
  weekendBg: "#eef2f7",
  btnBg: "#ffffff",
  btnBorder: "#d1d5db",
  btnHover: "#f3f4f6",
  schoolBg: "#FFF9C4",
  publicBg: "#FDE68A",
  dayHoverBg: "#FEE2E2",
  daySelectedBg: "#FECACA",

  // randen
  applyBorder: "#B91C1C",    // donkerrood voor "verlof aanvragen"
}

// Zelfde kleur voor approved én requested-strepen
const LEAVE_COLOR = "#C3E8E9"

const MONTHS_NL = [
  "januari","februari","maart","april","mei","juni","juli","augustus","september","oktober","november","december",
]
const DOW_NL = ["ma","di","wo","do","vr","za","zo"]

/* ===== Icons ===== */
function IconChevronLeft({ color = COLORS.primary, size = 22 }: { color?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="15 6 9 12 15 18" />
    </svg>
  )
}
function IconChevronRight({ color = COLORS.primary, size = 22 }: { color?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="9 6 15 12 9 18" />
    </svg>
  )
}

/* ===== Helpers ===== */
function daysInMonth(year: number, month0: number) { return new Date(year, month0 + 1, 0).getDate() }
function buildMonthMatrix(year: number, month0: number) {
  const totalDays = daysInMonth(year, month0)
  const firstDayIdxMonStart = (new Date(year, month0, 1).getDay() + 6) % 7
  const cells: (number | null)[] = []
  for (let i = 0; i < firstDayIdxMonStart; i++) cells.push(null)
  for (let d = 1; d <= totalDays; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)
  const weeks: (number | null)[][] = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))
  return weeks
}
function pad2(n: number) { return n < 10 ? `0${n}` : `${n}` }
function ymd(year: number, month0: number, day: number) { return `${year}-${pad2(month0 + 1)}-${pad2(day)}` }

/* ===== 4-staps selectie (nieuwe aanvraag) ===== */
type SelState = "none" | "full" | "am" | "pm"
function nextState(s: SelState): SelState { return s === "none" ? "full" : s === "full" ? "am" : s === "am" ? "pm" : "none" }
function nextBadge(s: SelState) {
  const nx = nextState(s)
  if (nx === "full") return "+"
  if (nx === "am") return "VM"
  if (nx === "pm") return "NM"
  return "×"
}

/* ===== Bestaande leave overlay types ===== */
type PartStatus = "requested" | "approved" | undefined
type ExistingByDate = Record<string, { am?: PartStatus; pm?: PartStatus }>

/* ===== Dag-cel ===== */
type HoverMode = "interactive" | "x-only" | "none"

function DayCell({
  day, bg, label,
  hoverMode,
  state,
  onCycle,
  existing,
  onXToggle,
  withdrawSelected,
}: {
  day: number | null
  bg: string
  label?: string
  hoverMode: HoverMode
  state: SelState
  onCycle?: () => void
  existing?: { am?: PartStatus; pm?: PartStatus }
  onXToggle?: () => void
  withdrawSelected?: boolean
}) {
  const [hover, setHover] = useState(false)
  const isInteractive = hoverMode === "interactive"
  const showHover = !!day && hoverMode !== "none"

  const hoverBg = isInteractive && hover && state === "none" && !existing ? COLORS.dayHoverBg : bg

  function renderOverlayHalf(which: "am" | "pm", status: PartStatus) {
    const styleBase: React.CSSProperties = {
      position: "absolute",
      left: 0,
      right: 0,
      height: "50%",
      background: "transparent",
      pointerEvents: "none",
      borderRadius: 8,
    }
    if (which === "am") Object.assign(styleBase, { top: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 0 })
    if (which === "pm") Object.assign(styleBase, { bottom: 0, borderTopLeftRadius: 0, borderTopRightRadius: 0 })

    if (status === "approved") {
      styleBase.background = LEAVE_COLOR
    } else if (status === "requested") {
      styleBase.background = `repeating-linear-gradient(
        45deg,
        ${LEAVE_COLOR} 0,
        ${LEAVE_COLOR} 8px,
        #ffffff 8px,
        #ffffff 16px
      )`
    } else {
      return null
    }
    return <div key={`${which}-${status}`} style={styleBase} />
  }

  const showFullNew = state === "full" && !existing
  const showAmNew  = state === "am" && !(existing && existing.am)
  const showPmNew  = state === "pm" && !(existing && existing.pm)

  const bothRequested = existing?.am === "requested" && existing?.pm === "requested"
  const bothApproved  = existing?.am === "approved"  && existing?.pm === "approved"

  // --- Rand (altijd rond hele cel) ---
  const hasNewSelection = state !== "none"
  const hasExisting = !!(existing?.am || existing?.pm)

  let borderColor = COLORS.line
  let borderWidth = 1
  if (hasNewSelection) {
    borderColor = COLORS.applyBorder   // donkerrood bij "verlof aanvragen"
    borderWidth = 2
  } else if (withdrawSelected) {
    borderColor = COLORS.primary       // groen bij "intrekken"-selectie
    borderWidth = 2
  } else if (hasExisting) {
    borderColor = COLORS.line
    borderWidth = 1
  }

  return (
    <div
      title={label}
      aria-label={label}
      onMouseEnter={() => showHover && setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={() => { if (isInteractive && day && onCycle) onCycle() }}
      role={isInteractive ? "button" : undefined}
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
        color: "#000", // cijfers altijd zwart
        opacity: day ? 1 : 0.55,
        userSelect: "none",
        transition: "background 120ms ease-in-out, border-color 120ms ease-in-out",
        cursor: isInteractive ? "pointer" : "default",
        overflow: "hidden",
      }}
    >
      {/* Bestaande overlays — hele dag */}
      {bothRequested && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: 8,
            pointerEvents: "none",
            background: `repeating-linear-gradient(
              45deg,
              ${LEAVE_COLOR} 0,
              ${LEAVE_COLOR} 8px,
              #ffffff 8px,
              #ffffff 16px
            )`,
          }}
        />
      )}
      {bothApproved && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: 8,
            pointerEvents: "none",
            background: LEAVE_COLOR,
          }}
        />
      )}

      {/* Bestaande overlays — halve dag */}
      {!bothRequested && !bothApproved && (
        <>
          {existing?.am && renderOverlayHalf("am", existing.am)}
          {existing?.pm && renderOverlayHalf("pm", existing.pm)}
        </>
      )}

      {/* Nieuwe (lokale) selectie overlays */}
      {showFullNew && (
        <div style={{ position: "absolute", inset: 0, background: COLORS.daySelectedBg, borderRadius: 8, pointerEvents: "none" }} />
      )}
      {showAmNew && (
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "50%", background: COLORS.daySelectedBg, borderTopLeftRadius: 8, borderTopRightRadius: 8, pointerEvents: "none" }} />
      )}
      {showPmNew && (
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "50%", background: COLORS.daySelectedBg, borderBottomLeftRadius: 8, borderBottomRightRadius: 8, pointerEvents: "none" }} />
      )}

      {/* dagnummer */}
      <span style={{ position: "relative", zIndex: 3 }}>
        {day ?? ""}
      </span>

      {/* Hover-badge */}
      {showHover && (
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
            transition: "opacity 120ms ease-in-out, background 120ms ease-in-out",
            cursor: "pointer",
            fontSize: 12, fontWeight: 800, color: COLORS.primary,
            zIndex: 4,
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = COLORS.btnHover)}
          onMouseLeave={(e) => (e.currentTarget.style.background = COLORS.btnBg)}
          onClick={(e) => {
            e.stopPropagation()
            if (hoverMode === "x-only") {
              onXToggle?.() // toggle multi-withdraw
            } else {
              onCycle?.()
            }
          }}
        >
          {hoverMode === "x-only" ? "×" : nextBadge(state)}
        </button>
      )}
    </div>
  )
}

/* ===== Maand ===== */
function MonthCalendar({
  year, month0, holidayTypes, selections, onCycleDate, existingByDate,
  withdrawSelections, onToggleWithdraw,
}: {
  year: number
  month0: number
  holidayTypes: Record<string, "school" | "public">
  selections: Record<string, SelState>
  onCycleDate: (key: string) => void
  existingByDate: ExistingByDate
  withdrawSelections: Record<string, boolean>
  onToggleWithdraw: (key: string) => void
}) {
  const weeks = buildMonthMatrix(year, month0)
  const monthName = MONTHS_NL[month0]

  return (
    <div style={{
      background: COLORS.card, border: `1px solid ${COLORS.line}`, borderRadius: 12, padding: 12,
      display: "flex", flexDirection: "column", gap: 8, minWidth: 260,
    }}>
      {/* titel */}
      <div style={{ display: "grid", gridTemplateColumns: "8px 1fr", alignItems: "center", columnGap: 8 }}>
        <div style={{ width: 8, height: 24, background: COLORS.primary, borderRadius: 4 }} />
        <h3 className={monthFont.className} style={{ margin: 0, color: COLORS.text, fontSize: 18, fontWeight: 600, textTransform: "capitalize" }}>
          {monthName} {year}
        </h3>
      </div>

      {/* weekdagen */}
      <div className={monthFont.className} style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, color: COLORS.textMuted, fontSize: 12, fontWeight: 600 }}>
        {DOW_NL.map((d, idx) => (
          <div key={d} style={{ textAlign: "center", padding: "6px 0", background: idx >= 5 ? COLORS.weekendBg : "transparent", borderRadius: 6 }}>
            {d}
          </div>
        ))}
      </div>

      {/* kalender-cellen */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {weeks.map((week, wi) => (
          <div key={wi} style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
            {week.map((day, di) => {
              const isWeekend = di === 5 || di === 6
              let baseBg = "#fff"
              let label: string | undefined
              let holidayType: "school" | "public" | undefined

              if (day) {
                const key = ymd(year, month0, day)
                holidayType = holidayTypes[key]
                if (holidayType === "school") {
                  baseBg = COLORS.schoolBg
                  label = "Schoolvakantie"
                } else if (holidayType === "public") {
                  baseBg = COLORS.publicBg
                  label = "Officiële feestdag"
                } else if (isWeekend) {
                  baseBg = COLORS.weekendBg
                }

                const existing = existingByDate[key]
                const hasExisting = !!(existing?.am || existing?.pm)
                const hoverMode: HoverMode =
                  holidayType === "public" || isWeekend ? "none"
                  : hasExisting ? "x-only"
                  : "interactive"

                const state: SelState = selections[key] ?? "none"

                if (hasExisting) {
                  const amTxt = existing?.am === "approved" ? "goedgekeurd" : existing?.am === "requested" ? "aangevraagd" : undefined
                  const pmTxt = existing?.pm === "approved" ? "goedgekeurd" : existing?.pm === "requested" ? "aangevraagd" : undefined
                  if (amTxt && pmTxt) label = `Voormiddag ${amTxt}, namiddag ${pmTxt}`
                  else if (amTxt)     label = `Voormiddag ${amTxt}`
                  else if (pmTxt)     label = `Namiddag ${pmTxt}`
                }

                const withdrawSelected = !!withdrawSelections[key]

                return (
                  <DayCell
                    key={di}
                    day={day}
                    bg={baseBg}
                    label={label}
                    hoverMode={hoverMode}
                    state={state}
                    existing={existing}
                    onCycle={() => onCycleDate(key)}
                    onXToggle={() => onToggleWithdraw(key)}
                    withdrawSelected={withdrawSelected}
                  />
                )
              }

              // lege cel
              return (
                <DayCell
                  key={di}
                  day={null}
                  bg={"#fff"}
                  label={undefined}
                  hoverMode={"none"}
                  state={"none"}
                />
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

/* ===== Page ===== */
export default function CalendarPage() {
  const search = useSearchParams()
  const personnelId = search.get("personnel_id")

  const [year, setYear] = useState(2025)
  const [personName, setPersonName] = useState<string>("…")
  const [holidayTypes, setHolidayTypes] = useState<Record<string, "school" | "public">>({})
  const [selections, setSelections] = useState<Record<string, SelState>>({})
  const [existingByDate, setExistingByDate] = useState<ExistingByDate>({})
  const [requesting, setRequesting] = useState(false)

  // Multi-select voor intrekken
  const [withdrawSelections, setWithdrawSelections] = useState<Record<string, boolean>>({})
  const [withdrawConfirm, setWithdrawConfirm] = useState(false)
  const [withdrawing, setWithdrawing] = useState(false)

  // Naam ophalen
  useEffect(() => {
    let active = true
    async function loadName() {
      if (!personnelId) { setPersonName("Onbekend"); return }
      const { data, error } = await supabase
        .from("personnel")
        .select("name")
        .eq("id", personnelId)
        .single()
      if (!active) return
      setPersonName(error ? "Onbekend" : (data?.name || "Onbekend"))
    }
    loadName()
    return () => { active = false }
  }, [personnelId])

  // Holidays ophalen
  useEffect(() => {
    let isMounted = true
    async function load() {
      const from = `${year}-01-01`
      const to = `${year + 1}-01-01`
      const { data, error } = await supabase
        .from("holidays")
        .select("holiday_date,type")
        .gte("holiday_date", from)
        .lt("holiday_date", to)

      if (error) {
        console.error("[holidays fetch]", error)
        if (isMounted) setHolidayTypes({})
        return
      }

      const map: Record<string, "school" | "public"> = {}
      for (const row of (data ?? []) as any[]) {
        if (row.type === "school" || row.type === "public") {
          map[row.holiday_date as string] = row.type
        }
      }
      if (isMounted) setHolidayTypes(map)
    }
    load()
    return () => { isMounted = false }
  }, [year])

  // Reset bevestigingsmodus als selectie leeg is
  useEffect(() => {
    if (Object.keys(withdrawSelections).length === 0) {
      setWithdrawConfirm(false)
    }
  }, [withdrawSelections])

  // Bestaande leaves ophalen (requested + approved) voor dit jaar en persoon
  async function fetchExisting() {
    if (!personnelId) { setExistingByDate({}); return }
    const from = `${year}-01-01`
    const to = `${year + 1}-01-01`

    const query = supabase
      .from("leave_requests")
      .select("leave_date,status,daypart")
      .eq("personnel_id", personnelId)
      .gte("leave_date", from)
      .lt("leave_date", to)
      .in("status", ["requested", "approved"])

    let { data, error } = await query
    if (error) { // fallback naar enkelvoudige tabel
      const alt = await supabase
        .from("leave_request")
        .select("leave_date,status,daypart")
        .eq("personnel_id", personnelId)
        .gte("leave_date", from)
        .lt("leave_date", to)
        .in("status", ["requested", "approved"])
      data = alt.data ?? null
      error = alt.error ?? null
    }
    if (error) {
      console.error("[leave(s) fetch]", error)
      setExistingByDate({})
      return
    }

    const map: ExistingByDate = {}
    const prefer = (prev: PartStatus, cur: PartStatus): PartStatus => {
      if (prev === "approved" || cur === "approved") return "approved"
      return prev || cur
    }

    for (const row of data ?? []) {
      const date = row.leave_date as string
      const status = (row.status as string) === "approved" ? "approved" : "requested"
      const part = (row.daypart as string) || "hele dag"
      if (!map[date]) map[date] = {}

      if (part === "hele dag") {
        map[date].am = prefer(map[date].am, status)
        map[date].pm = prefer(map[date].pm, status)
      } else if (part === "voormiddag") {
        map[date].am = prefer(map[date].am, status)
      } else if (part === "namiddag") {
        map[date].pm = prefer(map[date].pm, status)
      }
    }
    setExistingByDate(map)
  }

  useEffect(() => { fetchExisting() }, [personnelId, year])

  // Nieuwe aanvragen: 4-staps cycle (alleen op dagen zonder bestaande leave)
  const onCycleDate = (key: string) => {
    if (existingByDate[key]?.am || existingByDate[key]?.pm) return
    setSelections(prev => {
      const cur = (prev[key] ?? "none") as SelState
      const nx = nextState(cur)
      const next = { ...prev }
      if (nx === "none") delete next[key]
      else next[key] = nx
      return next
    })
  }

  // Toggle dag voor intrekken
  const onToggleWithdraw = (key: string) => {
    setWithdrawSelections(prev => {
      const next = { ...prev }
      if (next[key]) delete next[key]
      else next[key] = true
      return next
    })
  }

  // Teller voor aanvragen (full=1, VM/NM=0.5)
  const totalDays = useMemo(
    () => Object.values(selections).reduce((sum, s) => sum + (s === "full" ? 1 : 0.5), 0),
    [selections]
  )
  const totalDaysLabel = new Intl.NumberFormat("nl-BE", { minimumFractionDigits: 0, maximumFractionDigits: 1 }).format(totalDays)

  // Teller voor intrekken (tel per halve dag wat effectief bestaat)
  const withdrawTotal = useMemo(() => {
    return Object.keys(withdrawSelections).reduce((sum, key) => {
      const ex = existingByDate[key]
      if (!ex) return sum
      const halves = (ex.am ? 0.5 : 0) + (ex.pm ? 0.5 : 0)
      return sum + halves
    }, 0)
  }, [withdrawSelections, existingByDate])
  const withdrawTotalLabel = new Intl.NumberFormat("nl-BE", { minimumFractionDigits: 0, maximumFractionDigits: 1 }).format(withdrawTotal)

  const prev = () => setYear((y) => y - 1)
  const next = () => setYear((y) => y + 1)
  const prevYear = year - 1
  const nextYear = year + 1

  // Aanvraag wegschrijven — zonder extra popup
  const onRequestLeave = async () => {
    const entries = Object.entries(selections)
    if (!personnelId || entries.length === 0) return

    try {
      setRequesting(true)
      const rows = entries.map(([d, state]) => ({
        leave_date: d,
        status: "requested",
        personnel_id: personnelId,
        daypart:
          state === "full" ? "hele dag" :
          state === "am"   ? "voormiddag" :
                             "namiddag",
      }))
      const { error } = await supabase.from("leave_requests").insert(rows)
      if (error) throw error
      setSelections({})
      await fetchExisting()
    } catch (e: any) {
      try {
        const rows = Object.entries(selections).map(([d, state]) => ({
          leave_date: d, status: "requested", personnel_id: personnelId,
          daypart: state === "full" ? "hele dag" : state === "am" ? "voormiddag" : "namiddag",
        }))
        const { error: e2 } = await supabase.from("leave_request").insert(rows)
        if (e2) throw e2
        setSelections({})
        await fetchExisting()
      } catch (e3: any) {
        console.error("Kon verlof niet aanvragen:", e3?.message ?? e3)
      }
    } finally {
      setRequesting(false)
    }
  }

  // Intrekken: status -> removed (multi-dagen) — zonder extra popup
  const onWithdrawLeave = async () => {
    const dates = Object.keys(withdrawSelections)
    if (!personnelId || dates.length === 0) return
    try {
      setWithdrawing(true)
      let { error } = await supabase
        .from("leave_requests")
        .update({ status: "removed" })
        .eq("personnel_id", personnelId)
        .in("leave_date", dates)
        .in("status", ["requested", "approved"])

      if (error) {
        const alt = await supabase
          .from("leave_request")
          .update({ status: "removed" })
          .eq("personnel_id", personnelId)
          .in("leave_date", dates)
          .in("status", ["requested", "approved"])
        error = alt.error ?? null
      }
      if (error) throw error

      setWithdrawSelections({})
      setWithdrawConfirm(false)
      await fetchExisting()
    } catch (e: any) {
      console.error("Kon verlof niet intrekken:", e?.message ?? e)
    } finally {
      setWithdrawing(false)
    }
  }

  const selectionBarVisible = Object.keys(selections).length > 0
  const withdrawBarVisible = Object.keys(withdrawSelections).length > 0

  return (
    <main style={{ background: COLORS.bg, minHeight: "100vh", padding: 24, boxSizing: "border-box" }}>
      {/* Header met jaarnavigatie */}
      <header style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", marginBottom: 16, gap: 12 }}>
        <div>
          <button
            onClick={prev}
            aria-label={`Ga naar ${prevYear}`}
            className={titleFont.className}
            style={{
              padding: "8px 14px", background: COLORS.btnBg, border: `1px solid ${COLORS.btnBorder}`,
              borderRadius: 999, cursor: "pointer", minWidth: 130, display: "inline-flex",
              alignItems: "center", justifyContent: "center", gap: 10, fontWeight: 900, fontSize: 18, letterSpacing: 0.2,
              transition: "background 120ms ease-in-out",
            }}
            onMouseOver={(e) => (e.currentTarget.style.background = COLORS.btnHover)}
            onMouseOut={(e) => (e.currentTarget.style.background = COLORS.btnBg)}
          >
            <IconChevronLeft />
            <span>{prevYear}</span>
          </button>
        </div>

        <h1 className={titleFont.className} style={{ margin: 0, textAlign: "center", color: COLORS.text, fontSize: 28, fontWeight: 900, letterSpacing: 0.2 }}>
          Persoonlijke kalender van {personName}
        </h1>

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button
            onClick={next}
            aria-label={`Ga naar ${nextYear}`}
            className={titleFont.className}
            style={{
              padding: "8px 14px", background: COLORS.btnBg, border: `1px solid ${COLORS.btnBorder}`,
              borderRadius: 999, cursor: "pointer", minWidth: 130, display: "inline-flex",
              alignItems: "center", justifyContent: "center", gap: 10, fontWeight: 900, fontSize: 18, letterSpacing: 0.2,
              transition: "background 120ms ease-in-out",
            }}
            onMouseOver={(e) => (e.currentTarget.style.background = COLORS.btnHover)}
            onMouseOut={(e) => (e.currentTarget.style.background = COLORS.btnBg)}
          >
            <span>{nextYear}</span>
            <IconChevronRight />
          </button>
        </div>
      </header>

      {/* 4 kolommen × 3 rijen */}
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
            withdrawSelections={withdrawSelections}
            onToggleWithdraw={onToggleWithdraw}
          />
        ))}
      </section>

      {/* Verlof aanvragen bar (rechtsonder) */}
      {selectionBarVisible && (
        <div
          style={{
            position: "fixed",
            right: 24,
            bottom: 24,
            display: "flex",
            alignItems: "center",
            gap: 12,
            background: "#fff",
            border: `1px solid ${COLORS.line}`,
            borderRadius: 999,
            padding: "10px 14px",
            boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
            zIndex: 9999,
          }}
        >
          <span
            className={titleFont.className}
            style={{ color: COLORS.text, fontSize: 14, fontWeight: 800, position: "relative", zIndex: 2 }}
          >
            {totalDaysLabel} dag{totalDays === 1 ? "" : "en"} geselecteerd
          </span>

          <button
            onClick={onRequestLeave}
            disabled={requesting || !personnelId}
            className={titleFont.className}
            style={{
              padding: "10px 14px",
              background: requesting || !personnelId ? "#94d6d7" : COLORS.primary,
              color: "#fff",
              border: "none",
              borderRadius: 999,
              cursor: requesting || !personnelId ? "not-allowed" : "pointer",
              fontWeight: 900,
              fontSize: 14,
              letterSpacing: 0.2,
              minWidth: 140,
              position: "relative",
              zIndex: 2,
            }}
            title={!personnelId ? "Geen personnel_id in de URL" : undefined}
          >
            {requesting ? "Aanvragen…" : "Verlof aanvragen"}
          </button>
        </div>
      )}

      {/* Verlof intrekken bar — 2-staps bevestiging, zelfde stijl */}
      {withdrawBarVisible && (
        <div
          style={{
            position: "fixed",
            right: 24,
            bottom: selectionBarVisible ? 92 : 24, // stapel boven aanvragen-bar
            display: "flex",
            alignItems: "center",
            gap: 12,
            background: "#fff",
            border: `1px solid ${COLORS.line}`,
            borderRadius: 999,
            padding: "10px 14px",
            boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
            zIndex: 10000,
          }}
        >
          {withdrawConfirm ? (
            <>
              <span
                className={titleFont.className}
                style={{ color: COLORS.text, fontSize: 14, fontWeight: 800 }}
              >
                Zeker dat je je verlof wil intrekken?
              </span>

              <button
                onClick={() => setWithdrawConfirm(false)}
                className={titleFont.className}
                style={{
                  padding: "10px 14px",
                  background: COLORS.btnBg,
                  border: `1px solid ${COLORS.btnBorder}`,
                  borderRadius: 999,
                  cursor: "pointer",
                  fontWeight: 800,
                  fontSize: 14,
                  letterSpacing: 0.2,
                  minWidth: 80,
                }}
              >
                Neen
              </button>

              <button
                onClick={onWithdrawLeave}
                disabled={withdrawing}
                className={titleFont.className}
                style={{
                  padding: "10px 14px",
                  background: withdrawing ? "#94d6d7" : COLORS.primary,
                  color: "#fff",
                  border: "none",
                  borderRadius: 999,
                  cursor: withdrawing ? "not-allowed" : "pointer",
                  fontWeight: 900,
                  fontSize: 14,
                  letterSpacing: 0.2,
                  minWidth: 180,
                }}
              >
                {withdrawing ? "Bezig…" : "Ja, verlof intrekken"}
              </button>
            </>
          ) : (
            <>
              <span
                className={titleFont.className}
                style={{ color: COLORS.text, fontSize: 14, fontWeight: 800 }}
              >
                {withdrawTotalLabel} dag{withdrawTotal === 1 ? "" : "en"} geselecteerd om in te trekken
              </span>

              <button
                onClick={() => setWithdrawSelections({})}
                className={titleFont.className}
                style={{
                  padding: "10px 14px",
                  background: COLORS.btnBg,
                  border: `1px solid ${COLORS.btnBorder}`,
                  borderRadius: 999,
                  cursor: "pointer",
                  fontWeight: 800,
                  fontSize: 14,
                  letterSpacing: 0.2,
                  minWidth: 80,
                }}
              >
                Neen
              </button>

              <button
                onClick={() => setWithdrawConfirm(true)}
                className={titleFont.className}
                style={{
                  padding: "10px 14px",
                  background: COLORS.primary,
                  color: "#fff",
                  border: "none",
                  borderRadius: 999,
                  cursor: "pointer",
                  fontWeight: 900,
                  fontSize: 14,
                  letterSpacing: 0.2,
                  minWidth: 140,
                }}
              >
                Verlof intrekken
              </button>
            </>
          )}
        </div>
      )}
    </main>
  )
}
