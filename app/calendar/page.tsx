"use client"

import React, { useEffect, useState } from "react"
import localFont from "next/font/local"
import { supabase } from "@/lib/supabaseClient"
import FloatingNav from "../components/FloatingNav"
import { School, PartyPopper } from "lucide-react"   // Lucide iconen

/* Vaste offset onder FloatingNav */
const FLOATING_NAV_OFFSET = 12

// Fonts enkel op deze pagina laden
const monthFont = localFont({
  src: "../fonts/Font_Variable.otf",
  display: "swap",
})
const titleFont = localFont({
  src: "../fonts/Font_VariableBold.otf",
  display: "swap",
})

const COLORS = {
  bg: "#ffffff",
  card: "#f7f9fb",
  line: "#e5e7eb",
  text: "#0f172a",
  textMuted: "#475569",
  primary: "#0ea5a8",     // pijlen & maand-streepje
  weekendBg: "#eef2f7",
  btnBg: "#ffffff",
  btnBorder: "#d1d5db",
  btnHover: "#f3f4f6",
  schoolBg: "#FFF9C4",
  publicBg: "#FDE68A",
  approvedBg: "#C3E8E9",  // cellen met approved leave
}

// Breedte van de strepen (px) voor gearceerde cellen
const STRIPE = 6

const MONTHS_NL = [
  "januari","februari","maart","april","mei","juni",
  "juli","augustus","september","oktober","november","december",
]
const DOW_NL = ["ma","di","wo","do","vr","za","zo"]

/* ===== Icons voor jaar-navigatie ===== */
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
function daysInMonth(year: number, month0: number) {
  return new Date(year, month0 + 1, 0).getDate()
}
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
function ymd(year: number, month0: number, day: number) {
  return `${year}-${pad2(month0 + 1)}-${pad2(day)}`
}

/* ===== Types ===== */
type HolidayInfo = { type: "school" | "public"; name: string }
type LeavePerson = { name: string; avatar_url: string | null }
type TooltipItem =
  | { kind: "holiday"; name: string; subtype: "school" | "public" }
  | { kind: "leave"; people: LeavePerson[] }

