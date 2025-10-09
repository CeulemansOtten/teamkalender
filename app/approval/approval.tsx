"use client";

import React from "react";
import {
  COLORS as TCOLORS,
  HEADER_BTN as THEADER_BTN,
  YEARBAR as TYEARBAR,
  LeaveRequest,
  YearDetailRow,
  YearTotals,
  tellerSaldoLabel,
  firstCap,
  canonicalDaypart,
  formatDateShort,
} from "./page"; // zelfde map

type Props = {
  COLORS: typeof TCOLORS;
  HEADER_BTN: typeof THEADER_BTN;
  YEARBAR: typeof TYEARBAR;
  variableFontClass: string;
  titleFontClass: string;

  loading: boolean;
  requests: LeaveRequest[];
  entitlementOptions: string[];

  selectedIds: Set<string>;
  editedEntitlements: Record<string, string | null>;
  editedDayparts: Record<string, "hele dag" | "voormiddag" | "namiddag">;

  yearSaldo: Record<string, number>;
  yearDetails: Record<string, YearDetailRow[]>;
  yearTotals: Record<string, YearTotals>;
  openSaldo: { scope: "left" | "right"; key: string } | null;

  conflicts: Record<
    string,
    { approved: { id: string; name: string }[]; requested: { id: string; name: string }[] }
  >;

  onToggleSelect: (id: string) => void;
  onChangeEntitlement: (id: string, v: string | null) => void;
  onChangeDaypart: (id: string, v: "hele dag" | "voormiddag" | "namiddag") => void;

  onClickSaldoBadge: (key: string) => void;

  onBatchApprove: () => void;
  onBatchReject: () => void;
};

