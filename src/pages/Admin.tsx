import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { GraduationCap, BookOpen, UploadCloud, Settings as SettingsIcon, LogOut, Loader2, BarChart3 } from "lucide-react";
import { toast } from "sonner";
import { ThemeToggle } from "@/components/ThemeToggle";
import ContentTab from "@/components/admin/ContentTab";
import UploadTab from "@/components/admin/UploadTab";
import SettingsTab from "@/components/admin/SettingsTab";
import AnalyticsTab from "@/components/admin/AnalyticsTab";
import type { Subject, Resource, TeacherSettings } from "@/types";

type Tab = "content" | "upload" | "analytics" | "settings";

const NAV_ITEMS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "content", label: "My Content", icon: BookOpen },
  { id: "upload", label: "Upload", icon: UploadCloud },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "settings", label: "Settings", icon: SettingsIcon },
];

export default function Admin() {
  const { user, isTeacher, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("content");
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [settings, setSettings] = useState<TeacherSettings | null>(null);

  useEffect(() => {
    if (!loading && (!user || !isTeacher)) navigate("/auth");
  }, [user, isTeacher, loading, navigate]);

  const refresh = async (): Promise<void> => {
    try {
      const [{ data: s }, { data: r }, { data: ts }] = await Promise.all([
        supabase.from("subjects").select("*").order("order_index"),
        supabase.from("resources").select("*").order("order_index"),
        supabase.from("teacher_settings").select("*").limit(1).maybeSingle(),
      ]);
      setSubjects((s as Subject[]) ?? []);
      setResources((r as Resource[]) ?? []);
      setSettings(ts as TeacherSettings | null);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to load data");
    }
  };

  useEffect(() => {
    if (isTeacher) refresh();
  }, [isTeacher]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading || !isTeacher) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  }

  return (
    <div className="min-h-screen bg-background flex animate-fade-in-fast">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-72 border-r border-border bg-card/50 backdrop-blur sticky top-0 h-screen">
        <Link to="/" className="flex items-center gap-3 px-6 h-20 border-b border-border">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <GraduationCap className="w-6 h-6 text-white" />
          </div>
          <div className="flex flex-col">
            <span className="font-heading font-black text-foreground leading-none tracking-tight">
              {settings?.site_name || "mybookshelf"}
            </span>
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mt-1 opacity-50">
              Admin Portal
            </span>
          </div>
        </Link>
        <nav className="flex-1 p-4 space-y-2 mt-4">
          {NAV_ITEMS.map((item) => (
            <button key={item.id} onClick={() => setTab(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-bold transition-all duration-200 press ${tab === item.id ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/30" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}>
              <item.icon className={`w-5 h-5 ${tab === item.id ? "text-white" : "text-muted-foreground"}`} />
              {item.label}
            </button>
          ))}
        </nav>
        <div className="p-4 border-t border-border">
          <button onClick={() => signOut().then(() => navigate("/"))}
            className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-bold text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all press">
            <LogOut className="w-5 h-5" /> Sign Out
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 pb-20 md:pb-0">
        <header className="md:hidden sticky top-0 z-20 bg-background/85 dark:bg-gray-900/85 backdrop-blur border-b border-border dark:border-gray-800 h-16 flex items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-card bg-gradient-primary flex items-center justify-center"><GraduationCap className="w-5 h-5 text-primary-foreground" /></div>
            <span className="font-heading font-bold dark:text-gray-100">{settings?.site_name || "mybookshelf"}</span>
          </Link>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <button onClick={() => signOut().then(() => navigate("/"))} className="w-11 h-11 rounded-full hover:bg-muted dark:hover:bg-gray-800 flex items-center justify-center">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </header>

        <main className="flex-1 container mx-auto px-4 md:px-8 py-8 max-w-5xl w-full">
          {tab === "content" && <ContentTab subjects={subjects} resources={resources} settings={settings} onChange={refresh} />}
          {tab === "upload" && <UploadTab subjects={subjects} onDone={refresh} />}
          {tab === "analytics" && <AnalyticsTab />}
          {tab === "settings" && <SettingsTab settings={settings} onChange={refresh} />}
        </main>

        <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-card border-t border-border h-16 flex">
          {NAV_ITEMS.map((item) => (
            <button key={item.id} onClick={() => setTab(item.id)}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 text-xs font-medium press ${tab === item.id ? "text-primary" : "text-muted-foreground"}`}>
              <item.icon className="w-5 h-5" />{item.label}
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}
