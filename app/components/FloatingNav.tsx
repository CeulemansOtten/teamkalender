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

/* Kleuren */
const UI = {
  text: "#0f172a",
  muted: "#475569",
  primary: "#0ea5a8",
  hoverBg: "#f3f4f6",
  border: "#d1d5db",
};

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

  // Querystring voor alle links
  const q = personnelId ? `?personnel_id=${encodeURIComponent(personnelId)}` : "";

  // Status ophalen
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

  // Filter items: “Goedkeuren” en “Admin” alleen voor owners
  const visibleItems = useMemo(() => {
    return NAV_ITEMS.filter((it) => {
      const ownerOnly = it.href === "/approval" || it.href === "/admin";
      return ownerOnly ? isOwner : true;
    });
  }, [isOwner]);

  // Bepaal huidig item aan de hand van de zichtbare items (geen verborgen item tonen als current)
  const current = useMemo(() => {
    const found = visibleItems.find((it) =>
      pathname ? pathname.toLowerCase().startsWith(it.href.toLowerCase()) : false
    );
    return found ?? visibleItems[0] ?? NAV_ITEMS[0];
  }, [pathname, visibleItems]);

  // In uitgeklapte staat: huidige item eerst
  const orderedItems = useMemo(() => {
    const others = visibleItems.filter(
      (it) => it.href.toLowerCase() !== current.href.toLowerCase()
    );
    return [current, ...others];
  }, [current, visibleItems]);

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
        {/* Ingeklapt */}
        {!open && (
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <CurrentLabel icon={current.icon} label={current.label} />
            <CircleButton ariaLabel="Open navigatie" onClick={() => setOpen(true)}>
              <ChevronRightBoldWhite />
            </CircleButton>
          </div>
        )}

        {/* Uitgeklapt */}
        {open && (
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {orderedItems.map((item, idx) => {
              const active =
                pathname?.toLowerCase().startsWith(item.href.toLowerCase()) ?? false;

              // eerste = huidige → niet klikbaar
              if (idx === 0) {
                return (
                  <NavLinkItem
                    key={item.href}
                    className={titleFont.className}
                    icon={item.icon}
                    label={item.label}
                    active={true}
                    disableHover={true}
                    notClickable={true}
                    noUnderline={true}
                  />
                );
              }

              return (
                <Link
                  key={item.href}
                  href={`${item.href}${q}`}
                  style={{ textDecoration: "none" }}
                >
                  <NavLinkItem
                    className={titleFont.className}
                    icon={item.icon}
                    label={item.label}
                    active={active}
                  />
                </Link>
              );
            })}

            <CircleButton ariaLabel="Sluit navigatie" onClick={() => setOpen(false)}>
              <ChevronLeftBoldWhite />
            </CircleButton>
          </div>
        )}
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
        background: "transparent",
        border: "none",
        padding: "8px 6px",
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
}: {
  className?: string;
  icon: LucideIcon;
  label: string;
  active?: boolean;
  disableHover?: boolean;
  notClickable?: boolean;
  noUnderline?: boolean;
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
        background: bg,
        border: "none",
        borderRadius: 10,
        padding: "8px 8px",
        fontSize: 18,
        fontWeight: 900,
        letterSpacing: 0.2,
        color: active ? UI.text : UI.muted,
        position: "relative",
        cursor: notClickable ? "default" : "pointer",
        transition: "background 150ms ease",
        pointerEvents: notClickable ? "none" : "auto",
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
      }}
    >
      {children}
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
