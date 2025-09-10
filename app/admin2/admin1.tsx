"use client"

import React, { useEffect, useMemo, useState } from "react"
import localFont from "next/font/local"
import { supabase } from "../../lib/supabaseClient"
import FloatingNav from "../components/FloatingNav" // ✅ toegevoegd

const FLOATING_NAV_OFFSET = 12 // ✅ vaste marge onder de zwevende nav

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

const HEADER_BTN = {
  bg: "#ffffff",
  border: "#d1d5db",
  hover: "#f3f4f6",
}

type Holiday = {
  id: string
  holiday_date: string
  name: string
  type: "public" | "school" | "other"
}

/* Icons */
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
function IconTrash({ color = COLORS.primary, size = 18 }: { color?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="3 6 5 6 21 6" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  )
}

/* Korte labels */
const DOW_LABEL: Record<number, string> = {
  0: "zo", 1: "ma", 2: "di", 3: "woe", 4: "do", 5: "vr", 6: "za",
}
const MONTH_SHORT = ["jan","feb","mrt","apr","mei","jun","jul","aug","sep","okt","nov","dec"]

// Feestdag: "woe 1 jan '25"
function fmtHoliday(iso: string) {
  const d = new Date(iso + "T00:00:00")
  const dow = DOW_LABEL[d.getDay()]
  const day = d.getDate()
  const mon = MONTH_SHORT[d.getMonth()]
  const yr = String(d.getFullYear()).slice(-2)
  return `${dow} ${day} ${mon} '${yr}`
}

// Schoolvakantie-bereik: "zo 2 - za 8 mrt '25"
function fmtSchoolRange(startISO: string, endISO: string) {
  const s = new Date(startISO + "T00:00:00")
  const e = new Date(endISO + "T00:00:00")
  const sStr = `${DOW_LABEL[s.getDay()]} ${s.getDate()}`
  const eStr = `${DOW_LABEL[e.getDay()]} ${e.getDate()} ${MONTH_SHORT[e.getMonth()]} '${String(e.getFullYear()).slice(-2)}`
  return `${sStr} - ${eStr}`
}

function* eachDateInclusive(startISO: string, endISO: string) {
  const start = new Date(startISO + "T00:00:00")
  const end = new Date(endISO + "T00:00:00")
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    yield d.toISOString().slice(0, 10)
  }
}

