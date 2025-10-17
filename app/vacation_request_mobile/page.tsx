export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: "24px",
        background: "#ffffff",
        color: "#0f172a",
        textAlign: "center",
      }}
    >
      <p style={{ fontSize: 18, lineHeight: 1.5, fontWeight: 700 }}>
        Op dit moment kan je enkel op <span style={{ textDecoration: "underline" }}>desktop</span> verlof aanvragen.
      </p>
    </main>
  );
}
