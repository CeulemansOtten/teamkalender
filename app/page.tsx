"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import localFont from "next/font/local";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

/* Alleen titel in Bold-variable font; inputs = basisfont */
const titleFont = localFont({ src: "./fonts/Font_VariableBold.otf", display: "swap" });

const COLORS = {
  bg: "#ffffff",
  card: "#f7f9fb",
  line: "#e5e7eb",
  text: "#0f172a",
  textMuted: "#475569",
  primary: "#0ea5a8",
  btnHover: "#0cb3b7",
};

const CIRCLE_SIZE = 150; // placeholder/afbeelding

type Person = {
  id: string;
  name: string;
  surname: string | null;
  avatar_url: string | null;
  status: string | null;
  birthdate: string | null; // string!
};

/* Kleine inline icoontjes */
function EyeIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
function EyeOffIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path d="M3 3l18 18" />
      <path d="M10.58 10.58a3 3 0 104.24 4.24" />
      <path d="M9.88 5.09A10.94 10.94 0 0112 5c7 0 11 7 11 7a19.72 19.72 0 01-3.22 3.88M6.11 6.11A19.56 19.56 0 001 12s4 7 11 7a10.94 10.94 0 004.88-1.12" />
    </svg>
  );
}

/* Normaliseer naar enkel cijfers (spaties, streepjes, puntjes weg) */
function digitsOnly(s: string | null | undefined) {
  return (s ?? "").replace(/\D/g, "");
}