export default function HolidaysPage() {
  const [year, setYear] = useState<number>(new Date().getFullYear())
  const range = useMemo(() => ({ from: `${year}-01-01`, to: `${year}-12-31` }), [year])

  // Feestdagen
  const [publicHolidays, setPublicHolidays] = useState<Holiday[]>([])
  const [loadingPublic, setLoadingPublic] = useState(true)
  const [fdDate, setFdDate] = useState(""); const [fdName, setFdName] = useState("")
  const [fdSaving, setFdSaving] = useState(false); const [fdError, setFdError] = useState("")

  // Schoolvakanties (dagen → groeperen)
  const [schoolHolidays, setSchoolHolidays] = useState<Holiday[]>([])
  const [loadingSchool, setLoadingSchool] = useState(true)
  const [svStart, setSvStart] = useState(""); const [svEnd, setSvEnd] = useState("")
  const [svName, setSvName] = useState("")
  const [svSaving, setSvSaving] = useState(false); const [svError, setSvError] = useState("")

  // Hover
  const [hoveredPublicId, setHoveredPublicId] = useState<string | null>(null)
  const [hoveredSchoolName, setHoveredSchoolName] = useState<string | null>(null)

  useEffect(() => {
    const fetchPublic = async () => {
      setLoadingPublic(true)
      const { data, error } = await supabase.from("holidays")
        .select("id, holiday_date, name, type")
        .eq("type","public").gte("holiday_date", range.from).lte("holiday_date", range.to)
        .order("holiday_date", { ascending: true })
      setPublicHolidays(error ? [] : (data || [])); setLoadingPublic(false)
    }
    const fetchSchool = async () => {
      setLoadingSchool(true)
      const { data, error } = await supabase.from("holidays")
        .select("id, holiday_date, name, type")
        .eq("type","school").gte("holiday_date", range.from).lte("holiday_date", range.to)
        .order("holiday_date", { ascending: true })
      setSchoolHolidays(error ? [] : (data || [])); setLoadingSchool(false)
    }
    fetchPublic(); fetchSchool()
  }, [range])

  const onAddPublic = async (e: React.FormEvent) => {
    e.preventDefault(); setFdError("")
    if (!fdDate || !fdName.trim()) { setFdError("Geef een datum en een naam in."); return }
    if (new Date(fdDate).getFullYear() !== year) { setFdError(`Datum moet in ${year} liggen.`); return }
    setFdSaving(true)
    await supabase.from("holidays").insert({ holiday_date: fdDate, name: fdName.trim(), type: "public" } as never)
    const { data } = await supabase.from("holidays").select("id, holiday_date, name, type")
      .eq("type","public").gte("holiday_date", range.from).lte("holiday_date", range.to)
      .order("holiday_date", { ascending: true })
    setPublicHolidays(data || []); setFdDate(""); setFdName(""); setFdSaving(false)
  }

  const onAddSchool = async (e: React.FormEvent) => {
    e.preventDefault(); setSvError("")
    if (!svStart || !svEnd || !svName.trim()) { setSvError("Geef start, einde en benaming in."); return }
    if (new Date(svEnd) < new Date(svStart)) { setSvError("Einde mag niet vóór start liggen."); return }
    if (new Date(svStart).getFullYear() !== year || new Date(svEnd).getFullYear() !== year) {
      setSvError(`Periode moet in ${year} liggen.`); return
    }
    setSvSaving(true)
    const rows: Partial<Holiday>[] = []
    for (const d of eachDateInclusive(svStart, svEnd)) rows.push({ holiday_date: d, name: svName.trim(), type: "school" } as never)
    await supabase.from("holidays").insert(rows as never)
    const { data } = await supabase.from("holidays").select("id, holiday_date, name, type")
      .eq("type","school").gte("holiday_date", range.from).lte("holiday_date", range.to)
      .order("holiday_date", { ascending: true })
    setSchoolHolidays(data || []); setSvStart(""); setSvEnd(""); setSvName(""); setSvSaving(false)
  }

  const removePublic = async (id: string) => {
    await supabase.from("holidays").delete().eq("id", id)
    setPublicHolidays((prev) => prev.filter(h => h.id !== id))
  }
  const removeSchoolGroup = async (name: string) => {
    await supabase.from("holidays").delete()
      .eq("type","school").eq("name", name).gte("holiday_date", range.from).lte("holiday_date", range.to)
    setSchoolHolidays((prev) => prev.filter(h => !(h.type==="school" && h.name===name)))
  }

  const groupedSchool = useMemo(() => {
    const map = new Map<string, { start: string; end: string }>()
    for (const it of schoolHolidays) {
      const cur = map.get(it.name)
      if (!cur) map.set(it.name, { start: it.holiday_date, end: it.holiday_date })
      else { if (it.holiday_date < cur.start) cur.start = it.holiday_date; if (it.holiday_date > cur.end) cur.end = it.holiday_date }
    }
    return Array.from(map.entries()).map(([name, r]) => ({ name, start: r.start, end: r.end }))
      .sort((a,b)=> (a.start<b.start?-1:1))
  }, [schoolHolidays])

  return (
    <>
      {/* ✅ Zwevende navigatie bovenaan */}
      <FloatingNav />

      <main
        style={{
          background: COLORS.bg,
          minHeight: "100vh",
          padding: 24,
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          gap: 20,
          marginTop: `${FLOATING_NAV_OFFSET}px`, // ✅ ruimte onder floating nav
        }}
      >
        {/* Jaar + pijlen */}
        <header
          style={{
            display: "grid",
            gridTemplateColumns: "1fr auto 1fr",
            alignItems: "center",
            gap: 12,
            marginBottom: 0,
          }}
        >
          {/* Vorig jaar – exact zoals calendar */}
          <div>
            <button
              onClick={() => setYear((y) => y - 1)}
              aria-label={`Ga naar ${year - 1}`}
              className={titleFont.className}
              style={{
                padding: "8px 14px",
                background: HEADER_BTN.bg,
                border: `1px solid ${HEADER_BTN.border}`,
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
              onMouseOver={(e) => (e.currentTarget.style.background = HEADER_BTN.hover)}
              onMouseOut={(e) => (e.currentTarget.style.background = HEADER_BTN.bg)}
            >
              <IconChevronLeft />
              <span>{year - 1}</span>
            </button>
          </div>

          {/* Titel in het midden */}
          <h1
            className={variableFont.className}
            style={{
              margin: 0,
              textAlign: "center",
              color: COLORS.text,
              fontSize: 28,
              fontWeight: 800,
              letterSpacing: 0.2,
            }}
          >
            {year}
          </h1>

          {/* Volgend jaar – exact zoals calendar */}
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button
              onClick={() => setYear((y) => y + 1)}
              aria-label={`Ga naar ${year + 1}`}
              className={titleFont.className}
              style={{
                padding: "8px 14px",
                background: HEADER_BTN.bg,
                border: `1px solid ${HEADER_BTN.border}`,
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
              onMouseOver={(e) => (e.currentTarget.style.background = HEADER_BTN.hover)}
              onMouseOut={(e) => (e.currentTarget.style.background = HEADER_BTN.bg)}
            >
              <span>{year + 1}</span>
              <IconChevronRight />
            </button>
          </div>
        </header>

        {/* Cards gecentreerd */}
        <section style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 410px) minmax(0, 432px)",
          justifyContent: "center",
          justifyItems: "center",
          columnGap: "1%",
          rowGap: 12,
        }}>
          {/* LINKS – Feestdagen */}
          <div style={{ width: "min(410px, 100%)", background: COLORS.card, border: `1px solid ${COLORS.line}`, borderRadius: 12, padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display:"grid", gridTemplateColumns:"6px 1fr", alignItems:"center", columnGap:8 }}>
              <div style={{ width:6, height:20, background:COLORS.primary, borderRadius:3 }} />
              <h2 className={variableFont.className} style={{ margin: 0, fontSize: 18 }}>Feestdag toevoegen</h2>
            </div>

            <form onSubmit={onAddPublic} style={{ width:"100%", display:"grid", gridTemplateColumns:"1fr 1.4fr auto", gap:10, alignItems:"center" }}>
              <input type="date" value={fdDate} onChange={(e)=>setFdDate(e.target.value)}
                style={{ height:36, padding:"6px 10px", borderRadius:8, border:`1px solid ${COLORS.line}`, background:"#fff", width:"100%", minWidth:0 }} />
              <input placeholder="Naam (bv. Paasmaandag)" value={fdName} onChange={(e)=>setFdName(e.target.value)}
                style={{ height:36, padding:"6px 10px", borderRadius:8, border:`1px solid ${COLORS.line}`, background:"#fff", width:"100%", minWidth:0 }} />
              <button type="submit" disabled={fdSaving} aria-label="Feestdag toevoegen"
                style={{ height:36, minWidth:36, background:COLORS.btnBg, border:`1px solid ${COLORS.btnBorder}`, color:COLORS.btnText, borderRadius:8, cursor:"pointer", fontWeight:800, fontSize:18, lineHeight:1 }}
                onMouseOver={(e)=>e.currentTarget.style.background=COLORS.btnHover} onMouseOut={(e)=>e.currentTarget.style.background=COLORS.btnBg}>+</button>
            </form>
            {fdError && <div style={{ color: "#b91c1c", fontSize: 14 }}>{fdError}</div>}

            <div style={{ display:"grid", gridTemplateColumns:"6px 1fr", alignItems:"center", columnGap:8, marginTop:4 }}>
              <div style={{ width:6, height:18, background:COLORS.primary, borderRadius:3 }} />
              <h3 className={variableFont.className} style={{ margin: 0, fontSize: 16 }}>Feestdagen in {year}</h3>
            </div>

            {loadingPublic ? (
              <div style={{ color: COLORS.textMuted }}>Laden…</div>
            ) : publicHolidays.length === 0 ? (
              <div style={{ color: COLORS.textMuted }}>Geen feestdagen gevonden.</div>
            ) : (
              <ul style={{ listStyle:"none", padding:0, margin:0 }}>
                {publicHolidays.map(h => (
                  <li key={h.id}
                    onMouseEnter={()=>setHoveredPublicId(h.id)} onMouseLeave={()=>setHoveredPublicId(null)}
                    style={{ display:"grid", gridTemplateColumns:"160px 1fr auto", alignItems:"center", borderBottom:`1px solid ${COLORS.line}`, padding:"8px 0", gap:5 }}>
                    <div style={{ color: COLORS.textMuted, fontSize:14 }}>{fmtHoliday(h.holiday_date)}</div>
                    <div style={{ color: COLORS.text, fontSize:15 }}>{h.name}</div>
                    <button aria-label="Verwijder feestdag" onClick={()=>removePublic(h.id)}
                      style={{ background:"transparent", border:"none", cursor:"pointer", opacity:hoveredPublicId===h.id?1:0, transition:"opacity 120ms ease" }}>
                      <IconTrash />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* RECHTS – Schoolvakanties */}
          <div style={{ width: "min(432px, 100%)", background: COLORS.card, border: `1px solid ${COLORS.line}`, borderRadius: 12, padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display:"grid", gridTemplateColumns:"6px 1fr", alignItems:"center", columnGap:8 }}>
              <div style={{ width:6, height:20, background:COLORS.primary, borderRadius:3 }} />
              <h2 className={variableFont.className} style={{ margin: 0, fontSize: 18 }}>Schoolvakanties toevoegen</h2>
            </div>

            <form onSubmit={onAddSchool} style={{ width:"100%", display:"grid", gridTemplateColumns:"1fr 1fr 1.4fr auto", gap:10, alignItems:"center" }}>
              <input type="date" value={svStart} onChange={(e)=>setSvStart(e.target.value)}
                style={{ height:36, padding:"6px 10px", borderRadius:8, border:`1px solid ${COLORS.line}`, background:"#fff", width:"100%", minWidth:0 }} />
              <input type="date" value={svEnd} onChange={(e)=>setSvEnd(e.target.value)}
                style={{ height:36, padding:"6px 10px", borderRadius:8, border:`1px solid ${COLORS.line}`, background:"#fff", width:"100%", minWidth:0 }} />
              <input placeholder="Benaming (bv. Zomervakantie)" value={svName} onChange={(e)=>setSvName(e.target.value)}
                style={{ height:36, padding:"6px 10px", borderRadius:8, border:`1px solid ${COLORS.line}`, background:"#fff", width:"100%", minWidth:0 }} />
              <button type="submit" disabled={svSaving} aria-label="Schoolvakantie toevoegen"
                style={{ height:36, minWidth:36, background:COLORS.btnBg, border:`1px solid ${COLORS.btnBorder}`, color:COLORS.btnText, borderRadius:8, cursor:"pointer", fontWeight:800, fontSize:18, lineHeight:1 }}
                onMouseOver={(e)=>e.currentTarget.style.background=COLORS.btnHover} onMouseOut={(e)=>e.currentTarget.style.background=COLORS.btnBg}>+</button>
            </form>
            {svError && <div style={{ color: "#b91c1c", fontSize: 14 }}>{svError}</div>}

            <div style={{ display:"grid", gridTemplateColumns:"6px 1fr", alignItems:"center", columnGap:8, marginTop:4 }}>
              <div style={{ width:6, height:18, background:COLORS.primary, borderRadius:3 }} />
              <h3 className={variableFont.className} style={{ margin: 0, fontSize: 16 }}>Schoolvakanties in {year}</h3>
            </div>

            {loadingSchool ? (
              <div style={{ color: COLORS.textMuted }}>Laden…</div>
            ) : groupedSchool.length === 0 ? (
              <div style={{ color: COLORS.textMuted }}>Geen schoolvakanties gevonden.</div>
            ) : (
              <ul style={{ listStyle:"none", padding:0, margin:0 }}>
                {groupedSchool.map(g => (
                  <li key={g.name}
                    onMouseEnter={()=>setHoveredSchoolName(g.name)} onMouseLeave={()=>setHoveredSchoolName(null)}
                    style={{ display:"grid", gridTemplateColumns:"220px 1fr auto", alignItems:"center", borderBottom:`1px solid ${COLORS.line}`, padding:"8px 0", gap:6 }}>
                    <div style={{ color: COLORS.textMuted, fontSize:14 }}>{fmtSchoolRange(g.start, g.end)}</div>
                    <div style={{ color: COLORS.text, fontSize:15 }}>{g.name}</div>
                    <button aria-label="Verwijder schoolvakantie" onClick={()=>removeSchoolGroup(g.name)}
                      style={{ background:"transparent", border:"none", cursor:"pointer", opacity:hoveredSchoolName===g.name?1:0, transition:"opacity 120ms ease" }}>
                      <IconTrash />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </main>
    </>
  )
}
