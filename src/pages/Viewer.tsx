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
  Maximize, Download, Loader2, Sparkles, List, ChevronRight as ChevRight,
} from "lucide-react";
import AIAssistant from "@/components/AIAssistant";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useProgress } from "@/hooks/useProgress";
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
      <div className="bg-background/90 dark:bg-gray-900/90 backdrop-blur border-b border-border dark:border-gray-800 flex-shrink-0">
        <div className="px-3 sm:px-4 h-14 flex items-center gap-1">
          <Link
            to={`/subject/${resource.subject_id}`}
            className="w-11 h-11 rounded-full hover:bg-muted dark:hover:bg-gray-800 flex items-center justify-center flex-shrink-0"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5 text-foreground dark:text-gray-100" />
          </Link>

          {/* Resume banner */}
          {resumePage && (
            <button
              onClick={() => { goToPage(resumePage); setResumePage(null); }}
              className="hidden sm:flex items-center gap-1.5 text-xs font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950 px-3 py-1.5 rounded-full hover:bg-indigo-100 dark:hover:bg-indigo-900 transition-colors flex-shrink-0"
            >
              Resume from page {resumePage}
            </button>
          )}

          <h1 className="font-heading font-semibold text-foreground dark:text-gray-100 truncate flex-1 min-w-0 text-sm sm:text-base">
            {resource.title}
          </h1>

          {/* ToC button — only if PDF has outline */}
          {outline && outline.length > 0 && (
            <button
              onClick={() => setTocOpen(true)}
              className="w-11 h-11 rounded-full hover:bg-muted dark:hover:bg-gray-800 flex items-center justify-center flex-shrink-0"
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
      <div className="flex-shrink-0 bg-background dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800 shadow-[0_-2px_8px_rgba(0,0,0,0.06)] h-[52px] flex items-center px-2 gap-1 z-20">
        <Button size="icon" variant="ghost" className="h-10 w-10 rounded-full flex-shrink-0"
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
              className="w-12 text-center text-sm font-medium border border-border dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-md h-8 focus:outline-none focus:ring-1 focus:ring-primary"
            />
          ) : (
            <button
              onClick={() => { setEditingPage(true); setPageInput(String(page)); }}
              className="text-sm font-medium text-foreground dark:text-gray-200 min-w-[56px] text-center px-1 py-1 rounded hover:bg-muted dark:hover:bg-gray-800"
            >
              {page} / {numPages || "—"}
            </button>
          )}
        </div>

        <Button size="icon" variant="ghost" className="h-10 w-10 rounded-full flex-shrink-0"
          onClick={() => goToPage(page + 1)} disabled={page >= numPages} aria-label="Next page">
          <ChevronRight className="w-5 h-5" />
        </Button>

        <div className="w-px h-6 bg-border dark:bg-gray-700 mx-1 flex-shrink-0" />

        <Button size="icon" variant="ghost" className="h-10 w-10 rounded-full flex-shrink-0"
          onClick={() => setScale((s) => Math.max(0.5, +(s - 0.15).toFixed(2)))} aria-label="Zoom out">
          <ZoomOut className="w-4 h-4" />
        </Button>

        <span className="hidden sm:block text-xs text-muted-foreground w-10 text-center flex-shrink-0">
          {Math.round(scale * 100)}%
        </span>

        <Button size="icon" variant="ghost" className="h-10 w-10 rounded-full flex-shrink-0"
          onClick={() => setScale((s) => Math.min(3.0, +(s + 0.15).toFixed(2)))} aria-label="Zoom in">
          <ZoomIn className="w-4 h-4" />
        </Button>

        <div className="w-px h-6 bg-border dark:bg-gray-700 mx-1 flex-shrink-0" />

        <Button size="icon" variant="ghost" className="h-10 w-10 rounded-full flex-shrink-0"
          onClick={fullscreen} aria-label="Fullscreen">
          <Maximize className="w-4 h-4" />
        </Button>

        {resource.allow_download && (
          <a href={resource.pdf_url} download target="_blank" rel="noreferrer"
            aria-label="Download"
            className="h-10 w-10 rounded-full hover:bg-muted dark:hover:bg-gray-800 flex items-center justify-center flex-shrink-0">
            <Download className="w-4 h-4 text-foreground dark:text-gray-200" />
          </a>
        )}

        <div className="flex-1" />

        {/* AI FAB */}
        <button
          onClick={() => setIsAIOpen(true)}
          className="h-10 w-10 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-md hover:scale-105 active:scale-95 transition-all flex items-center justify-center flex-shrink-0"
          aria-label="Open AI Assistant"
        >
          <Sparkles className="w-4 h-4" />
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
