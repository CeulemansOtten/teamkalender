"use client"

import React, { useEffect, useMemo, useState } from "react"
import localFont from "next/font/local"
import { supabase } from "../../lib/supabaseClient"
import FloatingNav from "../components/FloatingNav"

/* ================= Instelbare waardes ================= */
const CARDS_TOP_OFFSET = 70

/* Max breedtes (px) voor de 2 cards */
const HOURS_CARD_MAX_WIDTH = 370
const PERSON_CARD_MAX_WIDTH = 660

/* Breedtes (px) voor Uren beheren */
const HOURS_FIELD_WIDTH_PX = 120
const HOURS_YEAR_FIELD_WIDTH_PX = 80
const HOURS_ADD_FIELD_HALF_WIDTH_PX = Math.max(40, Math.round(HOURS_FIELD_WIDTH_PX / 2)) // alleen voor 'uren' in toevoegen

/* Breedtes (px) voor Personeel beheren */
const PERSON_FIELD_WIDTH_PX = 120
/* ===================================================== */

const variableFont = localFont({ src: "../fonts/Font_Variable.otf", display: "swap" })

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
  danger: "#ef4444",
  overlay: "rgba(0,0,0,0.45)",
}
const FLOATING_NAV_OFFSET = 12

const SYS_FONT = "system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif"
const baseField: React.CSSProperties = {
  height: 36,
  padding: "6px 10px",
  borderRadius: 8,
  border: `1px solid ${COLORS.line}`,
  background: "#fff",
  fontFamily: SYS_FONT,
  fontSize: 14,
}

/* Helpers voor birthdate <-> string */
function ddmmyyyyToISO(s: string | null): string {
  // "30091982" -> "1982-09-30" (of "" als ongeldig/geen)
  if (!s || s.length !== 8) return ""
  const dd = s.slice(0, 2)
  const mm = s.slice(2, 4)
  const yyyy = s.slice(4, 8)
  if (!/^\d{2}$/.test(dd) || !/^\d{2}$/.test(mm) || !/^\d{4}$/.test(yyyy)) return ""
  return `${yyyy}-${mm}-${dd}`
}
function isoToDDMMYYYY(iso: string | null): string | null {
  // "1982-09-30" -> "30091982" (of null als leeg/ongeldig)
  if (!iso) return null
  const parts = iso.split("-")
  if (parts.length !== 3) return null
  const [yyyy, mm, dd] = parts
  if (!yyyy || !mm || !dd) return null
  return `${dd}${mm}${yyyy}`
}

/* Types */
type Personnel = {
  id: string
  name: string
  surname: string | null
  avatar_url: string | null
  status: string | null
  /** In STATE altijd als ISO "yyyy-mm-dd" of "" (leeg) voor het date-input */
  birthdate: string | null
}
type LeaveEntitlement = {
  id: string
  personnel_id: string
  year: number
  total_hours: number
  reason: string | null
}

/* ---------- Herbruikbare Confirm Modal ---------- */
type ConfirmState =
  | { open: false }
  | {
      open: true
      kind: "avatar" | "person" | "hours"
      title: string
      message: string
      confirmLabel?: string
      cancelLabel?: string
      person?: Personnel
      ent?: LeaveEntitlement
    }

