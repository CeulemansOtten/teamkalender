// app/admin/CardSchoolvakantieToevoegen.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

const UI = {
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

/* ▼ toegevoegd: SYS_FONT constant */
const SYS_FONT = "system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif";

const field: React.CSSProperties = {
  height: 36,
  padding: "6px 10px",
  borderRadius: 8,
  border: `1px solid ${UI.line}`,
  background: "#fff",
  fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
  fontSize: 14,
};

/* === Iconen uit oorspronkelijke pagina === */
function IconTrash({ color = UI.primary, size = 18 }: { color?: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polyline points="3 6 5 6 21 6" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  );
}

function IconSave({ color = UI.primary, size = 18 }: { color?: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
      <polyline points="17 21 17 13 7 13 7 21" />
      <polyline points="7 3 7 8 15 8" />
    </svg>
  );
}

/* === Component === */
type Holiday = { id: string; holiday_date: string; name: string; type: string };

function* eachDateInclusive(startISO: string, endISO: string) {
  const start = new Date(startISO + "T00:00:00");
  const end = new Date(endISO + "T00:00:00");
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    yield d.toISOString().slice(0, 10);
  }
}

const DOW: Record<number, string> = { 0: "zo", 1: "ma", 2: "di", 3: "woe", 4: "do", 5: "vr", 6: "za" };
const MONTH = ["jan", "feb", "mrt", "apr", "mei", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];
function parseDateParts(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return { dow: DOW[d.getDay()], day: d.getDate(), month: MONTH[d.getMonth()] };
}

const fmtRange = (s: string, e: string) => {
  const a = parseDateParts(s);
  const b = parseDateParts(e);
  if (s === e) return `${a.dow} ${a.day} ${a.month}`;
  if (a.month === b.month) return `${a.dow} ${a.day} - ${b.dow} ${b.day} ${a.month}`;
  return `${a.dow} ${a.day} ${a.month} - ${b.dow} ${b.day} ${b.month}`;
};

