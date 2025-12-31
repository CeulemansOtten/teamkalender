"use client";

import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import localFont from "next/font/local";

/* ====== UI (match met page) ====== */
const COLORS = {
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

const SYS_FONT = "system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif";
const baseField: React.CSSProperties = {
  height: 34,
  padding: "6px 10px",
  borderRadius: 8,
  border: `1px solid ${COLORS.line}`,
  background: "#fff",
  fontFamily: SYS_FONT,
  fontSize: 14,
};

/* Breedtes/hoogtes */
const CARD_WIDTH = 457;
const DATE_COL_PX = 150;
const LEFT_PAD_PX = 10;
const DATE_W = 125;
const NAME_W = 210;
const YEAR_W = 80;
const ADD_BTN_W = 34;
const ADD_BTN_H = 30;

/* Iconen */
function IconTrash({ color = COLORS.primary, size = 18 }: { color?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="3 6 5 6 21 6" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  );
}

/* Variable font (zelfde als in admin/page.tsx) */
const variableFont = localFont({
  src: "../fonts/Font_Variable.otf",
  display: "swap",
});

/* Types & helpers */
type Holiday = {
  id: string;
  holiday_date: string;
  name: string;
  type: string;
};
const DOW: Record<number, string> = { 0: "zo", 1: "ma", 2: "di", 3: "woe", 4: "do", 5: "vr", 6: "za" };
const MONTH = ["jan","feb","mrt","apr","mei","jun","jul","aug","sep","okt","nov","dec"];

function parseDateParts(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return { dow: DOW[d.getDay()], day: d.getDate(), month: MONTH[d.getMonth()] };
}

// format either a single date or a consecutive range (omit year)
function formatRangeOrSingle(startIso: string, endIso: string) {
  const a = parseDateParts(startIso);
  const b = parseDateParts(endIso);
  if (startIso === endIso) return `${a.dow} ${a.day} ${a.month}`;
  if (a.month === b.month) return `${a.dow} ${a.day} - ${b.dow} ${b.day} ${a.month}`;
  return `${a.dow} ${a.day} ${a.month} - ${b.dow} ${b.day} ${b.month}`;
}

/* Component */
export default function CardIslamFeestdagToevoegen() {
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [rows, setRows] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [fdDate, setFdDate] = useState("");
  const [fdName, setFdName] = useState("");
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const range = useMemo(() => ({ from: `${year}-01-01`, to: `${year}-12-31` }), [year]);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("holidays")
      .select("id, holiday_date, name, type")
      .eq("type", "islam")
      .gte("holiday_date", range.from)
      .lte("holiday_date", range.to)
      .order("holiday_date", { ascending: true });

    if (error) {
      setErr(error.message || "Kon feestdagen niet laden.");
      setRows([]);
    } else {
      setErr("");
      setRows((data || []) as Holiday[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range.from, range.to]);

  const onAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    if (!fdDate || !fdName.trim()) return setErr("Geef een datum en een naam in.");
    if (new Date(fdDate).getFullYear() !== year) return setErr(`Datum moet in ${year} liggen.`);

    const { error } = await supabase
      .from("holidays")
      .insert({ holiday_date: fdDate, name: fdName.trim(), type: "islam" } as never);
    if (error) return setErr(error.message || "Opslaan mislukt.");

    setFdDate("");
    setFdName("");
    await load();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("holidays").delete().eq("id", id);
    if (error) return setErr(error.message || "Verwijderen mislukt.");
    setRows((prev) => prev.filter((r) => r.id !== id));
  };

  // delete multiple ids (used for grouped ranges)
  const removeMany = async (ids: string[]) => {
    if (!ids || ids.length === 0) return;
    const { error } = await supabase.from("holidays").delete().in("id", ids);
    if (error) return setErr(error.message || "Verwijderen mislukt.");
    const idSet = new Set(ids);
    setRows((prev) => prev.filter((r) => !idSet.has(r.id)));
  };

  function groupHolidays(list: Holiday[]) {
    if (!list || list.length === 0) return [] as Array<{ start: string; end: string; name: string; ids: string[] }>;
    const out: Array<{ start: string; end: string; name: string; ids: string[] }> = [];
    for (const h of list) {
      const dateIso = h.holiday_date;
      if (out.length === 0) {
        out.push({ start: dateIso, end: dateIso, name: h.name, ids: [h.id] });
        continue;
      }
      const last = out[out.length - 1];
      const lastEnd = new Date(last.end + "T00:00:00");
      const cur = new Date(dateIso + "T00:00:00");
      const diffDays = Math.round((cur.getTime() - lastEnd.getTime()) / (1000 * 60 * 60 * 24));
      // merge when same name and dates are consecutive
      if (h.name === last.name && diffDays === 1) {
        last.end = dateIso;
        last.ids.push(h.id);
      } else {
        out.push({ start: dateIso, end: dateIso, name: h.name, ids: [h.id] });
      }
    }
    return out;
  }

  const groups = React.useMemo(() => groupHolidays(rows), [rows]);

  return (
    <div
      style={{
        width: `min(${CARD_WIDTH}px, 100%)`,
        background: COLORS.card,
        border: `1px solid ${COLORS.line}`,
        borderRadius: 12,
        padding: 16,
        display: "flex",
        flexDirection: "column",
        gap: 14,
        fontFamily: SYS_FONT,
      }}
    >
      {/* Titel + jaar */}
      <div style={{ display: "grid", gridTemplateColumns: "6px 1fr auto", alignItems: "center", columnGap: 8 }}>
        <div style={{ width: 6, height: 20, background: COLORS.primary, borderRadius: 3 }} />
        <h2 className={variableFont.className} style={{ margin: 0, fontSize: 18 }}>Islamitische feestdag toevoegen</h2>
        <input
          type="number"
          value={year}
          onChange={(e) =>
            setYear(parseInt(e.target.value || String(new Date().getFullYear()), 10) || new Date().getFullYear())
          }
          aria-label="Jaar"
          style={{ ...baseField, width: YEAR_W }}
          title="Jaar"
        />
      </div>

      {/* Form */}
      <form
        onSubmit={onAdd}
        style={{
          width: "100%",
          display: "grid",
          gridTemplateColumns: `auto ${NAME_W}px ${ADD_BTN_W}px`,
          gap: 10,
          alignItems: "center",
        }}
      >
        <input
          type="date"
          value={fdDate}
          onChange={(e) => setFdDate(e.target.value)}
          style={{ ...baseField, width: DATE_W }}
        />
        <input
          placeholder="Naam (bv. Eid al-Fitr)"
          value={fdName}
          onChange={(e) => setFdName(e.target.value)}
          style={{ ...baseField, width: NAME_W }}
        />
        <button
          type="submit"
          aria-label="Feestdag toevoegen"
          style={{
            height: ADD_BTN_H,
            width: ADD_BTN_W,
            minWidth: ADD_BTN_W,
            background: COLORS.btnBg,
            textAlign: "center",
            color: COLORS.btnText,
            borderRadius: 8,
            cursor: "pointer",
            fontWeight: 800,
            fontSize: 16,
            lineHeight: 1,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          onMouseOver={(e) => (e.currentTarget.style.background = COLORS.btnHover)}
          onMouseOut={(e) => (e.currentTarget.style.background = COLORS.btnBg)}
        >
          +
        </button>
      </form>

      {err && (
        <div
          role="status"
          style={{
            background: "#fef2f2",
            color: "#7f1d1d",
            border: "1px solid #fecaca",
            borderRadius: 10,
            padding: "8px 10px",
            fontSize: 14,
          }}
        >
          {err}
        </div>
      )}

      {/* Subtitel lijst */}
      <div style={{ display: "grid", gridTemplateColumns: "6px 1fr", columnGap: 8 }}>
        <div style={{ width: 6, height: 22, background: COLORS.primary, borderRadius: 3 }} />
        <h3 className={variableFont.className} style={{ margin: 0, fontSize: 16 }}>
          Islamitische feestdagen in {year}
        </h3>
      </div>

      {/* Lijst */}
      {loading ? (
        <div style={{ color: COLORS.textMuted }}>Laden…</div>
      ) : rows.length === 0 ? (
        <div style={{ color: COLORS.textMuted }}>Geen feestdagen gevonden.</div>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {groups.map((g, idx) => (
            <li
              key={`${g.start}_${g.end}_${g.name}_${idx}`}
              onMouseEnter={() => setHoveredIndex(idx)}
              onMouseLeave={() => setHoveredIndex(null)}
              style={{
                display: "grid",
                gridTemplateColumns: `${LEFT_PAD_PX}px ${DATE_COL_PX - LEFT_PAD_PX}px 1fr auto`,
                alignItems: "center",
                borderBottom: `1px solid ${COLORS.line}`,
                padding: "8px 0",
                gap: 5,
              }}
            >
              <div aria-hidden />
              <div style={{ color: COLORS.textMuted, fontSize: 14 }}>
                {formatRangeOrSingle(g.start, g.end)}
              </div>
              <div style={{ color: COLORS.text, fontSize: 15 }}>{g.name}</div>
              <button
                aria-label="Verwijderen"
                onClick={() => removeMany(g.ids)}
                title={g.ids.length > 1 ? `Verwijderen (${g.ids.length} datums)` : "Verwijderen"}
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  opacity: hoveredIndex === idx ? 1 : 0,
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