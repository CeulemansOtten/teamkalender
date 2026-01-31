// app/admin/CardStandaardPlanning.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import localFont from "next/font/local";
import { supabase } from "../../lib/supabaseClient";

/* ====== UI (match met CardPersoneelBeheren) ====== */
const COLORS = {
  card: "#f7f9fb",
  line: "#e5e7eb",
  text: "#0f172a",
  textMuted: "#475569",
  primary: "#0ea5a8",
};
const SYS_FONT = "system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif";

const baseField: React.CSSProperties = {
  height: 32,
  padding: "6px 10px",
  borderRadius: 8,
  border: `1px solid ${COLORS.line}`,
  background: "#fff",
  fontFamily: SYS_FONT,
  fontSize: 14,
};

const variableFont = localFont({
  src: "../fonts/Font_Variable.otf",
  display: "swap",
});

const titleFont = localFont({
  src: "../fonts/Font_VariableBold.otf",
  display: "swap",
});

type PersonRow = {
  id: string;
  name: string;
  avatar_url: string | null;
  active?: string | null;
};

type PharmacyChoice = "" | "vrij" | "Eeuwfeest" | "Generaal" | "Minerva";
type HalfDay = "am" | "pm";

const WEEKDAYS = [
  { key: "mon", label: "Maandag" },
  { key: "tue", label: "Dinsdag" },
  { key: "wed", label: "Woensdag" },
  { key: "thu", label: "Donderdag" },
  { key: "fri", label: "Vrijdag" },
] as const;

type WeekdayKey = (typeof WEEKDAYS)[number]["key"];

type StandardPlanningRow = {
  personnel_id: string;
  weekday: string;
  daypart: string;
  pharmacy: string;
};

const PHARMACY_VALUES: Array<Exclude<PharmacyChoice, "" | "vrij">> = ["Eeuwfeest", "Generaal", "Minerva"];

const DAY_SPACER_PX = 2;
const CELL_PX = 105;

const WEEKDAY_DB: Record<WeekdayKey, "maandag" | "dinsdag" | "woensdag" | "donderdag" | "vrijdag"> = {
  mon: "maandag",
  tue: "dinsdag",
  wed: "woensdag",
  thu: "donderdag",
  fri: "vrijdag",
};

const WEEKDAY_KEY_FROM_DB: Record<string, WeekdayKey> = {
  maandag: "mon",
  dinsdag: "tue",
  woensdag: "wed",
  donderdag: "thu",
  vrijdag: "fri",
};

const DAYPART_DB: Record<HalfDay, "voormiddag" | "namiddag"> = {
  am: "voormiddag",
  pm: "namiddag",
};

const HALF_FROM_DB: Record<string, HalfDay> = {
  voormiddag: "am",
  namiddag: "pm",
};

const PHARMACY_DB_FROM_CHOICE: Record<Exclude<PharmacyChoice, "">, string> = {
  Eeuwfeest: "Eeuwfeestapotheek",
  Generaal: "Apotheek Generaal",
  Minerva: "Apotheek Minerva",
  vrij: "vrij",
};

const PHARMACY_CHOICE_FROM_DB: Record<string, Exclude<PharmacyChoice, "">> = {
  Eeuwfeestapotheek: "Eeuwfeest",
  "Apotheek Generaal": "Generaal",
  "Apotheek Minerva": "Minerva",
  vrij: "vrij",
};

