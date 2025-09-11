"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import localFont from "next/font/local";
import type { LucideIcon } from "lucide-react";
import { Calendar, Plane, Clock, Settings, CalendarCheck } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

/* Bold font zoals in je kalender */
const titleFont = localFont({
  src: "../fonts/Font_VariableBold.otf",
  display: "swap",
});

/* UI */
const UI = {
  text: "#0f172a",
  muted: "#475569",
  primary: "#0ea5a8",
  hoverBg: "#f3f4f6",
  border: "#d1d5db",
};

const ROW_H = 36; // ✅ vaste hoogte voor alles

type NavItem = { label: string; href: string; icon: LucideIcon };
const NAV_ITEMS: NavItem[] = [
  { label: "Teamkalender", href: "/calendar", icon: Calendar },
  { label: "Verlof Aanvragen", href: "/vacation_request", icon: Plane },
  { label: "Verlof Teller", href: "/counter", icon: Clock },
  { label: "Verlof Goedkeuren", href: "/approval", icon: CalendarCheck }, // owner-only
  { label: "Admin", href: "/admin", icon: Settings }, // owner-only
];

export default function FloatingNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const personnelId = searchParams.get("personnel_id") || "";
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  const q = personnelId ? `?personnel_id=${encodeURIComponent(personnelId)}` : "";

  useEffect(() => {
    let on = true;
    (async () => {
      setLoading(true);
      if (!personnelId) {
        setStatus(null);
        setLoading(false);
        return;
      }
      const { data, error } = await supabase
        .from("personnel")
        .select("status")
        .eq("id", personnelId)
        .single();

      if (!on) return;
      if (error) {
        console.error("[FloatingNav] status fetch", error);
        setStatus(null);
      } else {
        setStatus((data?.status ?? null) as string | null);
      }
      setLoading(false);
    })();
    return () => {
      on = false;
    };
  }, [personnelId]);

  const isOwner = status === "owner";

  const visibleItems = useMemo(() => {
    return NAV_ITEMS.filter((it) => {
      const ownerOnly = it.href === "/approval" || it.href === "/admin";
      return ownerOnly ? isOwner : true;
    });
  }, [isOwner]);

  const current = useMemo(() => {
    const found = visibleItems.find((it) =>
      pathname ? pathname.toLowerCase().startsWith(it.href.toLowerCase()) : false
    );
    return found ?? visibleItems[0] ?? NAV_ITEMS[0];
  }, [pathname, visibleItems]);

  const others = useMemo(
    () => visibleItems.filter((it) => it.href.toLowerCase() !== current.href.toLowerCase()),
    [visibleItems, current]
  );

  return (
    <div
      style={{
        position: "fixed",
        top: 24,
        left: 24,
        zIndex: 2000,
      }}
      role="navigation"
      aria-label="Hoofdnavigatie"
    >
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          background: "#fff",
          borderRadius: 999,
          padding: 6,
          border: `1px solid ${UI.border}`,
        }}
      >
        {/* Altijd zichtbaar: huidige label */}
        <CurrentLabel icon={current.icon} label={current.label} />

        {/* Uitschuifbare container met overige links */}
        <div
          aria-hidden={!open}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: open ? 12 : 0,
            maxWidth: open ? 1000 : 0,                 // ⬅️ breedte-animatie
            height: open ? ROW_H : 0,                  // ⬅️ geen extra hoogte als dicht
            overflow: "hidden",
            transition: "max-width 360ms cubic-bezier(.2,.8,.2,1), height 0ms linear",
            minWidth: 0,
            pointerEvents: open ? "auto" : "none",
          }}
        >
          {others.map((item, idx) => {
            const active = pathname?.toLowerCase().startsWith(item.href.toLowerCase()) ?? false;
            const delay = open ? idx * 50 : 0; // subtiele stagger

            return (
              <Link key={item.href} href={`${item.href}${q}`} style={{ textDecoration: "none" }}>
                <NavLinkItem
                  className={titleFont.className}
                  icon={item.icon}
                  label={item.label}
                  active={active}
                  reveal={open}
                  delay={delay}
                />
              </Link>
            );
          })}

          {/* Sluit-knop binnen de uitschuif-container */}
          <CircleButton ariaLabel="Sluit navigatie" onClick={() => setOpen(false)} />
        </div>

        {/* Open-knop buiten de uitschuif-container */}
        {!open && <CircleButton ariaLabel="Open navigatie" onClick={() => setOpen(true)} />}
      </div>
    </div>
  );
}

