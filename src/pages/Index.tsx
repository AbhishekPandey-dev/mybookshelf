import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Search, BookOpen, X, Loader2, ArrowRight, Link2 } from "lucide-react";
import { getMeshGradient } from "@/utils/gradients";
import { ThemeToggle } from "@/components/ThemeToggle";
import { toast } from "sonner";
import type { Subject } from "@/types";

type Settings = { site_name: string; tagline: string };

type RecentResource = {
  id: string;
  title: string;
  content_type: string;
  subject_id: string;
  subjects: { name: string; icon: string; color: string } | null;
};

type SearchResult = {
  id: string;
  title: string;
  subject_id: string;
  subjects: { name: string; icon: string; color: string } | null;
};

/** Copy a share link to clipboard and show toast */
function copyShareLink(resourceId: string): void {
  const url = `${window.location.origin}/read/${resourceId}`;
  navigator.clipboard.writeText(url).then(() => {
    toast.success("Link copied! Share with your students 📋");
  }).catch(() => {
    toast.error("Could not copy link");
  });
}

/** Content-type badge label */
function ctLabel(type: string): string {
  if (type === "full") return "Full Book";
  if (type === "unit") return "Unit";
  return "Chapter";
}

export default function Index() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [recentResources, setRecentResources] = useState<RecentResource[]>([]);
  const [settings, setSettings] = useState<Settings>({
    site_name: "mybookshelf",
    tagline: "Learn anywhere, anytime.",
  });
  const [loading, setLoading] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState<string>("all");

  useEffect(() => {
    (async () => {
      const [{ data: subs }, { data: res }, { data: s }, { data: recent }] = await Promise.all([
        supabase.from("subjects").select("*").order("order_index"),
        supabase.from("resources").select("id, subject_id"),
        supabase.from("teacher_settings").select("site_name, tagline").limit(1).maybeSingle(),
        supabase
          .from("resources")
          .select("id, title, content_type, subject_id, subjects(name, icon, color)")
          .order("created_at", { ascending: false })
          .limit(4),
      ]);

      setSubjects((subs as Subject[]) ?? []);

      const c: Record<string, number> = {};
      ((res ?? []) as { id: string; subject_id: string }[]).forEach((r) => {
        c[r.subject_id] = (c[r.subject_id] ?? 0) + 1;
      });
      setCounts(c);

      if (s)
        setSettings({
          site_name: s.site_name || "mybookshelf",
          tagline: s.tagline || "Learn anywhere, anytime.",
        });

      setRecentResources((recent as RecentResource[]) ?? []);
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (!search.trim()) { setSearchResults([]); setSearching(false); return; }
    setSearching(true);
    const t = setTimeout(async () => {
      let query = supabase
        .from("resources")
        .select("id, title, subject_id, subjects(name, icon, color)")
        .textSearch("fts", search.trim(), { config: "english", type: "websearch" });
      if (selectedSubject !== "all") query = query.eq("subject_id", selectedSubject);
      const { data } = await query.limit(8);
      setSearchResults((data as SearchResult[]) ?? []);
      setSearching(false);
    }, 300);
    return () => clearTimeout(t);
  }, [search, selectedSubject]);

  return (
    <div className="min-h-screen bg-background dark:bg-gray-950 flex flex-col animate-fade-in-fast">
      {/* ── Navbar ─────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 bg-background/80 dark:bg-gray-950/80 backdrop-blur border-b border-border dark:border-gray-800">
        <div className="container mx-auto h-16 flex items-center justify-between px-4">
          <Link to="/" className="font-heading font-bold text-xl text-foreground dark:text-gray-100">
            {settings.site_name}
          </Link>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <button
              onClick={() => setSearchOpen(true)}
              className="w-12 h-12 rounded-full hover:bg-muted dark:hover:bg-gray-800 flex items-center justify-center"
              aria-label="Search"
            >
              <Search className="w-5 h-5 text-foreground dark:text-gray-200" />
            </button>
          </div>
        </div>
      </header>

      {/* ── Search overlay ────────────────────────────────────────── */}
      {searchOpen && (
        <div
          className="fixed inset-0 z-50 bg-background/95 dark:bg-gray-950/95 backdrop-blur-sm animate-fade-in-fast"
          onClick={() => setSearchOpen(false)}
        >
          <div className="container mx-auto px-4 pt-20" onClick={(e) => e.stopPropagation()}>
            <div className="max-w-2xl mx-auto">
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
                  {searching
                    ? <Loader2 className="w-5 h-5 text-primary animate-spin" />
                    : <Search className="w-5 h-5 text-muted-foreground" />}
                </div>
                <Input
                  autoFocus value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by title, subject or keyword…"
                  className="pl-12 pr-12 h-14 text-base shadow-card-hover border-0 dark:bg-gray-800 dark:text-gray-100"
                />
                <button
                  onClick={() => { setSearch(""); setSearchResults([]); setSearchOpen(false); }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full hover:bg-muted dark:hover:bg-gray-700 flex items-center justify-center"
                  aria-label="Close search"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Subject filter pills — h-10 touch targets (Task 3) */}
              <div className="mt-4 overflow-x-auto pb-2 -mx-1 px-1 flex items-center gap-2 no-scrollbar">
                <button
                  onClick={() => setSelectedSubject("all")}
                  className={`h-10 px-4 rounded-full text-sm font-medium whitespace-nowrap transition-smooth flex-shrink-0 ${
                    selectedSubject === "all"
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "bg-muted dark:bg-gray-800 text-muted-foreground hover:bg-muted/80"
                  }`}
                >All</button>
                {subjects.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setSelectedSubject(s.id)}
                    className={`h-10 px-4 rounded-full text-sm font-medium whitespace-nowrap transition-smooth flex-shrink-0 flex items-center gap-1.5 ${
                      selectedSubject === s.id
                        ? "bg-indigo-600 text-white shadow-sm"
                        : "bg-muted dark:bg-gray-800 text-muted-foreground hover:bg-muted/80"
                    }`}
                  >
                    <span>{s.icon}</span><span>{s.name}</span>
                  </button>
                ))}
              </div>

              {search.trim() && !searching && searchResults.length === 0 ? (
                <div className="mt-8 text-center animate-fade-in">
                  <div className="bg-muted dark:bg-gray-800 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Search className="w-8 h-8 text-muted-foreground opacity-50" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground dark:text-gray-100 mb-1">
                    No results found for "{search}"
                  </h3>
                  <p className="text-muted-foreground mb-6 max-w-xs mx-auto text-sm">
                    Try adjusting your search or subject filters.
                  </p>
                  <Button variant="outline" onClick={() => { setSearch(""); setSelectedSubject("all"); }}
                    className="rounded-full px-8">
                    Clear search
                  </Button>
                </div>
              ) : (
                searchResults.length > 0 && (
                  <Card className="mt-3 overflow-hidden p-0 shadow-pop animate-in slide-in-from-top-2 duration-300 dark:bg-gray-900 dark:border-gray-800">
                    {searchResults.map((r) => (
                      <Link key={r.id} to={`/read/${r.id}`}
                        className="flex items-center gap-3 px-4 py-3 hover:bg-muted dark:hover:bg-gray-800 transition-smooth"
                        onClick={() => setSearchOpen(false)}>
                        <span className="text-2xl flex-shrink-0">{r.subjects?.icon}</span>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-foreground dark:text-gray-100 truncate">{r.title}</div>
                          <div className="text-xs text-muted-foreground truncate">{r.subjects?.name}</div>
                        </div>
                      </Link>
                    ))}
                  </Card>
                )
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <section className="container mx-auto px-4 pt-12 md:pt-20 pb-10 text-center max-w-3xl">
        <h1 className="font-heading text-4xl md:text-6xl font-extrabold tracking-tight text-foreground dark:text-gray-100 mb-4 animate-fade-in">
          {settings.tagline}
        </h1>
        <p className="text-base md:text-lg text-muted-foreground animate-fade-in" style={{ animationDelay: "60ms" }}>
          Pick a subject to start exploring.
        </p>
      </section>

      <main className="container mx-auto px-4 pb-16 flex-1 space-y-12">
        {/* ── Task 4: Recently Added ──────────────────────────────── */}
        {!loading && recentResources.length > 0 && (
          <section className="animate-fade-in">
            <h2 className="font-heading font-bold text-lg text-foreground dark:text-gray-100 mb-4">
              Recently Added
            </h2>
            {/* mobile: horizontal scroll; desktop: 4-col grid */}
            <div className="flex gap-4 overflow-x-auto pb-2 no-scrollbar md:grid md:grid-cols-4 md:overflow-visible">
              {recentResources.map((r, idx) => {
                const subjectColor = r.subjects?.color ?? "indigo";
                return (
                  <div
                    key={r.id}
                    className="relative flex-shrink-0 w-52 md:w-auto bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 overflow-hidden animate-fade-in group"
                    style={{ animationDelay: `${idx * 60}ms` }}
                  >
                    {/* Color strip */}
                    <div
                      className={`h-2 w-full bg-${subjectColor}-500`}
                      style={{ backgroundColor: subjectColor === "indigo" ? "#6366f1" : undefined }}
                    />

                    {/* Task 5: Share button — hover reveal */}
                    <button
                      onClick={(e) => { e.preventDefault(); copyShareLink(r.id); }}
                      className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/80 dark:bg-gray-800/80 backdrop-blur flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm hover:bg-white dark:hover:bg-gray-700"
                      aria-label="Copy share link"
                    >
                      <Link2 className="w-3.5 h-3.5 text-gray-500 dark:text-gray-300" />
                    </button>

                    <Link to={`/read/${r.id}`} className="block p-4">
                      <div className="font-semibold text-sm text-foreground dark:text-gray-100 line-clamp-2 mb-2 pr-6">
                        {r.title}
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs text-muted-foreground">
                          {r.subjects?.icon} {r.subjects?.name}
                        </span>
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                          {ctLabel(r.content_type)}
                        </span>
                      </div>
                      <div className="mt-3 flex items-center justify-end">
                        <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400">
                          Open →
                        </span>
                      </div>
                    </Link>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ── Subject cards grid ─────────────────────────────────────── */}
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-5 max-w-5xl mx-auto">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-52 rounded-2xl" />
            ))}
          </div>
        ) : subjects.length === 0 ? (
          <Card className="p-12 text-center max-w-md mx-auto border-dashed dark:bg-gray-900 dark:border-gray-800">
            <BookOpen className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
            <h3 className="font-heading font-semibold text-lg mb-1 dark:text-gray-100">No subjects yet</h3>
            <p className="text-muted-foreground text-sm">Your teacher hasn't added any content yet.</p>
          </Card>
        ) : (
          <div>
            <h2 className="font-heading font-bold text-lg text-foreground dark:text-gray-100 mb-4">
              All Subjects
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-5 max-w-5xl mx-auto">
              {subjects.map((s, idx) => {
                const count = counts[s.id] ?? 0;
                const mesh = getMeshGradient(s.color);
                return (
                  <Link
                    key={s.id}
                    to={`/subject/${s.id}`}
                    style={{ animationDelay: `${idx * 40}ms` }}
                    className="animate-fade-in group"
                  >
                    <div className="rounded-2xl overflow-hidden border border-white/10 shadow-md transition-all duration-200 group-hover:-translate-y-1 group-hover:shadow-xl bg-white dark:bg-gray-900">
                      {/* Mesh gradient area */}
                      <div
                        className="relative h-36 md:h-40 flex flex-col justify-between p-4"
                        style={{ background: mesh, backgroundColor: "#4f46e5" }}
                      >
                        <div className="flex justify-center items-center flex-1">
                          <span className="text-5xl md:text-6xl leading-none"
                            style={{ filter: "drop-shadow(0 2px 8px rgba(0,0,0,0.3))" }}>
                            {s.icon}
                          </span>
                        </div>
                        <div className="flex items-end justify-between gap-2">
                          <h3 className="font-heading font-bold text-white text-sm md:text-base leading-tight drop-shadow">
                            {s.name}
                          </h3>
                          <span className="flex-shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-black/20 text-white/90 backdrop-blur-sm">
                            {count} {count === 1 ? "resource" : "resources"}
                          </span>
                        </div>
                      </div>
                      {/* White footer */}
                      <div className="px-4 py-3 flex items-center justify-between bg-white dark:bg-gray-900">
                        <span className="text-xs text-muted-foreground">
                          {count === 0 ? "No resources yet" : `${count} PDF${count === 1 ? "" : "s"} available`}
                        </span>
                        <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 flex items-center gap-1 group-hover:gap-1.5 transition-all">
                          View all <ArrowRight className="w-3 h-3" />
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </main>

      <footer className="border-t border-border dark:border-gray-800 py-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          {settings.site_name} · Made for students{" "}
          <span className="text-destructive">❤️</span>
        </div>
      </footer>
    </div>
  );
}
