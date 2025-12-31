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

function formatShortYMD(ymd: string) {
  const d = new Date(ymd);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = String(d.getFullYear()).slice(2);
  return `${dd}/${mm}/${yy}`;
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
  const [isRange, setIsRange] = React.useState(false);
  const [endDate, setEndDate] = React.useState(() => new Date().toISOString().slice(0, 10));
  const [dayEntries, setDayEntries] = React.useState<Array<{date: string; daypart: string; hours: number; reason: string}>>([]);
  const [daypart, setDaypart] = React.useState<"hele dag" | "voormiddag" | "namiddag" | "andere">("hele dag");
  const [hours, setHours] = React.useState<number>(8.5);
  const [reason, setReason] = React.useState<string>("");
  const [autoApprove, setAutoApprove] = React.useState<boolean>(true);
  const [pharmacyHours, setPharmacyHours] = React.useState<Record<string, number>>({});
  const [balances, setBalances] = React.useState<Record<string, Record<string, number>>>({});

  React.useEffect(() => {
    let mounted = true;
    async function buildEntries() {
      if (!isRange) {
        if (mounted) setDayEntries([]);
        return;
      }
      if (!date || !endDate) {
        if (mounted) setDayEntries([]);
        return;
      }

      // ensure start <= end
      let s = new Date(date);
      let e = new Date(endDate);
      if (s > e) {
        const t = s; s = e; e = t;
      }

      // fetch public holidays in [s, e]
      const from = s.toISOString().slice(0, 10);
      const toEx = new Date(e);
      toEx.setDate(toEx.getDate() + 1);
      const to = toEx.toISOString().slice(0, 10);
      const { data } = await supabase
        .from("holidays")
        .select("holiday_date,type")
        .gte("holiday_date", from)
        .lt("holiday_date", to)
        .eq("type", "public");
      const publicSet = new Set<string>((data || []).map((r: any) => String(r.holiday_date)));

      // preserve any existing per-row choices where possible
      const prevMap: Record<string, {daypart?: string; hours?: number; reason?: string}> = {};
      dayEntries.forEach((d) => { prevMap[d.date] = { daypart: d.daypart, hours: d.hours, reason: d.reason }; });

      const entries: Array<{date: string; daypart: string; hours: number; reason: string}> = [];
      for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
        const ymd = d.toISOString().slice(0, 10);
        const dow = d.getDay();
        if (dow === 0 || dow === 6) continue; // skip weekend
        if (publicSet.has(ymd)) continue; // skip public holiday
        const prev = prevMap[ymd];
        entries.push({ date: ymd, daypart: prev?.daypart ?? daypart, hours: prev?.hours ?? hours, reason: prev?.reason ?? "" });
      }

      // only update if changed to avoid stomping per-row edits
      const same = entries.length === dayEntries.length && entries.every((e, i) => e.date === dayEntries[i]?.date && e.daypart === dayEntries[i]?.daypart && Number(e.hours) === Number(dayEntries[i]?.hours) && (e.reason || "") === (dayEntries[i]?.reason || ""));
      if (mounted && !same) setDayEntries(entries);
    }
    buildEntries();
    return () => { mounted = false; };
  }, [isRange, date, endDate]);

  React.useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase.from("personnel").select("id, name, pharmacy, avatar_url").order("name");
      if (active && data) setPeople(data as Personnel[]);
    })();
    return () => { active = false; };
  }, []);

  React.useEffect(() => {
    // reset balances and clear only per-row reason when switching personnel
    setBalances({});
    setDayEntries((prev) => prev.map((d) => ({ ...d, reason: "" })));
    setReason("");
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

  // Compute entitlements and used hours per year and reason for the selected person
  React.useEffect(() => {
    let mounted = true;
    async function loadBalances() {
      if (!personId) {
        if (mounted) setBalances({});
        return;
      }

      // collect years we need: from dayEntries and single date
      const years = new Set<number>();
      if (date) years.add(new Date(date).getFullYear());
      if (isRange) {
        dayEntries.forEach((d) => years.add(new Date(d.date).getFullYear()));
      }
      if (years.size === 0) {
        if (mounted) setBalances({});
        return;
      }

      const yearsArr = Array.from(years.values());

      // fetch entitlements for these years
      const { data: ents } = await supabase
        .from("leave_entitlements")
        .select("year,total_hours,reason")
        .eq("personnel_id", personId)
        .in("year", yearsArr);

      // determine date span to fetch approved leave_requests
      const minYear = Math.min(...yearsArr);
      const maxYear = Math.max(...yearsArr);
      const from = `${minYear}-01-01`;
      const toEx = new Date(`${maxYear}-12-31`);
      toEx.setDate(toEx.getDate() + 1);
      const to = toEx.toISOString().slice(0, 10);

      const { data: usedRows } = await supabase
        .from("leave_requests")
        .select("leave_date,entitlement,hours,status")
        .eq("personnel_id", personId)
        .eq("status", "approved")
        .gte("leave_date", from)
        .lt("leave_date", to);

      const baseMap: Record<number, Record<string, number>> = {};
      (ents || []).forEach((r: any) => {
        const y = Number(r.year);
        if (!baseMap[y]) baseMap[y] = {};
        const key = (r.reason || "").toString().toLowerCase();
        baseMap[y][key] = (Number(r.total_hours) || 0) + (baseMap[y][key] || 0);
      });

      const usedMap: Record<number, Record<string, number>> = {};
      (usedRows || []).forEach((r: any) => {
        const y = new Date(r.leave_date).getFullYear();
        if (!usedMap[y]) usedMap[y] = {};
        const key = (r.entitlement || "").toString().toLowerCase();
        usedMap[y][key] = (Number(r.hours) || 0) + (usedMap[y][key] || 0);
      });

      const bal: Record<string, Record<string, number>> = {};
      yearsArr.forEach((y) => {
        const by: Record<string, number> = {};
        const keys = new Set<string>([
          ...(Object.keys(baseMap[y] || {})),
          ...(Object.keys(usedMap[y] || {})),
        ]);
        keys.forEach((k) => {
          const base = (baseMap[y] && baseMap[y][k]) || 0;
          const used = (usedMap[y] && usedMap[y][k]) || 0;
          by[k] = base - used;
        });
        bal[String(y)] = by;
      });

      if (mounted) setBalances(bal);
    }
    loadBalances();
    return () => { mounted = false; };
  }, [personId, date, isRange, endDate, dayEntries]);

  function remainingBalancesBeforeIndex(index: number) {
    const rem: Record<string, Record<string, number>> = {};
    Object.keys(balances).forEach((y) => {
      rem[y] = { ...(balances[y] || {}) };
    });
    for (let i = 0; i < index && i < dayEntries.length; i++) {
      const e = dayEntries[i];
      const yr = String(new Date(e.date).getFullYear());
      const r = (e.reason || "").toString().toLowerCase();
      if (!r || r === "andere") continue;
      if (!rem[yr]) rem[yr] = {};
      rem[yr][r] = (rem[yr][r] || 0) - (Number(e.hours) || 0);
    }
    return rem;
  }

  function availableReasonsForAt(index: number, year: number, neededHours: number) {
    const pref = ["overuren", "adv", "wettelijk"];
    const rem = remainingBalancesBeforeIndex(index);
    const by = rem[String(year)] || {};
    const out: string[] = [];
    pref.forEach((p) => {
      if ((by[p] || 0) > neededHours) out.push(p);
    });
    return out;
  }

  // default-select a reason when balances are available and no reason chosen
  React.useEffect(() => {
    if (!personId) return;
    if (!balances || Object.keys(balances).length === 0) return;
    if (!isRange) {
      const y = new Date(date).getFullYear();
      const opts = availableReasonsForAt(0, y, hours);
      if (opts.length > 0) {
        if (reason !== opts[0]) setReason(opts[0]);
      }
      return;
    }

    // For ranges we must assign defaults sequentially and deduct each choice
    setDayEntries((prev) => {
      const next: typeof prev = [];
      // clone rem balances to track deductions across rows
      const rem: Record<string, Record<string, number>> = {};
      Object.keys(balances).forEach((y) => { rem[y] = { ...(balances[y] || {}) }; });

      for (let i = 0; i < prev.length; i++) {
        const entry = { ...prev[i] };
        const yr = String(new Date(entry.date).getFullYear());
        if (!rem[yr]) rem[yr] = {};

        if (!entry.reason) {
          const pref = ["overuren", "adv", "wettelijk"];
          let chosen: string | null = null;
          for (const p of pref) {
            if ((rem[yr][p] || 0) > (Number(entry.hours) || 0)) {
              chosen = p;
              break;
            }
          }
          if (chosen) {
            entry.reason = chosen;
            rem[yr][chosen] = (rem[yr][chosen] || 0) - (Number(entry.hours) || 0);
          }
        } else {
          const r = entry.reason.toString().toLowerCase();
          if (r && r !== "andere") {
            rem[yr][r] = (rem[yr][r] || 0) - (Number(entry.hours) || 0);
          }
        }

        next.push(entry);
      }

      // Only update if something changed (simple shallow compare)
      const changed = next.some((n, i) => n.reason !== prev[i].reason);
      return changed ? next : prev;
    });
  }, [balances, personId, isRange, date, hours, dayEntries]);

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
  if (personId && isRange) {
    if (!dayEntries || dayEntries.length === 0) missing.push("Datum");
    // require every entry to have a reason and positive hours
    const anyMissingReason = dayEntries.some((e) => !e.reason);
    if (anyMissingReason) missing.push("Reden");
    const anyBadHours = dayEntries.some((e) => !e.hours || Number(e.hours) <= 0);
    if (anyBadHours) missing.push("Uren");
  } else {
    if (personId && !reason) missing.push("Reden");
    if (personId && (!hours || hours <= 0)) missing.push("Uren");
  }

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
      if (isRange) {
        const payloads = dayEntries.map((entry) => ({
          personnel_id: personId,
          leave_date: entry.date,
          status,
          daypart: entry.daypart,
          entitlement: entry.reason || null,
          hours: entry.hours,
        }));
        const { error } = await supabase.from("leave_requests").insert(payloads);
        if (error) throw error;
        setOk(`Verlof toegevoegd (${payloads.length} dagen, ${status === "approved" ? "goedgekeurd" : "aangevraagd"}).`);
      } else {
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
      }
      setDate(new Date().toISOString().slice(0, 10));
      setEndDate(new Date().toISOString().slice(0, 10));
      setIsRange(false);
      setDaypart("hele dag");
      setHours(stdHoursFor("hele dag") ?? 8.5);
      setReason("");
      setDayEntries([]);
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
            <div style={{ display: "grid", gridTemplateColumns: isRange ? "1fr 1fr" : "1fr", gap: 8 }}>
              <div>
                <label style={{ ...FIELD.label, color: COLORS.textMuted }}>{isRange ? "Startdatum" : "Datum"}</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  style={FIELD.input}
                />
              </div>

              {isRange && (
                <div>
                  <label style={{ ...FIELD.label, color: COLORS.textMuted }}>Einddatum</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    style={FIELD.input}
                  />
                </div>
              )}
            </div>

            <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, color: COLORS.text, fontSize: 14 }}>
              <input
                type="checkbox"
                checked={isRange}
                onChange={(e) => {
                  setIsRange(e.target.checked);
                  if (e.target.checked) setEndDate(date);
                }}
                style={{ width: 16, height: 16 }}
              />
              Vakantieperiode ipv 1 dag
            </label>

            {/* debug panel removed */}
          </div>

          {/* Dagdeel + Uren + Reden */}
          {isRange ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {dayEntries.length === 0 && (
                <div style={{ color: COLORS.textMuted, fontSize: 13 }}>Geen werkdagen in de geselecteerde periode.</div>
              )}

              {dayEntries.length > 0 && (
                <div style={{ display: "grid", gridTemplateColumns: "60px 115px 70px 110px", gap: 8, alignItems: "center", marginBottom: -10 }}>
                  <div />
                  <div style={{ ...FIELD.label, color: COLORS.textMuted }}>Dagdeel</div>
                  <div style={{ ...FIELD.label, color: COLORS.textMuted }}>Uren</div>
                  <div style={{ ...FIELD.label, color: COLORS.textMuted }}>Reden</div>
                </div>
              )}

              {dayEntries.map((entry, idx) => (
                <div key={entry.date} style={{ display: "grid", gridTemplateColumns: "60px 115px 70px 110px", gap: 6, alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", height: 36 }}>
                    <div style={{ fontSize: 13, color: COLORS.text }}>{formatShortYMD(entry.date)}</div>
                  </div>

                  <div>
                    <select
                      value={entry.daypart}
                      onChange={(e) => {
                        const next = [...dayEntries];
                        next[idx] = { ...next[idx], daypart: e.target.value };
                        setDayEntries(next);
                      }}
                      style={{ ...FIELD.input, marginTop: 0 }}
                    >
                      <option value="hele dag">Hele dag</option>
                      <option value="voormiddag">Voormiddag</option>
                      <option value="namiddag">Namiddag</option>
                      <option value="andere">Andere</option>
                    </select>
                  </div>

                  <div>
                    <input
                      type="number"
                      inputMode="decimal"
                      step="0.5"
                      min={0.5}
                      value={Number.isFinite(entry.hours) ? String(entry.hours) : ""}
                      onChange={(e) => {
                        const next = [...dayEntries];
                        next[idx] = { ...next[idx], hours: Number(e.target.value) };
                        setDayEntries(next);
                      }}
                      style={{ ...FIELD.input, textAlign: "right" as const, marginTop: 0 }}
                    />
                  </div>

                  <div>
                    {(() => {
                      const year = new Date(entry.date).getFullYear();
                      const opts = availableReasonsForAt(idx, year, entry.hours);
                      return (
                        <select
                          value={entry.reason}
                          onChange={(e) => {
                            const next = [...dayEntries];
                            next[idx] = { ...next[idx], reason: e.target.value };
                            setDayEntries(next);
                          }}
                          style={{ ...FIELD.input, marginTop: 0 }}
                        >
                          <option value="">—</option>
                          {opts.map((opt) => (
                            <option key={opt} value={opt}>{opt[0].toUpperCase() + opt.slice(1)}</option>
                          ))}
                          <option value="andere">Andere</option>
                        </select>
                      );
                    })()}
                  </div>
                </div>
              ))}
            </div>
          ) : (
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
                {(() => {
                  const y = new Date(date).getFullYear();
                  const opts = availableReasonsForAt(0, y, hours);
                  return (
                    <select
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      style={FIELD.input}
                    >
                      <option value="">—</option>
                      {opts.map((opt) => (
                        <option key={opt} value={opt}>{opt[0].toUpperCase() + opt.slice(1)}</option>
                      ))}
                      <option value="andere">Andere</option>
                    </select>
                  );
                })()}
              </div>
            </div>
          )}

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