/* ---- Subcomponents ---- */

function CurrentLabel({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <span
      className={titleFont.className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 10,
        height: ROW_H,                 // ✅ vaste hoogte
        padding: "0 6px",              // geen verticale padding
        fontSize: 18,
        fontWeight: 900,
        letterSpacing: 0.2,
        color: UI.text,
      }}
    >
      <Icon size={18} strokeWidth={2.5} color={UI.primary} />
      {label}
    </span>
  );
}

function NavLinkItem({
  className,
  icon: Icon,
  label,
  active,
  disableHover = false,
  notClickable = false,
  noUnderline = false,
  reveal = false,
  delay = 0,
}: {
  className?: string;
  icon: LucideIcon;
  label: string;
  active?: boolean;
  disableHover?: boolean;
  notClickable?: boolean;
  noUnderline?: boolean;
  reveal?: boolean;
  delay?: number;
}) {
  const [hovered, setHovered] = useState(false);
  const showHover = !disableHover && !active && hovered;
  const bg = showHover ? UI.hoverBg : "transparent";
  const underlineScale = noUnderline ? 0 : active ? 1 : showHover ? 1 : 0;

  return (
    <span
      className={className}
      aria-current={active ? "page" : undefined}
      aria-disabled={notClickable ? true : undefined}
      onMouseEnter={() => !disableHover && setHovered(true)}
      onMouseLeave={() => !disableHover && setHovered(false)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 10,
        height: ROW_H,                 // ✅ vaste hoogte
        padding: "0 8px",
        background: bg,
        border: "none",
        borderRadius: 10,
        fontSize: 18,
        fontWeight: 900,
        letterSpacing: 0.2,
        color: active ? UI.text : UI.muted,
        position: "relative",
        cursor: notClickable ? "default" : "pointer",
        transition:
          "background 150ms ease, transform 320ms ease, opacity 240ms ease",
        pointerEvents: notClickable ? "none" : "auto",
        transform: reveal ? "translateX(0)" : "translateX(8px)",
        opacity: reveal ? 1 : 0,
        transitionDelay: `${delay}ms`,
        whiteSpace: "nowrap",
      }}
    >
      <Icon size={18} strokeWidth={2.5} color={UI.primary} />
      {label}

      {!noUnderline && (
        <span
          aria-hidden
          style={{
            position: "absolute",
            left: 6,
            right: 6,
            bottom: 2,
            height: 3,
            borderRadius: 3,
            background: UI.primary,
            transform: `scaleX(${underlineScale})`,
            transformOrigin: "center",
            transition: "transform 150ms ease",
          }}
        />
      )}
    </span>
  );
}

function CircleButton({
  ariaLabel,
  onClick,
}: {
  ariaLabel: string;
  onClick?: () => void;
}) {
  // Chevron wisselt automatisch (open/dicht)
  const isClose = ariaLabel.toLowerCase().includes("sluit");
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick?.();
      }}
      style={{
        width: ROW_H,
        height: ROW_H,
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
      {isClose ? <ChevronLeftBoldWhite /> : <ChevronRightBoldWhite />}
    </button>
  );
}

/* ---- Chevrons: wit, size 22, strokeWidth 3.5 ---- */
function ChevronRightBoldWhite({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <polyline
        points="9 6 15 12 9 18"
        stroke="#ffffff"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function ChevronLeftBoldWhite({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <polyline
        points="15 6 9 12 15 18"
        stroke="#ffffff"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
