// app/admin/CardPersoneelBeheren.tsx
"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import localFont from "next/font/local";

/* ====== UI ====== */
const COLORS = {
  card: "#f7f9fb",
  line: "#e5e7eb",
  text: "#0f172a",
  textMuted: "#475569",
  primary: "#0ea5a8",
  btnBg: "#0ea5a8",
  btnHover: "#0c8e91",
  btnText: "#ffffff",
  btnBorder: "#0ea5a8",
  danger: "#ef4444",
  overlay: "rgba(0,0,0,0.45)",
};
const SYS_FONT = "system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif";

// kolombreedtes
const FIELD_W = 140;
const PHARMACY_W = 170; // breder voor de apotheeknaam

const baseField: React.CSSProperties = {
  height: 36,
  padding: "6px 10px",
  borderRadius: 8,
  border: `1px solid ${COLORS.line}`,
  background: "#fff",
  fontFamily: SYS_FONT,
  fontSize: 14,
};

  /* Variable font (zelfde als in admin/page.tsx) */
  const variableFont = localFont({
    src: "../fonts/Font_Variable.otf",
    display: "swap",
  });

const PHARMACY_OPTIONS = [
  "Apotheek Generaal",
  "Apotheek Minerva",
  "Eeuwfeestapotheek",
] as const;

/* ====== Iconen (zelfde stijl als originele page) ====== */
function IconTrash({ color = COLORS.primary, size = 18 }: { color?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="3 6 5 6 21 6" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  );
}
function IconSave({ color = COLORS.primary, size = 18 }: { color?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
      <polyline points="17 21 17 13 7 13 7 21" />
      <polyline points="7 3 7 8 15 8" />
    </svg>
  );
}

/* ====== Helpers: birthdate format (zoals in page) ====== */
function ddmmyyyyToISO(s: string | null): string {
  if (!s || s.length !== 8) return "";
  const dd = s.slice(0, 2), mm = s.slice(2, 4), yyyy = s.slice(4, 8);
  if (!/^\d{2}$/.test(dd) || !/^\d{2}$/.test(mm) || !/^\d{4}$/.test(yyyy)) return "";
  return `${yyyy}-${mm}-${dd}`;
}
function isoToDDMMYYYY(iso: string | null): string | null {
  if (!iso) return null;
  const parts = iso.split("-");
  if (parts.length !== 3) return null;
  const [yyyy, mm, dd] = parts;
  if (!yyyy || !mm || !dd) return null;
  return `${dd}${mm}${yyyy}`;
}

/* ====== Types ====== */
type Personnel = {
  id: string;
  name: string;
  surname: string | null;
  avatar_url: string | null;
  status: string | null;
  birthdate: string | null; // ISO yyyy-mm-dd in UI-state
  pharmacy_single: string | ""; // UI: enkele keuze; DB: array met 0/1 item
};

type ConfirmState =
  | { open: false }
  | {
      open: true;
      kind: "delete-person" | "delete-avatar";
      title: string;
      message: string;
      person: Personnel;
    };

/* ====== Eenvoudige Confirm Modal ====== */
function ConfirmModal({
  open,
  title,
  message,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{ position: "fixed", inset: 0, background: COLORS.overlay, display: "grid", placeItems: "center", zIndex: 50 }}
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(420px, 90vw)",
          background: "#fff",
          borderRadius: 12,
          border: `1px solid ${COLORS.line}`,
          boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
          padding: 16,
          fontFamily: SYS_FONT,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <div
            aria-hidden
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              background: "#fee2e2",
              display: "grid",
              placeItems: "center",
              border: "1px solid #fecaca",
            }}
          >
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#b91c1c" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
              <line x1="12" y1="9" x2="12" y2="13"></line>
              <line x1="12" y1="17" x2="12.01" y2="17"></line>
            </svg>
          </div>
          <h3 style={{ margin: 0, fontSize: 18, color: COLORS.text }}>{title}</h3>
        </div>
        <p style={{ margin: "6px 0 14px", fontSize: 14, color: COLORS.textMuted }}>{message}</p>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button
            onClick={onCancel}
            style={{ height: 36, padding: "0 12px", borderRadius: 8, border: `1px solid ${COLORS.line}`, background: "#fff", cursor: "pointer", fontWeight: 700 }}
          >
            Annuleren
          </button>
          <button
            onClick={onConfirm}
            style={{
              height: 36,
              padding: "0 14px",
              borderRadius: 8,
              border: `1px solid ${COLORS.danger}`,
              background: COLORS.danger,
              color: "#fff",
              cursor: "pointer",
              fontWeight: 800,
            }}
          >
            Verwijderen
          </button>
        </div>
      </div>
    </div>
  );
}