export default function CardStandaardPlanning() {
  const [people, setPeople] = useState<PersonRow[]>([]);
  const [loading, setLoading] = useState(false);

  const [planLoaded, setPlanLoaded] = useState(false);

  const [saving, setSaving] = useState(false);

  const [plan, setPlan] = useState<
    Record<string, Record<WeekdayKey, { am: PharmacyChoice; pm: PharmacyChoice }>>
  >({});

  const gridTemplateColumns = useMemo(() => {
    // 1ste kolom = avatar + naam, daarna per weekdag: voormiddag + namiddag
    const dayCols = WEEKDAYS.map((_, i) =>
      i === WEEKDAYS.length - 1 ? `${CELL_PX}px ${CELL_PX}px` : `${CELL_PX}px ${CELL_PX}px ${DAY_SPACER_PX}px`
    ).join(" ");
    return `130px ${dayCols}`;
  }, []);

  useEffect(() => {
    let on = true;

    const isActiveFlag = (value: unknown) => {
      const v = String(value ?? "").trim().toLowerCase();
      return v === "yes" || v === "ja" || v === "true" || v === "1";
    };

    const loadPeople = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("personnel")
        .select("id, name, avatar_url, active")
        .order("name", { ascending: true });

      if (!on) return;
      if (error) {
        console.error("[CardStandaardPlanning] personnel fetch", error);
        setPeople([]);
      } else {
        const next = ((data || []) as PersonRow[]).filter((p) => isActiveFlag(p.active));
        setPeople(next);
      }
      setPlanLoaded(false);
      setLoading(false);
    };

    const handler = () => {
      loadPeople();
    };

    loadPeople();
    window.addEventListener("personnel-active-updated", handler as EventListener);
    window.addEventListener("personnel-updated", handler as EventListener);

    return () => {
      on = false;
      window.removeEventListener("personnel-active-updated", handler as EventListener);
      window.removeEventListener("personnel-updated", handler as EventListener);
    };
  }, []);

  useEffect(() => {
    if (planLoaded) return;
    if (loading) return;
    if (people.length === 0) return;

    let on = true;
    (async () => {
      const ids = people.map((p) => p.id);
      const { data, error } = await supabase
        .from("standard_planning")
        .select("personnel_id, weekday, daypart, pharmacy")
        .in("personnel_id", ids);

      if (!on) return;
      if (error) {
        console.error("[CardStandaardPlanning] standard_planning fetch", error);
        setPlanLoaded(true);
        return;
      }

      const nextPlan: Record<string, Record<WeekdayKey, { am: PharmacyChoice; pm: PharmacyChoice }>> = {};
      for (const r of (data || []) as StandardPlanningRow[]) {
        const dayKey = WEEKDAY_KEY_FROM_DB[(r.weekday || "").toLowerCase()];
        const half = HALF_FROM_DB[(r.daypart || "").toLowerCase()];
        const choice = PHARMACY_CHOICE_FROM_DB[(r.pharmacy || "").toString()] ?? "";
        if (!dayKey || !half) continue;
        const prevRow = nextPlan[r.personnel_id] || ({} as Record<WeekdayKey, { am: PharmacyChoice; pm: PharmacyChoice }>);
        const prevDay = prevRow[dayKey] || { am: "", pm: "" };
        nextPlan[r.personnel_id] = {
          ...prevRow,
          [dayKey]: {
            ...prevDay,
            [half]: choice,
          },
        };
      }

      setPlan(nextPlan);
      setPlanLoaded(true);
    })();

    return () => {
      on = false;
    };
  }, [people, loading, planLoaded]);

  const setPharmacy = (personId: string, day: WeekdayKey, half: HalfDay, value: PharmacyChoice) => {
    setPlan((prev) => {
      const prevRow = prev[personId] || ({} as Record<WeekdayKey, { am: PharmacyChoice; pm: PharmacyChoice }>);
      const prevDay = prevRow[day] || { am: "", pm: "" };
      return {
        ...prev,
        [personId]: {
          ...prevRow,
          [day]: {
            ...prevDay,
            [half]: value,
          },
        },
      };
    });
  };

  const onSave = async () => {
    setSaving(true);
    try {
      const upserts: Array<StandardPlanningRow> = [];

      for (const personId of Object.keys(plan)) {
        for (const d of WEEKDAYS) {
          const day = plan[personId]?.[d.key] || { am: "", pm: "" };
          (Object.keys(DAYPART_DB) as HalfDay[]).forEach((half) => {
            const choice = day[half];
            const weekday = WEEKDAY_DB[d.key];
            const daypart = DAYPART_DB[half];

            if (choice === "") return;
            upserts.push({
              personnel_id: personId,
              weekday,
              daypart,
              pharmacy: PHARMACY_DB_FROM_CHOICE[choice],
            });
          });
        }
      }

      // Requirement: wipe the table completely, then re-insert everything.
      // Supabase requires a filter on delete; this filter matches all non-null personnel_id rows.
      const { error: delErr } = await supabase.from("standard_planning").delete().not("personnel_id", "is", null);
      if (delErr) throw delErr;

      if (upserts.length > 0) {
        const { error: insErr } = await supabase.from("standard_planning").insert(upserts as any);
        if (insErr) throw insErr;
      }
    } catch (e) {
      console.error("[CardStandaardPlanning] save failed", e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{
        width: "100%",
        background: COLORS.card,
        border: `1px solid ${COLORS.line}`,
        borderRadius: 12,
        padding: 16,
        display: "flex",
        flexDirection: "column",
        gap: 14,
        fontFamily: SYS_FONT,
        color: COLORS.text,
      }}
    >
      {/* Titel */}
      <div style={{ display: "grid", gridTemplateColumns: "6px 1fr", columnGap: 8, alignItems: "center" }}>
        <div style={{ width: 6, height: 20, background: COLORS.primary, borderRadius: 3 }} />
        <h2 className={variableFont.className} style={{ margin: 0, fontSize: 18 }}>
          Standaard Planning aanpassen
        </h2>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {/* Header rij 1: weekdagen (span 2) */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns,
            gap: 6,
            alignItems: "center",
            color: COLORS.textMuted,
            fontSize: 12,
            fontWeight: 700,
            padding: "2px 0 0",
          }}
        >
          <div />
          {WEEKDAYS.flatMap((d, idx) => {
            const cells: React.ReactNode[] = [
              <div
                key={d.key}
                style={{
                  gridColumn: "span 2",
                  textAlign: "center",
                  background: COLORS.primary,
                  color: "#fff",
                  borderRadius: 10,
                  padding: "6px 0",
                }}
              >
                {d.label}
              </div>,
            ];

            if (idx !== WEEKDAYS.length - 1) cells.push(<div key={`${d.key}_sp`} />);
            return cells;
          })}
        </div>

        {/* Header rij 2: voormiddag / namiddag */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns,
            gap: 6,
            alignItems: "center",
            color: COLORS.textMuted,
            fontSize: 12,
            fontWeight: 400,
            padding: "0 0 10px",
            borderBottom: `1px solid ${COLORS.line}`,
          }}
        >
          <div />
          {WEEKDAYS.flatMap((d, idx) => {
            const cells: React.ReactNode[] = [
              <div key={`${d.key}_am`} style={{ textAlign: "center" }}>
                voormiddag
              </div>,
              <div key={`${d.key}_pm`} style={{ textAlign: "center" }}>
                namiddag
              </div>,
            ];

            if (idx !== WEEKDAYS.length - 1) cells.push(<div key={`${d.key}_sp2`} />);
            return cells;
          })}
        </div>

        {loading ? (
          <div style={{ color: COLORS.textMuted }}>Laden…</div>
        ) : people.length === 0 ? (
          <div style={{ color: COLORS.textMuted }}>Nog geen personeel.</div>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {people.map((p, idx) => (
              <li
                key={p.id}
                style={{
                  display: "grid",
                  gridTemplateColumns,
                  gap: 6,
                  alignItems: "center",
                  borderBottom: idx === people.length - 1 ? "none" : `1px solid ${COLORS.line}`,
                  padding: "6px 0",
                }}
              >
              {/* 1ste kolom: avatar + voornaam */}
              <div style={{ display: "inline-flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 6,
                    overflow: "hidden",
                    background: "transparent",
                  }}
                >
                  {p.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.avatar_url} alt="avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    <div style={{ width: "100%", height: "100%", background: "transparent" }} />
                  )}
                </div>
                <div style={{ fontSize: 14, color: COLORS.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {p.name}
                </div>
              </div>

              {/* weekdagen (voormiddag/namiddag) dropdowns */}
              {WEEKDAYS.flatMap((d, dayIdx) => {
                const day = plan[p.id]?.[d.key] || { am: "", pm: "" };
                const cells: React.ReactNode[] = [
                  <select
                    key={`${p.id}_${d.key}_am`}
                    value={day.am}
                    onChange={(e) => setPharmacy(p.id, d.key, "am", e.target.value as PharmacyChoice)}
                    style={{ ...baseField, width: CELL_PX, background: day.am === "vrij" ? "#def8f8" : "#fff" }}
                    aria-label={`${p.name} ${d.label} voormiddag`}
                  >
                    <option value="" disabled hidden />
                    {PHARMACY_VALUES.map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                    <option value="__sep__" disabled>
                      ----
                    </option>
                    <option value="vrij">Vrij</option>
                  </select>,
                  <select
                    key={`${p.id}_${d.key}_pm`}
                    value={day.pm}
                    onChange={(e) => setPharmacy(p.id, d.key, "pm", e.target.value as PharmacyChoice)}
                    style={{ ...baseField, width: CELL_PX, background: day.pm === "vrij" ? "#def8f8" : "#fff" }}
                    aria-label={`${p.name} ${d.label} namiddag`}
                  >
                    <option value="" disabled hidden />
                    {PHARMACY_VALUES.map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                    <option value="__sep__" disabled>
                      ----
                    </option>
                    <option value="vrij">Vrij</option>
                  </select>,
                ];

                if (dayIdx !== WEEKDAYS.length - 1) cells.push(<div key={`${p.id}_${d.key}_sp`} />);
                return cells;
              })}
              </li>
            ))}
          </ul>
        )}

        {/* Actie */}
        <div style={{ display: "flex", gap: 8, marginTop: 4, justifyContent: "flex-end" }}>
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className={titleFont.className}
            style={{
              padding: "10px 14px",
              background: "#0ea5a8",
              color: "#ffffff",
              border: `1px solid #0ea5a8`,
              borderRadius: 999,
              cursor: saving ? "not-allowed" : "pointer",
              fontWeight: 900,
              fontSize: 14,
              letterSpacing: 0.2,
              minWidth: 120,
              opacity: saving ? 0.7 : 1,
            }}
            onMouseOver={(e) => {
              if (saving) return;
              e.currentTarget.style.background = "#0c8e91";
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = "#0ea5a8";
            }}
          >
            Bewaren
          </button>
        </div>
      </div>
    </div>
  );
}