/* ===== Month component ===== */
function MonthCalendar({
  year,
  month0,
  holidaysByDate,
  approvedByDate,
  onHover,
}: {
  year: number
  month0: number
  holidaysByDate: Record<string, HolidayInfo>
  approvedByDate: Record<string, LeavePerson[]>
  onHover: (e: React.MouseEvent | null, items: TooltipItem[] | null) => void
}) {
  const weeks = buildMonthMatrix(year, month0)
  const monthName = MONTHS_NL[month0]

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
      <div
        style={{ display: "grid", gridTemplateColumns: "8px 1fr", alignItems: "center", columnGap: 8 }}
      >
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
              const isWeekend = di === 5 || di === 6

              // Geen shorthand 'background', maar losse properties
              let backgroundColor = "#fff"
              let backgroundImage: string | "none" = "none"
              let backgroundRepeat: "repeat" | "no-repeat" = "no-repeat"
              let backgroundSize = "auto"
              let backgroundPosition = "0 0"

              const items: TooltipItem[] = []

              if (day) {
                const key = ymd(year, month0, day)
                const h = holidaysByDate[key]
                const leaves = approvedByDate[key] || []

                // Holiday-kleur bepalen (public gaat voor op school)
                const holidayColor =
                  h?.type === "public" ? COLORS.publicBg :
                  h?.type === "school" ? COLORS.schoolBg :
                  null

                // 1) Beide aanwezig → gearceerd: gele + blauwe schuine strepen
                if (holidayColor && leaves.length > 0) {
                  backgroundColor = COLORS.approvedBg
                  backgroundImage = `repeating-linear-gradient(
                    45deg,
                    ${holidayColor},
                    ${holidayColor} ${STRIPE}px,
                    ${COLORS.approvedBg} ${STRIPE}px,
                    ${COLORS.approvedBg} ${STRIPE * 2}px
                  )`
                  backgroundRepeat = "repeat"
                  backgroundSize = "auto"
                  backgroundPosition = "0 0"
                }
                // 2) Enkel holiday
                else if (holidayColor) {
                  backgroundColor = holidayColor
                  backgroundImage = "none"
                  backgroundRepeat = "no-repeat"
                }
                // 3) Enkel approved leave
                else if (leaves.length > 0) {
                  backgroundColor = COLORS.approvedBg
                  backgroundImage = "none"
                  backgroundRepeat = "no-repeat"
                }
                // 4) Weekend
                else if (isWeekend) {
                  backgroundColor = COLORS.weekendBg
                  backgroundImage = "none"
                  backgroundRepeat = "no-repeat"
                }

                // Tooltip-items (toon beide als ze samen vallen)
                if (h) items.push({ kind: "holiday", name: h.name, subtype: h.type })
                if (leaves.length > 0) items.push({ kind: "leave", people: leaves })
              }

              const hasInfo = items.length > 0

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
                    cursor: hasInfo ? "help" : "default",
                    transition: "box-shadow 120ms ease-in-out",
                    overflow: "hidden",
                  }}
                >
                  {day ?? ""}
                </div>
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
  const [year, setYear] = useState(2025)

  const [holidaysByDate, setHolidaysByDate] = useState<Record<string, HolidayInfo>>({})
  const [approvedByDate, setApprovedByDate] = useState<Record<string, LeavePerson[]>>({})

  // Tooltip state
  const [tooltip, setTooltip] = useState<{
    x: number
    y: number
    items: TooltipItem[]
  } | null>(null)

  useEffect(() => {
    let isMounted = true

    async function load() {
      const from = `${year}-01-01`
      const to = `${year + 1}-01-01`

      // 1) Holidays (naam + type). 'public' gaat voor op 'school' indien beide bestaan
      const { data: holidays, error: hErr } = await supabase
        .from("holidays")
        .select("holiday_date,name,type")
        .gte("holiday_date", from)
        .lt("holiday_date", to)

      if (hErr) {
        console.error("[holidays fetch]", hErr)
        if (isMounted) setHolidaysByDate({})
      } else {
        const map: Record<string, HolidayInfo> = {}
        for (const row of holidays ?? []) {
          if (row.type !== "school" && row.type !== "public") continue
          const date = row.holiday_date as string
          const current = map[date]
          if (!current || row.type === "public" || current.type !== "public") {
            map[date] = { type: row.type, name: row.name as string }
          }
        }
        if (isMounted) setHolidaysByDate(map)
      }

      // 2) Approved leave incl. naam + avatar via FK
      const { data: leaves, error: lErr } = await supabase
        .from("leave_requests")
        .select("leave_date, personnel:personnel_id (name, avatar_url)")
        .eq("status", "approved")
        .gte("leave_date", from)
        .lt("leave_date", to)

      if (lErr) {
        console.error("[leave_requests fetch]", lErr)
        if (isMounted) setApprovedByDate({})
      } else {
        const map: Record<string, LeavePerson[]> = {}
        for (const row of (leaves ?? []) as any[]) {
          const date = row.leave_date as string
          const p = row.personnel as { name?: string; avatar_url?: string | null } | null
          if (!p) continue
          if (!map[date]) map[date] = []
          map[date].push({ name: p.name ?? "Onbekend", avatar_url: p.avatar_url ?? null })
        }
        if (isMounted) setApprovedByDate(map)
      }
    }

    load()
    return () => { isMounted = false }
  }, [year])

  const handleHover = (e: React.MouseEvent | null, items: TooltipItem[] | null) => {
    if (!e || !items || items.length === 0) {
      setTooltip(null)
      return
    }
    setTooltip({
      x: e.clientX + 12,
      y: e.clientY + 12,
      items,
    })
  }

  const prev = () => setYear((y) => y - 1)
  const next = () => setYear((y) => y + 1)
  const prevYear = year - 1
  const nextYear = year + 1

  return (
    <>
      <FloatingNav />

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
              onHover={handleHover}
            />
          ))}
        </section>

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
                if (it.kind === "holiday") {
                  const label = it.subtype === "public" ? "Feestdag" : "Schoolvakantie"
                  const Icon = it.subtype === "public" ? PartyPopper : School
                  return (
                    <div key={`h-${idx}`} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <Icon size={16} strokeWidth={1.5} />
                      <div style={{ fontSize: 13, color: COLORS.text }}>
                        <strong>{label}:</strong> {it.name}
                      </div>
                    </div>
                  )
                }
                // Verlof
                return (
                  <div key={`l-${idx}`} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <div style={{ fontSize: 13, color: COLORS.text }}>
                      <strong>Verlof:</strong>
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {it.people.map((p, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          {p.avatar_url ? (
                            <img
                              src={p.avatar_url}
                              alt={p.name}
                              style={{
                                width: 25,
                                height: 25,
                                objectFit: "contain",  // rechthoek, niet croppen
                                background: "#fff",
                                flex: "0 0 auto",
                              }}
                            />
                          ) : (
                            <div
                              aria-hidden
                              style={{
                                width: 20,
                                height: 20,
                                border: "1px solid #e5e7eb",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: 11,
                                background: "#f5f5f5",
                                color: "#555",
                                flex: "0 0 auto",
                              }}
                            >
                              {p.name?.[0]?.toUpperCase() ?? "?"}
                            </div>
                          )}
                          <span style={{ fontSize: 13, color: COLORS.text }}>{p.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </main>
    </>
  )
}