/* ====== Component ====== */
export default function CardPersoneelBeheren() {
  const [people, setPeople] = useState<Personnel[]>([]);
  const [statusOptions, setStatusOptions] = useState<string[]>(["active", "inactive"]);
  const [err, setErr] = useState("");
  const [hoveredAvatarId, setHoveredAvatarId] = useState<string | null>(null);

  // Confirm modal state
  const [confirm, setConfirm] = useState<ConfirmState>({ open: false });

  // nieuw personeelslid
  const [newName, setNewName] = useState("");
  const [newSurname, setNewSurname] = useState("");
  const [newBirthdate, setNewBirthdate] = useState(""); // ISO yyyy-mm-dd
  const [newStatus, setNewStatus] = useState("active");
  const [newPharmacy, setNewPharmacy] = useState<string>(""); // single-select

  // Data ophalen
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("personnel")
        .select("id, name, surname, avatar_url, status, birthdate, pharmacy")
        .order("name", { ascending: true });

      if (error) {
        setErr(error.message || "Kon personeel niet laden.");
        setPeople([]);
      } else {
        const list = (data || []).map((p: any) => {
          const firstPh = Array.isArray(p.pharmacy) && p.pharmacy.length > 0 ? p.pharmacy[0] : "";
          return {
            id: p.id,
            name: p.name,
            surname: p.surname ?? null,
            avatar_url: p.avatar_url ?? null,
            status: p.status ?? null,
            birthdate: ddmmyyyyToISO(p.birthdate ?? null) || "",
            pharmacy_single: firstPh || "",
          } as Personnel;
        });
        setPeople(list);
      }

      // status-opties
      const { data: sdata } = await supabase.from("personnel").select("status");
      const values = (sdata || [])
        .map((r: any) => r.status)
        .filter((v: any) => typeof v === "string" && v.trim().length > 0);
      const uniq = Array.from(new Set(values));
      if (uniq.length) setStatusOptions(uniq);
    })();
  }, []);

  // updates in UI
  const updatePersonField = (id: string, field: keyof Personnel, value: any) => {
    setPeople((prev) => prev.map((p) => (p.id === id ? ({ ...p, [field]: value } as Personnel) : p)));
  };

  // bewaren (birthdate en pharmacy correct wegschrijven)
  const savePerson = async (p: Personnel) => {
    setErr("");
    const birthStr = isoToDDMMYYYY(p.birthdate || null);
    const payload = {
      name: p.name,
      surname: p.surname ?? null,
      status: p.status ?? null,
      avatar_url: p.avatar_url || null,
      birthdate: birthStr, // "DDMMYYYY" of null
      pharmacy: p.pharmacy_single ? [p.pharmacy_single] : [], // array 0/1
    };
    const { error } = await supabase.from("personnel").update(payload).eq("id", p.id);
    if (error) setErr(error.message || "Opslaan mislukt.");
  };

  // --- Verwijderen medewerker via popup ---
  const askDeletePerson = (p: Personnel) => {
    setConfirm({
      open: true,
      kind: "delete-person",
      person: p,
      title: "Medewerker verwijderen?",
      message:
        `Als je ${p.name}${p.surname ? " " + p.surname : ""} verwijdert, ` +
        "worden ook alle gekoppelde gegevens verwijderd. Weet je het zeker?",
    });
  };

  const doDeletePerson = async (p: Personnel) => {
    setErr("");
    const { error } = await supabase.from("personnel").delete().eq("id", p.id);
    if (error) {
      setErr(error.message || "Verwijderen mislukt.");
      return;
    }
    setPeople((prev) => prev.filter((x) => x.id !== p.id));
  };

  // Avatar upload
  const handleAvatarFileChange = async (p: Personnel, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const filePath = `${p.id}/${Date.now()}-${file.name}`;
    const { error: upErr } = await supabase.storage.from("avatar").upload(filePath, file, { upsert: true });
    if (upErr) {
      setErr(upErr.message || "Upload mislukt.");
      return;
    }
    const { data: pub } = supabase.storage.from("avatar").getPublicUrl(filePath);
    const url = pub?.publicUrl || "";
    if (!url) {
      setErr("Kon publieke URL niet ophalen.");
      return;
    }
    const { error } = await supabase.from("personnel").update({ avatar_url: url }).eq("id", p.id);
    if (error) {
      setErr(error.message || "Updaten van avatar mislukt.");
      return;
    }
    setPeople((prev) => prev.map((x) => (x.id === p.id ? { ...x, avatar_url: url } : x)));
    e.target.value = "";
  };

  // --- Verwijderen avatar via popup ---
  const askDeleteAvatar = (p: Personnel) => {
    setConfirm({
      open: true,
      kind: "delete-avatar",
      person: p,
      title: "Avatar verwijderen?",
      message: "Ben je zeker dat je deze avatar wil verwijderen?",
    });
  };

  const doDeleteAvatar = async (p: Personnel) => {
    const { error } = await supabase.from("personnel").update({ avatar_url: null }).eq("id", p.id);
    if (error) {
      setErr(error.message || "Avatar verwijderen mislukt.");
      return;
    }
    setPeople((prev) => prev.map((x) => (x.id === p.id ? { ...x, avatar_url: null } : x)));
  };

  // toevoegen
  const addPerson = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    if (!newName.trim()) return setErr("Voornaam is verplicht.");
    if (!newSurname.trim()) return setErr("Achternaam is verplicht.");
    if (!newStatus.trim()) return setErr("Status is verplicht.");
    const birthStr = isoToDDMMYYYY(newBirthdate || null);

    const { data, error } = await supabase
      .from("personnel")
      .insert({
        name: newName.trim(),
        surname: newSurname.trim(),
        birthdate: birthStr,
        status: newStatus.trim(),
        pharmacy: newPharmacy ? [newPharmacy] : [],
      } as never)
      .select("id, name, surname, avatar_url, status, birthdate, pharmacy")
      .single();

    if (error) return setErr(error.message || "Toevoegen mislukt.");
    if (data) {
      const firstPh = Array.isArray((data as any).pharmacy) && (data as any).pharmacy.length > 0 ? (data as any).pharmacy[0] : "";
      const normalized: Personnel = {
        id: (data as any).id,
        name: (data as any).name,
        surname: (data as any).surname ?? null,
        avatar_url: (data as any).avatar_url ?? null,
        status: (data as any).status ?? null,
        birthdate: ddmmyyyyToISO((data as any).birthdate ?? null) || "",
        pharmacy_single: firstPh,
      };
      setPeople((prev) => [...prev, normalized].sort((a, b) => a.name.localeCompare(b.name)));
      setNewName("");
      setNewSurname("");
      setNewBirthdate("");
      setNewStatus(statusOptions[0] || "active");
      setNewPharmacy("");
    }
  };

  // Confirm handlers
  const handleConfirmCancel = () => setConfirm({ open: false });
  const handleConfirmProceed = async () => {
    if (!confirm.open) return;
    const p = confirm.person;
    if (confirm.kind === "delete-person") {
      await doDeletePerson(p);
    } else if (confirm.kind === "delete-avatar") {
      await doDeleteAvatar(p);
    }
    setConfirm({ open: false });
  };

  return (
    <>
      <div
        style={{
          width: "min(980px, 100%)",
          background: COLORS.card,
          border: `1px solid ${COLORS.line}`,
          borderRadius: 12,
          padding: 16,
          display: "flex",
          flexDirection: "column",
          gap: 14,
          fontFamily: SYS_FONT,
        }}
      >
        <div style={{ display: "grid", gridTemplateColumns: "6px 1fr", alignItems: "center", columnGap: 8 }}>
          <div style={{ width: 6, height: 20, background: COLORS.primary, borderRadius: 3 }} />
          <h2 className={variableFont.className} style={{ margin: 0, fontSize: 18 }}>Personeel beheren</h2>
        </div>

        {err && (
          <div
            role="status"
            style={{
              background: "#fef2f2",
              color: "#7f1d1d",
              border: "1px solid #fecaca",
              borderRadius: 10,
              padding: "8px 10px",
            }}
          >
            {err}
          </div>
        )}

        {/* Toevoegen */}
        <form
          onSubmit={addPerson}
          style={{
            display: "grid",
            gridTemplateColumns: `${FIELD_W}px ${FIELD_W}px ${FIELD_W}px ${FIELD_W}px ${PHARMACY_W}px 50px`,
            gap: 8,
            alignItems: "center",
          }}
        >
          <input placeholder="voornaam" value={newName} onChange={(e) => setNewName(e.target.value)} style={{ ...baseField, width: FIELD_W }} />
          <input placeholder="achternaam" value={newSurname} onChange={(e) => setNewSurname(e.target.value)} style={{ ...baseField, width: FIELD_W }} />
          <input type="date" placeholder="geboortedatum" value={newBirthdate} onChange={(e) => setNewBirthdate(e.target.value)} style={{ ...baseField, width: FIELD_W }} />
          <select value={newStatus} onChange={(e) => setNewStatus(e.target.value)} style={{ ...baseField, width: FIELD_W }}>
            {statusOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
          {/* Single-select apotheek, breder */}
          <select value={newPharmacy} onChange={(e) => setNewPharmacy(e.target.value)} style={{ ...baseField, width: PHARMACY_W }} title="Apotheek">
            <option value="">—</option>
            {PHARMACY_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
          <button
            type="submit"
            aria-label="Personeel toevoegen"
            style={{
              height: 36,
              width: 50,
              minWidth: 50,
              background: COLORS.btnBg,
              border: `1px solid ${COLORS.btnBorder}`,
              color: COLORS.btnText,
              borderRadius: 8,
              cursor: "pointer",
              fontWeight: 800,
              fontSize: 16,
              lineHeight: 1,
            }}
            onMouseOver={(e) => (e.currentTarget.style.background = COLORS.btnHover)}
            onMouseOut={(e) => (e.currentTarget.style.background = COLORS.btnBg)}
          >
            +
          </button>
        </form>

        {/* Lijst */}
        {people.length === 0 ? (
          <div style={{ color: COLORS.textMuted }}>Nog geen personeel.</div>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {people.map((p) => (
              <li
                key={p.id}
                onMouseEnter={() => setHoveredAvatarId(p.id)}
                onMouseLeave={() => setHoveredAvatarId(null)}
                style={{
                  display: "grid",
                  gridTemplateColumns: `28px ${FIELD_W}px ${FIELD_W}px ${FIELD_W}px ${FIELD_W}px ${PHARMACY_W}px auto`,
                  gap: 8,
                  alignItems: "center",
                  borderBottom: `1px solid ${COLORS.line}`,
                  padding: "8px 0",
                  position: "relative",
                }}
              >
                {/* Avatar */}
                <div style={{ width: 28, height: 28, position: "relative" }}>
                  {p.avatar_url ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.avatar_url} alt="avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      {hoveredAvatarId === p.id && (
                        <button
                          aria-label="Avatar verwijderen"
                          onClick={() => askDeleteAvatar(p)}
                          title="Verwijder avatar"
                          style={{
                            position: "absolute",
                            inset: 0,
                            border: "none",
                            background: "rgba(239,68,68,0.6)",
                            color: "#fff",
                            fontSize: 18,
                            fontWeight: 800,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            cursor: "pointer",
                          }}
                        >
                          ×
                        </button>
                      )}
                    </>
                  ) : (
                    <>
                      <div
                        onClick={() => (document.getElementById(`file-${p.id}`) as HTMLInputElement | null)?.click()}
                        aria-label="lege avatar - klik om te uploaden"
                        title="Klik om avatar te uploaden"
                        style={{
                          width: "100%",
                          height: "100%",
                          borderRadius: "50%",
                          border: `1px solid ${COLORS.line}`,
                          cursor: "pointer",
                          position: "relative",
                        }}
                      />
                      {hoveredAvatarId === p.id && (
                        <button
                          aria-label="Upload foto"
                          onClick={() => (document.getElementById(`file-${p.id}`) as HTMLInputElement | null)?.click()}
                          title="Foto uploaden"
                          style={{
                            position: "absolute",
                            inset: 0,
                            border: "none",
                            background: "rgba(14,165,168,0.15)",
                            color: COLORS.primary,
                            fontSize: 18,
                            fontWeight: 800,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            cursor: "pointer",
                          }}
                        >
                          +
                        </button>
                      )}
                      <input id={`file-${p.id}`} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => handleAvatarFileChange(p, e)} />
                    </>
                  )}
                </div>

                <input value={p.name} onChange={(e) => updatePersonField(p.id, "name", e.target.value)} placeholder="voornaam" style={{ ...baseField, height: 32, width: FIELD_W }} />
                <input value={p.surname ?? ""} onChange={(e) => updatePersonField(p.id, "surname", e.target.value)} placeholder="achternaam" style={{ ...baseField, height: 32, width: FIELD_W }} />
                <input
                  type="date"
                  value={p.birthdate ?? ""}
                  onChange={(e) => updatePersonField(p.id, "birthdate", e.target.value)}
                  placeholder="geboortedatum"
                  style={{ ...baseField, height: 32, width: FIELD_W }}
                />
                <select value={p.status ?? (statusOptions[0] || "")} onChange={(e) => updatePersonField(p.id, "status", e.target.value)} style={{ ...baseField, height: 32, width: FIELD_W }}>
                  {statusOptions.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>

                {/* Single-select apotheek, breder */}
                <select
                  value={p.pharmacy_single}
                  onChange={(e) => updatePersonField(p.id, "pharmacy_single", e.target.value)}
                  style={{ ...baseField, height: 32, width: PHARMACY_W }}
                  title="Apotheek"
                >
                  <option value="">—</option>
                  {PHARMACY_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>

                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                  <button
                    aria-label="Opslaan"
                    title="Opslaan"
                    onClick={() => savePerson(p)}
                    style={{
                      background: "transparent",
                      height: 32,
                      width: 32,
                      borderRadius: 8,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                    }}
                  >
                    <IconSave />
                  </button>
                  <button
                    aria-label="Verwijderen"
                    title="Verwijderen"
                    onClick={() => askDeletePerson(p)}
                    style={{
                      background: "transparent",
                      border: "none",
                      height: 32,
                      width: 32,
                      borderRadius: 8,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                    }}
                  >
                    <IconTrash />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Confirm modal voor zowel medewerker als avatar */}
      <ConfirmModal
        open={confirm.open}
        title={confirm.open ? confirm.title : ""}
        message={confirm.open ? confirm.message : ""}
        onConfirm={handleConfirmProceed}
        onCancel={handleConfirmCancel}
      />
    </>
  );
}