export default function CardSchoolvakantieToevoegen() {
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [svStart, setSvStart] = useState("");
  const [svEnd, setSvEnd] = useState("");
  const [svName, setSvName] = useState("");
  const [rows, setRows] = useState<Holiday[]>([]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [hoveredName, setHoveredName] = useState<string | null>(null);

  const range = useMemo(
    () => ({ from: `${year}-01-01`, to: `${year}-12-31` }),
    [year]
  );

  // Ophalen vakanties
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("holidays")
        .select("id, holiday_date, name, type")
        .eq("type", "school")
        .gte("holiday_date", range.from)
        .lte("holiday_date", range.to)
        .order("holiday_date", { ascending: true });
      setRows((data || []) as Holiday[]);
    })();
  }, [range]);

  // Toevoegen nieuwe vakantie
  const onAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");

    if (!svStart || !svEnd || !svName.trim()) return setErr("Geef start, einde en naam in.");
    if (new Date(svEnd) < new Date(svStart)) return setErr("Einde mag niet vóór start liggen.");
    if (
      new Date(svStart).getFullYear() !== year ||
      new Date(svEnd).getFullYear() !== year
    )
      return setErr(`Periode moet in ${year} liggen.`);

    setSaving(true);
    const toInsert: Partial<Holiday>[] = [];
    for (const d of eachDateInclusive(svStart, svEnd))
      toInsert.push({ holiday_date: d, name: svName.trim(), type: "school" });
    await supabase.from("holidays").insert(toInsert as never);

    const { data } = await supabase
      .from("holidays")
      .select("id, holiday_date, name, type")
      .eq("type", "school")
      .gte("holiday_date", range.from)
      .lte("holiday_date", range.to)
      .order("holiday_date", { ascending: true });
    setRows((data || []) as Holiday[]);
    setSvStart("");
    setSvEnd("");
    setSvName("");
    setSaving(false);
  };

  // Verwijderen groep
  const removeGroup = async (name: string) => {
    await supabase.from("holidays").delete().eq("type", "school").eq("name", name);
    setRows((prev) => prev.filter((r) => r.name !== name));
  };

  // Groeperen
  const grouped = useMemo(() => {
    const byName: Record<string, Holiday[]> = {};
    rows.forEach((r) => {
      if (!byName[r.name]) byName[r.name] = [];
      byName[r.name].push(r);
    });
    return Object.entries(byName).map(([name, list]) => {
      const sorted = [...list].sort(
        (a, b) =>
          new Date(a.holiday_date).getTime() - new Date(b.holiday_date).getTime()
      );
      return { name, start: sorted[0].holiday_date, end: sorted.at(-1)!.holiday_date };
    });
  }, [rows]);

  return (
    <div
      style={{
        width: "min(560px, 100%)",
        background: UI.card,
        border: `1px solid ${UI.line}`,
        borderRadius: 12,
        padding: 16,
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
      {/* Titel + Jaar */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "6px 1fr auto",
          alignItems: "center",
          columnGap: 8,
        }}
      >
        <div style={{ width: 6, height: 20, background: UI.primary, borderRadius: 3 }} />
        <h2 style={{ margin: 0, fontSize: 18 }}>Schoolvakanties toevoegen</h2>
        <input
          type="number"
          value={year}
          onChange={(e) =>
            setYear(
              parseInt(e.target.value || String(new Date().getFullYear()), 10) ||
                new Date().getFullYear()
            )
          }
          style={{ ...field, width: 90, height: 32 }}
          title="Jaar"
        />
      </div>

      {/* Toevoegen formulier */}
      <form
        onSubmit={onAdd}
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1.4fr auto",
          gap: 10,
          alignItems: "center",
        }}
      >
        <input type="date" value={svStart} onChange={(e) => setSvStart(e.target.value)} style={field} />
        <input type="date" value={svEnd} onChange={(e) => setSvEnd(e.target.value)} style={field} />
        <input
          placeholder="Naam (bv. Zomervakantie)"
          value={svName}
          onChange={(e) => setSvName(e.target.value)}
          style={field}
        />
        <button
          type="submit"
          disabled={saving}
          style={{
            height: 36,
            minWidth: 36,
            background: UI.btnBg,
            border: `1px solid ${UI.btnBorder}`,
            color: UI.btnText,
            borderRadius: 8,
            cursor: "pointer",
            fontWeight: 800,
            fontSize: 18,
            lineHeight: 1,
          }}
          onMouseOver={(e) => (e.currentTarget.style.background = UI.btnHover)}
          onMouseOut={(e) => (e.currentTarget.style.background = UI.btnBg)}
        >
          +
        </button>
      </form>

      {err && <div style={{ color: "#b91c1c", fontSize: 14 }}>{" "}{err}</div>}

      {/* Lijst */}
      <div style={{ display: "grid", gridTemplateColumns: "6px 1fr", columnGap: 8 }}>
        <div style={{ width: 6, height: 18, background: UI.primary, borderRadius: 3 }} />
        <h3 style={{ margin: 0, fontSize: 16 }}>Schoolvakanties in {year}</h3>
      </div>

      {grouped.length === 0 ? (
        <div style={{ color: UI.textMuted }}>Nog geen schoolvakanties gevonden.</div>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {grouped.map((g) => (
            <li
              key={g.name}
              onMouseEnter={() => setHoveredName(g.name)}
              onMouseLeave={() => setHoveredName(null)}
              style={{
                display: "grid",
                /* ▼ smalle kolom vóór de naam toegevoegd */
                gridTemplateColumns: "12px 200px 1fr auto",
                alignItems: "center",
                borderBottom: `1px solid ${UI.line}`,
                padding: "8px 0",
                gap: 8,
              }}
            >
              {/* smalle spacer-kolom */}
              <div aria-hidden />
              {/* naam in SYS_FONT, 14px */}
              <div style={{ color: UI.textMuted, fontFamily: SYS_FONT, fontSize: 14 }}>
                {fmtRange(g.start, g.end)}
              </div>
              {/* datumbereik in SYS_FONT, 14px */}
              <div style={{ color: UI.text, fontSize: 14, fontFamily: SYS_FONT }}>
                {g.name}
              </div>
              <button
                aria-label="Verwijderen"
                onClick={() => removeGroup(g.name)}
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  /* ▼ hier aangepast: alleen zichtbaar bij hover */
                  opacity: hoveredName === g.name ? 1 : 0,
                  transition: "opacity 120ms ease",
                }}
              >
                <IconTrash />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
