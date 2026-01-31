"use client";

import React, { useEffect, useState } from "react";
import { titleFont, variableFont } from "../components/fonts";

const DAYS = ["Ma", "Di", "Wo", "Do", "Vr", "Za", "Zo"] as const;

type PlanningCheckColors = {
  primary: string;
  line: string;
  btnBg: string;
  btnBorder: string;
  btnHover: string;
  text: string;
};

function IconChevronRight({ color, size = 18 }: { color: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={3.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polyline points="9 6 15 12 9 18" />
    </svg>
  );
}

export default function PlanningCheck({
  colors,
  width = 420,
  allPharmaciesMinOneShift,
  missingShifts,
  allPersonnelPlanned,
  missingPersonnel,
  otherRemarksOk,
  otherRemarksLines,
  weekDates,
  onSaveRemark,
  highlightPersonnel,
  highlightDisabledById,
  highlightColorForId,
  onToggleHighlight,
  onClick,
  onCopyPreviousWeek,
  weekNumber,
  onSaveWeek,
  savingWeek,
}: {
  colors: PlanningCheckColors;
  width?: number;
  allPharmaciesMinOneShift: boolean;
  missingShifts: string[];
  allPersonnelPlanned: boolean;
  missingPersonnel: string[];
  otherRemarksOk: boolean;
  otherRemarksLines: string[];
  weekDates: Date[];
  onSaveRemark?: (dayIdx: number, remark: string, pharmacy: string | null) => Promise<boolean> | boolean;
  highlightPersonnel: Array<{ id: string; name: string; avatar_url: string | null }>;
  highlightDisabledById: Record<string, true>;
  highlightColorForId: (id: string) => string;
  onToggleHighlight: (id: string) => void;
  onClick?: () => void;
  onCopyPreviousWeek?: () => void;
  weekNumber: number;
  onSaveWeek?: () => void;
  savingWeek?: boolean;
}) {
  const [showMissingShifts, setShowMissingShifts] = useState(false);
  const [showMissingPersonnel, setShowMissingPersonnel] = useState(false);
  const [showOtherRemarks, setShowOtherRemarks] = useState(false);

  const [openMissingShiftDays, setOpenMissingShiftDays] = useState<Record<string, boolean>>({});
  const [openMissingPersonnelByName, setOpenMissingPersonnelByName] = useState<Record<string, boolean>>({});
  const [openOtherRemarksByDay, setOpenOtherRemarksByDay] = useState<Record<string, boolean>>({});
  const [openOtherRemarksByName, setOpenOtherRemarksByName] = useState<Record<string, boolean>>({});

  const [remarkDayIdx, setRemarkDayIdx] = useState(0);
  const [remarkPharmacy, setRemarkPharmacy] = useState<string>("");
  const [remarkText, setRemarkText] = useState("");
  const [savingRemark, setSavingRemark] = useState(false);

  function formatDay(date: Date) {
    const dd = date.getDate().toString().padStart(2, "0");
    const mmm = date.toLocaleString("nl-BE", { month: "short" });
    return `${dd}/${mmm}`;
  }

  useEffect(() => {
    if (allPharmaciesMinOneShift) setShowMissingShifts(false);
  }, [allPharmaciesMinOneShift]);

  useEffect(() => {
    if (!showMissingShifts || allPharmaciesMinOneShift) setOpenMissingShiftDays({});
  }, [showMissingShifts, allPharmaciesMinOneShift]);

  const missingShiftGroups = React.useMemo(() => {
    type Item = { dayLabel: string; pharmacy: string; shift: string; raw: string };
    const groups = new Map<string, Item[]>();

    for (const line of missingShifts || []) {
      const raw = String(line ?? "");
      const parts = raw.split(" • ").map((p) => p.trim()).filter(Boolean);
      const dayLabel = parts[0] || "Onbekende dag";
      const pharmacy = parts[1] || "";
      const shift = parts[2] || "";

      const it: Item = { dayLabel, pharmacy, shift, raw };
      groups.set(dayLabel, [...(groups.get(dayLabel) || []), it]);
    }

    // Keep same order as weekDates (Ma..Zo), then append any unknown labels.
    const orderedLabels = weekDates.map((d, idx) => `${DAYS[idx]} ${formatDay(d)}`);
    const out: Array<{ dayLabel: string; items: Item[] }> = [];

    for (const lbl of orderedLabels) {
      const items = groups.get(lbl);
      if (items?.length) out.push({ dayLabel: lbl, items });
      groups.delete(lbl);
    }

    for (const [dayLabel, items] of groups.entries()) {
      out.push({ dayLabel, items });
    }

    return out;
  }, [missingShifts, weekDates]);

  function toggleMissingShiftDay(dayLabel: string) {
    setOpenMissingShiftDays((prev) => ({ ...prev, [dayLabel]: !prev[dayLabel] }));
  }

  const missingPersonnelGroups = React.useMemo(() => {
    type Item = { name: string; dateLabel: string; shift: string; raw: string };
    const groups = new Map<string, Item[]>();

    for (const line of missingPersonnel || []) {
      const raw = String(line ?? "");
      const parts = raw.split(" • ").map((p) => p.trim()).filter(Boolean);
      const name = parts[0] || "Onbekende medewerker";
      const dateLabel = parts[1] || "";
      const shift = parts[2] || "";
      const it: Item = { name, dateLabel, shift, raw };
      groups.set(name, [...(groups.get(name) || []), it]);
    }

    const names = Array.from(groups.keys());
    const firstNameOf = (full: string) => String(full || "").trim().split(/\s+/)[0] || String(full || "");
    names.sort((a, b) => firstNameOf(a).localeCompare(firstNameOf(b), "nl", { sensitivity: "base" }));
    return names.map((name) => ({ name, items: groups.get(name) || [] }));
  }, [missingPersonnel]);

  function toggleMissingPersonnel(name: string) {
    setOpenMissingPersonnelByName((prev) => ({ ...prev, [name]: !prev[name] }));
  }

  useEffect(() => {
    if (allPersonnelPlanned) setShowMissingPersonnel(false);
  }, [allPersonnelPlanned]);

  useEffect(() => {
    if (!showMissingPersonnel || allPersonnelPlanned) setOpenMissingPersonnelByName({});
  }, [showMissingPersonnel, allPersonnelPlanned]);

  useEffect(() => {
    if (otherRemarksOk) setShowOtherRemarks(false);
  }, [otherRemarksOk]);

  useEffect(() => {
    if (!showOtherRemarks || otherRemarksOk) {
      setOpenOtherRemarksByDay({});
      setOpenOtherRemarksByName({});
    }
  }, [showOtherRemarks, otherRemarksOk]);

  const otherRemarkGroups = React.useMemo(() => {
    const orderedDayLabels = weekDates.map((d, idx) => `${DAYS[idx]} ${formatDay(d)}`);
    const dayLabelSet = new Set(orderedDayLabels);

    const dayMap = new Map<string, string[]>();
    const personMap = new Map<string, string[]>();

    for (const line of otherRemarksLines || []) {
      const raw = String(line ?? "");
      const parts = raw.split(" • ").map((p) => p.trim()).filter(Boolean);
      const first = parts[0] || "";
      const rest = parts.slice(1).join(" • ");

      if (dayLabelSet.has(first)) {
        const dayLabel = first;
        const detail = rest || raw;
        dayMap.set(dayLabel, [...(dayMap.get(dayLabel) || []), detail]);
      } else {
        const name = first || "Onbekende medewerker";
        const detail = rest || raw;
        personMap.set(name, [...(personMap.get(name) || []), detail]);
      }
    }

    const dayGroups: Array<{ key: string; title: string; items: string[] }> = [];
    for (const lbl of orderedDayLabels) {
      const items = dayMap.get(lbl);
      if (items?.length) dayGroups.push({ key: lbl, title: lbl, items });
      dayMap.delete(lbl);
    }
    for (const [lbl, items] of dayMap.entries()) {
      dayGroups.push({ key: lbl, title: lbl, items });
    }

    const firstNameOf = (full: string) => String(full || "").trim().split(/\s+/)[0] || String(full || "");
    const names = Array.from(personMap.keys());
    names.sort((a, b) => firstNameOf(a).localeCompare(firstNameOf(b), "nl", { sensitivity: "base" }));
    const personGroups = names.map((name) => ({ key: name, title: name, items: personMap.get(name) || [] }));

    return { dayGroups, personGroups };
  }, [otherRemarksLines, weekDates]);

  function toggleOtherRemarkDay(dayLabel: string) {
    setOpenOtherRemarksByDay((prev) => ({ ...prev, [dayLabel]: !prev[dayLabel] }));
  }

  function toggleOtherRemarkPerson(name: string) {
    setOpenOtherRemarksByName((prev) => ({ ...prev, [name]: !prev[name] }));
  }

  return (
    <div
      style={{
        background: "#f7f9fb",
        border: `1px solid ${colors.line}`,
        borderRadius: 18,
        padding: "16px",
        width,
        flex: `0 0 ${width}px`,
      }}
    >
      <button
        type="button"
        className={titleFont.className}
        style={{
          width: "100%",
          padding: "12px 14px",
          background: colors.btnBg,
          border: `1px solid ${colors.btnBorder}`,
          borderRadius: 14,
          cursor: "pointer",
          fontWeight: 900,
          fontSize: 18,
          letterSpacing: 0.2,
          transition: "background 120ms ease-in-out",
          color: colors.text,
          textAlign: "center",
        }}
        onMouseOver={(e) => (e.currentTarget.style.background = colors.btnHover)}
        onMouseOut={(e) => (e.currentTarget.style.background = colors.btnBg)}
        onClick={onClick}
      >
        Pas standaardplanning toe
      </button>

      <button
        type="button"
        className={titleFont.className}
        style={{
          width: "100%",
          padding: "12px 14px",
          background: colors.btnBg,
          border: `1px solid ${colors.btnBorder}`,
          borderRadius: 14,
          cursor: "pointer",
          fontWeight: 900,
          fontSize: 18,
          letterSpacing: 0.2,
          transition: "background 120ms ease-in-out",
          color: colors.text,
          textAlign: "center",
          marginTop: 10,
        }}
        onMouseOver={(e) => (e.currentTarget.style.background = colors.btnHover)}
        onMouseOut={(e) => (e.currentTarget.style.background = colors.btnBg)}
        onClick={() => onCopyPreviousWeek?.()}
      >
        Kopieer planning van vorige week
      </button>

      <div
        style={{
          marginTop: 14,
          background: "#fff",
          border: `1px solid ${colors.line}`,
          borderRadius: 14,
          padding: "14px 14px",
        }}
      >
        <div
          className={variableFont.className}
          style={{
            display: "inline-grid",
            gridTemplateColumns: "8px auto",
            alignItems: "center",
            columnGap: 10,
            fontWeight: 900,
            fontSize: 17,
            color: colors.text,
          }}
        >
          <div
            style={{
              width: 8,
              height: 18,
              background: colors.primary,
              borderRadius: 999,
            }}
          />
          <div>Openstaande opmerkingen</div>
        </div>

        <div
          style={{
            marginTop: 12,
            display: "flex",
            flexDirection: "column",
            gap: 10,
            color: colors.text,
            fontSize: 15,
            fontWeight: 400,
          }}
        >
          <div>
            <label style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <input type="checkbox" checked={allPharmaciesMinOneShift} disabled />
              <span>Alle apotheken minstens 1 shift ingevuld</span>
              {!allPharmaciesMinOneShift ? (
                <button
                  type="button"
                  aria-label="Toon ontbrekende shiften"
                  onClick={() => setShowMissingShifts((v) => !v)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 28,
                    height: 28,
                    borderRadius: 999,
                    border: `1px solid ${colors.line}`,
                    background: "#fff",
                    cursor: "pointer",
                    padding: 0,
                  }}
                >
                  <div style={{ transform: showMissingShifts ? "rotate(90deg)" : "none" }}>
                    <IconChevronRight color={colors.primary} size={18} />
                  </div>
                </button>
              ) : null}
            </label>

            {!allPharmaciesMinOneShift && showMissingShifts ? (
              <div style={{ marginTop: 10, marginLeft: 28 }}>
                {missingShiftGroups.length ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 14 }}>
                    {missingShiftGroups.map(({ dayLabel, items }) => {
                      const open = Boolean(openMissingShiftDays[dayLabel]);

                      return (
                        <div
                          key={dayLabel}
                          style={{
                            padding: "4px 0",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                            <div style={{ fontWeight: 500, color: colors.text }}>
                              {dayLabel}
                            </div>

                            <button
                              type="button"
                              aria-label="Toon ontbrekende shiften voor deze dag"
                              onClick={() => toggleMissingShiftDay(dayLabel)}
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                width: 28,
                                height: 28,
                                borderRadius: 999,
                                border: `1px solid ${colors.line}`,
                                background: "#fff",
                                cursor: "pointer",
                                padding: 0,
                              }}
                            >
                              <div style={{ transform: open ? "rotate(90deg)" : "none" }}>
                                <IconChevronRight color={colors.primary} size={18} />
                              </div>
                            </button>
                          </div>

                          <div style={{ marginTop: 8, width: "100%", height: 1, background: colors.line }} />

                          {open ? (
                            <div
                              style={{
                                marginTop: 8,
                                display: "flex",
                                flexDirection: "column",
                                gap: 6,
                                color: colors.text,
                                paddingLeft: 2,
                              }}
                            >
                              {items.map((it, i) => (
                                <div key={`${dayLabel}-${i}`}>
                                  {it.pharmacy && it.shift ? `${it.pharmacy} • ${it.shift}` : it.raw}
                                </div>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ fontSize: 14 }}>Geen ontbrekende shiften gevonden.</div>
                )}
              </div>
            ) : null}
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <input type="checkbox" checked={allPersonnelPlanned} disabled />
            <span>Alle medewerkers ingepland</span>
            {!allPersonnelPlanned ? (
              <button
                type="button"
                aria-label="Toon ontbrekende medewerkers"
                onClick={() => setShowMissingPersonnel((v) => !v)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 28,
                  height: 28,
                  borderRadius: 999,
                  border: `1px solid ${colors.line}`,
                  background: "#fff",
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                <div style={{ transform: showMissingPersonnel ? "rotate(90deg)" : "none" }}>
                  <IconChevronRight color={colors.primary} size={18} />
                </div>
              </button>
            ) : null}
          </label>

          {!allPersonnelPlanned && showMissingPersonnel ? (
            <div style={{ marginTop: 10, marginLeft: 28 }}>
              {missingPersonnelGroups.length ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 14 }}>
                  {missingPersonnelGroups.map(({ name, items }) => {
                    const open = Boolean(openMissingPersonnelByName[name]);
                    return (
                      <div key={name} style={{ padding: "4px 0" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                          <div style={{ fontWeight: 500, color: colors.text }}>{name}</div>

                          <button
                            type="button"
                            aria-label="Toon ontbrekende shiften voor deze medewerker"
                            onClick={() => toggleMissingPersonnel(name)}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              width: 28,
                              height: 28,
                              borderRadius: 999,
                              border: `1px solid ${colors.line}`,
                              background: "#fff",
                              cursor: "pointer",
                              padding: 0,
                            }}
                          >
                            <div style={{ transform: open ? "rotate(90deg)" : "none" }}>
                              <IconChevronRight color={colors.primary} size={18} />
                            </div>
                          </button>
                        </div>

                        <div style={{ marginTop: 8, width: "100%", height: 1, background: colors.line }} />

                        {open ? (
                          <div
                            style={{
                              marginTop: 8,
                              display: "flex",
                              flexDirection: "column",
                              gap: 6,
                              color: colors.text,
                              paddingLeft: 2,
                            }}
                          >
                            {items.map((it, i) => (
                              <div key={`${name}-${i}`}>
                                {it.dateLabel && it.shift ? `${it.dateLabel} • ${it.shift}` : it.raw}
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ fontSize: 14 }}>Geen ontbrekende medewerkers gevonden.</div>
              )}
            </div>
          ) : null}
          <label style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <input type="checkbox" checked={otherRemarksOk} disabled />
            <span>Andere opmerkingen</span>
            {!otherRemarksOk ? (
              <button
                type="button"
                aria-label="Toon andere opmerkingen"
                onClick={() => setShowOtherRemarks((v) => !v)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 28,
                  height: 28,
                  borderRadius: 999,
                  border: `1px solid ${colors.line}`,
                  background: "#fff",
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                <div style={{ transform: showOtherRemarks ? "rotate(90deg)" : "none" }}>
                  <IconChevronRight color={colors.primary} size={18} />
                </div>
              </button>
            ) : null}
          </label>

          {!otherRemarksOk && showOtherRemarks ? (
            <div style={{ marginTop: 10, marginLeft: 28 }}>
              {otherRemarksLines.length ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 12, fontSize: 14 }}>
                  {otherRemarkGroups.dayGroups.length ? (
                    <div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        {otherRemarkGroups.dayGroups.map(({ key, title, items }) => {
                          const open = Boolean(openOtherRemarksByDay[key]);
                          return (
                            <div key={`day-${key}`} style={{ padding: "4px 0" }}>
                              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                                <div style={{ fontWeight: 500, color: colors.text }}>{title}</div>
                                <button
                                  type="button"
                                  aria-label="Toon opmerkingen voor deze dag"
                                  onClick={() => toggleOtherRemarkDay(key)}
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    width: 28,
                                    height: 28,
                                    borderRadius: 999,
                                    border: `1px solid ${colors.line}`,
                                    background: "#fff",
                                    cursor: "pointer",
                                    padding: 0,
                                  }}
                                >
                                  <div style={{ transform: open ? "rotate(90deg)" : "none" }}>
                                    <IconChevronRight color={colors.primary} size={18} />
                                  </div>
                                </button>
                              </div>

                              <div style={{ marginTop: 8, width: "100%", height: 1, background: colors.line }} />

                              {open ? (
                                <div
                                  style={{
                                    marginTop: 8,
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: 6,
                                    color: colors.text,
                                    paddingLeft: 2,
                                  }}
                                >
                                  {items.map((it, i) => (
                                    <div key={`${key}-${i}`}>{it}</div>
                                  ))}
                                </div>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}

                  {otherRemarkGroups.personGroups.length ? (
                    <div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        {otherRemarkGroups.personGroups.map(({ key, title, items }) => {
                          const open = Boolean(openOtherRemarksByName[key]);
                          return (
                            <div key={`p-${key}`} style={{ padding: "4px 0" }}>
                              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                                <div style={{ fontWeight: 500, color: colors.text }}>{title}</div>
                                <button
                                  type="button"
                                  aria-label="Toon opmerkingen voor deze medewerker"
                                  onClick={() => toggleOtherRemarkPerson(key)}
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    width: 28,
                                    height: 28,
                                    borderRadius: 999,
                                    border: `1px solid ${colors.line}`,
                                    background: "#fff",
                                    cursor: "pointer",
                                    padding: 0,
                                  }}
                                >
                                  <div style={{ transform: open ? "rotate(90deg)" : "none" }}>
                                    <IconChevronRight color={colors.primary} size={18} />
                                  </div>
                                </button>
                              </div>

                              <div style={{ marginTop: 8, width: "100%", height: 1, background: colors.line }} />

                              {open ? (
                                <div
                                  style={{
                                    marginTop: 8,
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: 6,
                                    color: colors.text,
                                    paddingLeft: 2,
                                  }}
                                >
                                  {items.map((it, i) => (
                                    <div key={`${key}-${i}`}>{it}</div>
                                  ))}
                                </div>
                              ) : null}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div style={{ fontSize: 14 }}>Geen opmerkingen gevonden.</div>
              )}
            </div>
          ) : null}
        </div>
      </div>

      <button
        type="button"
        className={titleFont.className}
        onClick={onSaveWeek}
        disabled={!onSaveWeek || savingWeek}
        style={{
          width: "100%",
          marginTop: 12,
          padding: "12px 14px",
          background: colors.primary,
          border: `1px solid ${colors.primary}`,
          borderRadius: 14,
          cursor: !onSaveWeek || savingWeek ? "not-allowed" : "pointer",
          fontWeight: 900,
          fontSize: 18,
          letterSpacing: 0.2,
          transition: "background 120ms ease-in-out",
          color: "#ffffff",
          textAlign: "center",
          opacity: !onSaveWeek || savingWeek ? 0.7 : 1,
        }}
        onMouseOver={(e) => {
          if (!onSaveWeek || savingWeek) return;
          e.currentTarget.style.background = "#0c8e91";
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.background = colors.primary;
        }}
      >
        Planning week {weekNumber} opslaan
      </button>

      <div
        style={{
          marginTop: 12,
          background: "#fff",
          border: `1px solid ${colors.line}`,
          borderRadius: 14,
          padding: "14px 14px",
        }}
      >
        <div
          className={variableFont.className}
          style={{
            display: "inline-grid",
            gridTemplateColumns: "8px auto",
            alignItems: "center",
            columnGap: 10,
            fontWeight: 900,
            fontSize: 17,
            color: colors.text,
          }}
        >
          <div
            style={{
              width: 8,
              height: 18,
              background: colors.primary,
              borderRadius: 999,
            }}
          />
          <div>Highlight personeel</div>
        </div>

        <div
          style={{
            marginTop: 12,
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 10,
            color: colors.text,
            fontSize: 15,
            fontWeight: 500,
          }}
        >
          {(() => {
            const unique = Array.from(new Map(highlightPersonnel.map((p) => [p.id, p])).values());
            const firstNameOf = (name: string) => String(name || "").trim().split(/\s+/)[0] || String(name || "");
            unique.sort((a, b) =>
              firstNameOf(a.name).localeCompare(firstNameOf(b.name), "nl", { sensitivity: "base" })
            );

            const items = [...unique, { id: "__everyone__", name: "Iedereen", avatar_url: null }];
            const allEnabled = Object.keys(highlightDisabledById).length === 0;

            return items.map((p) => {
              const firstName = firstNameOf(p.name);
              const isEveryone = p.id === "__everyone__";
              const isDisabled = !isEveryone && Boolean(highlightDisabledById[p.id]);
              const rowBg = isEveryone ? colors.btnHover : highlightColorForId(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onToggleHighlight(p.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    minHeight: 26,
                    width: "100%",
                    textAlign: "left",
                    border: "none",
                    padding: "4px 6px",
                    borderRadius: 10,
                    background: isEveryone ? (allEnabled ? rowBg : "transparent") : (isDisabled ? "transparent" : rowBg),
                    cursor: "pointer",
                    opacity: isEveryone ? (allEnabled ? 0.95 : 0.75) : (isDisabled ? 0.6 : 0.95),
                    font: "inherit",
                    color: "inherit",
                  }}
                >
                  {p.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.avatar_url}
                      alt={p.name}
                      style={{
                        width: 26,
                        height: 26,
                        objectFit: "contain",
                        borderRadius: 6,
                      }}
                    />
                  ) : (
                    <div style={{ width: 26, height: 26 }} />
                  )}
                  <div style={{ fontWeight: 500 }}>{firstName}</div>
                </button>
              );
            });
          })()}
        </div>
      </div>

      <div
        style={{
          marginTop: 12,
          background: "#fff",
          border: `1px solid ${colors.line}`,
          borderRadius: 14,
          padding: "14px 14px",
        }}
      >
        <div
          className={variableFont.className}
          style={{
            display: "inline-grid",
            gridTemplateColumns: "8px auto",
            alignItems: "center",
            columnGap: 10,
            fontWeight: 900,
            fontSize: 17,
            color: colors.text,
          }}
        >
          <div
            style={{
              width: 8,
              height: 18,
              background: colors.primary,
              borderRadius: 999,
            }}
          />
          <div>Opmerking toevoegen</div>
        </div>

        <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: 6 }}>
            <select
              value={remarkDayIdx}
              onChange={(e) => setRemarkDayIdx(Number(e.target.value))}
              style={{
                width: "100%",
                padding: "10px 10px",
                borderRadius: 10,
                border: `1px solid ${colors.line}`,
                fontSize: 15,
                background: "#fff",
                color: colors.text,
                fontWeight: 400,
                boxShadow: "0 1px 4px rgba(0,0,0,0.03)",
              }}
            >
              {weekDates.map((d, idx) => (
                <option key={idx} value={idx}>
                  {d.toLocaleDateString("nl-BE", { weekday: "long" })} {formatDay(d)}
                </option>
              ))}
            </select>

            <select
              value={remarkPharmacy}
              onChange={(e) => setRemarkPharmacy(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 10,
                border: `1px solid ${colors.line}`,
                fontSize: 15,
                background: "#fff",
                color: colors.text,
                fontWeight: 400,
                boxShadow: "0 1px 4px rgba(0,0,0,0.03)",
              }}
            >
              <option value=""></option>
              <option value="Eeuwfeestapotheek">Eeuwfeestapotheek</option>
              <option value="Apotheek Generaal">Apotheek Generaal</option>
              <option value="Apotheek Minerva">Apotheek Minerva</option>
            </select>
          </div>

          <textarea
            value={remarkText}
            onChange={(e) => setRemarkText(e.target.value)}
            rows={3}
            placeholder="Typ hier je opmerking..."
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: 10,
              border: `1px solid ${colors.line}`,
              fontSize: 15,
              background: "#fff",
              color: colors.text,
              fontWeight: 400,
              boxShadow: "0 1px 4px rgba(0,0,0,0.03)",
              resize: "vertical",
            }}
          />

          <button
            type="button"
            className={titleFont.className}
            disabled={!onSaveRemark || savingRemark || !remarkText.trim()}
            style={{
              width: "100%",
              padding: "12px 14px",
              background: colors.btnBg,
              border: `1px solid ${colors.btnBorder}`,
              borderRadius: 14,
              cursor: !onSaveRemark || savingRemark || !remarkText.trim() ? "not-allowed" : "pointer",
              fontWeight: 900,
              fontSize: 15,
              letterSpacing: 0.2,
              transition: "background 120ms ease-in-out",
              color: colors.text,
              textAlign: "center",
              opacity: !onSaveRemark || savingRemark || !remarkText.trim() ? 0.7 : 1,
            }}
            onMouseOver={(e) => {
              if (!onSaveRemark || savingRemark || !remarkText.trim()) return;
              e.currentTarget.style.background = colors.btnHover;
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = colors.btnBg;
            }}
            onClick={async () => {
              if (!onSaveRemark) return;
              if (savingRemark) return;
              const text = remarkText.trim();
              if (!text) return;
              setSavingRemark(true);
              try {
                const ok = await onSaveRemark(remarkDayIdx, text, remarkPharmacy.trim() ? remarkPharmacy.trim() : null);
                if (ok) {
                  setRemarkDayIdx(0);
                  setRemarkPharmacy("");
                  setRemarkText("");
                }
              } finally {
                setSavingRemark(false);
              }
            }}
          >
            {savingRemark ? "Opslaan..." : "Opmerking opslaan"}
          </button>
        </div>
      </div>
    </div>
  );
}
