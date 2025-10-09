"use client";

import React from "react";
import {
  COLORS as TCOLORS,
  HEADER_BTN as THEADER_BTN,
  YEARBAR as TYEARBAR,
  YearDetailRow,
  YearTotals,
  tellerSaldoLabel,
  firstCap,
  canonicalDaypart,
  formatDateShort,
  Personnel,
  LeaveRequest,
} from "./page";
import { supabase } from "@/lib/supabaseClient";

/* ========== KOLOMBREEDTES (zoals jij instelde) ========== */
const PERSON_SELECT_WIDTH = 140; // px
const COLS_PERSON = {
  spacer: "4px",
  date: "105px",
  daypart: "105px",
  hours: "40px", // smal
  entitlement: "90px",
  actions: "72px", // ✎ / save / delete
};
const GRID_PERSON = `${COLS_PERSON.spacer} ${COLS_PERSON.date} ${COLS_PERSON.daypart} ${COLS_PERSON.hours} ${COLS_PERSON.entitlement} ${COLS_PERSON.actions}`;

/* ========== Iconen (zelfde stijl als admin page) ========== */
function IconSave({ color, size = 18 }: { color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
      <polyline points="17 21 17 13 7 13 7 21" />
      <polyline points="7 3 7 8 15 8" />
    </svg>
  );
}
function IconTrash({ color, size = 18 }: { color: string; size?: number }) {
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

/* ========== Confirm Modal ========== */
type ConfirmState =
  | { open: false }
  | {
      open: true;
      title: string;
      message: string;
      confirmLabel?: string;
      cancelLabel?: string;
      onConfirm: () => void;
    };

function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = "Verwijderen",
  cancelLabel = "Annuleren",
  onConfirm,
  onCancel,
  COLORS,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  COLORS: typeof TCOLORS;
}) {
  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "grid", placeItems: "center", zIndex: 50 }}
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
          fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <div aria-hidden style={{ width: 28, height: 28, borderRadius: 8, background: "#fee2e2", display: "grid", placeItems: "center", border: "1px solid #fecaca" }}>
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
          <button onClick={onCancel} style={{ height: 36, padding: "0 12px", borderRadius: 8, border: `1px solid ${COLORS.line}`, background: "#fff", cursor: "pointer", fontWeight: 700 }}>
            {cancelLabel}
          </button>
          <button onClick={onConfirm} style={{ height: 36, padding: "0 14px", borderRadius: 8, border: `1px solid #ef4444`, background: "#ef4444", color: "#fff", cursor: "pointer", fontWeight: 800 }}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ========== Uren helpers ========== */
