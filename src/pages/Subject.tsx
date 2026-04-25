import { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, FileText, ChevronRight, BookOpen, Link2, CheckCircle2 } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useProgress } from "@/hooks/useProgress";
import { toast } from "sonner";

type Subject = { id: string; name: string; icon: string; color: string };
type Book = { id: string; title: string; description: string | null; order_index: number };
type Resource = {
  id: string; title: string; description: string | null; content_type: string;
  unit_number: string | null; book_id: string | null; order_index: number;
  cover_emoji: string | null; cover_color: string | null; grade_level?: string | null;
};

function copyShareLink(resourceId: string): void {
  const url = `${window.location.origin}/read/${resourceId}`;
  navigator.clipboard.writeText(url).then(() => {
    toast.success("Link copied! Share with your students 📋");
  }).catch(() => toast.error("Could not copy link"));
}

export default function Subject() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [subject, setSubject] = useState<Subject | null>(null);
  const [books, setBooks] = useState<Book[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const [{ data: s }, { data: b }, { data: r }] = await Promise.all([
        supabase.from("subjects").select("*").eq("id", id).maybeSingle(),
        supabase.from("books").select("*").eq("subject_id", id).order("order_index"),
        supabase.from("resources").select("*").eq("subject_id", id).order("order_index"),
      ]);
      setSubject(s);
      setBooks(b ?? []);
      setResources(r ?? []);
      setLoading(false);
    })();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background dark:bg-gray-950 animate-fade-in-fast">
        <div className="container mx-auto px-4 py-8 max-w-3xl">
          <Skeleton className="h-6 w-24 mb-6" />
          <Skeleton className="h-10 w-64 mb-8" />
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-card" />)}
          </div>
        </div>
      </div>
    );
  }
  if (!subject) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground dark:bg-gray-950">Subject not found</div>;
  }

  const standalone = resources.filter((r) => !r.book_id);
  const fullBooks = standalone.filter((r) => r.content_type === "full");
  const otherStandalone = standalone.filter((r) => r.content_type !== "full");

  return (
    <div className="min-h-screen bg-background dark:bg-gray-950 flex flex-col animate-fade-in-fast">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-background/80 dark:bg-gray-950/80 backdrop-blur border-b border-border dark:border-gray-800">
        <div className="container mx-auto h-16 px-4 flex items-center gap-2 max-w-3xl">
          <button
            onClick={() => navigate("/")}
            className="w-12 h-12 -ml-2 rounded-full hover:bg-muted dark:hover:bg-gray-800 flex items-center justify-center"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5 dark:text-gray-200" />
          </button>
          <span className="text-2xl">{subject.icon}</span>
          <h1 className="font-heading font-bold text-xl md:text-2xl text-foreground dark:text-gray-100 truncate flex-1">
            {subject.name}
          </h1>
          <ThemeToggle />
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-3xl flex-1 space-y-10">
        {fullBooks.length > 0 && (
          <section>
            <h2 className="font-heading font-bold text-base text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
              <BookOpen className="w-4 h-4" /> Full Books
            </h2>
            <div className="space-y-3">
              {fullBooks.map((r) => <UnitRow key={r.id} r={r} />)}
            </div>
          </section>
        )}

        {books.map((book) => {
          const items = resources
            .filter((r) => r.book_id === book.id)
            .sort((a, b) => a.order_index - b.order_index);
          if (items.length === 0) return null;
          return (
            <section key={book.id}>
              <h2 className="font-heading font-bold text-lg text-foreground dark:text-gray-100 mb-1">
                {book.title}
              </h2>
              {book.description && (
                <p className="text-sm text-muted-foreground mb-4">{book.description}</p>
              )}
              {!book.description && <div className="mb-4" />}
              <div className="space-y-3">
                {items.map((r, i) => <UnitRow key={r.id} r={r} index={i + 1} />)}
              </div>
            </section>
          );
        })}

        {otherStandalone.length > 0 && (
          <section>
            <h2 className="font-heading font-bold text-base text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
              <FileText className="w-4 h-4" /> More Resources
            </h2>
            <div className="space-y-3">
              {otherStandalone.map((r) => <UnitRow key={r.id} r={r} />)}
            </div>
          </section>
        )}

        {resources.length === 0 && (
          <div className="py-20 text-center animate-in fade-in zoom-in duration-500">
            <div className="w-20 h-20 bg-muted dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-6">
              <FileText className="w-10 h-10 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-heading font-bold text-foreground dark:text-gray-100 mb-2">No resources yet</h3>
            <p className="text-muted-foreground max-w-xs mx-auto">
              This subject doesn't have any books or units uploaded yet. Check back soon!
            </p>
          </div>
        )}
      </main>
    </div>
  );
}

