// app/admin/CardUrenBeheren.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import localFont from "next/font/local";

/* ====== UI (matching page) ====== */
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
  overlay: "rgba(0,0,0,0.45)",
};

const SYS_FONT = "system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif";

/* Layout-constanten zoals in page */
const CARD_MAX_WIDTH = 370;
const FIELD_W = 120;
const YEAR_W = 80;
const ADD_HOURS_W = 60;

const baseField: React.CSSProperties = {
  height: 36,
  padding: "6px 10px",
  borderRadius: 8,
  border: `1px solid ${COLORS.line}`,
  background: "#fff",
  fontFamily: SYS_FONT,
  fontSize: 14,
};

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
function IconSave({ color = COLORS.primary, size = 18 }: { color?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
      <polyline points="17 21 17 13 7 13 7 21" />
      <polyline points="7 3 7 8 15 8" />
    </svg>
  );
}

/* ====== Types ====== */
type Personnel = {
  id: string;
  name: string;
  surname: string | null;
  avatar_url: string | null;
};
type LeaveEntitlement = {
  id: string;
  personnel_id: string;
  year: number;
  total_hours: number;
  reason: string | null;
};

/* ====== Simple confirm modal (zelfde stijl als elders) ====== */
type ConfirmState =
  | { open: false }
  | {
      open: true;
      title: string;
      message: string;
      ent: LeaveEntitlement;
    };

function ConfirmModal({
  open,
  title,
  message,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onCancel}
      style={{ position: "fixed", inset: 0, background: COLORS.overlay, display: "grid", placeItems: "center", zIndex: 50 }}
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
        <h3 style={{ margin: 0, fontSize: 18, color: COLORS.text }}>{title}</h3>
        <p style={{ margin: "8px 0 14px", color: COLORS.textMuted }}>{message}</p>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button
            onClick={onCancel}
            style={{ height: 36, padding: "0 12px", borderRadius: 8, border: `1px solid ${COLORS.line}`, background: "#fff", cursor: "pointer", fontWeight: 700 }}
          >
            Annuleren
          </button>
          <button
            onClick={onConfirm}
            style={{
              height: 36,
              padding: "0 14px",
              borderRadius: 8,
              border: `1px solid #ef4444`,
              background: "#ef4444",
              color: "#fff",
              cursor: "pointer",
              fontWeight: 800,
            }}
          >
            Verwijderen
          </button>
        </div>
      </div>
    </div>
  );
}

  /* Variable font (zelfde als in admin/page.tsx) */
  const variableFont = localFont({
    src: "../fonts/Font_Variable.otf",
    display: "swap",
  });
  
  
