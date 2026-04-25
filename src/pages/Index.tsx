import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Search, BookOpen, X, Loader2, ArrowRight, Link2, Bookmark, Trash2 } from "lucide-react";
import { getMeshGradient } from "@/utils/gradients";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { toast } from "sonner";
import { useBookmarks } from "@/hooks/useBookmarks";
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
  content_type: string;
  grade_level: string | null;
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
  const [gradeLevels, setGradeLevels] = useState<string[]>([]);
  const [selectedGrade, setSelectedGrade] = useState<string>("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [bookmarksOpen, setBookmarksOpen] = useState(false);
  const { bookmarks, removeBookmark, clearAll } = useBookmarks();

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
      
      // Fetch unique grade levels
      const { data: grades } = await supabase.rpc('get_unique_grades');
      // If RPC is missing, fallback to select distinct
      if (grades) {
        setGradeLevels(grades as string[]);
      } else {
        const { data: resGrades } = await supabase.from("resources").select("grade_level");
        const unique = Array.from(new Set((resGrades ?? []).map(r => r.grade_level).filter(Boolean))) as string[];
        setGradeLevels(unique.sort());
      }

      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (!search.trim() && selectedSubject === "all" && selectedGrade === "all" && selectedCategory === "all") { 
      setSearchResults([]); setSearching(false); return; 
    }
    setSearching(true);
    const t = setTimeout(async () => {
      let query = supabase
        .from("resources")
        .select("id, title, content_type, grade_level, subject_id, subjects(name, icon, color)");
      
      if (search.trim()) {
        query = query.textSearch("fts", search.trim(), { config: "english", type: "websearch" });
      }
      if (selectedSubject !== "all") query = query.eq("subject_id", selectedSubject);
      if (selectedGrade !== "all") query = query.eq("grade_level", selectedGrade);
      if (selectedCategory !== "all") query = query.eq("content_type", selectedCategory);
      
      const { data } = await query.limit(12);
      setSearchResults((data as SearchResult[]) ?? []);
      setSearching(false);
    }, 300);
    return () => clearTimeout(t);
  }, [search, selectedSubject, selectedGrade, selectedCategory]);

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
              onClick={() => setBookmarksOpen(true)}
              className="w-12 h-12 rounded-full hover:bg-muted dark:hover:bg-gray-800 flex items-center justify-center relative"
              aria-label="Bookmarks"
            >
              <Bookmark className="w-5 h-5 text-foreground dark:text-gray-200" />
              {bookmarks.length > 0 && (
                <span className="absolute top-3.5 right-3.5 w-2 h-2 rounded-full bg-indigo-500 border-2 border-background dark:border-gray-950" />
              )}
            </button>
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
          className="fixed inset-0 z-50 bg-background/60 dark:bg-black/60 backdrop-blur-xl animate-fade-in-fast"
          onClick={() => setSearchOpen(false)}
        >
          <div className="container mx-auto px-4 pt-12 md:pt-20" onClick={(e) => e.stopPropagation()}>
            <div className="max-w-2xl mx-auto flex flex-col h-[85vh]">
              {/* Search Box */}
              <div className="relative group shrink-0">
                <div className="absolute left-5 top-1/2 -translate-y-1/2 pointer-events-none transition-transform group-focus-within:scale-110">
                  {searching
                    ? <Loader2 className="w-6 h-6 text-primary animate-spin" />
                    : <Search className="w-6 h-6 text-muted-foreground" />}
                </div>
                <Input
                  autoFocus value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="What are we learning today?..."
                  className="pl-14 pr-14 h-16 text-lg md:text-xl font-heading font-medium rounded-2xl glass dark:bg-gray-900/80 shadow-pop border-white/20 dark:border-white/5 focus:ring-4 focus:ring-primary/10 transition-all placeholder:text-muted-foreground/50"
                />
                <button
                  onClick={() => { setSearch(""); setSearchResults([]); setSearchOpen(false); }}
                  className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full hover:bg-muted dark:hover:bg-gray-700 flex items-center justify-center transition-all hover:rotate-90"
                  aria-label="Close search"
                >
                  <X className="w-5 h-5 text-muted-foreground" />
                </button>
              </div>

              {/* Filters Area */}
              <div className="mt-6 space-y-4 shrink-0 px-1">
                {/* Subjects */}
                <div className="overflow-x-auto pb-1 -mx-2 px-2 flex items-center gap-2 no-scrollbar">
                  <button
                    onClick={() => setSelectedSubject("all")}
                    className={`h-9 px-5 rounded-full text-xs font-bold uppercase tracking-wider transition-all duration-300 ${
                      selectedSubject === "all" 
                        ? "bg-primary text-white shadow-lg shadow-primary/20 scale-105" 
                        : "glass text-muted-foreground hover:bg-white/50 dark:hover:bg-white/5"
                    }`}
                  >All</button>
                  {subjects.map((s) => (
                    <button key={s.id} onClick={() => setSelectedSubject(s.id)}
                      className={`h-9 px-5 rounded-full text-xs font-bold uppercase tracking-wider transition-all duration-300 flex items-center gap-2 ${
                        selectedSubject === s.id 
                          ? "bg-primary text-white shadow-lg shadow-primary/20 scale-105" 
                          : "glass text-muted-foreground hover:bg-white/50 dark:hover:bg-white/5"
                      }`}>
                      <span>{s.icon}</span><span>{s.name}</span>
                    </button>
                  ))}
                </div>

                <div className="flex flex-wrap items-center gap-6 pt-2">
                  {/* Format Pills */}
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/40">Format</span>
                    <div className="flex items-center gap-1.5">
                      {["all", "full", "unit", "part"].map((c) => (
                        <button key={c} onClick={() => setSelectedCategory(c)}
                          className={`h-7 px-3 rounded-full text-[10px] font-black uppercase tracking-widest transition-all duration-300 ${
                            selectedCategory === c 
                              ? "bg-indigo-500 text-white shadow-md shadow-indigo-500/20" 
                              : "glass text-muted-foreground/60 hover:text-foreground"
                          }`}>
                          {c === "all" ? "Any" : ctLabel(c)}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Grade Pills */}
                  {gradeLevels.length > 0 && (
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/40">Grade</span>
                      <div className="flex items-center gap-1.5 max-w-[200px] overflow-x-auto no-scrollbar">
                        <button onClick={() => setSelectedGrade("all")}
                          className={`h-7 px-3 rounded-full text-[10px] font-black uppercase tracking-widest transition-all duration-300 ${
                            selectedGrade === "all" 
                              ? "bg-amber-500 text-white shadow-md shadow-amber-500/20" 
                              : "glass text-muted-foreground/60 hover:text-foreground"
                          }`}>
                          Any
                        </button>
                        {gradeLevels.map((g) => (
                          <button key={g} onClick={() => setSelectedGrade(g)}
                            className={`h-7 px-3 rounded-full text-[10px] font-black uppercase tracking-widest transition-all duration-300 ${
                              selectedGrade === g 
                                ? "bg-amber-500 text-white shadow-md shadow-amber-500/20" 
                                : "glass text-muted-foreground/60 hover:text-foreground"
                            }`}>
                            {g}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Scrollable Results */}
              <div className="mt-8 flex-1 overflow-y-auto custom-scrollbar px-1 pb-10">
                {searching ? (
                  <div className="py-20 flex flex-col items-center justify-center">
                    <Loader2 className="w-12 h-12 animate-spin text-primary/30 mb-6" />
                    <p className="text-sm font-bold uppercase tracking-widest text-muted-foreground/50 animate-pulse">Scanning library...</p>
                  </div>
                ) : searchResults.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {searchResults.map((r, idx) => (
                      <Link key={r.id} to={`/read/${r.id}`}
                        className="flex items-center gap-4 p-4 rounded-2xl glass hover:bg-white dark:hover:bg-white/5 border-white/20 hover:border-primary/20 transition-all duration-300 group/result animate-fade-in"
                        style={{ animationDelay: `${idx * 50}ms` }}
                        onClick={() => setSearchOpen(false)}>
                        <div className="w-14 h-14 rounded-xl bg-primary/5 dark:bg-white/5 flex items-center justify-center text-3xl group-hover/result:scale-110 group-hover/result:shadow-xl transition-all duration-500">
                          {r.cover_emoji || r.subjects?.icon || "📄"}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-sm md:text-base text-foreground truncate group-hover/result:text-primary transition-colors">{r.title}</div>
                          <div className="flex items-center gap-2 mt-1.5">
                            <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50 bg-muted px-1.5 py-0.5 rounded">
                              {r.subjects?.name}
                            </span>
                            <span className="text-[10px] font-bold text-indigo-500">
                              {ctLabel(r.content_type)}
                            </span>
                            {r.grade_level && (
                              <span className="text-[10px] font-black text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded-sm">
                                {r.grade_level}
                              </span>
                            )}
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-muted-foreground opacity-0 group-hover/result:opacity-100 -translateX-2 group-hover/result:translate-x-0 transition-all duration-300" />
                      </Link>
                    ))}
                  </div>
                ) : search.trim().length > 2 ? (
                  <div className="py-20 text-center animate-scale-in">
                    <div className="bg-muted dark:bg-gray-800 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
                      <Search className="w-10 h-10 text-muted-foreground opacity-20" />
                    </div>
                    <h3 className="text-xl font-heading font-black text-foreground mb-2">No matches found</h3>
                    <p className="text-muted-foreground text-sm max-w-xs mx-auto mb-8">
                      We couldn't find anything matching "{search}". Try different keywords or subjects.
                    </p>
                    <Button variant="outline" onClick={() => { setSearch(""); setSelectedSubject("all"); }}
                      className="rounded-full px-10 h-11 border-2 font-bold uppercase tracking-wider text-xs">
                      Reset Library
                    </Button>
                  </div>
                ) : (
                  <div className="py-24 text-center">
                    <p className="text-sm font-bold uppercase tracking-[0.3em] text-muted-foreground/30">Enter a keyword to explore</p>
                  </div>
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
                    <div className="rounded-2xl overflow-hidden border border-white/10 shadow-card transition-all duration-300 hover:-translate-y-2 hover:shadow-card-hover bg-white dark:bg-gray-900 group">
                      {/* Mesh gradient area */}
                      <div
                        className="relative h-40 md:h-44 flex flex-col justify-between p-5 overflow-hidden"
                        style={{ background: mesh, backgroundColor: "#4f46e5" }}
                      >
                        {/* Decorative glow */}
                        <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/20 rounded-full blur-3xl" />
                        
                        <div className="flex justify-center items-center flex-1 relative">
                          <span className="text-6xl md:text-7xl leading-none group-hover:scale-110 transition-transform duration-500"
                            style={{ filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.4))" }}>
                            {s.icon}
                          </span>
                        </div>
                        <div className="flex items-end justify-between gap-2 relative">
                          <h3 className="font-heading font-black text-white text-base md:text-lg leading-tight drop-shadow-md">
                            {s.name}
                          </h3>
                          <span className="flex-shrink-0 text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg bg-black/30 text-white backdrop-blur-md border border-white/10">
                            {count} {count === 1 ? "unit" : "units"}
                          </span>
                        </div>
                      </div>
                      {/* Footer */}
                      <div className="px-5 py-4 flex items-center justify-between bg-white dark:bg-gray-900 border-t border-gray-50 dark:border-gray-800">
                        <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">
                          {count === 0 ? "Coming Soon" : `Ready to read`}
                        </span>
                        <div className="w-8 h-8 rounded-full bg-muted dark:bg-gray-800 flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-colors duration-300">
                          <ArrowRight className="w-4 h-4" />
                        </div>
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

      {/* ── Bookmarks Drawer ────────────────────────────────────────── */}
      <Sheet open={bookmarksOpen} onOpenChange={setBookmarksOpen}>
        <SheetContent className="w-full sm:max-w-md p-0 dark:bg-gray-900 dark:border-gray-800 flex flex-col z-[100]">
          <SheetHeader className="px-5 py-4 border-b border-border dark:border-gray-800 flex flex-row items-center justify-between">
            <SheetTitle className="text-lg dark:text-gray-100">Your Bookmarks</SheetTitle>
            {bookmarks.length > 0 && (
              <Button variant="ghost" size="sm" onClick={clearAll} className="text-muted-foreground hover:text-destructive h-8 px-2 -mr-2 mt-0">
                <Trash2 className="w-4 h-4 mr-1.5" /> Clear All
              </Button>
            )}
          </SheetHeader>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {bookmarks.length === 0 ? (
              <div className="text-center py-10">
                <Bookmark className="w-10 h-10 mx-auto text-muted-foreground opacity-20 mb-3" />
                <p className="text-muted-foreground text-sm">No bookmarks yet. Open a PDF and tap the bookmark icon to save a page.</p>
              </div>
            ) : (
              bookmarks.slice().reverse().map((b) => (
                <div key={`${b.resourceId}-${b.pageNumber}`} className="flex items-center justify-between p-3 rounded-lg border border-border dark:border-gray-800 bg-card hover:bg-muted/50 dark:hover:bg-gray-800/50 transition-colors">
                  <Link
                    to={`/read/${b.resourceId}`}
                    className="flex-1 min-w-0 pr-4"
                    onClick={() => setBookmarksOpen(false)}
                  >
                    <div className="font-medium text-sm text-foreground dark:text-gray-100 truncate">{b.title}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">Page {b.pageNumber}</div>
                  </Link>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive flex-shrink-0" onClick={() => removeBookmark(b.resourceId, b.pageNumber)}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
