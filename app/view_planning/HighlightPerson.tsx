"use client";

import React from "react";
import { titleFont, variableFont } from "../components/fonts";

type PlanningCheckColors = {
  primary: string;
  line: string;
  btnBg: string;
  btnBorder: string;
  btnHover: string;
  text: string;
};

export default function PlanningCheck({
  colors,
  width = 420,
  allPharmaciesMinOneShift,
  missingShifts,
  allPersonnelPlanned,
  missingPersonnel,
  otherRemarksOk,
  otherRemarksLines,
  highlightPersonnel,
  highlightDisabledById,
  highlightColorForId,
  onToggleHighlight,
  onClick,
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
  highlightPersonnel: Array<{ id: string; name: string; avatar_url: string | null }>;
  highlightDisabledById: Record<string, true>;
  highlightColorForId: (id: string) => string;
  onToggleHighlight: (id: string) => void;
  onClick?: () => void;
  weekNumber: number;
  onSaveWeek?: () => void;
  savingWeek?: boolean;
}) {
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
      <div
        style={{
          marginTop: 0,
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
                    background: isDisabled ? "transparent" : rowBg,
                    cursor: "pointer",
                    opacity: isDisabled ? 0.6 : 0.95,
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
    </div>
  );
}
