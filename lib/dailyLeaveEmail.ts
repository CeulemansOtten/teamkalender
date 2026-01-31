type LeaveRow = {
  id: string;
  created_at: string;
  leave_date: string;
  daypart: string | null;
  entitlement: string | null;
  personnel?: {
    id?: string;
    name?: string | null;
    surname?: string | null;
  } | null;
};

const APPROVAL_URL =
  "https://kalender.eeuwfeestapotheek.be/approval?personnel_id=3bfd8c6b-cc89-4a83-bee8-66523bce9cd4";
const APPROVAL_CTA = "Klik hier om verlof goed te keuren of af te keuren";

export function formatBrusselsDate(d: Date) {
  // en-CA yields YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Brussels",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function personLabel(p: LeaveRow["personnel"]) {
  const name = String(p?.name ?? "").trim();
  const surname = String(p?.surname ?? "").trim();
  const full = `${name} ${surname}`.trim();
  return full || "(onbekend)";
}

function canonicalDaypart(dp: string | null) {
  const v = String(dp ?? "").toLowerCase();
  if (v.includes("voor") || v === "am" || v.includes("morning")) return "voormiddag";
  if (v.includes("na") || v === "pm" || v.includes("afternoon")) return "namiddag";
  return "hele dag";
}

function firstCap(s: string) {
  const v = String(s ?? "").trim();
  if (!v) return "(geen)";
  return v.charAt(0).toUpperCase() + v.slice(1);
}

export function buildDailyLeaveEmail(opts: { todayBrussels: string; rows: LeaveRow[] }) {
  const rowsSorted = [...opts.rows].sort((a, b) => {
    const pa = personLabel(a.personnel).localeCompare(personLabel(b.personnel));
    if (pa !== 0) return pa;
    return String(a.leave_date).localeCompare(String(b.leave_date));
  });

  const lines: string[] = [];
  lines.push(`Overzicht aangevraagde verlofdagen ingevoerd op ${opts.todayBrussels}`);
  lines.push("");
  for (const r of rowsSorted) {
    const who = personLabel(r.personnel);
    const when = String(r.leave_date);
    const dp = canonicalDaypart(r.daypart);
    const reason = firstCap(String(r.entitlement ?? ""));
    lines.push(`- ${who}: ${when} (${dp}) – reden: ${reason}`);
  }

  lines.push("");
  lines.push(`${APPROVAL_CTA}: ${APPROVAL_URL}`);

  const text = lines.join("\n");

  const htmlRows = rowsSorted
    .map((r) => {
      const who = escapeHtml(personLabel(r.personnel));
      const when = escapeHtml(String(r.leave_date));
      const dp = escapeHtml(canonicalDaypart(r.daypart));
      const reason = escapeHtml(firstCap(String(r.entitlement ?? "")));
      return `<tr><td>${who}</td><td>${when}</td><td>${dp}</td><td>${reason}</td></tr>`;
    })
    .join("");

  const html = `
    <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; font-size: 14px; color: #0f172a;">
      <p>Overzicht aangevraagde verlofdagen ingevoerd op <b>${escapeHtml(opts.todayBrussels)}</b></p>
      <table cellpadding="8" cellspacing="0" style="border-collapse: collapse; border: 1px solid #e5e7eb;">
        <thead>
          <tr style="background: #f7f9fb;">
            <th align="left" style="border-bottom: 1px solid #e5e7eb;">Wie</th>
            <th align="left" style="border-bottom: 1px solid #e5e7eb;">Voor welke dag</th>
            <th align="left" style="border-bottom: 1px solid #e5e7eb;">Dagdeel</th>
            <th align="left" style="border-bottom: 1px solid #e5e7eb;">Reden</th>
          </tr>
        </thead>
        <tbody>
          ${htmlRows}
        </tbody>
      </table>
      <p style="margin-top: 16px;">
        <a href="${escapeHtml(APPROVAL_URL)}">${escapeHtml(APPROVAL_CTA)}</a>
      </p>
    </div>
  `;

  return { subject: "Aangevraagde verlof", text, html };
}

function escapeHtml(input: string) {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
