"use client";

import React from "react";
import { supabase } from "@/lib/supabaseClient";
import { COLORS as TCOLORS } from "./page";

type Personnel = {
  id: string;
  name: string;
  pharmacy?: string[] | null;
  avatar_url?: string | null;
};

type PharmacyRow = { pharmacy: string; daypart: string; hours: number };

type Props = {
  COLORS: typeof TCOLORS;
  variableFontClass: string;
  onAfterInsert?: (personId: string) => void;
};

const PHARMACY_CHOICES = ["Apotheek Generaal", "Apotheek Minerva", "Eeuwfeestapotheek"] as const;
const REASON_CHOICES = ["wettelijk", "overuren", "adv", "andere"] as const;

const FIELD = {
  label: { fontSize: 13, marginBottom: 6 },
  input: {
    height: 36,
    padding: "8px 10px",
    borderRadius: 10,
    border: "1px solid #e5e7eb",
    background: "#fff",
    width: "100%",
    fontSize: 14,
    boxSizing: "border-box" as const,
  },
};

function round1(n: number) {
  return Math.round(n * 10) / 10;
}
function normPharm(raw: string) {
  return String(raw || "")
    .toLowerCase()
    .replace(/\bapotheek\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
function normDaypart(v: string) {
  const s = String(v || "").trim().toLowerCase();
  if (s.startsWith("hele")) return "hele dag";
  if (s.startsWith("voor")) return "voormiddag";
  if (s.startsWith("nami") || s.startsWith("na")) return "namiddag";
  if (["voormiddag", "namiddag", "hele dag", "andere"].includes(s)) return s;
  return s;
}

export default function ManualInputCard({ COLORS, variableFontClass, onAfterInsert }: Props) {
  const [people, setPeople] = React.useState<Personnel[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [ok, setOk] = React.useState<string | null>(null);

  const [personId, setPersonId] = React.useState("");
  const [avatarUrl, setAvatarUrl] = React.useState<string | null>(null);
  const [pharmacy, setPharmacy] = React.useState<string>("");
  const [date, setDate] = React.useState(() => new Date().toISOString().slice(0, 10));
  const [daypart, setDaypart] = React.useState<"hele dag" | "voormiddag" | "namiddag" | "andere">("hele dag");
  const [hours, setHours] = React.useState<number>(8.5);
  const [reason, setReason] = React.useState<string>("");
  const [autoApprove, setAutoApprove] = React.useState<boolean>(true);
  const [pharmacyHours, setPharmacyHours] = React.useState<Record<string, number>>({});

  React.useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase.from("personnel").select("id, name, pharmacy, avatar_url").order("name");
      if (active && data) setPeople(data as Personnel[]);
    })();
    return () => { active = false; };
  }, []);

  React.useEffect(() => {
    if (!personId) {
      setPharmacy("");
      setAvatarUrl(null);
      setPharmacyHours({});
      return;
    }
    const p = people.find((x) => x.id === personId);
    setAvatarUrl(p?.avatar_url ?? null);
    if (p && Array.isArray(p.pharmacy) && p.pharmacy.length > 0) {
      const match = p.pharmacy.find((ph) => PHARMACY_CHOICES.includes(ph as any)) || String(p.pharmacy[0]);
      setPharmacy(match);
    } else setPharmacy("");
  }, [personId, people]);

  React.useEffect(() => {
    let active = true;
    async function loadPharmacyHours() {
      setPharmacyHours({});
      if (!pharmacy) return;
      const { data, error } = await supabase.from("pharmacy").select("pharmacy, daypart, hours");
      if (!active || error) return;
      const want = normPharm(pharmacy);
      const rows = (data || []).filter((r: PharmacyRow) => {
        const have = normPharm(r.pharmacy);
        return have === want || have.includes(want) || want.includes(have);
      });
      const map: Record<string, number> = {};
      rows.forEach((row) => (map[normDaypart(row.daypart)] = Number(row.hours ?? 0)));
      setPharmacyHours(map);
    }
    loadPharmacyHours();
    return () => { active = false; };
  }, [pharmacy]);

  const stdHoursFor = React.useCallback(
    (dp: string): number | null => {
      const key = normDaypart(dp);
      if (pharmacyHours[key] != null) return Number(pharmacyHours[key]);
      if (key === "hele dag") return 8.5;
      if (key === "voormiddag") return 4;
      if (key === "namiddag") return 4.5;
      return null;
    },
    [pharmacyHours]
  );

  React.useEffect(() => {
    const std = stdHoursFor(daypart);
    if (std != null) setHours(std);
    else if (daypart === "andere") setHours((prev) => prev || 1);
  }, [daypart, stdHoursFor]);

  React.useEffect(() => {
    if (!pharmacy) return;
    const std = stdHoursFor(daypart);
    if (std != null) setHours(std);
  }, [pharmacy, stdHoursFor, daypart]);

  function handleHoursChange(next: number) {
    setHours(next);
    const n = round1(next);
    const dp = normDaypart(daypart);
    if (["hele dag", "voormiddag", "namiddag"].includes(dp)) {
      const std = stdHoursFor(dp);
      if (std != null && round1(std) !== n) setDaypart("andere");
    }
  }

  const missing: string[] = [];
  if (!personId) missing.push("Medewerker");
  if (personId && !pharmacy) missing.push("Apotheek");
  if (personId && !date) missing.push("Datum");
  if (personId && !reason) missing.push("Reden");
  if (personId && (!hours || hours <= 0)) missing.push("Uren");

  const isValid = missing.length === 0;
  const tooltip = isValid ? "Toevoegen" : `Vul nog in: ${missing.join(", ")}`;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid || loading) return;
    setErr(null);
    setOk(null);
    setLoading(true);
    try {
      const status = autoApprove ? "approved" : "requested";
      const payload = {
        personnel_id: personId,
        leave_date: date,
        status,
        daypart,
        entitlement: reason || null,
        hours,
      };
      const { error } = await supabase.from("leave_requests").insert([payload]);
      if (error) throw error;
      setOk(`Verlof toegevoegd (${status === "approved" ? "goedgekeurd" : "aangevraagd"}).`);
      setDate(new Date().toISOString().slice(0, 10));
      setDaypart("hele dag");
      setHours(stdHoursFor("hele dag") ?? 8.5);
      setReason("");
      setAutoApprove(true);
      if (onAfterInsert) onAfterInsert(personId);
    } catch (e: any) {
      setErr(e?.message || "Toevoegen mislukt.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        background: COLORS.card,
        border: `1px solid ${COLORS.line}`,
        borderRadius: 12,
        padding: 16,
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <div style={{ display: "grid", gridTemplateColumns: "6px 1fr", alignItems: "center", columnGap: 8 }}>
        <div style={{ width: 6, height: 20, background: COLORS.primary, borderRadius: 3 }} />
        <h2 className={variableFontClass} style={{ margin: 0, fontSize: 18 }}>Verlof manueel invoeren</h2>
      </div>

      {err && (
        <div style={{ background: "#fff7ed", border: `1px solid ${COLORS.line}`, padding: 10, borderRadius: 10, color: "#7c2d12" }}>
          {err}
        </div>
      )}
      {ok && (
        <div style={{ background: "#ecfdf5", border: `1px solid ${COLORS.line}`, padding: 10, borderRadius: 10, color: "#065f46" }}>
          {ok}
        </div>
      )}

      {/* Medewerker */}
      <div style={{ display: "grid", gridTemplateColumns: "44px 1fr", alignItems: "center", gap: 10 }}>
        <div
          aria-hidden
          style={{
            width: 44,
            height: 44,
            borderRadius: 8,
            overflow: "hidden",
          }}
        >
          {avatarUrl ? (
            <img src={avatarUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <div style={{ width: "100%", height: "100%" }} />
          )}
        </div>

        <div>
          <label style={{ ...FIELD.label, color: COLORS.textMuted }}>Medewerker</label>
          <select
            value={personId}
            onChange={(e) => setPersonId(e.target.value)}
            style={FIELD.input}
          >
            <option value="">—</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      </div>

      {personId && (
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {/* Apotheek */}
          <div>
            <label style={{ ...FIELD.label, color: COLORS.textMuted }}>Apotheek</label>
            <select
              value={pharmacy}
              onChange={(e) => setPharmacy(e.target.value)}
              style={FIELD.input}
            >
              <option value="">—</option>
              {PHARMACY_CHOICES.map((ph) => (
                <option key={ph} value={ph}>{ph}</option>
              ))}
            </select>
          </div>

          {/* Datum */}
          <div>
            <label style={{ ...FIELD.label, color: COLORS.textMuted }}>Datum</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              style={FIELD.input}
            />
          </div>

          {/* Dagdeel + Uren + Reden */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 60px 1fr", gap: 10 }}>
            <div>
              <label style={{ ...FIELD.label, color: COLORS.textMuted }}>Dagdeel</label>
              <select
                value={daypart}
                onChange={(e) => setDaypart(e.target.value as any)}
                style={FIELD.input}
              >
                <option value="hele dag">Hele dag</option>
                <option value="voormiddag">Voormiddag</option>
                <option value="namiddag">Namiddag</option>
                <option value="andere">Andere</option>
              </select>
            </div>

            <div>
              <label style={{ ...FIELD.label, color: COLORS.textMuted }}>Uren</label>
              <input
                type="number"
                inputMode="decimal"
                step="0.5"
                min={0.5}
                value={Number.isFinite(hours) ? String(hours) : ""}
                onChange={(e) => handleHoursChange(Number(e.target.value))}
                style={{ ...FIELD.input, textAlign: "right" as const }}
              />
            </div>

            <div>
              <label style={{ ...FIELD.label, color: COLORS.textMuted }}>Reden</label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                style={FIELD.input}
              >
                <option value="">—</option>
                {REASON_CHOICES.map((opt) => (
                  <option key={opt} value={opt}>{opt[0].toUpperCase() + opt.slice(1)}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Meteen goedkeuren */}
          <label style={{ display: "flex", alignItems: "center", gap: 8, color: COLORS.text, fontSize: 14 }}>
            Meteen goedkeuren
            <input
              type="checkbox"
              checked={autoApprove}
              onChange={(e) => setAutoApprove(e.target.checked)}
              style={{ width: 16, height: 16 }}
            />
          </label>

          {/* Knop */}
          <div style={{ display: "flex", justifyContent: "flex-end" }} title={tooltip}>
            <button
              type="submit"
              disabled={!isValid || loading}
              className={variableFontClass}
              style={{
                padding: "10px 14px",
                background: (!isValid || loading) ? "#d2edf2" : COLORS.btnBg,
                color: "#ffffff",
                border: "none",
                borderRadius: 999,
                cursor: (!isValid || loading) ? "not-allowed" : "pointer",
                fontWeight: 400,
                fontSize: 14,
                letterSpacing: 0.2,
                minWidth: 120,
              }}
              onMouseOver={(e) => {
                if (isValid && !loading) e.currentTarget.style.background = COLORS.btnHover;
              }}
              onMouseOut={(e) => {
                if (isValid && !loading) e.currentTarget.style.background = COLORS.btnBg;
              }}
            >
              Toevoegen
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