function toCommaString(val: unknown): string {
  if (val === null || val === undefined) return "";
  if (typeof val === "string") {
    const t = val.trim();
    if (t === "") return "";
    const asNum = Number(t.replace(",", "."));
    return Number.isFinite(asNum) ? String(asNum).replace(".", ",") : t;
  }
  const n = Number(val);
  if (!Number.isFinite(n)) return "";
  return String(n).replace(".", ",");
}
function parseHoursTextToNumber(txt: string | null | undefined): number | null {
  if (!txt) return null;
  const clean = txt.trim();
  if (clean === "") return null;
  const n = Number(clean.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}
function hasHours(row: any): boolean {
  if (!row) return false;
  const v = row.hours;
  if (v === null || v === undefined) return false;
  const num = typeof v === "string" ? Number(v.replace(",", ".")) : Number(v);
  return Number.isFinite(num);
}

/* ===== Types ===== */
type UpdatePayload = {
  leave_date: string;
  daypart: string;
  hours: number | null; // DB numeric (met punt)
  entitlement: string;
};
type DraftPayload = UpdatePayload & {
  hoursText: string; // UI tekstbuffer (met komma tijdens typen)
};

type Props = {
  COLORS: typeof TCOLORS;
  HEADER_BTN: typeof THEADER_BTN;
  YEARBAR: typeof TYEARBAR;
  variableFontClass: string;
  titleFontClass: string;

  people: Personnel[];
  selectedPersonId: string;
  setSelectedPersonId: (id: string) => void;
  personYear: number;
  setPersonYear: (fn: (y: number) => number) => void;

  personApproved: LeaveRequest[];
  personRequested: LeaveRequest[];

  yearSaldo: Record<string, number>;
  yearDetails: Record<string, YearDetailRow[]>;
  yearTotals: Record<string, YearTotals>;
  openSaldo: { scope: "left" | "right"; key: string } | null;

  onClickSaldoBadge: (key: string) => void;

  onUpdateLeaveRequest?: (id: string, payload: UpdatePayload) => Promise<void> | void;
  onDeleteLeaveRequest?: (id: string) => Promise<void> | void;

  entitlementOptions?: string[];
};

export default function OverviewPerPersonCard(props: Props) {
  const {
    COLORS, HEADER_BTN, variableFontClass, titleFontClass,
    people, selectedPersonId, setSelectedPersonId,
    personYear, setPersonYear, personApproved, personRequested,
    yearSaldo, yearDetails, yearTotals, openSaldo, onClickSaldoBadge,
    onUpdateLeaveRequest, onDeleteLeaveRequest,
    entitlementOptions = ["wettelijk", "overuren", "adv", "andere"],
  } = props;

  const [hoverRowId, setHoverRowId] = React.useState<string | null>(null);

  // 🔧 HIER WAS DE FOUT — deze regel ontbrak:
  const [confirm, setConfirm] = React.useState<ConfirmState>({ open: false });

  /* Inline edit state */
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [drafts, setDrafts] = React.useState<Record<string, DraftPayload>>({});

  /* Lokale kopie van lijsten voor optimistische updates */
  const [approvedLocal, setApprovedLocal] = React.useState<LeaveRequest[]>(personApproved);
  const [requestedLocal, setRequestedLocal] = React.useState<LeaveRequest[]>(personRequested);

  React.useEffect(() => { setApprovedLocal(personApproved); }, [personApproved]);
  React.useEffect(() => { setRequestedLocal(personRequested); }, [personRequested]);

  /* Helpers om lokale lijst direct te verversen */
  function applyLocalUpdate(id: string, patch: Partial<LeaveRequest>) {
    setApprovedLocal((arr) => {
      const idx = arr.findIndex((x) => String(x.id) === String(id));
      if (idx === -1) return arr;
      const updated = [...arr];
      updated[idx] = { ...updated[idx], ...patch };
      return updated;
    });
    setRequestedLocal((arr) => {
      const idx = arr.findIndex((x) => String(x.id) === String(id));
      if (idx === -1) return arr;
      const updated = [...arr];
      updated[idx] = { ...updated[idx], ...patch };
      return updated;
    });
  }
  function applyLocalDelete(id: string) {
    setApprovedLocal((arr) => arr.filter((x) => String(x.id) !== String(id)));
    setRequestedLocal((arr) => arr.filter((x) => String(x.id) !== String(id)));
  }

  const startEdit = (r: any) => {
    const isoDate =
      typeof r.leave_date === "string"
        ? r.leave_date
        : new Date(r.leave_date).toISOString().slice(0, 10);

    setDrafts((d) => ({
      ...d,
      [r.id]: {
        leave_date: isoDate,
        daypart: r.daypart ?? "Hele dag",
        entitlement: r.entitlement ?? entitlementOptions[0],
        hours: parseHoursTextToNumber(String(r.hours ?? "")),
        hoursText: toCommaString(r.hours),
      },
    }));
    setEditingId(r.id);
  };

  const updateDraft = (id: string, patch: Partial<DraftPayload>) => {
    setDrafts((d) => ({ ...d, [id]: { ...d[id], ...patch } as DraftPayload }));
  };

  const saveEdit = async (id: string) => {
    const draft = drafts[id];
    if (!draft) return;

    const parsedHours = parseHoursTextToNumber(draft.hoursText);
    const toSend: UpdatePayload = {
      leave_date: draft.leave_date,
      daypart: draft.daypart,
      entitlement: draft.entitlement,
      hours: parsedHours,
    };

    try {
      if (onUpdateLeaveRequest) {
        await onUpdateLeaveRequest(id, toSend);
      } else {
        const { error } = await supabase
          .from("leave_requests")
          .update({
            leave_date: toSend.leave_date,
            daypart: toSend.daypart,
            entitlement: toSend.entitlement,
            hours: toSend.hours,
          })
          .eq("id", id)
          .select("id")
          .single();
        if (error) throw error;
      }

      applyLocalUpdate(id, {
        leave_date: toSend.leave_date as any,
        daypart: toSend.daypart as any,
        entitlement: toSend.entitlement as any,
        hours: toSend.hours as any,
      });

      setDrafts((d) => ({
        ...d,
        [id]: {
          ...draft,
          hours: parsedHours,
          hoursText: parsedHours == null ? "" : String(parsedHours).replace(".", ","),
        },
      }));
      setEditingId(null);
    } catch (e) {
      console.error("Bewaren mislukt:", e);
    }
  };

  const askDeleteRow = (id: string) => {
    setConfirm({
      open: true,
      title: "Dag verwijderen?",
      message: "Weet je zeker dat je deze dag wil verwijderen? Dit kan niet ongedaan gemaakt worden.",
      confirmLabel: "Verwijderen",
      onConfirm: async () => {
        try {
          if (onDeleteLeaveRequest) {
            await onDeleteLeaveRequest(id);
          } else {
            const { error } = await supabase.from("leave_requests").delete().eq("id", id);
            if (error) throw error;
          }
          applyLocalDelete(id);
          if (editingId === id) setEditingId(null);
        } catch (e) {
          console.error("Verwijderen mislukt:", e);
        } finally {
          setConfirm({ open: false });
        }
      },
    });
  };

  const DaypartSelect: React.FC<{ value: string; onChange: (v: string) => void; }> = ({ value, onChange }) => (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{ width: "100%", border: `1px solid ${COLORS.line}`, borderRadius: 8, padding: "4px 6px", fontSize: 13, background: "#fff" }}
    >
      {["Hele dag", "Voormiddag", "Namiddag", "Andere"].map((opt) => (
        <option key={opt} value={opt}>{opt}</option>
      ))}
    </select>
  );

  const EntitlementSelect: React.FC<{ value: string; onChange: (v: string) => void; }> = ({ value, onChange }) => (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{ width: "100%", border: `1px solid ${COLORS.line}`, borderRadius: 8, padding: "4px 6px", fontSize: 13, background: "#fff" }}
    >
      {entitlementOptions.map((opt) => (
        <option key={opt} value={opt}>{firstCap(opt)}</option>
      ))}
    </select>
  );

  const HoursInput: React.FC<{ value: string; onChange: (v: string) => void; }> = ({ value, onChange }) => (
    <input
      type="text"
      inputMode="decimal"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{ width: "100%", border: `1px solid ${COLORS.line}`, borderRadius: 8, padding: "4px 6px", fontSize: 13 }}
      placeholder="—"
      autoFocus
    />
  );

  const LeaveRow: React.FC<{ r: any; isLast: boolean }> = ({ r, isLast }) => {
    const isEditing = editingId === r.id;
    const draft = drafts[r.id];
    const showHours = hasHours(r);
    const hoursLabel = toCommaString(r.hours);

    return (
      <li
        onMouseEnter={() => setHoverRowId(r.id)}
        onMouseLeave={() => setHoverRowId(null)}
        style={{
          display: "grid",
          gridTemplateColumns: GRID_PERSON,
          alignItems: "center",
          gap: 6,
          padding: "8px 10px",
          borderBottom: isLast ? "none" : `1px dashed ${COLORS.line}`,
          fontSize: 14,
        }}
      >
        <div />

        {/* Datum */}
        <div style={{ minWidth: 0 }}>
          {!isEditing ? (
            formatDateShort(r.leave_date)
          ) : (
            <input
              type="date"
              value={draft?.leave_date ?? ""}
              onChange={(e) => updateDraft(r.id, { leave_date: e.target.value })}
              style={{ width: "100%", border: `1px solid ${COLORS.line}`, borderRadius: 8, padding: "4px 6px", fontSize: 13 }}
            />
          )}
        </div>

        {/* Dagdeel */}
        <div style={{ color: COLORS.textMuted, textAlign: "center" }}>
          {!isEditing ? (
            firstCap(canonicalDaypart(r.daypart))
          ) : (
            <DaypartSelect value={draft?.daypart ?? "Hele dag"} onChange={(v) => updateDraft(r.id, { daypart: v })} />
          )}
        </div>

        {/* Uren */}
        <div style={{ color: COLORS.textMuted, textAlign: "center" }}>
          {!isEditing ? (
            showHours ? `${hoursLabel} u` : ""
          ) : (
            <HoursInput value={draft?.hoursText ?? ""} onChange={(txt) => updateDraft(r.id, { hoursText: txt })} />
          )}
        </div>

        {/* Entitlement */}
        <div style={{ color: COLORS.textMuted, textAlign: "center" }}>
          {!isEditing ? (
            firstCap(r.entitlement)
          ) : (
            <EntitlementSelect value={draft?.entitlement ?? entitlementOptions[0]} onChange={(v) => updateDraft(r.id, { entitlement: v })} />
          )}
        </div>

        {/* Acties */}
        <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", height: 24, gap: 8 }}>
          {!isEditing ? (
            <button
              type="button"
              onClick={() => startEdit(r)}
              aria-label="Aanpassen"
              title="Aanpassen"
              style={{
                width: 26, height: 26,
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                color: COLORS.primary, background: "transparent", border: "none",
                opacity: hoverRowId === r.id ? 1 : 0.9, cursor: "pointer", fontSize: 18, lineHeight: 1,
              }}
            >
              ✎
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => saveEdit(r.id)}
                aria-label="Bewaren"
                title="Bewaren"
                style={{
                  background: "transparent",
                  height: 26,
                  width: 26,
                  borderRadius: 8,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  border: "none",
                }}
              >
                <IconSave color={COLORS.primary} />
              </button>
              <button
                type="button"
                onClick={() => askDeleteRow(r.id)}
                aria-label="Verwijderen"
                title="Verwijderen"
                style={{
                  background: "transparent",
                  border: "none",
                  height: 26,
                  width: 26,
                  borderRadius: 8,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                }}
              >
                <IconTrash color={COLORS.primary} />
              </button>
            </>
          )}
        </div>
      </li>
    );
  };

  return (
    <>
      <div
        style={{
          background: COLORS.card,
          border: `1px solid ${COLORS.line}`,
          borderRadius: 12,
          padding: 14,
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        {/* Titel */}
        <div style={{ display: "grid", gridTemplateColumns: "6px 1fr", alignItems: "center", columnGap: 8 }}>
          <div style={{ width: 6, height: 18, background: COLORS.primary, borderRadius: 3 }} />
          <h2 className={variableFontClass} style={{ margin: 0, fontSize: 17 }}>Per persoon</h2>
        </div>

        {/* Select + jaar */}
        <div style={{ display: "grid", gridTemplateColumns: `${PERSON_SELECT_WIDTH}px 1fr`, alignItems: "end", gap: 10, marginTop: 2 }}>
          <div style={{ width: PERSON_SELECT_WIDTH }}>
            <label style={{ fontSize: 13, color: COLORS.textMuted, display: "block", marginBottom: 6 }}>Medewerker</label>
            <select
              value={selectedPersonId}
              onChange={(e) => setSelectedPersonId(e.target.value)}
              style={{ width: "100%", padding: "7px 10px", borderRadius: 10, border: `1px solid ${COLORS.line}`, background: "#fff", height: 34, fontSize: 14 }}
            >
              <option value="">—</option>
              {people.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
            </select>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <button
                onClick={() => setPersonYear((y) => y - 1)}
                aria-label={`Ga naar ${personYear - 1}`}
                className={titleFontClass}
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
                onMouseOver={(e) => (e.currentTarget.style.background = THEADER_BTN.hover)}
                onMouseOut={(e) => (e.currentTarget.style.background = THEADER_BTN.bg)}
              >
                ‹
              </button>

              <span className={titleFontClass} style={{ fontSize: 15, fontWeight: 900, minWidth: 48, textAlign: "center" }}>
                {personYear}
              </span>

              <button
                onClick={() => setPersonYear((y) => y + 1)}
                aria-label={`Ga naar ${personYear + 1}`}
                className={titleFontClass}
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
                onMouseOver={(e) => (e.currentTarget.style.background = THEADER_BTN.hover)}
                onMouseOut={(e) => (e.currentTarget.style.background = THEADER_BTN.bg)}
              >
                ›
              </button>
            </div>

            <div style={{ flex: 1 }} />

            {/* Saldo badge rechts */}
            {selectedPersonId && (() => {
              const key = `${selectedPersonId}:${personYear}`;
              const saldoHours = yearSaldo[key] ?? 0;
              const details = yearDetails[key] || [];
              const totals = yearTotals[key];
              const isOpen = openSaldo?.scope === "right" && openSaldo.key === key;

              const safeTotals: YearTotals = totals ?? {
                start: details.reduce((s, r) => s + r.start, 0),
                used: details.reduce((s, r) => s + r.used, 0),
                saldo: details.reduce((s, r) => s + r.saldo, 0),
              };

              return (
                <div data-saldo-pop="true" style={{ position: "relative", display: "inline-flex", alignItems: "flex-start" }}>
                  <button
                    type="button"
                    onClick={() => onClickSaldoBadge(key)}
                    title="Toon details"
                    style={{ fontSize: 12, background: "#ffffff", color: COLORS.text, border: "1px solid rgba(0,0,0,0.08)", padding: "4px 10px", borderRadius: 999, whiteSpace: "nowrap", cursor: "pointer" }}
                  >
                    {tellerSaldoLabel(saldoHours)}
                  </button>

                  <div
                    data-saldo-pop="true"
                    style={{
                      position: "absolute",
                      right: 0,
                      top: "calc(100% + 6px)",
                      transformOrigin: "top right",
                      transform: isOpen ? "scale(1)" : "scale(0.9)",
                      opacity: isOpen ? 1 : 0,
                      pointerEvents: isOpen ? "auto" : "none",
                      transition: "opacity 140ms ease, transform 160ms ease",
                      background: "#ffffff",
                      border: `1px solid ${COLORS.line}`,
                      borderRadius: 12,
                      boxShadow: "0 8px 20px rgba(0,0,0,0.06)",
                      padding: 10,
                      minWidth: 300,
                      zIndex: 10,
                    }}
                  >
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 90px 90px 90px", gap: 8, alignItems: "center", paddingBottom: 6, borderBottom: `1px solid ${COLORS.line}`, fontSize: 12, fontWeight: 600 }}>
                      <div />
                      <div style={{ textAlign: "right" }}>Startsaldo</div>
                      <div style={{ textAlign: "right" }}>Opgenomen</div>
                      <div style={{ textAlign: "right" }}>Saldo</div>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
                      {details.length === 0 ? (
                        <div style={{ fontSize: 12, color: COLORS.textMuted }}>Geen categorieën.</div>
                      ) : (
                        details.map((row) => (
                          <div key={row.reason} style={{ display: "grid", gridTemplateColumns: "1fr 90px 90px 90px", gap: 8, alignItems: "center", fontSize: 12 }}>
                            <div>{firstCap(row.reason)}</div>
                            <div style={{ textAlign: "right" }}>{row.start}</div>
                            <div style={{ textAlign: "right" }}>{row.used}</div>
                            <div style={{ textAlign: "right" }}>{row.saldo}</div>
                          </div>
                        ))
                      )}

                      <div style={{ display: "grid", gridTemplateColumns: "1fr 90px 90px 90px", gap: 8, alignItems: "center", fontSize: 12, marginTop: 6, paddingTop: 6, borderTop: `1px dashed ${COLORS.line}`, fontWeight: 600 }}>
                        <div>Totaal</div>
                        <div style={{ textAlign: "right" }}>{safeTotals.start || 0}</div>
                        <div style={{ textAlign: "right" }}>{safeTotals.used || 0}</div>
                        <div style={{ textAlign: "right" }}>{safeTotals.saldo || 0}</div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>

        {/* Overzicht */}
        {selectedPersonId && (
          <div style={{ marginTop: 4, display: "flex", flexDirection: "column", gap: 10 }}>
            {/* Goedgekeurd */}
            <section>
              <div style={{ background: "#fff", border: `1px solid ${COLORS.line}`, borderRadius: 10, overflow: "hidden" }}>
                <div style={{ padding: "8px 10px", background: COLORS.card, borderBottom: `1px solid ${COLORS.line}`, fontWeight: 700, fontSize: 13 }}>
                  Goedgekeurd
                </div>

                {approvedLocal.length === 0 ? (
                  <div style={{ color: COLORS.textMuted, padding: "8px 10px", fontSize: 13 }}>Nog geen verlof.</div>
                ) : (
                  <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                    {approvedLocal.map((r, idx) => (
                      <LeaveRow key={r.id} r={r} isLast={idx === approvedLocal.length - 1} />
                    ))}
                  </ul>
                )}
              </div>
            </section>

            {/* Aangevraagd */}
            {requestedLocal.length > 0 && (
              <section>
                <div style={{ background: "#fff", border: `1px solid ${COLORS.line}`, borderRadius: 10, overflow: "hidden" }}>
                  <div style={{ padding: "8px 10px", background: COLORS.card, borderBottom: `1px solid ${COLORS.line}`, fontWeight: 700, fontSize: 13 }}>
                    Aangevraagd
                  </div>

                  <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                    {requestedLocal.map((r, idx) => (
                      <LeaveRow key={r.id} r={r} isLast={idx === requestedLocal.length - 1} />
                    ))}
                  </ul>
                </div>
              </section>
            )}
          </div>
        )}
      </div>

      {/* Confirm voor verwijderen */}
      <ConfirmModal
        open={confirm.open}
        title={confirm.open ? confirm.title : ""}
        message={confirm.open ? confirm.message : ""}
        confirmLabel={confirm.open && confirm.confirmLabel ? confirm.confirmLabel : "Verwijderen"}
        onConfirm={confirm.open ? confirm.onConfirm : () => {}}
        onCancel={() => setConfirm({ open: false })}
        COLORS={COLORS}
      />
    </>
  );
}