export default function ApprovalCard(props: Props) {
  const {
    COLORS,
    YEARBAR,
    variableFontClass,
    titleFontClass,
    // loading/requests/… komen hieronder
    loading,
    requests,
    entitlementOptions,
    selectedIds,
    editedEntitlements,
    editedDayparts,
    yearSaldo,
    yearDetails,
    yearTotals,
    openSaldo,
    conflicts,
    onToggleSelect,
    onChangeEntitlement,
    onChangeDaypart,
    onClickSaldoBadge,
    onBatchApprove,
    onBatchReject,
  } = props;

  // Positie van het paneel (relatief t.o.v. de persoon-card container)
  const [anchor, setAnchor] = React.useState<{ top: number; right: number } | null>(null);

  // --- HULP: namenlijst netjes formatteren ---
  function formatNameList(names: string[]) {
    if (names.length <= 1) return names[0] ?? "";
    if (names.length === 2) return `${names[0]} en ${names[1]}`;
    return `${names.slice(0, -1).join(", ")} en ${names[names.length - 1]}`;
  }

  // Groeperen per persoon → per jaar
  const groupedByPersonAndYear = React.useMemo(() => {
    const personMap = new Map<string, { person: any; byYear: Map<number, LeaveRequest[]> }>();
    for (const r of requests) {
      const p = r.personnel;
      const key = p?.id || "onbekend";
      if (!personMap.has(key)) {
        personMap.set(key, {
          person: { id: p?.id || "?", name: p?.name || "Onbekend", avatar_url: p?.avatar_url ?? null },
          byYear: new Map(),
        });
      }
      const year = new Date(r.leave_date + "T00:00:00").getFullYear();
      const entry = personMap.get(key)!;
      if (!entry.byYear.has(year)) entry.byYear.set(year, []);
      entry.byYear.get(year)!.push(r);
    }
    return Array.from(personMap.values())
      .sort((a, b) => a.person.name.localeCompare(b.person.name))
      .map(({ person, byYear }) => {
        const years = Array.from(byYear.keys()).sort((a, b) => a - b);
        const yearBlocks = years.map((y) => ({
          year: y,
          items: (byYear.get(y) || []).slice().sort((a, b) => a.leave_date.localeCompare(b.leave_date)),
        }));
        return { person, yearBlocks };
      });
  }, [requests]);

  return (
    <div
      style={{
        background: COLORS.card,
        border: `1px solid ${COLORS.line}`,
        borderRadius: 12,
        padding: 16,
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
      <div style={{ display: "grid", gridTemplateColumns: "6px 1fr auto", alignItems: "center", columnGap: 8 }}>
        <div style={{ width: 6, height: 20, background: COLORS.primary, borderRadius: 3 }} />
        <h2 className={variableFontClass} style={{ margin: 0, fontSize: 18 }}>Openstaande aanvragen</h2>
        <span style={{ color: COLORS.textMuted, fontSize: 13 }}>({requests.length})</span>
      </div>

      {/* Lijst */}
      {loading ? (
        <div style={{ color: COLORS.textMuted }}>Laden…</div>
      ) : groupedByPersonAndYear.length === 0 ? (
        <div style={{ color: COLORS.textMuted }}>Geen aanvragen.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {groupedByPersonAndYear.map(({ person, yearBlocks }) => (
            <div
              key={person.id}
              data-person-card
              style={{
                background: "#fff",
                border: `1px solid ${COLORS.line}`,
                borderRadius: 10,
                position: "relative", // overlay positioneert tov deze container
                overflow: "visible",
              }}
            >
              {/* Kop per persoon */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "10px 12px",
                  background: COLORS.card,
                  borderBottom: `1px solid ${COLORS.line}`,
                  borderTopLeftRadius: 10,       // ⬅️ nieuw
                  borderTopRightRadius: 10,      // ⬅️ nieuw
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {person.avatar_url ? (
                    <img src={person.avatar_url} alt={person.name} style={{ width: 18, height: 18, objectFit: "cover" }} />
                  ) : (
                    <div aria-hidden style={{ width: 18, height: 18 }} />
                  )}
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                    <strong style={{ fontSize: 15 }}>{person.name}</strong>
                    <span style={{ color: COLORS.textMuted, fontSize: 13 }}>
                      ({yearBlocks.reduce((acc, y) => acc + y.items.length, 0)} aanvragen)
                    </span>
                  </div>
                </div>
              </div>

              {/* Jaarblokken */}
              {yearBlocks.map(({ year, items }) => {
                const saldoKey = `${person.id}:${year}`;
                const saldoHours = yearSaldo[saldoKey] ?? 0;
                const details = yearDetails[saldoKey] || [];
                const totals = yearTotals[saldoKey];
                const isOpen = openSaldo?.scope === "left" && openSaldo.key === saldoKey;

                const safeTotals: YearTotals = totals ?? {
                  start: details.reduce((s, r) => s + r.start, 0),
                  used: details.reduce((s, r) => s + r.used, 0),
                  saldo: details.reduce((s, r) => s + r.saldo, 0),
                };

                return (
                  <div key={year}>
                    {/* dun streepje */}
                    <div aria-hidden style={{ width: "100%", borderTop: `3px solid ${YEARBAR}` }} />

                    {/* JAARBALK */}
                    <div
                      style={{
                        padding: "8px 12px",
                        background: YEARBAR,
                        borderBottom: `1px solid ${COLORS.line}`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 8,
                      }}
                    >
                      <span style={{ fontWeight: 400, fontSize: 15, color: COLORS.text }}>{year}</span>

                      {/* Saldobadge (klikbaar) */}
                      <div style={{ position: "relative", display: "inline-flex", alignItems: "flex-start" }}>
                        <button
                          type="button"
                          onClick={(e) => {
                            // Bepaal ankerpositie t.o.v. de persoon-card container
                            const btn = e.currentTarget as HTMLElement;
                            const btnRect = btn.getBoundingClientRect();
                            const card = btn.closest("[data-person-card]") as HTMLElement | null;
                            if (card) {
                              const cardRect = card.getBoundingClientRect();
                              setAnchor({
                                top: Math.round(btnRect.bottom - cardRect.top + 6), // 6px onder de pill
                                right: Math.round(cardRect.right - btnRect.right),  // rechts uitlijnen
                              });
                            } else {
                              setAnchor(null);
                            }
                            onClickSaldoBadge(saldoKey); // toggle open/close
                          }}
                          title="Toon details"
                          style={{
                            fontSize: 12,
                            background: "#ffffff",
                            color: COLORS.text,
                            border: "1px solid rgba(0,0,0,0.08)",
                            padding: "4px 10px",
                            borderRadius: 999,
                            whiteSpace: "nowrap",
                            cursor: "pointer",
                          }}
                        >
                          {tellerSaldoLabel(saldoHours)}
                        </button>
                      </div>
                    </div>

                    {/* OVERLAY-paneel (zonder achtergrondlaag) */}
                    {isOpen && (
                      <div style={{ position: "absolute", inset: 0, zIndex: 50, pointerEvents: "none" }}>
                        <div
                          style={{
                            position: "absolute",
                            top: anchor?.top ?? 10,
                            right: anchor?.right ?? 10,
                            background: "#ffffff",
                            border: `1px solid ${COLORS.line}`,
                            borderRadius: 12,
                            boxShadow: "0 8px 20px rgba(0,0,0,0.1)",
                            padding: 12,
                            minWidth: 320,
                            maxWidth: "min(560px, 90vw)",
                            maxHeight: "min(70vh, 80rem)",
                            overflow: "auto",
                            // Alleen het paneel moet interacties pakken:
                            pointerEvents: "auto",
                          }}
                          onClick={(e) => e.stopPropagation()} // klik in paneel bubbelt niet naar buiten
                        >
                          {/* Header (zonder teller-pill) */}
                          <div
                            style={{
                              display: "grid",
                              gridTemplateColumns: "1fr 90px 90px 90px",
                              gap: 8,
                              alignItems: "center",
                              paddingBottom: 6,
                              borderBottom: `1px solid ${COLORS.line}`,
                              fontSize: 12,
                              fontWeight: 600,
                            }}
                          >
                            <div>Saldo {year}</div>
                            <div style={{ textAlign: "right" }}>Startsaldo</div>
                            <div style={{ textAlign: "right" }}>Opgenomen</div>
                            <div style={{ textAlign: "right" }}>Saldo</div>
                          </div>

                          {/* Body */}
                          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
                            {details.length === 0 ? (
                              <div style={{ fontSize: 12, color: COLORS.textMuted }}>Geen categorieën.</div>
                            ) : (
                              details.map((row) => (
                                <div
                                  key={row.reason}
                                  style={{
                                    display: "grid",
                                    gridTemplateColumns: "1fr 90px 90px 90px",
                                    gap: 8,
                                    alignItems: "center",
                                    fontSize: 12,
                                  }}
                                >
                                  <div>{firstCap(row.reason)}</div>
                                  <div style={{ textAlign: "right" }}>{row.start}</div>
                                  <div style={{ textAlign: "right" }}>{row.used}</div>
                                  <div style={{ textAlign: "right" }}>{row.saldo}</div>
                                </div>
                              ))
                            )}

                            {/* Totaalrij */}
                            <div
                              style={{
                                display: "grid",
                                gridTemplateColumns: "1fr 90px 90px 90px",
                                gap: 8,
                                alignItems: "center",
                                fontSize: 12,
                                marginTop: 6,
                                paddingTop: 6,
                                borderTop: `1px dashed ${COLORS.line}`,
                                fontWeight: 600,
                              }}
                            >
                              <div>Totaal</div>
                              <div style={{ textAlign: "right" }}>{safeTotals.start || 0}</div>
                              <div style={{ textAlign: "right" }}>{safeTotals.used || 0}</div>
                              <div style={{ textAlign: "right" }}>{safeTotals.saldo || 0}</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Items */}
                    <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                      {items.map((r, i) => {
                        // Conflicten ophalen
                        const c = conflicts[r.leave_date];
                        const othersApproved = (c?.approved || []).filter((p) => p.id !== r.personnel?.id);
                        const othersRequested = (c?.requested || []).filter((p) => p.id !== r.personnel?.id);

                        // ✅ ALLE namen tonen + correct werkwoord
                        const apprNames = othersApproved.map((p) => p.name);
                        const reqNames = othersRequested.map((p) => p.name);

                        const apprLine =
                          apprNames.length > 0
                            ? `${formatNameList(apprNames)} ${apprNames.length > 1 ? "hebben" : "heeft"} op dezelfde dag verlof`
                            : null;

                        const reqLine =
                          reqNames.length > 0
                            ? `${formatNameList(reqNames)} ${reqNames.length > 1 ? "hebben" : "heeft"} voor dezelfde dag verlof aangevraagd`
                            : null;

                        const hasConflict = !!(apprLine || reqLine);

                        const isSelected = selectedIds.has(r.id);
                        const entValue = (editedEntitlements[r.id] ?? r.entitlement ?? "") as string;
                        const daypartValue = (editedDayparts[r.id] ?? canonicalDaypart(r.daypart)) as
                          | "hele dag"
                          | "voormiddag"
                          | "namiddag";

                        const isLast = i === items.length - 1;

                         return (
                          <li
                            key={r.id}
                            style={{
                              display: "grid",
                              gridTemplateColumns: "20px 75px 115px 110px",
                              alignItems: "center",
                              gap: 10,
                              padding: "10px 12px",
                              borderBottom: isLast ? "none" : `1px dashed ${COLORS.line}`, // ⬅️ hier de truc
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => onToggleSelect(r.id)}
                              aria-label="selecteer"
                              style={{ width: 18, height: 18 }}
                            />

                            {/* Datum */}
                            <div style={{ fontSize: 15, color: COLORS.text }}>{formatDateShort(r.leave_date)}</div>

                            {/* Dagdeel */}
                            <div>
                              <select
                                value={daypartValue}
                                disabled={!isSelected}
                                onChange={(e) => {
                                  if (!isSelected) return;
                                  const v = e.target.value as "hele dag" | "voormiddag" | "namiddag";
                                  onChangeDaypart(r.id, v);
                                }}
                                style={{
                                  width: "100%",
                                  padding: "6px 8px",
                                  borderRadius: 8,
                                  border: `1px solid ${COLORS.line}`,
                                  background: "#fff",
                                  fontSize: 14,
                                  color: COLORS.text,
                                  height: 32,
                                  opacity: isSelected ? 1 : 0.5,
                                  cursor: isSelected ? "pointer" : "not-allowed",
                                }}
                                aria-label="Dagdeel kiezen"
                                title={isSelected ? "Kies dagdeel" : "Vink eerst de rij aan"}
                              >
                                <option value="hele dag">Hele dag</option>
                                <option value="voormiddag">Voormiddag</option>
                                <option value="namiddag">Namiddag</option>
                              </select>
                            </div>

                            {/* Entitlement */}
                            <div>
                              <select
                                value={entValue}
                                disabled={!isSelected}
                                onChange={(e) => {
                                  if (!isSelected) return;
                                  const v = (e.target.value || "").trim().toLowerCase() || null;
                                  onChangeEntitlement(r.id, v);
                                }}
                                style={{
                                  width: "100%",
                                  padding: "6px 8px",
                                  borderRadius: 8,
                                  border: `1px solid ${COLORS.line}`,
                                  background: "#fff",
                                  fontSize: 14,
                                  color: COLORS.text,
                                  height: 32,
                                  opacity: isSelected ? 1 : 0.5,
                                  cursor: isSelected ? "pointer" : "not-allowed",
                                }}
                                aria-label="Entitlement kiezen"
                                title={isSelected ? "Kies type" : "Vink eerst de rij aan"}
                              >
                                <option value="">—</option>
                                {entitlementOptions.map((opt) => (
                                  <option key={opt} value={opt}>
                                    {firstCap(opt)}
                                  </option>
                                ))}
                              </select>
                            </div>

                            {/* Conflicten */}
                            {hasConflict && (
                              <div style={{ gridColumn: "1 / -1", color: "#b91c1c", fontSize: 12, marginTop: 6 }}>
                                {apprLine && <div>{apprLine}</div>}
                                {reqLine && <div>{reqLine}</div>}
                              </div>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {/* Acties */}
      <div style={{ display: "flex", gap: 8, marginTop: 4, justifyContent: "flex-end" }}>
        <button
          onClick={onBatchReject}
          className={titleFontClass}
          style={{
            padding: "10px 14px",
            background: "#ffffff",
            border: `1px solid #d1d5db`,
            borderRadius: 999,
            cursor: "pointer",
            fontWeight: 800,
            fontSize: 14,
            letterSpacing: 0.2,
            minWidth: 120,
          }}
          onMouseOver={(e) => (e.currentTarget.style.background = "#f3f4f6")}
          onMouseOut={(e) => (e.currentTarget.style.background = "#ffffff")}
        >
          Afkeuren
        </button>

        <button
          onClick={onBatchApprove}
          className={titleFontClass}
          style={{
            padding: "10px 14px",
            background: "#0ea5a8",
            color: "#ffffff",
            border: `1px solid #0ea5a8`,
            borderRadius: 999,
            cursor: "pointer",
            fontWeight: 900,
            fontSize: 14,
            letterSpacing: 0.2,
            minWidth: 120,
          }}
          onMouseOver={(e) => (e.currentTarget.style.background = "#0c8e91")}
          onMouseOut={(e) => (e.currentTarget.style.background = "#0ea5a8")}
        >
          Goedkeuren
        </button>
      </div>
    </div>
  );
}
