// app/admin/page.tsx
"use client";

import React, { Suspense } from "react";
import localFont from "next/font/local";

// 👉 De 5 cards staan in dezelfde folder als deze page.tsx
import CardUrenBeheren from "./CardUrenBeheren";                 // Card 1 (smaller)
import CardPersoneelBeheren from "./CardPersoneelBeheren";       // Card 2
import CardFeestdagToevoegen from "./CardFeestdagToevoegen";     // Card 3
import CardJoodseFeestdagToevoegen from "./CardJoodseFeestdagToevoegen"; // Card 4
import CardIslamFeestdagToevoegen from "./CardIslamFeestdagToevoegen";   // nieuwe card
import CardSchoolvakantieToevoegen from "./CardSchoolvakantieToevoegen"; // Card 5

// (optioneel) als je FloatingNav gebruikt op je project:
import FloatingNav from "../components/FloatingNav";

const variableFont = localFont({
  src: "../fonts/Font_Variable.otf",
  display: "swap",
});

const COLORS = {
  bg: "#ffffff",
  text: "#0f172a",
};

export default function AdminPage() {
  return (
    <>
      <Suspense fallback={<div style={{ padding: 12 }}>Laden…</div>}>
        <FloatingNav />
      </Suspense>

      <main
        className={variableFont.className}
        style={{
          background: COLORS.bg,
          minHeight: "100vh",
          padding: 24,
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          gap: 20,
          color: COLORS.text,
        }}
      >
        {/* Rij 1: Card 1 (smaller) + Card 2 */}
        <section
          style={{
            display: "grid",
            gridTemplateColumns: "370px 920px",
            justifyContent: "center",
            columnGap: "1%",
            rowGap: 12,
            marginTop: 70, // wat ruimte onder de nav
          }}
        >
          <CardUrenBeheren />
          <CardPersoneelBeheren />
        </section>

        {/* Rij 2: 3 gelijke cards (Feestdag, Joods, Islam) - passen onder de twee cards erboven */}
        <section
          style={{
            display: "grid",
            gridTemplateColumns: "425px 425px 425px",
            justifyContent: "center",
            justifyItems: "center",
            columnGap: "1%",
            rowGap: 12,
          }}
        >
          <CardFeestdagToevoegen />
          <CardJoodseFeestdagToevoegen />
          <CardIslamFeestdagToevoegen />
        </section>

        {/* Rij 3: Schoolvakanties - links uitlijnen en even breed als de eerste twee cards van rij 2 (span 2) */}
        <section
          style={{
            display: "grid",
            gridTemplateColumns: "425px 425px 425px", // gelijke kolombreedtes als rij 2
            justifyContent: "center",
            justifyItems: "start", // items starten links in hun kolom
            columnGap: "1%",
            rowGap: 12,
            marginTop: 12,
          }}
        >
          <div style={{ gridColumn: "1 / span 2", justifySelf: "start" }}>
            <CardSchoolvakantieToevoegen />
          </div>
          <div /> {/* lege placeholder om de derde kolom op te vullen */}
        </section>
      </main>
    </>
  );
}

export const dynamic = "force-dynamic";
