import { useEffect, useRef, useState, useCallback } from "react";
import { Link, useParams } from "react-router-dom";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Maximize,
  Download,
  Loader2,
  Sparkles,
} from "lucide-react";
import AIAssistant from "@/components/AIAssistant";
import { toast } from "sonner";

pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

type Resource = {
  id: string;
  title: string;
  pdf_url: string;
  allow_download: boolean;
  subject_id: string;
};

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

  const containerRef = useRef<HTMLDivElement>(null);

  // ── Task 1: ResizeObserver for accurate container width ──────────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0;
      setContainerWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Load resource
  useEffect(() => {
    if (!id) return;
    supabase
      .from("resources")
      .select("id, title, pdf_url, allow_download, subject_id")
      .eq("id", id)
      .maybeSingle()
      .then(({ data }) => setResource(data as Resource | null));
  }, [id]);

  const onLoaded = useCallback((pdf: { numPages: number }) => {
    setNumPages(pdf.numPages);
  }, []);

  const fullscreen = (): void => {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen?.();
  };

  const goToPage = (p: number): void => {
    setPage(Math.max(1, Math.min(numPages, p)));
  };

  const commitPageInput = (): void => {
    const n = parseInt(pageInput, 10);
    if (!isNaN(n)) goToPage(n);
    setEditingPage(false);
    setPageInput("");
  };

  if (!resource) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // PDF render width: container width minus horizontal padding (16px each side)
  const pdfWidth = containerWidth > 0 ? Math.floor((containerWidth - 32) * scale) : undefined;

  return (
    <div className="fixed inset-0 bg-muted/50 flex flex-col animate-fade-in-fast">
      {/* ── Top bar ─────────────────────────────────────────────────── */}
      <div className="bg-background/90 backdrop-blur border-b border-border flex-shrink-0">
        <div className="px-3 sm:px-4 h-14 flex items-center gap-2">
          <Link
            to={`/subject/${resource.subject_id}`}
            className="w-11 h-11 rounded-full hover:bg-muted flex items-center justify-center flex-shrink-0"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </Link>
          <h1 className="font-heading font-semibold text-foreground truncate flex-1 min-w-0 text-sm sm:text-base">
            {resource.title}
          </h1>
        </div>
      </div>

      {/* ── PDF scroll area ──────────────────────────────────────────── */}
      {/* Task 1: overflow-x-hidden + max-w-full, no hardcoded width */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto overflow-x-hidden max-w-full px-4 py-4"
      >
        <div className="flex justify-center">
          <Document
            file={resource.pdf_url}
            onLoadSuccess={onLoaded}
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

      {/* ── Task 5: Permanent compact bottom toolbar ─────────────────── */}
      <div className="flex-shrink-0 bg-background border-t border-gray-100 shadow-[0_-2px_8px_rgba(0,0,0,0.06)] h-[52px] flex items-center px-2 gap-1 z-20">
        {/* Prev */}
        <Button
          size="icon"
          variant="ghost"
          className="h-10 w-10 rounded-full flex-shrink-0"
          onClick={() => goToPage(page - 1)}
          disabled={page <= 1}
          aria-label="Previous page"
        >
          <ChevronLeft className="w-5 h-5" />
        </Button>

        {/* Page input */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {editingPage ? (
            <input
              autoFocus
              type="number"
              min={1}
              max={numPages}
              value={pageInput}
              onChange={(e) => setPageInput(e.target.value)}
              onBlur={commitPageInput}
              onKeyDown={(e) => { if (e.key === "Enter") commitPageInput(); if (e.key === "Escape") setEditingPage(false); }}
              className="w-12 text-center text-sm font-medium border border-border rounded-md h-8 focus:outline-none focus:ring-1 focus:ring-primary"
            />
          ) : (
            <button
              onClick={() => { setEditingPage(true); setPageInput(String(page)); }}
              className="text-sm font-medium text-foreground min-w-[56px] text-center px-1 py-1 rounded hover:bg-muted"
            >
              {page} / {numPages || "—"}
            </button>
          )}
        </div>

        {/* Next */}
        <Button
          size="icon"
          variant="ghost"
          className="h-10 w-10 rounded-full flex-shrink-0"
          onClick={() => goToPage(page + 1)}
          disabled={page >= numPages}
          aria-label="Next page"
        >
          <ChevronRight className="w-5 h-5" />
        </Button>

        <div className="w-px h-6 bg-border mx-1 flex-shrink-0" />

        {/* Zoom out */}
        <Button
          size="icon"
          variant="ghost"
          className="h-10 w-10 rounded-full flex-shrink-0"
          onClick={() => setScale((s) => Math.max(0.5, +(s - 0.15).toFixed(2)))}
          aria-label="Zoom out"
        >
          <ZoomOut className="w-4 h-4" />
        </Button>

        {/* Zoom % — hidden on mobile */}
        <span className="hidden sm:block text-xs text-muted-foreground w-10 text-center flex-shrink-0">
          {Math.round(scale * 100)}%
        </span>

        {/* Zoom in */}
        <Button
          size="icon"
          variant="ghost"
          className="h-10 w-10 rounded-full flex-shrink-0"
          onClick={() => setScale((s) => Math.min(3.0, +(s + 0.15).toFixed(2)))}
          aria-label="Zoom in"
        >
          <ZoomIn className="w-4 h-4" />
        </Button>

        <div className="w-px h-6 bg-border mx-1 flex-shrink-0" />

        {/* Fullscreen */}
        <Button
          size="icon"
          variant="ghost"
          className="h-10 w-10 rounded-full flex-shrink-0"
          onClick={fullscreen}
          aria-label="Fullscreen"
        >
          <Maximize className="w-4 h-4" />
        </Button>

        {/* Download — only if allowed */}
        {resource.allow_download && (
          <a
            href={resource.pdf_url}
            download
            target="_blank"
            rel="noreferrer"
            aria-label="Download"
            className="h-10 w-10 rounded-full hover:bg-muted flex items-center justify-center flex-shrink-0"
          >
            <Download className="w-4 h-4 text-foreground" />
          </a>
        )}

        {/* Spacer pushes AI button to far right */}
        <div className="flex-1" />

        {/* AI assistant FAB — stays in toolbar, right side, above content */}
        <button
          onClick={() => setIsAIOpen(true)}
          className="h-10 w-10 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-md hover:scale-105 active:scale-95 transition-all flex items-center justify-center flex-shrink-0"
          aria-label="Open AI Assistant"
        >
          <Sparkles className="w-4 h-4" />
        </button>
      </div>

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