export default function LoginPage() {
  const router = useRouter();
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string>("");
  const [selectedId, setSelectedId] = useState<string>("");
  const [password, setPassword] = useState("");
  const [submitError, setSubmitError] = useState<"none" | "no-name" | "no-pass" | "wrong-pass">("none");

  const [showPw, setShowPw] = useState(false);
  const pwRef = useRef<HTMLInputElement | null>(null);

  const selectedPerson = useMemo(
    () => people.find((p) => p.id === selectedId) || null,
    [people, selectedId]
  );

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setLoadError("");
      const { data, error } = await supabase
        .from("personnel")
        .select("id,name,surname,avatar_url,status,birthdate")
        .order("name", { ascending: true });

      if (!active) return;

      if (error) {
        console.error("[personnel fetch]", error);
        setLoadError(`Kon personeelslijst niet laden: ${error.message}`);
        setPeople([]);
      } else {
        setPeople(data ?? []);
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  function handleSelect(e: React.ChangeEvent<HTMLSelectElement>) {
    setSelectedId(e.target.value);
    setPassword("");
    setSubmitError("none");
    setTimeout(() => pwRef.current?.focus(), 0);
  }

  function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError("none");

    if (!selectedId) return setSubmitError("no-name");
    if (!password) return setSubmitError("no-pass");

    const expectedDigits = digitsOnly(selectedPerson?.birthdate);
    const enteredDigits = digitsOnly(password);

    if (!expectedDigits || enteredDigits !== expectedDigits) {
      setSubmitError("wrong-pass");
      return;
    }

    if (typeof window !== "undefined") {
      localStorage.setItem("logged_in_personnel_id", selectedId);
      // iOS Safari zoom fix: reset viewport and scroll
      setTimeout(() => {
        // Scroll naar boven en reset zoom
        window.scrollTo(0, 0);
        // Probeer meta viewport te resetten
        const meta = document.querySelector('meta[name="viewport"]');
        if (meta) {
          meta.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=0');
          // Na korte tijd weer user-scalable toestaan
          setTimeout(() => {
            meta.setAttribute('content', 'width=device-width, initial-scale=1.0');
          }, 500);
        }
      }, 100);
    }
    router.push(`/after_login/?personnel_id=${encodeURIComponent(selectedId)}`);
  }

  return (
    <main
      style={{
        background: COLORS.bg,
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 24,
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 512,
          background: COLORS.card,
          border: `1px solid ${COLORS.line}`,
          borderRadius: 16,
          padding: 20,
          boxSizing: "border-box",
        }}
      >
        {/* Titel */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "8px 1fr",
            alignItems: "center",
            columnGap: 10,
            marginBottom: 16,
          }}
        >
          <div style={{ width: 8, height: 28, background: COLORS.primary, borderRadius: 4 }} />
          <h1 className={titleFont.className} style={{ margin: 0, color: COLORS.text, fontSize: 28, fontWeight: 900 }}>
            Aanmelden
          </h1>
        </div>

        {loadError && (
          <div style={{ marginBottom: 10, color: "#b91c1c", fontSize: 13 }}>{loadError}</div>
        )}

        <form onSubmit={handleLogin}>
          {/* Links: cirkel/PNG — Rechts: velden */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: `${CIRCLE_SIZE}px 1fr`,
              gap: 16,
              alignItems: "start",
            }}
          >
            <div style={{ width: CIRCLE_SIZE, height: CIRCLE_SIZE }}>
              {selectedPerson?.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={selectedPerson.avatar_url}
                  alt={selectedPerson.name}
                  style={{ width: "100%", height: "100%", objectFit: "contain" }}
                />
              ) : (
                <div
                  aria-hidden
                  style={{
                    width: "100%",
                    height: "100%",
                    borderRadius: "50%",
                    border: `1px solid ${COLORS.line}`,
                    background: "#fff",
                  }}
                />
              )}
            </div>

            {/* Rechts: Naam + Paswoord */}
            <div style={{ display: "grid", gap: 12 }}>
              <label style={{ fontSize: 13, color: COLORS.text }}>
                Naam
                <select
                  value={selectedId}
                  onChange={handleSelect}
                  style={{
                    width: "100%",
                    marginTop: 6,
                    padding: "10px 12px",
                    fontSize: 14,
                    borderRadius: 12,
                    border: `1px solid ${COLORS.line}`,
                    background: "#fff",
                    color: COLORS.text,
                    outline: "none",
                  }}
                >
                  <option value="">
                    {loading ? "Laden…" : people.length === 0 ? "Geen personeel gevonden" : "— Kies je naam —"}
                  </option>
                  {!loading &&
                    people.map((p) => {
                      const label = p.surname ? `${p.name} ${p.surname}` : p.name;
                      return (
                        <option key={p.id} value={p.id}>
                          {label}
                        </option>
                      );
                    })}
                </select>
              </label>

              {selectedId && (
                <label style={{ display: "grid", gap: 6, fontSize: 13, color: COLORS.text }}>
                  Paswoord
                  <div style={{ position: "relative" }}>
                    <input
                      ref={pwRef}
                      type={showPw ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder=""
                      autoComplete="current-password"
                      style={{
                        width: "100%",
                        padding: "10px 44px 10px 12px", // ruimte rechts voor oogknop
                        fontSize: 14,
                        borderRadius: 12,
                        border: `1px solid ${COLORS.line}`,
                        background: "#fff",
                        color: COLORS.text,
                        outline: "none",
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw((s) => !s)}
                      aria-label={showPw ? "Verberg paswoord" : "Toon paswoord"}
                      title={showPw ? "Verberg paswoord" : "Toon paswoord"}
                      style={{
                        position: "absolute",
                        right: 8,
                        top: "50%",
                        transform: "translateY(-50%)",
                        border: "none",
                        background: "transparent",
                        cursor: "pointer",
                        padding: 6,
                        display: "grid",
                        placeItems: "center",
                        color: COLORS.textMuted,
                      }}
                    >
                      {showPw ? <EyeOffIcon /> : <EyeIcon />}
                    </button>
                  </div>

                  {/* Foutmelding onder het paswoordveld, links uitgelijnd, 3 regels */}
                  {submitError === "wrong-pass" && (
                    <div style={{ marginTop: 6 }}>
                      <div style={{ fontWeight: 700, color: "#b91c1c", fontSize: 13 }}>
                        paswoord klopt niet
                      </div>
                      <div style={{ fontStyle: "italic", color: "#b91c1c", fontSize: 12 }}>
                        is normaal je geboortedatum
                      </div>
                      <div style={{ fontStyle: "italic", color: "#b91c1c", fontSize: 12 }}>
                        dag maand jaar aan elkaar geplakt (bvb 24101993)
                      </div>
                    </div>
                  )}
                </label>
              )}
            </div>
          </div>

          {/* Actieknop */}
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
            <button
              type="submit"
              disabled={!selectedId || !password}
              className={titleFont.className}
              onMouseOver={(e) => (e.currentTarget.style.background = COLORS.btnHover)}
              onMouseOut={(e) => (e.currentTarget.style.background = COLORS.primary)}
              style={{
                padding: "10px 16px",
                background: COLORS.primary,
                color: "#ffffff",
                border: "1px solid transparent",
                borderRadius: 999,
                cursor: !selectedId || !password ? "not-allowed" : "pointer",
                opacity: !selectedId || !password ? 0.7 : 1,
                minWidth: 140,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 900,
                fontSize: 16,
                letterSpacing: 0.2,
                transition: "background 120ms ease-in-out, opacity 120ms ease-in-out",
              }}
              aria-label="Aanmelden"
              title={!selectedId ? "Kies eerst je naam" : !password ? "Geef je paswoord in" : "Aanmelden"}
            >
              Aanmelden
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
