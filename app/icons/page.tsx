"use client";
import * as React from "react";
import {
  Calendar, Plane, Clock, Check, Settings,
  Home, Users, User, FileText, ShieldCheck,
  Bell, Edit, Trash2, Plus,
  ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Search
} from "lucide-react";

const ICONS = [
  { name: "Calendar", Comp: Calendar },
  { name: "Plane", Comp: Plane },
  { name: "Clock", Comp: Clock },
  { name: "Check", Comp: Check },
  { name: "Settings", Comp: Settings },
  { name: "Home", Comp: Home },
  { name: "Users", Comp: Users },
  { name: "User", Comp: User },
  { name: "FileText", Comp: FileText },
  { name: "ShieldCheck", Comp: ShieldCheck },
  { name: "Bell", Comp: Bell },
  { name: "Edit", Comp: Edit },
  { name: "Trash2", Comp: Trash2 },
  { name: "Plus", Comp: Plus },
  { name: "ChevronLeft", Comp: ChevronLeft },
  { name: "ChevronRight", Comp: ChevronRight },
  { name: "ChevronDown", Comp: ChevronDown },
  { name: "ChevronUp", Comp: ChevronUp },
  { name: "Search", Comp: Search },
];

export default function IconsPage() {
  return (
    <main style={{ padding: 24 }}>
      <h1 style={{ marginBottom: 16 }}>Iconen preview</h1>
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(8, minmax(90px, 1fr))",
        gap: 12
      }}>
        {ICONS.map(({ name, Comp }) => (
          <div key={name} style={{
            display: "flex", flexDirection: "column",
            alignItems: "center", gap: 8,
            padding: 10, border: "1px solid #e5e7eb", borderRadius: 8
          }}>
            <Comp size={28} strokeWidth={2.5} color="#0ea5a8" />
            <small style={{ fontSize: 12, color: "#475569" }}>{name}</small>
          </div>
        ))}
      </div>
    </main>
  );
}
