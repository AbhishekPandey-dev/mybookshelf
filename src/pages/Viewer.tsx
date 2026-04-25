import { useEffect, useRef, useState, useCallback } from "react";
import { Link, useParams } from "react-router-dom";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  ArrowLeft, ChevronLeft, ChevronRight, ZoomIn, ZoomOut,
  Maximize, Download, Loader2, Sparkles, List, ChevronRight as ChevRight, Bookmark,
} from "lucide-react";
import AIAssistant from "@/components/AIAssistant";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useProgress } from "@/hooks/useProgress";
import { useBookmarks } from "@/hooks/useBookmarks";
import { toast } from "sonner";

pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

type Resource = {
  id: string; title: string; pdf_url: string; allow_download: boolean; subject_id: string;
};

// ── Types for PDF outline ────────────────────────────────────────────────────
interface OutlineItem {
  title: string;
  dest: unknown;
  items: OutlineItem[];
  page?: number; // resolved after load
}

// Minimal type for pdfjs PDFDocumentProxy we need
interface PDFDocProxy {
  numPages: number;
  getOutline(): Promise<OutlineItem[] | null>;
  getDestination(name: string): Promise<unknown[]>;
  getPageIndex(ref: unknown): Promise<number>;
}

export default function Viewer() {
  const { id } = useParams();
  const [resource, setResource] = useState<Resource | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [page, setPage] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [containerWidth, setContainerWidth] = useState(0);
  const [isAIOpen, setIsAIOpen] = useState(false);
  const [pageInput, setPageInput] = useState("");
  const [editingPage, setEditingPage] = useState(false);
  const [tocOpen, setTocOpen] = useState(false);
  const [outline, setOutline] = useState<OutlineItem[] | null>(null);
  const [pdfProxy, setPdfProxy] = useState<PDFDocProxy | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  // ── Progress tracking (Task 2) ───────────────────────────────────────────
  const { getProgress, setProgress } = useProgress(id ?? "");
  const [resumePage, setResumePage] = useState<number | null>(null);

  // ── Bookmarks ────────────────────────────────────────────────────────────
  const { addBookmark, removeBookmark, isBookmarked } = useBookmarks();

  // ── ResizeObserver for accurate PDF width ────────────────────────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      setContainerWidth(entries[0]?.contentRect.width ?? 0);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ── Load resource & check resume ─────────────────────────────────────────
  useEffect(() => {
    if (!id) return;
    supabase
      .from("resources")
      .select("id, title, pdf_url, allow_download, subject_id")
      .eq("id", id)
      .maybeSingle()
      .then(({ data }) => {
        setResource(data as Resource | null);
        
        // Track view (Task 1 - Analytics)
        if (data) {
          supabase.from("resource_views").insert({ resource_id: data.id }).then();
        }

        // Check if student has prior progress
        const prog = getProgress();
        if (prog && prog.lastPage > 1) {
          setResumePage(prog.lastPage);
        }
      });
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Save progress whenever page changes ──────────────────────────────────
  useEffect(() => {
    if (numPages > 0 && id) {
      setProgress(page, numPages);
    }
  }, [page, numPages]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── PDF loaded callback — extract ToC ────────────────────────────────────
  const onLoaded = useCallback(async (pdf: PDFDocProxy) => {
    setNumPages(pdf.numPages);
    setPdfProxy(pdf);

    try {
      const raw = await pdf.getOutline();
      if (!raw || raw.length === 0) { setOutline(null); return; }

      // Resolve page numbers for each outline item (recursive)
      const resolve = async (items: OutlineItem[]): Promise<OutlineItem[]> => {
        return Promise.all(
          items.map(async (item) => {
            let pageNum: number | undefined;
            try {
              if (Array.isArray(item.dest) && item.dest.length > 0) {
                pageNum = (await pdf.getPageIndex(item.dest[0])) + 1;
              } else if (typeof item.dest === "string") {
                const dest = await pdf.getDestination(item.dest);
                if (dest) pageNum = (await pdf.getPageIndex(dest[0])) + 1;
              }
            } catch { /* ignore unresolvable refs */ }
            const children = item.items?.length > 0 ? await resolve(item.items) : [];
            return { ...item, page: pageNum, items: children };
          })
        );
      };

      const resolved = await resolve(raw);
      setOutline(resolved);
    } catch {
      setOutline(null);
    }
  }, []);

  const goToPage = (p: number): void => setPage(Math.max(1, Math.min(numPages, p)));

  const commitPageInput = (): void => {
    const n = parseInt(pageInput, 10);
    if (!isNaN(n)) goToPage(n);
    setEditingPage(false);
    setPageInput("");
  };

  const fullscreen = (): void => {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen?.();
  };

  const toggleBookmark = useCallback(() => {
    if (!resource) return;
    if (isBookmarked(resource.id, page)) {
      removeBookmark(resource.id, page);
      toast("Bookmark removed");
    } else {
      addBookmark(resource.id, resource.title, page);
      toast.success(`📌 Page ${page} bookmarked`);
    }
  }, [resource, page, isBookmarked, removeBookmark, addBookmark]);

  // ── Keyboard shortcuts ───────────────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === "ArrowRight") {
        goToPage(page + 1);
      } else if (e.key === "ArrowLeft") {
        goToPage(page - 1);
      } else if (e.key.toLowerCase() === "b") {
        toggleBookmark();
      } else if (e.key.toLowerCase() === "f") {
        fullscreen();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [page, numPages, toggleBookmark]);

  if (!resource) {
    return (
      <div className="min-h-screen flex items-center justify-center dark:bg-gray-950">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const pdfWidth = containerWidth > 0 ? Math.floor((containerWidth - 32) * scale) : undefined;

  return (
    <div className="fixed inset-0 bg-muted/50 dark:bg-gray-950 flex flex-col animate-fade-in-fast">
      {/* ── Top bar ─────────────────────────────────────────────────── */}
      <div className="bg-background/60 dark:bg-gray-900/60 backdrop-blur-xl border-b border-white/10 dark:border-white/5 flex-shrink-0 sticky top-0 z-[40]">
        <div className="px-3 sm:px-4 h-14 flex items-center gap-1">
          <Link
            to={`/subject/${resource.subject_id}`}
            className="w-10 h-10 rounded-full hover:bg-white/20 dark:hover:bg-white/5 flex items-center justify-center flex-shrink-0 transition-colors"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5 text-foreground dark:text-gray-100" />
          </Link>

          {/* Resume banner */}
          {resumePage && (
            <button
              onClick={() => { goToPage(resumePage); setResumePage(null); }}
              className="hidden sm:flex items-center gap-1.5 text-xs font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/50 backdrop-blur px-4 py-2 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900 transition-all flex-shrink-0 border border-indigo-100/50 dark:border-indigo-500/20"
            >
              Resume from page {resumePage}
            </button>
          )}

          <h1 className="font-heading font-black text-foreground dark:text-gray-100 truncate flex-1 min-w-0 text-sm sm:text-base px-2">
            {resource.title}
          </h1>

          {/* ToC button — only if PDF has outline */}
          {outline && outline.length > 0 && (
            <button
              onClick={() => setTocOpen(true)}
              className="w-10 h-10 rounded-full hover:bg-white/20 dark:hover:bg-white/5 flex items-center justify-center flex-shrink-0 transition-colors"
              aria-label="Table of contents"
            >
              <List className="w-5 h-5 text-foreground dark:text-gray-100" />
            </button>
          )}

          <ThemeToggle />
        </div>
      </div>

      {/* ── PDF scroll area ──────────────────────────────────────────── */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto overflow-x-hidden max-w-full px-4 py-4"
      >
        <div className="flex justify-center">
          <Document
            file={resource.pdf_url}
            onLoadSuccess={onLoaded as (pdf: object) => void}
            onLoadError={(e) => toast.error("Failed to load PDF: " + e.message)}
            loading={
              <div className="py-20 text-muted-foreground flex items-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin" /> Loading PDF…
              </div>
            }
          >
            <Page
              pageNumber={page}
              width={pdfWidth}
              className="shadow-card rounded-card overflow-hidden bg-white"
              renderTextLayer
              renderAnnotationLayer
            />
          </Document>
        </div>
      </div>

      {/* ── Permanent bottom toolbar ─────────────────────────────────── */}
      <div className="flex-shrink-0 bg-background/60 dark:bg-gray-900/60 backdrop-blur-xl border-t border-white/10 dark:border-white/5 shadow-2xl h-[60px] flex items-center px-4 gap-2 z-[40]">
        <Button size="icon" variant="ghost" className="h-10 w-10 rounded-full flex-shrink-0 hover:bg-white/20"
          onClick={() => goToPage(page - 1)} disabled={page <= 1} aria-label="Previous page">
          <ChevronLeft className="w-5 h-5" />
        </Button>

        {/* Tappable page input */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {editingPage ? (
            <input
              autoFocus type="number" min={1} max={numPages}
              value={pageInput}
              onChange={(e) => setPageInput(e.target.value)}
              onBlur={commitPageInput}
              onKeyDown={(e) => { if (e.key === "Enter") commitPageInput(); if (e.key === "Escape") setEditingPage(false); }}
              className="w-14 text-center text-sm font-black border-2 border-primary/20 dark:border-white/10 dark:bg-gray-800 dark:text-gray-100 rounded-lg h-9 focus:outline-none focus:ring-2 focus:ring-primary/40 bg-white/50"
            />
          ) : (
            <button
              onClick={() => { setEditingPage(true); setPageInput(String(page)); }}
              className="text-xs font-black text-foreground dark:text-gray-200 min-w-[70px] tracking-widest text-center px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors uppercase"
            >
              {page} <span className="opacity-30">/</span> {numPages || "—"}
            </button>
          )}
        </div>

        <Button size="icon" variant="ghost" className="h-10 w-10 rounded-full flex-shrink-0 hover:bg-white/20"
          onClick={toggleBookmark} aria-label="Bookmark page">
          <Bookmark className={`w-5 h-5 transition-all ${resource && isBookmarked(resource.id, page) ? "fill-current text-indigo-500 scale-110" : "opacity-40"}`} />
        </Button>

        <Button size="icon" variant="ghost" className="h-10 w-10 rounded-full flex-shrink-0 hover:bg-white/20"
          onClick={() => goToPage(page + 1)} disabled={page >= numPages} aria-label="Next page">
          <ChevronRight className="w-5 h-5" />
        </Button>

        <div className="w-px h-8 bg-white/10 mx-2 flex-shrink-0" />

        <div className="hidden sm:flex items-center gap-1">
          <Button size="icon" variant="ghost" className="h-10 w-10 rounded-full flex-shrink-0 hover:bg-white/20"
            onClick={() => setScale((s) => Math.max(0.5, +(s - 0.15).toFixed(2)))} aria-label="Zoom out">
            <ZoomOut className="w-4 h-4" />
          </Button>

          <span className="text-[10px] font-black uppercase tracking-tighter text-muted-foreground w-12 text-center flex-shrink-0">
            {Math.round(scale * 100)}%
          </span>

          <Button size="icon" variant="ghost" className="h-10 w-10 rounded-full flex-shrink-0 hover:bg-white/20"
            onClick={() => setScale((s) => Math.min(3.0, +(s + 0.15).toFixed(2)))} aria-label="Zoom in">
            <ZoomIn className="w-4 h-4" />
          </Button>
        </div>

        <div className="hidden sm:block w-px h-8 bg-white/10 mx-2 flex-shrink-0" />

        <Button size="icon" variant="ghost" className="h-10 w-10 rounded-full flex-shrink-0 hover:bg-white/20"
          onClick={fullscreen} aria-label="Fullscreen">
          <Maximize className="w-4 h-4 opacity-60" />
        </Button>

        {resource.allow_download && (
          <a href={resource.pdf_url} download target="_blank" rel="noreferrer"
            aria-label="Download"
            className="h-10 w-10 rounded-full hover:bg-white/20 flex items-center justify-center flex-shrink-0 transition-colors">
            <Download className="w-4 h-4 text-foreground dark:text-gray-200 opacity-60" />
          </a>
        )}

        <div className="flex-1" />

        {/* AI FAB - Prominent with glow */}
        <button
          onClick={() => setIsAIOpen(true)}
          className="group relative h-10 px-4 rounded-full bg-indigo-600 text-white shadow-lg hover:shadow-indigo-500/40 hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center gap-2 overflow-hidden"
          aria-label="Open AI Assistant"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 opacity-0 group-hover:opacity-100 transition-opacity" />
          <Sparkles className="w-4 h-4 relative z-10" />
          <span className="relative z-10 text-[10px] font-black uppercase tracking-widest hidden md:inline">AI Assistant</span>
        </button>
      </div>

      {/* ── ToC Sheet (Task 3) ────────────────────────────────────────── */}
      <Sheet open={tocOpen} onOpenChange={setTocOpen}>
        <SheetContent
          side="left"
          className="w-72 sm:w-80 p-0 dark:bg-gray-900 dark:border-gray-800 flex flex-col"
        >
          <SheetHeader className="px-5 py-4 border-b border-border dark:border-gray-800 flex-shrink-0">
            <SheetTitle className="text-base dark:text-gray-100">Contents</SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto py-2">
            {outline?.map((item, i) => (
              <TocItem
                key={i}
                item={item}
                currentPage={page}
                depth={0}
                onJump={(p) => { goToPage(p); setTocOpen(false); }}
              />
            ))}
          </div>
        </SheetContent>
      </Sheet>

      <AIAssistant
        resourceId={resource.id}
        currentPage={page}
        open={isAIOpen}
        onOpenChange={setIsAIOpen}
        onJumpToPage={goToPage}
      />
    </div>
  );
}

// ── ToC item (recursive) ─────────────────────────────────────────────────────
function TocItem({
  item, currentPage, depth, onJump,
}: {
  item: OutlineItem; currentPage: number; depth: number; onJump: (p: number) => void;
}) {
  const [expanded, setExpanded] = useState(depth < 1);
  const isActive = item.page !== undefined && item.page === currentPage;

  return (
    <div>
      <button
        onClick={() => { if (item.page) onJump(item.page); if (item.items.length) setExpanded((e) => !e); }}
        className={`w-full flex items-center gap-2 px-5 py-2 text-sm text-left transition-colors hover:bg-muted dark:hover:bg-gray-800
          ${depth > 0 ? "pl-" + (5 + depth * 4) : "pl-5"}
          ${isActive ? "text-indigo-600 dark:text-indigo-400 font-semibold bg-indigo-50 dark:bg-indigo-950/50" : "text-foreground dark:text-gray-300"}`}
        style={{ paddingLeft: `${20 + depth * 16}px` }}
      >
        <span className="flex-1 truncate">{item.title}</span>
        {item.page && (
          <span className="text-xs text-muted-foreground dark:text-gray-500 flex-shrink-0">{item.page}</span>
        )}
        {item.items.length > 0 && (
          <ChevRight className={`w-3.5 h-3.5 text-muted-foreground flex-shrink-0 transition-transform ${expanded ? "rotate-90" : ""}`} />
        )}
      </button>
      {expanded && item.items.length > 0 && (
        <div>
          {item.items.map((child, i) => (
            <TocItem key={i} item={child} currentPage={currentPage} depth={depth + 1} onJump={onJump} />
          ))}
        </div>
      )}
    </div>
  );
}