/* ====== Component ====== */
export default function CardUrenBeheren() {
  const [people, setPeople] = useState<Personnel[]>([]);
  const [selectedPersonId, setSelectedPersonId] = useState("");
  const selectedPerson = useMemo(() => people.find((p) => p.id === selectedPersonId) || null, [people, selectedPersonId]);

  const [yearOptions, setYearOptions] = useState<number[]>([]);
  const [year, setYear] = useState<number | "">("");
  const [entitlements, setEntitlements] = useState<LeaveEntitlement[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const [newHours, setNewHours] = useState("");
  const [newReason, setNewReason] = useState<"wettelijk" | "overuren" | "adv" | "andere">("wettelijk");
  const [newYear, setNewYear] = useState<string>("");

  const [confirm, setConfirm] = useState<ConfirmState>({ open: false });

  /* Personeel ophalen (incl. avatar) */
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("personnel")
        .select("id, name, surname, avatar_url")
        .order("name", { ascending: true });
      if (error) {
        setPeople([]);
        setErr(error.message || "Kon personeel niet laden.");
      } else {
        setPeople((data || []) as Personnel[]);
      }
    })();
  }, []);

  /* Jaren voor geselecteerde persoon ophalen */
  useEffect(() => {
    (async () => {
      if (!selectedPersonId) {
        setYearOptions([]);
        setYear("");
        setEntitlements([]);
        setNewYear("");
        return;
      }
      const { data, error } = await supabase
        .from("leave_entitlements")
        .select("year")
        .eq("personnel_id", selectedPersonId)
        .order("year", { ascending: true });

      if (error || !data) {
        setYearOptions([]);
        setYear("");
        setNewYear(String(new Date().getFullYear()));
        return;
      }
      const uniq = Array.from(new Set((data as { year: number }[]).map((r) => r.year))).sort((a, b) => a - b);
      setYearOptions(uniq);
      const current = new Date().getFullYear();
      setYear(uniq.includes(current) ? current : uniq[uniq.length - 1] ?? "");
      setNewYear(String(current));
    })();
  }, [selectedPersonId]);

  /* Urenregels ophalen */
  useEffect(() => {
    (async () => {
      if (!selectedPersonId || !year) {
        setEntitlements([]);
        return;
      }
      setLoading(true);
      setErr("");
      const { data, error } = await supabase
        .from("leave_entitlements")
        .select("id, personnel_id, year, total_hours, reason")
        .eq("personnel_id", selectedPersonId)
        .eq("year", year)
        .order("id", { ascending: true });
      if (error) {
        setErr(error.message || "Kon uren niet laden.");
        setEntitlements([]);
      } else {
        setEntitlements((data || []) as LeaveEntitlement[]);
      }
      setLoading(false);
      setNewYear(String(year));
    })();
  }, [selectedPersonId, year]);

  /* Toevoegen nieuwe regel */
  const addEntitlement = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    if (!selectedPersonId) return setErr("Kies eerst een persoon.");
    // ⬇️ komma pas bij bewaren vervangen door punt
    const hours = parseFloat(newHours.replace(",", "."));
    if (isNaN(hours) || hours <= 0) return setErr("Geef een geldig aantal uren in (> 0).");
    const y = parseInt(newYear, 10);
    if (!y || isNaN(y)) return setErr("Geef een geldig jaar in.");

    const { data, error } = await supabase
      .from("leave_entitlements")
      .insert({ personnel_id: selectedPersonId, year: y, total_hours: hours, reason: newReason } as never)
      .select("id, personnel_id, year, total_hours, reason")
      .single();

    if (error) return setErr(error.message || "Toevoegen mislukt.");
    if (data) {
      if (year === y) setEntitlements((prev) => [...prev, data as LeaveEntitlement]);
      setYearOptions((prev) => (prev.includes(y) ? prev : [...prev, y].sort((a, b) => a - b)));
      setNewHours("");
    }
  };

  /* Opslaan wijziging */
  const saveEntitlement = async (ent: LeaveEntitlement) => {
    setErr("");
    const { error } = await supabase
      .from("leave_entitlements")
      .update({ total_hours: ent.total_hours, reason: ent.reason })
      .eq("id", ent.id);
    if (error) setErr(error.message || "Opslaan mislukt.");
  };

  /* Verwijderen met confirm */
  const askDeleteEntitlement = (ent: LeaveEntitlement) =>
    setConfirm({
      open: true,
      title: "Urenregel verwijderen?",
      message: `Je staat op het punt een urenregel (${ent.total_hours}u${ent.reason ? ` – ${ent.reason}` : ""}, ${ent.year}) te verwijderen. Doorgaan?`,
      ent,
    });

  const doDeleteEntitlement = async (id: string) => {
    setErr("");
    const { error } = await supabase.from("leave_entitlements").delete().eq("id", id);
    if (error) return setErr(error.message || "Verwijderen mislukt.");
    setEntitlements((prev) => prev.filter((e) => e.id !== id));
  };

  /* Inline helpers */
  const updateEntField = (id: string, field: keyof LeaveEntitlement, value: string) => {
    setEntitlements((prev) =>
      prev.map((e) => {
        if (e.id !== id) return e;
        if (field === "total_hours") {
          const v = parseFloat(value.replace(",", "."));
          return { ...e, total_hours: isNaN(v) ? 0 : v };
        }
        return { ...e, [field]: value } as LeaveEntitlement;
      })
    );
  };



  return (
    <>
      <div
        style={{
          width: `min(${CARD_MAX_WIDTH}px, 100%)`,
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
        <div style={{ display: "grid", gridTemplateColumns: "6px 1fr", alignItems: "center", columnGap: 8 }}>
          <div style={{ width: 6, height: 20, background: COLORS.primary, borderRadius: 3 }} />
          <h2 className={variableFont.className} style={{ margin: 0, fontSize: 18 }}>Uren beheren</h2>
        </div>

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

        {/* Persoon + Jaar (met avatar) */}
        <div style={{ display: "grid", gridTemplateColumns: `36px 200px ${YEAR_W}px`, gap: 10, alignItems: "center" }}>
          <div style={{ width: 36, height: 36, overflow: "hidden" }}>
            {selectedPerson?.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={selectedPerson.avatar_url} alt="avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : null}
          </div>

          <select value={selectedPersonId} onChange={(e) => setSelectedPersonId(e.target.value)} style={{ ...baseField, width: 200 }}>
            <option value="">-</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.surname ? ` ${p.surname}` : ""}
              </option>
            ))}
          </select>

          <select
            value={year === "" ? "" : String(year)}
            onChange={(e) => setYear(e.target.value ? parseInt(e.target.value, 10) : "")}
            style={{ ...baseField, width: YEAR_W }}
            disabled={!selectedPersonId}
            title={!selectedPersonId ? "Kies eerst een persoon" : "Jaar"}
          >
            <option value="">—</option>
            {yearOptions.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>

        {/* Lijst met uren */}
        {!selectedPersonId ? (
          <div style={{ color: COLORS.textMuted }}>Kies eerst een persoon.</div>
        ) : loading ? (
          <div style={{ color: COLORS.textMuted }}>Laden…</div>
        ) : entitlements.length === 0 ? (
          <div style={{ color: COLORS.textMuted }}>Nog geen uren voor dit jaar.</div>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {entitlements.map((ent) => (
              <li
                key={ent.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: `${FIELD_W}px ${FIELD_W}px auto`,
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
                  style={{ ...baseField, width: FIELD_W }}
                />
                <select value={ent.reason ?? ""} onChange={(e) => updateEntField(ent.id, "reason", e.target.value)} style={{ ...baseField, width: FIELD_W }}>
                  <option value="wettelijk">wettelijk</option>
                  <option value="overuren">overuren</option>
                  <option value="adv">adv</option>
                  <option value="andere">andere</option>
                </select>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: 6 }}>
                  <button
                    aria-label="Opslaan"
                    title="Opslaan"
                    onClick={() => saveEntitlement(ent)}
                    style={{
                      background: "transparent",
                      height: 32,
                      width: 32,
                      borderRadius: 8,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                    }}
                  >
                    <IconSave />
                  </button>
                  <button
                    aria-label="Verwijderen"
                    title="Verwijderen"
                    onClick={() => askDeleteEntitlement(ent)}
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
                    <IconTrash />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {/* Nieuwe toevoegen (zelfde look) */}
        <form
          onSubmit={addEntitlement}
          style={{
            display: "grid",
            gridTemplateColumns: `${ADD_HOURS_W}px ${FIELD_W}px ${YEAR_W}px 50px`,
            gap: 10,
            alignItems: "center",
            marginTop: 10,
          }}
        >
          {/* ⬇️ Alleen dit veld aangepast: text i.p.v. number; geen zichtbare vervanging van komma */}
          <input
            type="text"
            placeholder="uren"
            value={newHours}
            onChange={(e) => setNewHours(e.target.value)}
            style={{ ...baseField, width: ADD_HOURS_W }}
            disabled={!selectedPersonId}
          />
          <select value={newReason} onChange={(e) => setNewReason(e.target.value as any)} style={{ ...baseField, width: FIELD_W }} disabled={!selectedPersonId}>
            <option value="wettelijk">wettelijk</option>
            <option value="overuren">overuren</option>
            <option value="adv">adv</option>
            <option value="andere">andere</option>
          </select>
          <input
            type="number"
            placeholder="jaar"
            value={newYear}
            onChange={(e) => setNewYear(e.target.value)}
            style={{ ...baseField, width: YEAR_W }}
            disabled={!selectedPersonId}
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
            disabled={!selectedPersonId}
            onMouseOver={(e) => (e.currentTarget.style.background = !selectedPersonId ? COLORS.btnBg : COLORS.btnHover)}
            onMouseOut={(e) => (e.currentTarget.style.background = COLORS.btnBg)}
          >
            +
          </button>
        </form>
      </div>

      {/* Confirm modal voor verwijderen van uur-regel */}
      <ConfirmModal
        open={confirm.open}
        title={confirm.open ? confirm.title : ""}
        message={confirm.open ? confirm.message : ""}
        onConfirm={async () => {
          if (confirm.open) await doDeleteEntitlement(confirm.ent.id);
          setConfirm({ open: false });
        }}
        onCancel={() => setConfirm({ open: false })}
      />
    </>
  );
}
