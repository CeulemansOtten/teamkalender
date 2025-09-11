"use client";

import React, { useState } from "react";
import localFont from "next/font/local";
import { Info, ChevronRight } from "lucide-react";

const titleFont = localFont({
  src: "../fonts/Font_VariableBold.otf",
  display: "swap",
});

const UI = {
  text: "#0f172a",
  muted: "#475569",
  primary: "#0ea5a8",
  hoverBg: "#f3f4f6",
  border: "#d1d5db",
  bg: "#ffffff",
};

/* Kleurcodes afgestemd op je vacation request page */
const COLORS = {
  publicBg: "#FDE68A",      // feestdag (donkergeel)
  vacationBg: "#FFF9C4",    // vakantie (lichtgeel)
  approvedBg: "#C3E8E9",    // goedgekeurd (groen/blauwgroen)
  requestedStripe: "#C3E8E9", // zelfde kleur, maar gestreept met wit
  birthdayBg: "#FCE7F3",    // verjaardag (roze)
};

export default function LegendNav() {
  const [open, setOpen] = useState(false);

  return (
    <div
      style={{ position: "fixed", top: 24, right: 24, zIndex: 2000 }}
      role="navigation"
      aria-label="Legenda"
    >
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: open ? 8 : 0,   // ✅ perfect rond als dicht
          background: UI.bg,
          borderRadius: 999,
          padding: 6,
          border: `1px solid ${UI.border}`,
          boxSizing: "border-box",
        }}
      >
        {/* Uitschuifbare inhoud (klapt naar links open) */}
        <div
          aria-hidden={!open}
          style={{
            display: "inline-flex",
            alignItems: "center",
            maxWidth: open ? 900 : 0, // breedte-animatie
            overflow: "hidden",
            transition: "max-width 360ms cubic-bezier(.2,.8,.2,1)",
            minWidth: 0,
          }}
        >
          <LegendList open={open} />
        </div>

        {/* Toggle-knop (rechts) */}
        <CircleButton
          ariaLabel={open ? "Sluit legenda" : "Open legenda"}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? (
            <ChevronRight size={18} color="#ffffff" strokeWidth={2.5} />
          ) : (
            <Info size={18} color="#ffffff" strokeWidth={2.5} />
          )}
        </CircleButton>
      </div>
    </div>
  );
}

/* ---------- Subcomponents ---------- */

function LegendList({ open }: { open: boolean }) {
  const baseDelay = 50;
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 12,
        padding: "4px 2px",
        pointerEvents: open ? "auto" : "none",
      }}
    >
      {/* Nieuwe volgorde: Goedgekeurd, Aangevraagd, Feestdag, Vakantie, Verjaardag */}
      <LegendItemSolid
        color={COLORS.approvedBg}
        label="Goedgekeurd verlof"
        open={open}
        delay={baseDelay * 0}
      />
      <LegendItemPattern
        label="Aangevraagd verlof"
        open={open}
        delay={baseDelay * 1}
        pattern={`repeating-linear-gradient(
          45deg,
          ${COLORS.requestedStripe} 0,
          ${COLORS.requestedStripe} 8px,
          #ffffff 8px,
          #ffffff 16px
        )`}
      />
      <LegendItemSolid
        color={COLORS.publicBg}
        label="Feestdag"
        open={open}
        delay={baseDelay * 2}
      />
      <LegendItemSolid
        color={COLORS.vacationBg}
        label="Vakantie"
        open={open}
        delay={baseDelay * 3}
      />
      <LegendItemSolid
        color={COLORS.birthdayBg}
        label="Verjaardag"
        open={open}
        delay={baseDelay * 4}
      />
    </div>
  );
}

function LegendItemBase({
  children,
  label,
  open,
  delay = 0,
}: {
  children: React.ReactNode;
  label: string;
  open: boolean;
  delay?: number;
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 8px",
        background: UI.hoverBg,
        borderRadius: 10,
        transform: open ? "translateX(0)" : "translateX(8px)",
        opacity: open ? 1 : 0,
        transition: `transform 320ms ease, opacity 240ms ease`,
        transitionDelay: `${open ? delay : 0}ms`,
      }}
    >
      {children}
      <span
        className={titleFont.className}
        style={{
          fontSize: 14,
          fontWeight: 800,
          letterSpacing: 0.2,
          color: UI.muted,
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </span>
    </span>
  );
}

function LegendItemSolid({
  color,
  label,
  open,
  delay,
}: {
  color: string;
  label: string;
  open: boolean;
  delay?: number;
}) {
  return (
    <LegendItemBase label={label} open={open} delay={delay}>
      <span
        aria-hidden
        style={{
          width: 16,
          height: 16,
          borderRadius: 4,
          background: color,
          border: `1px solid ${UI.border}`,
          boxSizing: "border-box",
          flex: "0 0 16px",
        }}
      />
    </LegendItemBase>
  );
}

function LegendItemPattern({
  pattern,
  label,
  open,
  delay,
}: {
  pattern: string;
  label: string;
  open: boolean;
  delay?: number;
}) {
  return (
    <LegendItemBase label={label} open={open} delay={delay}>
      <span
        aria-hidden
        style={{
          width: 16,
          height: 16,
          borderRadius: 4,
          backgroundColor: "#ffffff",
          backgroundImage: pattern,
          backgroundRepeat: "repeat",
          border: `1px solid ${UI.border}`,
          boxSizing: "border-box",
          flex: "0 0 16px",
        }}
      />
    </LegendItemBase>
  );
}

function CircleButton({
  ariaLabel,
  onClick,
  children,
}: {
  ariaLabel: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick();
      }}
      style={{
        width: 36,
        height: 36,
        borderRadius: "50%",
        border: "none",
        cursor: "pointer",
        background: UI.primary,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        transition: "transform 200ms ease",
      }}
      onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.96)")}
      onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
      onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
    >
      {children}
    </button>
  );
}