function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = "Verwijderen",
  cancelLabel = "Annuleren",
  onConfirm,
  onCancel,
}: {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void
  onCancel: () => void
}) {
  if (!open) return null
  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        background: COLORS.overlay,
        display: "grid",
        placeItems: "center",
        zIndex: 50,
      }}
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(420px, 90vw)",
          background: "#fff",
          borderRadius: 12,
          border: `1px solid ${COLORS.line}`,
          boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
          padding: 16,
          fontFamily: SYS_FONT,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <div
            aria-hidden
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              background: "#fee2e2",
              display: "grid",
              placeItems: "center",
              border: `1px solid #fecaca`,
            }}
          >
            {/* waarschuwing-icoon */}
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#b91c1c" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
              <line x1="12" y1="9" x2="12" y2="13"></line>
              <line x1="12" y1="17" x2="12.01" y2="17"></line>
            </svg>
          </div>
          <h3 style={{ margin: 0, fontSize: 18, color: COLORS.text }}>{title}</h3>
        </div>

        <p style={{ margin: "6px 0 14px", fontSize: 14, color: COLORS.textMuted }}>{message}</p>

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button
            onClick={onCancel}
            style={{
              height: 36,
              padding: "0 12px",
              borderRadius: 8,
              border: `1px solid ${COLORS.line}`,
              background: "#fff",
              cursor: "pointer",
              fontWeight: 700,
            }}
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            style={{
              height: 36,
              padding: "0 14px",
              borderRadius: 8,
              border: `1px solid ${COLORS.danger}`,
              background: COLORS.danger,
              color: "#fff",
              cursor: "pointer",
              fontWeight: 800,
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Admin2Page() {
  /* ---------------- Personeel ---------------- */
  const [people, setPeople] = useState<Personnel[]>([])
  const [loadingPeople, setLoadingPeople] = useState(true)
  const [pErr, setPErr] = useState("")
  const [statusOptions, setStatusOptions] = useState<string[]>([])

  // Personeel toevoegen (newBirthdate = ISO in input)
  const [newName, setNewName] = useState("")
  const [newSurname, setNewSurname] = useState("")
  const [newBirthdate, setNewBirthdate] = useState("") // ISO "yyyy-mm-dd"
  const [newStatus, setNewStatus] = useState("")
  const [savingNewPerson, setSavingNewPerson] = useState(false)

  /* ---------------- Uren ---------------- */
  const [selectedPersonId, setSelectedPersonId] = useState("")
  const [yearFilter, setYearFilter] = useState<number | "">("")
  const [yearOptions, setYearOptions] = useState<number[]>([])
  const [ents, setEnts] = useState<LeaveEntitlement[]>([])
  const [loadingEnts, setLoadingEnts] = useState(false)
  const [eErr, setEErr] = useState("")

  // Uren toevoegen (onderaan)
  const [newHoursInput, setNewHoursInput] = useState("")
  const [newReason, setNewReason] = useState<"wettelijk" | "overuren" | "adv" | "andere">("wettelijk")
  const [newYearInput, setNewYearInput] = useState<string>("")

  // Avatar hover state
  const [hoveredAvatarId, setHoveredAvatarId] = useState<string | null>(null)

  // Confirm modal state
  const [confirm, setConfirm] = useState<ConfirmState>({ open: false })

  /* ---------- Load personeel + status-waarden ---------- */
  useEffect(() => {
    const loadPeople = async () => {
      setLoadingPeople(true)
      setPErr("")
      const { data, error } = await supabase
        .from("personnel")
        .select("id, name, surname, avatar_url, status, birthdate")
        .order("name", { ascending: true })

      if (error) {
        setPErr(error.message || "Kon personeel niet laden.")
        setPeople([])
      } else {
        // Converteer birthdate uit DB ("ddmmjjjj") naar ISO ("yyyy-mm-dd") voor UI
        const list = (data || []).map((p: any) => ({
          ...p,
          birthdate: ddmmyyyyToISO(p.birthdate ?? null) || "",
        })) as Personnel[]
        setPeople(list)
        if (!selectedPersonId && list.length > 0) setSelectedPersonId(list[0].id)
      }
      setLoadingPeople(false)
    }

    const loadStatusOptions = async () => {
      const { data, error } = await supabase.from("personnel").select("status")
      if (error) {
        setStatusOptions(["active", "inactive"])
      } else {
        const values = (data || [])
          .map((r: any) => r.status)
          .filter((v: any) => typeof v === "string" && v.trim().length > 0)
        const unique = Array.from(new Set(values))
        setStatusOptions(unique.length ? unique : ["active", "inactive"])
        if (!newStatus) setNewStatus(unique[0] || "active")
      }
    }

    loadPeople()
    loadStatusOptions()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* ---------- Jaaropties per persoon ---------- */
  useEffect(() => {
    const fetchYears = async () => {
      if (!selectedPersonId) {
        setYearOptions([])
        setYearFilter("")
        return
      }
      const { data, error } = await supabase
        .from("leave_entitlements")
        .select("year")
        .eq("personnel_id", selectedPersonId)
        .order("year", { ascending: true })

      if (error || !data) {
        setYearOptions([])
        setYearFilter("")
        return
      }
      const unique = Array.from(new Set((data as { year: number }[]).map((r) => r.year))).sort((a, b) => a - b)
      setYearOptions(unique)
      if (!yearFilter) setYearFilter(unique[unique.length - 1] ?? "")
      setNewYearInput(String(unique[unique.length - 1] ?? new Date().getFullYear()))
    }
    fetchYears()
  }, [selectedPersonId])

  /* ---------- Urenregels ophalen ---------- */
  useEffect(() => {
    const fetchEnts = async () => {
      if (!selectedPersonId || !yearFilter) {
        setEnts([])
        return
      }
      setLoadingEnts(true)
      setEErr("")
      const { data, error } = await supabase
        .from("leave_entitlements")
        .select("id, personnel_id, year, total_hours, reason")
        .eq("personnel_id", selectedPersonId)
        .eq("year", yearFilter)
        .order("id", { ascending: true })
      if (error) {
        setEErr(error.message || "Kon uren niet laden.")
        setEnts([])
      } else setEnts((data || []) as LeaveEntitlement[])
      setLoadingEnts(false)
      setNewYearInput(String(yearFilter))
    }
    fetchEnts()
  }, [selectedPersonId, yearFilter])

  /* ---------- Personeel acties ---------- */
  const updatePersonField = (id: string, field: keyof Personnel, value: string) => {
    setPeople((prev) => prev.map((p) => (p.id === id ? ({ ...p, [field]: value } as Personnel) : p)))
  }

  const savePerson = async (p: Personnel) => {
    setPErr("")
    // Zet ISO uit UI terug naar ddmmjjjj voor DB
    const birthStr = isoToDDMMYYYY(p.birthdate || null)
    const { error } = await supabase
      .from("personnel")
      .update({
        name: p.name,
        surname: p.surname ?? null,
        status: p.status ?? null,
        birthdate: birthStr, // ddmmjjjj of null
        avatar_url: p.avatar_url || null,
      })
      .eq("id", p.id)
    if (error) setPErr(error.message || "Opslaan mislukt.")
  }

  // Acties zónder browser-confirm; we koppelen ze aan onze modal
  const doDeletePerson = async (p: Personnel) => {
    setPErr("")
    const { error } = await supabase.from("personnel").delete().eq("id", p.id)
    if (error) {
      setPErr(error.message || "Verwijderen mislukt (mogelijk gekoppelde gegevens).")
    } else {
      setPeople((prev) => prev.filter((x) => x.id !== p.id))
      if (selectedPersonId === p.id) {
        const next = people.find((x) => x.id !== p.id)
        setSelectedPersonId(next ? next.id : "")
      }
    }
  }

  const doClearAvatar = async (p: Personnel) => {
    setPErr("")
    const { error } = await supabase.from("personnel").update({ avatar_url: null }).eq("id", p.id)
    if (error) {
      setPErr(error.message || "Avatar verwijderen mislukt.")
      return
    }
    setPeople((prev) => prev.map((x) => (x.id === p.id ? { ...x, avatar_url: null } : x)))
  }

  // Upload avatar (klik op lege cirkel of plus-overlay) – PUBLIC bucket "avatar"
  const handleAvatarFileChange = async (p: Personnel, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const filePath = `${p.id}/${Date.now()}-${file.name}`
    const { error: upErr } = await supabase.storage.from("avatar").upload(filePath, file, { upsert: true })
    if (upErr) {
      setPErr(upErr.message || "Upload mislukt.")
      return
    }
    const { data: pub } = supabase.storage.from("avatar").getPublicUrl(filePath)
    const url = pub?.publicUrl || ""
    if (!url) {
      setPErr("Kon publieke URL niet ophalen.")
      return
    }
    const { error } = await supabase.from("personnel").update({ avatar_url: url }).eq("id", p.id)
    if (error) {
      setPErr(error.message || "Updaten van avatar mislukt.")
      return
    }
    setPeople((prev) => prev.map((x) => (x.id === p.id ? { ...x, avatar_url: url } : x)))
    e.target.value = "" // reset input
  }

  const addPerson = async (e: React.FormEvent) => {
    e.preventDefault()
    setPErr("")
    if (!newName.trim()) {
      setPErr("Voornaam is verplicht.")
      return
    }
    if (!newSurname.trim()) {
      setPErr("Achternaam is verplicht.")
      return
    }
    if (!newStatus.trim()) {
      setPErr("Status is verplicht.")
      return
    }

    // newBirthdate (ISO) -> ddmmjjjj
    const birthStr = isoToDDMMYYYY(newBirthdate || null)

    setSavingNewPerson(true)
    const { data, error } = await supabase
      .from("personnel")
      .insert({
        name: newName.trim(),
        surname: newSurname.trim(),
        birthdate: birthStr, // ddmmjjjj of null
        status: newStatus.trim(),
      } as never)
      .select("id, name, surname, avatar_url, status, birthdate")
      .single()
    setSavingNewPerson(false)

    if (error) {
      setPErr(error.message || "Toevoegen mislukt.")
      return
    }
    if (data) {
      // Zet DB-string weer om naar ISO voor state
      const normalized: Personnel = {
        ...data,
        birthdate: ddmmyyyyToISO((data as any).birthdate ?? null) || "",
      }
      setPeople((prev) => [...prev, normalized].sort((a, b) => a.name.localeCompare(b.name)))
      setNewName("")
      setNewSurname("")
      setNewBirthdate("")
      if (!selectedPersonId) setSelectedPersonId((data as any).id)
      const st = (data as any).status
      if (st && !statusOptions.includes(st)) setStatusOptions((prev) => [...prev, st])
    }
  }

  /* ---------- Uren acties ---------- */
  const updateEntField = (id: string, field: keyof LeaveEntitlement, value: string) => {
    setEnts((prev) =>
      prev.map((e) => {
        if (e.id !== id) return e
        if (field === "total_hours") {
          const v = parseFloat(value.replace(",", "."))
          return { ...e, total_hours: isNaN(v) ? 0 : v }
        }
        return { ...e, [field]: value } as LeaveEntitlement
      })
    )
  }

  const doDeleteEnt = async (ent: LeaveEntitlement) => {
    setEErr("")
    const { error } = await supabase.from("leave_entitlements").delete().eq("id", ent.id)
    if (error) setEErr(error.message || "Verwijderen mislukt.")
    else setEnts((prev) => prev.filter((e) => e.id !== ent.id))
  }

  const saveEnt = async (ent: LeaveEntitlement) => {
    setEErr("")
    const { error } = await supabase
      .from("leave_entitlements")
      .update({ total_hours: ent.total_hours, reason: ent.reason })
      .eq("id", ent.id)
    if (error) setEErr(error.message || "Opslaan mislukt.")
  }

  const addHours = async (e: React.FormEvent) => {
    e.preventDefault()
    setEErr("")
    if (!selectedPersonId) {
      setEErr("Kies eerst een persoon.")
      return
    }

    const hours = parseFloat(newHoursInput.replace(",", "."))
    if (isNaN(hours) || hours <= 0) {
      setEErr("Geef een geldig aantal uren in (> 0).")
      return
    }

    const y = parseInt(newYearInput, 10)
    if (!y || isNaN(y)) {
      setEErr("Geef een geldig jaar in.")
      return
    }

    const { data, error } = await supabase
      .from("leave_entitlements")
      .insert({
        personnel_id: selectedPersonId,
        year: y,
        total_hours: hours,
        reason: newReason,
      } as never)
      .select("id, personnel_id, year, total_hours, reason")
      .single()

    if (error) {
      setEErr(error.message || "Toevoegen mislukt.")
      return
    }

    if (data) {
      if (yearFilter === y) setEnts((prev) => [...prev, data as LeaveEntitlement])
      setYearOptions((prev) => (prev.includes(y) ? prev : [...prev, y].sort((a, b) => a - b)))
      setNewHoursInput("")
    }
  }

  /* ---------- Helpers ---------- */
  const selectedPerson = useMemo(() => people.find((p) => p.id === selectedPersonId) || null, [people, selectedPersonId])

  /* ---------- Handlers om modal te openen ---------- */
  const askDeleteAvatar = (p: Personnel) =>
    setConfirm({
      open: true,
      kind: "avatar",
      title: "Avatar verwijderen?",
      message: `Weet je zeker dat je de foto van ${p.name}${p.surname ? " " + p.surname : ""} wilt verwijderen?`,
      confirmLabel: "Verwijder avatar",
      person: p,
    })

  const askDeletePerson = (p: Personnel) =>
    setConfirm({
      open: true,
      kind: "person",
      title: "Personeelslid verwijderen?",
      message: `Als je ${p.name}${p.surname ? " " + p.surname : ""} verwijdert, gaat ook zijn/haar historiek weg. Weet je het zeker?`,
      confirmLabel: "Verwijder persoon",
      person: p,
    })

  const askDeleteHours = (ent: LeaveEntitlement) =>
    setConfirm({
      open: true,
      kind: "hours",
      title: "Urenregel verwijderen?",
      message: `Je staat op het punt een urenregel (${ent.total_hours}u${ent.reason ? ` – ${ent.reason}` : ""}, ${ent.year}) te verwijderen. Doorgaan?`,
      confirmLabel: "Verwijder uren",
      ent,
    })

  const handleConfirmProceed = async () => {
    if (!confirm.open) return
    try {
      if (confirm.kind === "avatar" && confirm.person) await doClearAvatar(confirm.person)
      if (confirm.kind === "person" && confirm.person) await doDeletePerson(confirm.person)
      if (confirm.kind === "hours" && confirm.ent) await doDeleteEnt(confirm.ent)
    } finally {
      setConfirm({ open: false })
    }
  }

  const handleConfirmCancel = () => setConfirm({ open: false })

  return (
    <>
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
          marginTop: `${FLOATING_NAV_OFFSET}px`,
        }}
      >
        {/* Error banners (simpel, maar netjes) */}
        {(pErr || eErr) && (
          <div
            role="status"
            style={{
              margin: "0 auto",
              width: "min(1000px, 96vw)",
              background: "#fef2f2",
              color: "#7f1d1d",
              border: "1px solid #fecaca",
              borderRadius: 10,
              padding: "10px 12px",
              fontFamily: SYS_FONT,
              fontSize: 14,
            }}
          >
            {pErr || eErr}
          </div>
        )}

        {/* Grid: LINKS Uren – RECHTS Personeel */}
        <section
          style={{
            display: "grid",
            gridTemplateColumns: `minmax(0, ${HOURS_CARD_MAX_WIDTH}px) minmax(0, ${PERSON_CARD_MAX_WIDTH}px)`,
            justifyContent: "center",
            columnGap: "2%",
            rowGap: 12,
            marginTop: CARDS_TOP_OFFSET,
          }}
        >
          {/* ---------------- LINKS – Uren beheren ---------------- */}
          <div
            style={{
              width: `min(${HOURS_CARD_MAX_WIDTH}px, 100%)`,
              background: COLORS.card,
              border: `1px solid ${COLORS.line}`,
              borderRadius: 12,
              padding: 16,
              display: "flex",
              flexDirection: "column",
              gap: 14,
            }}
          >
            <div style={{ display: "grid", gridTemplateColumns: "6px 1fr", alignItems: "center", columnGap: 8 }}>
              <div style={{ width: 6, height: 20, background: COLORS.primary, borderRadius: 3 }} />
              <h2 className={variableFont.className} style={{ margin: 0, fontSize: 18 }}>
                Uren beheren
              </h2>
            </div>

            {/* Avatar + Personeel (200px) + Jaar */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: `36px 200px ${HOURS_YEAR_FIELD_WIDTH_PX}px`,
                gap: 10,
                alignItems: "center",
              }}
            >
              <div style={{ width: 36, height: 36, overflow: "hidden" }}>
                {selectedPerson?.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={selectedPerson.avatar_url} alt="avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : null}
              </div>

              <select value={selectedPersonId} onChange={(e) => setSelectedPersonId(e.target.value)} style={{ ...baseField, width: 200 }}>
                {people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                    {p.surname ? ` ${p.surname}` : ""}
                  </option>
                ))}
              </select>

              <select
                value={yearFilter === "" ? "" : String(yearFilter)}
                onChange={(e) => setYearFilter(e.target.value ? parseInt(e.target.value, 10) : "")}
                style={{ ...baseField, width: HOURS_YEAR_FIELD_WIDTH_PX }}
              >
                <option value="">—</option>
                {yearOptions.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>

            {eErr && <div style={{ color: "#b91c1c", fontSize: 14 }}>{eErr}</div>}

            {/* Lijst urenregels */}
            {loadingEnts ? (
              <div style={{ color: COLORS.textMuted }}>Laden…</div>
            ) : ents.length === 0 ? (
              <div style={{ color: COLORS.textMuted }}>Nog geen uren voor dit jaar.</div>
            ) : (
              <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {ents.map((ent) => (
                  <li
                    key={ent.id}
                    style={{
                      display: "grid",
                      gridTemplateColumns: `${HOURS_FIELD_WIDTH_PX}px ${HOURS_FIELD_WIDTH_PX}px auto`,
                      gap: 8,
                      alignItems: "center",
                      borderBottom: `1px solid ${COLORS.line}`,
                      padding: "8px 0",
                    }}
                  >
                    <input
                      value={String(ent.total_hours)}
                      onChange={(e) => updateEntField(ent.id, "total_hours", e.target.value)}
                      inputMode="decimal"
                      style={{ ...baseField, width: HOURS_FIELD_WIDTH_PX }}
                    />
                    <select
                      value={ent.reason ?? ""}
                      onChange={(e) => updateEntField(ent.id, "reason", e.target.value)}
                      style={{ ...baseField, width: HOURS_FIELD_WIDTH_PX }}
                    >
                      <option value="wettelijk">wettelijk</option>
                      <option value="overuren">overuren</option>
                      <option value="adv">adv</option>
                      <option value="andere">andere</option>
                    </select>

                    <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                      <button
                        aria-label="Opslaan"
                        title="Opslaan"
                        onClick={() => saveEnt(ent)}
                        style={{
                          background: "transparent",
                          border: `1px solid ${COLORS.line}`,
                          height: 32,
                          width: 32,
                          borderRadius: 8,
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          cursor: "pointer",
                        }}
                      >
                        <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={COLORS.primary} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                          <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                          <polyline points="17 21 17 13 7 13 7 21" />
                          <polyline points="7 3 7 8 15 8" />
                        </svg>
                      </button>
                      <button
                        aria-label="Verwijderen"
                        title="Verwijderen"
                        onClick={() => askDeleteHours(ent)}
                        style={{
                          background: "transparent",
                          border: "none",
                          height: 32,
                          width: 32,
                          borderRadius: 8,
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          cursor: "pointer",
                        }}
                      >
                        <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={COLORS.primary} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                          <line x1="10" y1="11" x2="10" y2="17" />
                          <line x1="14" y1="11" x2="14" y2="17" />
                        </svg>
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {/* Uren toevoegen – (+ is 50px breed) / uren-veld half breed */}
            <form
              onSubmit={addHours}
              style={{
                display: "grid",
                gridTemplateColumns: `${HOURS_ADD_FIELD_HALF_WIDTH_PX}px ${HOURS_FIELD_WIDTH_PX}px ${HOURS_YEAR_FIELD_WIDTH_PX}px 50px`,
                gap: 10,
                alignItems: "center",
                marginTop: 10,
              }}
            >
              <input
                type="number"
                step="0.1"
                placeholder="uren"
                value={newHoursInput}
                onChange={(e) => setNewHoursInput(e.target.value)}
                style={{ ...baseField, width: HOURS_ADD_FIELD_HALF_WIDTH_PX }}
              />

              <select value={newReason} onChange={(e) => setNewReason(e.target.value as any)} style={{ ...baseField, width: HOURS_FIELD_WIDTH_PX }}>
                <option value="wettelijk">wettelijk</option>
                <option value="overuren">overuren</option>
                <option value="adv">adv</option>
                <option value="andere">andere</option>
              </select>

              <input
                type="number"
                placeholder="jaar"
                value={newYearInput}
                onChange={(e) => setNewYearInput(e.target.value)}
                style={{ ...baseField, width: HOURS_YEAR_FIELD_WIDTH_PX }}
              />

              <button
                type="submit"
                aria-label="Uren toevoegen"
                style={{
                  height: 36,
                  width: 50,
                  minWidth: 50,
                  background: COLORS.btnBg,
                  border: `1px solid ${COLORS.btnBorder}`,
                  color: COLORS.btnText,
                  borderRadius: 8,
                  cursor: "pointer",
                  fontWeight: 800,
                  fontSize: 18,
                  lineHeight: 1,
                }}
                onMouseOver={(e) => (e.currentTarget.style.background = COLORS.btnHover)}
                onMouseOut={(e) => (e.currentTarget.style.background = COLORS.btnBg)}
              >
                +
              </button>
            </form>
          </div>

          {/* ---------------- RECHTS – Personeel beheren ---------------- */}
          <div
            style={{
              width: `min(${PERSON_CARD_MAX_WIDTH}px, 100%)`,
              background: COLORS.card,
              border: `1px solid ${COLORS.line}`,
              borderRadius: 12,
              padding: 16,
              display: "flex",
              flexDirection: "column",
              gap: 14,
            }}
          >
            <div style={{ display: "grid", gridTemplateColumns: "6px 1fr", alignItems: "center", columnGap: 8 }}>
              <div style={{ width: 6, height: 20, background: COLORS.primary, borderRadius: 3 }} />
              <h2 className={variableFont.className} style={{ margin: 0, fontSize: 18 }}>
                Personeel beheren
              </h2>
            </div>

            {/* Toevoegen (+ is 50px breed) */}
            <form
              onSubmit={addPerson}
              style={{
                display: "grid",
                gridTemplateColumns: `${PERSON_FIELD_WIDTH_PX}px ${PERSON_FIELD_WIDTH_PX}px ${PERSON_FIELD_WIDTH_PX}px ${PERSON_FIELD_WIDTH_PX}px 50px`,
                gap: 8,
                alignItems: "center",
              }}
            >
              <input placeholder="voornaam" value={newName} onChange={(e) => setNewName(e.target.value)} style={{ ...baseField, width: PERSON_FIELD_WIDTH_PX }} />
              <input placeholder="achternaam" value={newSurname} onChange={(e) => setNewSurname(e.target.value)} style={{ ...baseField, width: PERSON_FIELD_WIDTH_PX }} />
              <input
                type="date"
                placeholder="geboortedatum"
                value={newBirthdate}
                onChange={(e) => setNewBirthdate(e.target.value)}
                style={{ ...baseField, width: PERSON_FIELD_WIDTH_PX }}
              />
              <select value={newStatus} onChange={(e) => setNewStatus(e.target.value)} style={{ ...baseField, width: PERSON_FIELD_WIDTH_PX }}>
                {statusOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                disabled={savingNewPerson}
                aria-label="Personeel toevoegen"
                style={{
                  height: 36,
                  width: 50,
                  minWidth: 50,
                  background: COLORS.btnBg,
                  border: `1px solid ${COLORS.btnBorder}`,
                  color: COLORS.btnText,
                  borderRadius: 8,
                  cursor: "pointer",
                  fontWeight: 800,
                  fontSize: 16,
                  lineHeight: 1,
                }}
                onMouseOver={(e) => (e.currentTarget.style.background = COLORS.btnHover)}
                onMouseOut={(e) => (e.currentTarget.style.background = COLORS.btnBg)}
              >
                +
              </button>
            </form>

            {pErr && <div style={{ color: "#b91c1c", fontSize: 14 }}>{pErr}</div>}

            {loadingPeople ? (
              <div style={{ color: COLORS.textMuted }}>Laden…</div>
            ) : people.length === 0 ? (
              <div style={{ color: COLORS.textMuted }}>Nog geen personeel.</div>
            ) : (
              <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {people.map((p) => (
                  <li
                    key={p.id}
                    onMouseEnter={() => setHoveredAvatarId(p.id)}
                    onMouseLeave={() => setHoveredAvatarId(null)}
                    style={{
                      display: "grid",
                      gridTemplateColumns: `28px ${PERSON_FIELD_WIDTH_PX}px ${PERSON_FIELD_WIDTH_PX}px ${PERSON_FIELD_WIDTH_PX}px ${PERSON_FIELD_WIDTH_PX}px auto`,
                      gap: 8,
                      alignItems: "center",
                      borderBottom: `1px solid ${COLORS.line}`,
                      padding: "8px 0",
                      position: "relative",
                    }}
                  >
                    {/* Avatar: leeg = klikbare cirkel + plus-overlay op hover */}
                    <div style={{ width: 28, height: 28, position: "relative" }}>
                      {p.avatar_url ? (
                        <>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={p.avatar_url} alt="avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          {hoveredAvatarId === p.id && (
                            <button
                              aria-label="Avatar verwijderen"
                              onClick={() => askDeleteAvatar(p)}
                              title="Verwijder avatar"
                              style={{
                                position: "absolute",
                                inset: 0,
                                border: "none",
                                background: "rgba(239,68,68,0.6)",
                                color: "#fff",
                                fontSize: 18,
                                fontWeight: 800,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                cursor: "pointer",
                              }}
                            >
                              ×
                            </button>
                          )}
                        </>
                      ) : (
                        <>
                          <div
                            onClick={() => (document.getElementById(`file-${p.id}`) as HTMLInputElement | null)?.click()}
                            aria-label="lege avatar - klik om te uploaden"
                            title="Klik om avatar te uploaden"
                            style={{
                              width: "100%",
                              height: "100%",
                              borderRadius: "50%",
                              border: `1px solid ${COLORS.line}`,
                              cursor: "pointer",
                              position: "relative",
                            }}
                          />
                          {/* Plus-overlay bij hover op lege avatar */}
                          {hoveredAvatarId === p.id && (
                            <button
                              aria-label="Upload foto"
                              onClick={() => (document.getElementById(`file-${p.id}`) as HTMLInputElement | null)?.click()}
                              title="Foto uploaden"
                              style={{
                                position: "absolute",
                                inset: 0,
                                border: "none",
                                background: "rgba(14,165,168,0.15)",
                                color: COLORS.primary,
                                fontSize: 18,
                                fontWeight: 800,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                cursor: "pointer",
                              }}
                            >
                              +
                            </button>
                          )}
                          <input id={`file-${p.id}`} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => handleAvatarFileChange(p, e)} />
                        </>
                      )}
                    </div>

                    <input value={p.name} onChange={(e) => updatePersonField(p.id, "name", e.target.value)} placeholder="voornaam" style={{ ...baseField, height: 32, width: PERSON_FIELD_WIDTH_PX }} />
                    <input
                      value={p.surname ?? ""}
                      onChange={(e) => updatePersonField(p.id, "surname", e.target.value)}
                      placeholder="achternaam"
                      style={{ ...baseField, height: 32, width: PERSON_FIELD_WIDTH_PX }}
                    />
                    <input
                      type="date"
                      value={p.birthdate ?? ""}
                      onChange={(e) => updatePersonField(p.id, "birthdate", e.target.value)}
                      placeholder="geboortedatum"
                      style={{ ...baseField, height: 32, width: PERSON_FIELD_WIDTH_PX }}
                    />
                    <select
                      value={p.status ?? (statusOptions[0] || "")}
                      onChange={(e) => updatePersonField(p.id, "status", e.target.value)}
                      style={{ ...baseField, height: 32, width: PERSON_FIELD_WIDTH_PX }}
                    >
                      {statusOptions.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>

                    {/* Acties naast elkaar */}
                    <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                      <button
                        aria-label="Opslaan"
                        title="Opslaan"
                        onClick={() => savePerson(p)}
                        style={{
                          background: "transparent",
                          border: `1px solid ${COLORS.line}`,
                          height: 32,
                          width: 32,
                          borderRadius: 8,
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          cursor: "pointer",
                        }}
                      >
                        <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={COLORS.primary} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                          <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                          <polyline points="17 21 17 13 7 13 7 21" />
                          <polyline points="7 3 7 8 15 8" />
                        </svg>
                      </button>
                      <button
                        aria-label="Verwijderen"
                        title="Verwijderen"
                        onClick={() => askDeletePerson(p)}
                        style={{
                          background: "transparent",
                          border: "none",
                          height: 32,
                          width: 32,
                          borderRadius: 8,
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          cursor: "pointer",
                        }}
                      >
                        <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={COLORS.primary} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                          <line x1="10" y1="11" x2="10" y2="17" />
                          <line x1="14" y1="11" x2="14" y2="17" />
                        </svg>
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </main>

      {/* ---------- De confirm modal ---------- */}
      <ConfirmModal
        open={confirm.open}
        title={confirm.open ? confirm.title : ""}
        message={confirm.open ? confirm.message : ""}
        confirmLabel={confirm.open && confirm.confirmLabel ? confirm.confirmLabel : "Verwijderen"}
        cancelLabel="Annuleren"
        onConfirm={handleConfirmProceed}
        onCancel={handleConfirmCancel}
      />
    </>
  )
}
