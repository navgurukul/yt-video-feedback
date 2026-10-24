/**
 * /admin — institution admin console.
 */
import { useState } from "react";
import { Link } from "react-router-dom";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Card } from "@/components/ui/card";
import { hasRole, useTenant } from "@/lib/tenant";
import SyllabusTab from "./SyllabusTab";
import RubricsTab from "./RubricsTab";
import PromptsTab from "./PromptsTab";
import UsersTab from "./UsersTab";
import SettingsTab from "./SettingsTab";

const TABS = [
  { id: "syllabus", label: "Syllabus", el: <SyllabusTab /> },
  { id: "rubrics", label: "Rubrics", el: <RubricsTab /> },
  { id: "prompts", label: "Prompts", el: <PromptsTab /> },
  { id: "users", label: "Users", el: <UsersTab /> },
  { id: "settings", label: "Settings & usage", el: <SettingsTab /> },
] as const;

const TAB_KEY = "admin_tab";

export default function AdminPage() {
  const { me } = useTenant();
  const [tab, setTab] = useState<string>(() => {
    try { return localStorage.getItem(TAB_KEY) || "syllabus"; } catch { return "syllabus"; }
  });
  const choose = (id: string) => { setTab(id); try { localStorage.setItem(TAB_KEY, id); } catch { /* ignore */ } };

  if (!hasRole(me, "institution_admin")) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <main className="container mx-auto px-4 py-12 flex-1">
          <Card className="max-w-xl mx-auto p-8 text-center">
            <h1 className="text-2xl font-black mb-2">Admins only</h1>
            <p className="mb-4">You need the institution admin role to open this page.</p>
            <Link to="/" className="underline font-bold">Back to home</Link>
          </Card>
        </main>
        <Footer />
      </div>
    );
  }

  const current = TABS.find((t) => t.id === tab) ?? TABS[0];
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="container mx-auto px-4 py-8 flex-1">
        <div className="mb-6">
          <h1 className="text-4xl font-black uppercase">Admin</h1>
          <p className="font-bold text-muted-foreground">{me?.activeInstitution?.name}</p>
        </div>
        <nav className="flex flex-wrap gap-2 mb-6" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={current.id === t.id}
              onClick={() => choose(t.id)}
              className={`border-4 border-foreground px-4 py-2 font-black uppercase text-sm transition-all ${current.id === t.id ? "bg-primary text-primary-foreground shadow-brutal-sm" : "bg-card hover:bg-muted"}`}
            >
              {t.label}
            </button>
          ))}
        </nav>
        <div role="tabpanel">{current.el}</div>
      </main>
      <Footer />
    </div>
  );
}
