// app/admin/CardWachtToevoegen.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import localFont from "next/font/local";

/* ====== UI (match met andere admin cards) ====== */
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

const CARD_WIDTH = 457;
const ADD_BTN_W = 30;
const ADD_BTN_H = 30;
const DATE_COL_PX = 85;
const PHARM_COL_PX = 160;
const LEFT_PAD_PX = 10;

const plusBtnStyle: React.CSSProperties = {
  height: 30,
  width: 30,
  minWidth: 30,
  padding: 0,
  border: "none",
  background: COLORS.btnBg,   // of UI.btnBg in Schoolvakantie file
  color: "#fff",
  borderRadius: 8,
  cursor: "pointer",
  fontWeight: 800,
  fontSize: 18,
  lineHeight: 1,
  display: "grid",
  placeItems: "center",
};

const variableFont = localFont({
  src: "../fonts/Font_Variable.otf",
  display: "swap",
});

function IconTrash({ color = COLORS.primary, size = 18 }: { color?: string; size?: number }) {
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

function ChevronRight({ color = COLORS.primary, size = 20 }: { color?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <polyline
        points="9 6 15 12 9 18"
        stroke={color}
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChevronLeft({ color = COLORS.primary, size = 20 }: { color?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <polyline
        points="15 6 9 12 15 18"
        stroke={color}
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

type OndutyRow = {
  id: string;
  date: string; // YYYY-MM-DD
  pharmacy: string;
  night: string; // "ja" | "nee" (text)
};

const DOW: Record<number, string> = { 0: "zo", 1: "ma", 2: "di", 3: "woe", 4: "do", 5: "vr", 6: "za" };
const MONTH = ["jan", "feb", "mrt", "apr", "mei", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];
function formatSingleDate(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return `${DOW[d.getDay()]} ${d.getDate()} ${MONTH[d.getMonth()]}`;
}

const PHARMACIES = ["Eeuwfeest", "Generaal", "Minerva"] as const;

function toDbPharmacy(value: (typeof PHARMACIES)[number]) {
  switch (value) {
    case "Eeuwfeest":
      return "Eeuwfeestapotheek";
    case "Generaal":
      return "Apotheek Generaal";
    case "Minerva":
      return "Apotheek Minerva";
  }
}

export default function CardWachtToevoegen() {
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [wachtDate, setWachtDate] = useState<string>("");
  const [pharmacy, setPharmacy] = useState<"" | (typeof PHARMACIES)[number]>("");
  const [inclNight, setInclNight] = useState(false);

  const ITEMS_PER_PAGE = 5;
  const [page, setPage] = useState<number>(1);
  const didAutoJumpRef = useRef(false);

  const range = useMemo(() => ({ from: `${year}-01-01`, to: `${year}-12-31` }), [year]);

  const [rows, setRows] = useState<OndutyRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string>("");
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const existingKeySet = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) set.add(`${r.date}__${r.pharmacy}`);
    return set;
  }, [rows]);

  const load = async () => {
    setLoading(true);
    setErr("");

    const { data, error } = await supabase
      .from("onduty")
      .select("id, date, pharmacy, night")
      .gte("date", range.from)
      .lte("date", range.to)
      .order("date", { ascending: true })
      .order("pharmacy", { ascending: true });

    if (error) {
      setErr(error.message || "Kon wachten niet laden.");
      setRows([]);
    } else {
      setRows((data || []) as OndutyRow[]);
    }

    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range.from, range.to]);

  useEffect(() => {
    // Houd de datum-picker in het gekozen jaar (simpelste gedrag)
    if (wachtDate && wachtDate.slice(0, 4) !== String(year)) setWachtDate("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year]);

  useEffect(() => {
    setPage(1);
    didAutoJumpRef.current = false;
  }, [year]);

  useEffect(() => {
    if (didAutoJumpRef.current) return;
    if (rows.length === 0) return;

    const today = new Date();
    const todayMs = new Date(today.toISOString().slice(0, 10) + "T00:00:00").getTime();

    let bestIndex = 0;
    let bestDiff = Number.POSITIVE_INFINITY;

    for (let i = 0; i < rows.length; i++) {
      const rowMs = new Date(rows[i].date + "T00:00:00").getTime();
      const diff = Math.abs(rowMs - todayMs);
      if (diff < bestDiff) {
        bestDiff = diff;
        bestIndex = i;
      }
    }

    setPage(Math.floor(bestIndex / ITEMS_PER_PAGE) + 1);
    didAutoJumpRef.current = true;
  }, [rows]);

  const totalPages = useMemo(() => {
    const pages = Math.ceil(rows.length / ITEMS_PER_PAGE);
    return Math.max(1, pages);
  }, [rows.length]);

  useEffect(() => {
    setPage((p) => Math.min(Math.max(1, p), totalPages));
  }, [totalPages]);

  const pageRows = useMemo(() => {
    const start = (page - 1) * ITEMS_PER_PAGE;
    return rows.slice(start, start + ITEMS_PER_PAGE);
  }, [rows, page]);

  const pageItems = useMemo(() => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const items: Array<number | "…"> = [];
    const push = (v: number | "…") => {
      if (items[items.length - 1] !== v) items.push(v);
    };

    push(1);

    if (page > 3) push("…");
    const start = Math.max(2, page - 1);
    const end = Math.min(totalPages - 1, page + 1);
    for (let p = start; p <= end; p++) push(p);
    if (page < totalPages - 2) push("…");

    push(totalPages);
    return items;
  }, [page, totalPages]);

  const onAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");

    if (!wachtDate) return setErr("Kies een datum.");
    if (!pharmacy) return setErr("Kies een apotheek.");

    const dbPharmacy = toDbPharmacy(pharmacy);

    if (existingKeySet.has(`${wachtDate}__${dbPharmacy}`)) {
      return setErr("Er bestaat al een wacht voor deze datum en apotheek.");
    }

    setSaving(true);
    const { error } = await supabase.from("onduty").insert({
      date: wachtDate,
      pharmacy: dbPharmacy,
      night: inclNight ? "ja" : "nee",
    } as never);

    if (error) {
      setSaving(false);
      return setErr(error.message || "Opslaan mislukt.");
    }

    await load();
    setSaving(false);
  };

  const remove = async (id: string) => {
    setErr("");
    const { error } = await supabase.from("onduty").delete().eq("id", id);
    if (error) return setErr(error.message || "Verwijderen mislukt.");
    setRows((prev) => prev.filter((r) => r.id !== id));
  };

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
        color: COLORS.text,
      }}
    >
      {/* Titel */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "6px 1fr auto",
          alignItems: "center",
          columnGap: 8,
        }}
      >
        <div style={{ width: 6, height: 20, background: COLORS.primary, borderRadius: 3 }} />
        <h2 className={variableFont.className} style={{ margin: 0, fontSize: 18 }}>
          Wacht toevoegen
        </h2>

        <input
          type="number"
          value={year}
          onChange={(e) =>
            setYear(
              parseInt(e.target.value || String(new Date().getFullYear()), 10) || new Date().getFullYear()
            )
          }
          aria-label="Jaar"
          style={{ ...baseField, width: 80, height: 32 }}
          title="Jaar"
        />
      </div>

      {/* Form */}
      <form onSubmit={onAdd} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "nowrap" }}>
          <input
            type="date"
            value={wachtDate}
            onChange={(e) => setWachtDate(e.target.value)}
            style={{ ...baseField, width: 120 }}
            aria-label="Datum"
          />

          <select
            value={pharmacy}
            onChange={(e) => setPharmacy(e.target.value as (typeof PHARMACIES)[number])}
            style={{ ...baseField, width: 120 }}
            aria-label="Apotheek"
          >
            <option value="" disabled hidden />
            {PHARMACIES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>

          <label
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              height: 34,
              padding: "0 10px",
              borderRadius: 8,
              border: `1px solid ${COLORS.line}`,
              background: "#fff",
              fontFamily: SYS_FONT,
              fontSize: 14,
              whiteSpace: "nowrap",
              userSelect: "none",
            }}
          >
            <input
              type="checkbox"
              checked={inclNight}
              onChange={(e) => setInclNight(e.target.checked)}
              aria-label="Incl nacht"
            />
            incl nacht
          </label>

          <button
            type="submit"
            disabled={saving}
            aria-label="Wacht toevoegen"
           style={{
    ...plusBtnStyle,
    cursor: saving ? "not-allowed" : "pointer",
    opacity: saving ? 0.85 : 1,
  }}
            onMouseOver={(e) => {
              if (!saving) e.currentTarget.style.background = COLORS.btnHover;
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = COLORS.btnBg;
            }}
          >
            +
          </button>
        </div>

        {err ? (
          <div style={{ color: "#b91c1c", fontSize: 13 }}>{err}</div>
        ) : null}
      </form>

      {/* Subtitel lijst (zelfde stijl als andere cards) */}
      <div style={{ display: "grid", gridTemplateColumns: "6px 1fr", columnGap: 8, marginTop: 10 }}>
        <div style={{ width: 6, height: 22, background: COLORS.primary, borderRadius: 3 }} />
        <h3 className={variableFont.className} style={{ margin: 0, fontSize: 16 }}>
          Wachten in {year}
        </h3>
      </div>

      {/* Lijst (zelfde rij-stijl als CardFeestdagToevoegen) */}
      {loading ? (
        <div style={{ color: COLORS.textMuted }}>Laden…</div>
      ) : rows.length === 0 ? (
        <div style={{ color: COLORS.textMuted }}>Geen wachten gevonden.</div>
      ) : (
        <>
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {pageRows.map((r, idx) => (
            <li
              key={r.id}
              onMouseEnter={() => setHoveredId(r.id)}
              onMouseLeave={() => setHoveredId(null)}
              style={{
                display: "grid",
                gridTemplateColumns: `${LEFT_PAD_PX}px ${DATE_COL_PX - LEFT_PAD_PX}px ${PHARM_COL_PX}px 90px auto`,
                alignItems: "center",
                borderBottom: idx === pageRows.length - 1 ? "none" : `1px solid ${COLORS.line}`,
                padding: "8px 0",
                gap: 5,
              }}
            >
              <div aria-hidden />
              <div style={{ color: COLORS.textMuted, fontSize: 14 }}>{formatSingleDate(r.date)}</div>
              <div style={{ color: COLORS.text, fontSize: 15, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.pharmacy}</div>
              <div
                style={{
                  textAlign: "left",
                  color: r.night === "ja" ? COLORS.text : COLORS.textMuted,
                  fontWeight: 400,
                  fontSize: 14,
                }}
              >
                {r.night === "ja" ? "incl nacht" : ""}
              </div>

              <button
                aria-label="Verwijderen"
                onClick={() => remove(r.id)}
                title="Verwijderen"
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  opacity: hoveredId === r.id ? 1 : 0,
                  transition: "opacity 120ms ease",
                }}
              >
                <IconTrash />
              </button>
            </li>
            ))}
          </ul>

          {totalPages > 1 ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                marginTop: 10,
                flexWrap: "wrap",
              }}
            >
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                aria-label="Vorige pagina"
                style={{
                  width: 32,
                  height: 32,
                  padding: 0,
                  borderRadius: 999,
                  border: `1px solid ${COLORS.line}`,
                  background: page === 1 ? "#f1f5f9" : "#fff",
                  color: COLORS.text,
                  cursor: page === 1 ? "not-allowed" : "pointer",
                  fontFamily: SYS_FONT,
                  fontSize: 14,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <ChevronLeft color={page === 1 ? "#cbd5e1" : COLORS.primary} />
              </button>

              {pageItems.map((item, i) =>
                item === "…" ? (
                  <span
                    key={`ellipsis-${i}`}
                    style={{
                      height: 30,
                      display: "inline-flex",
                      alignItems: "center",
                      padding: "0 6px",
                      color: COLORS.textMuted,
                      fontFamily: SYS_FONT,
                      fontSize: 14,
                      userSelect: "none",
                    }}
                    aria-hidden
                  >
                    …
                  </span>
                ) : (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setPage(item)}
                    aria-label={`Pagina ${item}`}
                    style={{
                      height: 30,
                      minWidth: 30,
                      padding: "0 10px",
                      borderRadius: 8,
                      border: `1px solid ${item === page ? COLORS.primary : COLORS.line}`,
                      background: "#fff",
                      color: COLORS.text,
                      cursor: "pointer",
                      fontFamily: SYS_FONT,
                      fontSize: 14,
                      fontWeight: item === page ? 700 : 500,
                    }}
                  >
                    {item}
                  </button>
                )
              )}

              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                aria-label="Volgende pagina"
                style={{
                  width: 32,
                  height: 32,
                  padding: 0,
                  borderRadius: 999,
                  border: `1px solid ${COLORS.line}`,
                  background: page === totalPages ? "#f1f5f9" : "#fff",
                  color: COLORS.text,
                  cursor: page === totalPages ? "not-allowed" : "pointer",
                  fontFamily: SYS_FONT,
                  fontSize: 14,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <ChevronRight color={page === totalPages ? "#cbd5e1" : COLORS.primary} />
              </button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
