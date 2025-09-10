"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { supabase } from "@/lib/supabaseClient"

type Person = {
  id: string
  name: string
  surname: string | null
  avatar_url: string | null
  status: string | null
  holiday_teller: number | null
}

export default function HomePage() {
  const [people, setPeople] = useState<Person[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [q, setQ] = useState("")

  useEffect(() => {
    let mounted = true
    ;(async () => {
      setLoading(true)
      setError(null)
      const { data, error } = await supabase
        .from("personnel")
        .select("id, name, surname, avatar_url, status, holiday_teller")
        .order("name", { ascending: true })

      if (!mounted) return
      if (error) setError(error.message ?? "Kon personeelslijst niet laden")
      else setPeople(data ?? [])
      setLoading(false)
    })()
    return () => {
      mounted = false
    }
  }, [])

  const displayName = (p: Person) =>
    p.surname ? `${p.name} ${p.surname}` : p.name

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase()
    const sorted = [...people].sort((a, b) =>
      displayName(a).localeCompare(displayName(b), "nl")
    )
    if (!term) return sorted
    return sorted.filter((p) =>
      displayName(p).toLowerCase().includes(term)
    )
  }, [people, q])

  const styles: { [k: string]: React.CSSProperties } = {
    page: { padding: 24, maxWidth: 1100, margin: "0 auto" },
    title: { fontSize: 24, fontWeight: 700, marginBottom: 12 },
    toolbar: {
      display: "flex",
      gap: 12,
      alignItems: "center",
      marginBottom: 16,
      flexWrap: "wrap",
    },
    input: {
      padding: "8px 10px",
      border: "1px solid #d1d5db",
      borderRadius: 8,
      minWidth: 260,
      outline: "none",
    },
    tableWrap: {
      overflowX: "auto",
      background: "#fff",
      borderRadius: 12,
      boxShadow: "0 1px 3px rgba(0,0,0,.06)",
    },
    table: { width: "100%", borderCollapse: "separate", borderSpacing: 0 },
    th: {
      textAlign: "left",
      fontSize: 13,
      color: "#475569",
      padding: "12px 14px",
      borderBottom: "1px solid #e5e7eb",
      background: "#f8fafc",
      position: "sticky",
      top: 0,
      zIndex: 1,
    },
    td: { padding: "12px 14px", borderBottom: "1px solid #f1f5f9", verticalAlign: "middle" },
    row: {},
    btn: {
      display: "inline-block",
      padding: "8px 12px",
      borderRadius: 8,
      border: "1px solid #0891B2",
      background: "#0ea5a8",
      color: "#fff",
      cursor: "pointer",
      fontSize: 14,
      textDecoration: "none",
      whiteSpace: "nowrap",
    },
    muted: { color: "#64748b", fontSize: 13 },
    error: {
      padding: 12,
      background: "#fef2f2",
      color: "#991b1b",
      border: "1px solid #fecaca",
      borderRadius: 8,
      marginBottom: 12,
    },
    empty: { padding: 20, textAlign: "center", color: "#64748b", fontSize: 14 },
    nameCell: { display: "flex", alignItems: "center", gap: 10 },
    avatar: {
      width: 28,
      height: 28,
      borderRadius: "50%",
      objectFit: "cover",
      background: "#e2e8f0",
      display: "inline-block",
    },
    statusPill: (status?: string | null): React.CSSProperties => ({
      display: "inline-block",
      padding: "2px 8px",
      borderRadius: 999,
      fontSize: 12,
      background:
        status === "active" ? "#ecfeff" : status === "inactive" ? "#fee2e2" : "#f1f5f9",
      color:
        status === "active" ? "#0e7490" : status === "inactive" ? "#991b1b" : "#475569",
      border:
        status === "active" ? "1px solid #a5f3fc" : status === "inactive" ? "1px solid #fecaca" : "1px solid #e5e7eb",
    }),
  }

  return (
    <main style={styles.page}>
      <h1 style={styles.title}>Personeel</h1>

      <div style={styles.toolbar}>
        <input
          style={styles.input}
          placeholder="Zoeken op naam…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {error && <div style={styles.error}>Fout: {error}</div>}

      <div style={styles.tableWrap}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Naam</th>
              <th style={styles.th}>Status</th>
              <th style={{ ...styles.th, width: 1 }}>Acties</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td style={styles.td} colSpan={3}>
                  <span style={styles.muted}>Laden…</span>
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td style={styles.td} colSpan={3}>
                  <div style={styles.empty}>Geen personen gevonden.</div>
                </td>
              </tr>
            ) : (
              filtered.map((p) => (
                <tr key={p.id} style={styles.row}>
                  <td style={styles.td}>
                    <span style={styles.nameCell}>
                      {p.avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.avatar_url} alt="" style={styles.avatar} />
                      ) : (
                        <span style={styles.avatar} />
                      )}
                      {displayName(p)}
                    </span>
                  </td>
                  <td style={styles.td}>
                    <span style={styles.statusPill(p.status)}>{p.status ?? "—"}</span>
                  </td>
                  <td style={styles.td}>
                    <Link
                      href={`/vacation_request?personnel_id=${p.id}`}
                      style={styles.btn}
                    >
                      Open kalender
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p style={{ marginTop: 10, ...styles.muted }}>
        Klik op <strong>Open kalender</strong> om naar <code>/vacation_request?personnel_id=…</code> te gaan.
      </p>
    </main>
  )
}