// ── Resource row with progress + share (Tasks 2 & 5) ────────────────────────
function UnitRow({ r, index }: { r: Resource; index?: number }) {
  const label = r.unit_number || (index ? `Unit ${index}` : (r.content_type === "full" ? "Book" : "Item"));
  // Read progress from localStorage for this resource
  const { getProgress } = useProgress(r.id);
  const prog = getProgress();
  const pct = prog && prog.totalPages > 0
    ? Math.min(100, Math.round((prog.lastPage / prog.totalPages) * 100))
    : 0;

  return (
    <div className="relative group">
      <Link to={`/read/${r.id}`} className="block">
        <Card className="lift-card p-4 sm:p-5 flex items-center gap-4 cursor-pointer dark:bg-gray-900 dark:border-gray-800 overflow-hidden">
          {/* Icon / label box */}
          <div className="flex-shrink-0 w-12 h-12 rounded-input bg-primary-soft dark:bg-indigo-950 text-primary dark:text-indigo-400 flex items-center justify-center font-heading font-bold text-sm px-2 text-center">
            {label.length > 8 ? r.cover_emoji || "📄" : label}
          </div>

          <div className="flex-1 min-w-0 pr-2">
            <div className="font-heading font-semibold text-foreground dark:text-gray-100 truncate">
              {r.title}
            </div>
            {r.description && (
              <div className="text-sm text-muted-foreground line-clamp-1">{r.description}</div>
            )}
            
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              {r.grade_level && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded-sm bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 text-[10px] font-bold uppercase tracking-wider border border-amber-100 dark:border-amber-900/50">
                  {r.grade_level}
                </span>
              )}
              {r.content_type && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded-sm bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 text-[10px] font-bold uppercase tracking-wider border border-blue-100 dark:border-blue-900/50">
                  {r.content_type.replace("_", " ")}
                </span>
              )}
            </div>

            {/* Progress info */}
            {prog && prog.lastPage > 0 && (
              <div className="mt-1 flex items-center gap-2">
                {prog.completed ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Completed
                  </span>
                ) : (
                  <span className="text-[11px] text-muted-foreground">
                    Page {prog.lastPage} of {prog.totalPages}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Open button */}
          <Button size="sm" className="hidden sm:inline-flex flex-shrink-0">
            Open <ChevronRight className="w-4 h-4 -mr-1" />
          </Button>
          <ChevronRight className="w-5 h-5 text-muted-foreground sm:hidden flex-shrink-0" />
        </Card>

        {/* Task 2: Progress bar — 3px, indigo fill */}
        {pct > 0 && (
          <div className="h-[3px] w-full bg-gray-100 dark:bg-gray-800 -mt-[3px] relative overflow-hidden rounded-b-input">
            <div
              className="h-full bg-indigo-500 transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
        )}
      </Link>

      {/* Task 5: Share button — hover reveal, top-right */}
      <button
        onClick={() => copyShareLink(r.id)}
        className="absolute top-3 right-3 w-8 h-8 rounded-full bg-background dark:bg-gray-800 border border-border dark:border-gray-700 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm hover:bg-muted dark:hover:bg-gray-700 z-10"
        aria-label="Copy share link"
      >
        <Link2 className="w-3.5 h-3.5 text-muted-foreground" />
      </button>
    </div>
  );
}
