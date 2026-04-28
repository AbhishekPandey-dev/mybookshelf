import { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useVibration } from "@/hooks/useVibration";
import { ArrowLeft, FileText, ChevronRight, BookOpen, Search } from "lucide-react";
import { Header } from "@/components/Header";



type Subject = { id: string; name: string; icon: string; color: string };
type Book = { id: string; title: string; description: string | null; order_index: number };
type Resource = {
  id: string; title: string; description: string | null; content_type: string;
  unit_number: string | null; book_id: string | null; order_index: number;
  cover_emoji: string | null; cover_color: string | null;
};

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
      <div className="min-h-screen bg-background animate-fade-in-fast">
        <header className="h-16 border-b border-border bg-background/80 backdrop-blur sticky top-0 z-20">
          <div className="container mx-auto h-full px-4 flex items-center gap-3 max-w-3xl">
            <Skeleton className="w-10 h-10 rounded-full" />
            <Skeleton className="h-6 w-32" />
          </div>
        </header>
        <div className="container mx-auto px-4 py-8 max-w-3xl space-y-10">
          <div className="space-y-4">
            <Skeleton className="h-6 w-24" />
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Card key={i} className="p-5 flex items-center gap-4">
                  <Skeleton className="w-12 h-12 rounded-input" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!subject) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Subject not found</div>;
  }

  const standalone = resources.filter((r) => !r.book_id);
  const fullBooks = standalone.filter((r) => r.content_type === "full");
  const otherStandalone = standalone.filter((r) => r.content_type !== "full");

  return (
    <div className="min-h-screen bg-background flex flex-col animate-fade-in-fast">
      <Header siteName={subject.name} onSearchClick={() => navigate("/")} />


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
          const items = resources.filter((r) => r.book_id === book.id).sort((a, b) => a.order_index - b.order_index);
          if (items.length === 0) return null;
          return (
            <section key={book.id}>
              <h2 className="font-heading font-bold text-lg text-foreground mb-1">{book.title}</h2>
              {book.description && <p className="text-sm text-muted-foreground mb-4">{book.description}</p>}
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
          <Card className="p-12 text-center border-dashed">
            <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">No resources in this subject yet.</p>
          </Card>
        )}
      </main>
    </div>
  );
}

function UnitRow({ r, index }: { r: Resource; index?: number }) {
  const { vibrateLight } = useVibration();
  const label = r.unit_number || (index ? `Unit ${index}` : (r.content_type === "full" ? "Book" : "Item"));
  return (
    <Link to={`/read/${r.id}`} className="block group" onClick={() => vibrateLight()}>

      <Card className="lift-card p-4 sm:p-5 flex items-center gap-4 cursor-pointer">
        <div className="flex-shrink-0 w-12 h-12 rounded-input bg-primary-soft text-primary flex items-center justify-center font-heading font-bold text-sm px-2 text-center">
          {label.length > 8 ? r.cover_emoji || "📄" : label}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-heading font-semibold text-foreground truncate">{r.title}</div>
          {r.description && <div className="text-sm text-muted-foreground line-clamp-1">{r.description}</div>}
        </div>
        <Button size="sm" className="hidden sm:inline-flex">
          Open <ChevronRight className="w-4 h-4 -mr-1" />
        </Button>
        <ChevronRight className="w-5 h-5 text-muted-foreground sm:hidden" />
      </Card>
    </Link>
  );
}
