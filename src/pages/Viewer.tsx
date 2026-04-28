import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import ErrorBoundary from "@/components/ErrorBoundary";

import { Link, useParams } from "react-router-dom";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ArrowLeft, ZoomIn, ZoomOut, Maximize, Download, Loader2,
  Search, X, ChevronUp, ChevronDown, LayoutPanelLeft,
  ChevronLeft, ChevronRight, Hash
} from "lucide-react";
import AIAssistant from "@/components/AIAssistant";
import { toast } from "sonner";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useVibration } from "@/hooks/useVibration";

pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

const PDF_OPTIONS = {
  cMapUrl: `https://unpkg.com/pdfjs-dist@${pdfjs.version}/cmaps/`,
  cMapPacked: true,
  standardFontDataUrl: `https://unpkg.com/pdfjs-dist@${pdfjs.version}/standard_fonts/`,
};


type Resource = {
  id: string; title: string; pdf_url: string; allow_download: boolean; subject_id: string;
};

// Lazy Page Component to improve performance with aggressive DOM culling
const LazyPage = ({ pageNum, width, scale, highlightTerm, onVisible }: { 
  pageNum: number; 
  width: number; 
  scale: number; 
  highlightTerm: string;
  onVisible: (pageNum: number) => void;
}) => {
  const [isRendered, setIsRendered] = useState(false);
  const [actualHeight, setActualHeight] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Observer to unmount DOM nodes that are far out of view
    const renderObserver = new IntersectionObserver(
      ([entry]) => setIsRendered(entry.isIntersecting),
      { rootMargin: "800px 0px" } // Reduced margin for better performance
    );

    // Observer to determine the "active" reading page
    const visibleObserver = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) onVisible(pageNum);
      },
      { rootMargin: "-45% 0px -45% 0px" }
    );

    if (containerRef.current) {
      renderObserver.observe(containerRef.current);
      visibleObserver.observe(containerRef.current);
    }
    return () => {
      renderObserver.disconnect();
      visibleObserver.disconnect();
    };
  }, [pageNum, onVisible]);

  // Use the actual height once loaded to prevent scroll jumping
  const estimatedHeight = actualHeight ? actualHeight * scale : width * scale * 1.414;

  return (
    <div
      ref={containerRef}
      data-page={pageNum}
      className="relative mb-6 last:mb-0 transition-opacity duration-500 flex justify-center"
      style={{ 
        minHeight: `${estimatedHeight}px`,
        width: `${width * scale}px`
      }}
    >
      <div 
        className={`w-full transition-all duration-700 ${isRendered ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}
      >
        {isRendered ? (
          <ErrorBoundary name={`Page ${pageNum}`} fallback={<div className="h-full flex items-center justify-center text-xs text-muted-foreground">Rendering Page {pageNum}...</div>}>
            <Page
              pageNumber={pageNum}
              width={width * scale}
              className="shadow-[0_20px_50px_rgba(0,0,0,0.1)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.3)] rounded-xl overflow-hidden bg-white dark:bg-zinc-900 ring-1 ring-black/5 dark:ring-white/10 transition-transform duration-300"
              renderTextLayer
              renderAnnotationLayer
              onLoadSuccess={(page: any) => {
                if (page.originalWidth && page.originalHeight) {
                  const ratio = page.originalHeight / page.originalWidth;
                  setActualHeight(width * ratio);
                }
              }}
              loading={
                <div className="flex items-center justify-center bg-card/50 rounded-xl border border-border w-full" style={{ height: `${estimatedHeight}px` }}>
                  <Loader2 className="w-6 h-6 animate-spin text-primary/40" />
                </div>
              }
              customTextRenderer={highlightTerm ? ({ str }: any) => {
                const safe = highlightTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
                return str.replace(new RegExp(`(${safe})`, "gi"), `<mark class="pdf-hl">$1</mark>`);
              } : undefined}
            />
          </ErrorBoundary>
        ) : (
          <div className="w-full h-full bg-muted/5 rounded-xl flex items-center justify-center border border-dashed border-border/30" style={{ height: `${estimatedHeight}px` }}>
            <div className="flex flex-col items-center gap-3 text-muted-foreground/20">
              <Loader2 className="w-6 h-6 animate-spin" />
              <span className="text-[10px] font-bold uppercase tracking-[0.2em]">Buffering Page {pageNum}</span>
            </div>
          </div>
        )}
        <div className="absolute -left-2 top-2 sm:left-4 px-3 py-1.5 rounded-full bg-background/90 backdrop-blur-md text-[10px] text-primary font-bold shadow-lg border border-primary/20 z-10 pointer-events-none tracking-tighter">
          P. {pageNum}
        </div>
      </div>
    </div>
  );
};

// Lazy Thumbnail for sidebar to avoid loading 100s of pdf canvas simultaneously
const LazyThumbnail = ({ pageNum, currentPage, pdf, onClick }: { pageNum: number, currentPage: number, pdf: any, onClick: () => void }) => {
  const [isVisible, setIsVisible] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => setIsVisible(entry.isIntersecting),
      { rootMargin: "600px 0px" }
    );
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div 
      ref={containerRef}
      className={`group cursor-pointer transition-all duration-300 ${currentPage === pageNum ? "scale-[1.02]" : "opacity-70 hover:opacity-100"}`}
      onClick={onClick}
    >
      <ErrorBoundary name={`Thumbnail ${pageNum}`}>
        <div className={`relative aspect-[1/1.41] rounded-lg border-2 transition-all shadow-sm bg-card flex items-center justify-center overflow-hidden ${currentPage === pageNum ? "border-primary ring-4 ring-primary/10" : "border-border hover:border-primary/40"}`}>
          {isVisible && pdf ? (
            <Page
              pdf={pdf}
              pageNumber={pageNum}
              width={160} // Fixed small width for thumbnail
              renderTextLayer={false}
              renderAnnotationLayer={false}
              loading={<Loader2 className="w-4 h-4 animate-spin text-muted-foreground/30" />}
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="text-2xl font-bold text-muted-foreground/20">{pageNum}</span>
          )}
        </div>
      </ErrorBoundary>
      <div className={`text-center mt-1.5 text-[10px] font-bold transition-colors ${currentPage === pageNum ? "text-primary" : "text-muted-foreground"}`}>
        PAGE {pageNum}
      </div>
    </div>
  );
};

export default function Viewer() {
  const { id } = useParams();
  const [resource, setResource] = useState<Resource | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [width, setWidth] = useState<number>(800);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [pdfText, setPdfText] = useState("");
  const [pageTexts, setPageTexts] = useState<Record<number, string>>({});
  const [pdfObject, setPdfObject] = useState<any>(null);
  
  // Navigation & UI state
  const [toolbarVisible, setToolbarVisible] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [searchHits, setSearchHits] = useState<{ page: number; snippet: string }[]>([]);
  const [activeHit, setActiveHit] = useState(0);
  const [isJumpInputOpen, setIsJumpInputOpen] = useState(false);
  const [jumpPage, setJumpPage] = useState("");

  const { vibrateLight, vibrateMedium, vibrateSuccess } = useVibration();
  const hideTimer = useRef<number | null>(null);

  const showToolbar = useCallback(() => {
    setToolbarVisible(true);
    if (hideTimer.current) window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => {
      if (!searchOpen && !isJumpInputOpen && !sidebarOpen) {
        setToolbarVisible(false);
      }
    }, 4000);
  }, [searchOpen, isJumpInputOpen, sidebarOpen]);

  useEffect(() => {
    showToolbar();
    return () => { if (hideTimer.current) window.clearTimeout(hideTimer.current); };
  }, [showToolbar]);

  useEffect(() => {
    if (!id) return;
    supabase.from("resources").select("id, title, pdf_url, allow_download, subject_id").eq("id", id).maybeSingle()
      .then(({ data }) => setResource(data));
  }, [id]);

  useEffect(() => {
    const onResize = () => {
      if (containerRef.current) {
        const availableWidth = containerRef.current.clientWidth;
        // On mobile, use more width. On desktop, cap it for readability.
        const padding = window.innerWidth < 640 ? 16 : 48;
        setWidth(Math.min(availableWidth - padding, 900));
      }
    };
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [resource, sidebarOpen]);

  // Background text extraction with cancellation support
  useEffect(() => {
    if (!numPages || !resource) return;

    let isCancelled = false;
    const extractText = async () => {
      try {
        // We need to get the PDF object again or use a ref, 
        // but react-pdf doesn't expose the pdf object easily outside onLoadSuccess
        // So we'll trigger extraction only when onLoadSuccess provides it.
      } catch (e) {
        console.error("Extraction error", e);
      }
    };

    return () => { isCancelled = true; };
  }, [numPages, resource]);

  const isMounted = useRef(true);
  useEffect(() => {
    return () => { isMounted.current = false; };
  }, []);

  const onLoaded = (pdf: any) => {
    setNumPages(pdf.numPages);
    setPdfObject(pdf);
    vibrateSuccess();
    
    // Controlled background extraction
    const extractionTask = async () => {
      if (!isMounted.current) return;
      
      let all = "";
      const map: Record<number, string> = {};
      const limit = Math.min(pdf.numPages, 100); // Reduce limit for stability
      
      for (let i = 1; i <= limit; i++) {
        try {
          if (!isMounted.current || !pdf || pdf.destroyed) break;
          
          const p = await pdf.getPage(i);
          const tc = await p.getTextContent();
          const txt = tc.items.map((it: any) => (it as any).str).join(" ");
          map[i] = txt;
          all += `\n--- Page ${i} ---\n${txt}`;
          
          if (i % 5 === 0) { // More frequent updates but smaller chunks
            if (isMounted.current) {
              setPageTexts(prev => ({ ...prev, ...map }));
              setPdfText(all);
            }
            await new Promise(r => setTimeout(r, 100)); // Be gentler to the worker
          }
        } catch (e) {
          if (e instanceof Error && (e.message.includes("destroyed") || e.message.includes("null"))) break;
          console.warn("Extraction skipped page " + i, e);
        }
      }
      
      if (isMounted.current) {
        setPdfText(all);
        setPageTexts(prev => ({ ...prev, ...map }));
      }
    };

    // Delay extraction to prioritize initial rendering
    setTimeout(() => {
      if (isMounted.current) extractionTask();
    }, 2000);
  };

  const scrollToPage = useCallback((pageNum: number, instant = false) => {
    const el = document.querySelector(`[data-page="${pageNum}"]`);
    if (el && scrollContainerRef.current) {
      // Calculate offset to align top of page nicely
      const scrollParent = scrollContainerRef.current;
      const elTop = (el as HTMLElement).offsetTop;
      scrollParent.scrollTo({
        top: elTop - 20, // 20px top padding
        behavior: instant ? "auto" : "smooth"
      });
    }
  }, []);

  const handleJumpToPage = (e: React.FormEvent) => {
    e.preventDefault();
    const p = parseInt(jumpPage);
    if (p >= 1 && p <= numPages) {
      scrollToPage(p);
      setIsJumpInputOpen(false);
      setJumpPage("");
      vibrateMedium();
    } else {
      toast.error(`Please enter a page between 1 and ${numPages}`);
    }
  };

  // Search logic
  useEffect(() => {
    const q = query.trim().toLowerCase();
    if (!q || q.length < 2) { setSearchHits([]); setActiveHit(0); return; }
    
    const hits: { page: number; snippet: string }[] = [];
    Object.entries(pageTexts).forEach(([pStr, text]) => {
      const lower = text.toLowerCase();
      let idx = lower.indexOf(q);
      while (idx !== -1 && hits.length < 50) {
        const start = Math.max(0, idx - 30);
        const end = Math.min(text.length, idx + q.length + 30);
        hits.push({ page: Number(pStr), snippet: text.slice(start, end) });
        idx = lower.indexOf(q, idx + q.length);
      }
    });
    setSearchHits(hits.sort((a, b) => a.page - b.page));
    setActiveHit(0);
  }, [query, pageTexts]);

  const jumpToHit = (i: number) => {
    if (!searchHits.length) return;
    const next = (i + searchHits.length) % searchHits.length;
    setActiveHit(next);
    scrollToPage(searchHits[next].page);
    vibrateLight();
  };

  const highlightTerm = useMemo(() => query.trim(), [query]);

  if (!resource) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4">
        <div className="relative w-16 h-16">
          <div className="absolute inset-0 rounded-full border-4 border-primary/20" />
          <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin" />
        </div>
        <p className="text-muted-foreground font-medium animate-pulse">Loading Document...</p>
      </div>
    );
  }

  // Calculate reading progress (0 to 100)
  const progressPercent = numPages > 0 ? (currentPage / numPages) * 100 : 0;

  return (
    <div
      className="fixed inset-0 bg-muted/20 flex flex-col overflow-hidden selection:bg-primary/20"
      onMouseMove={showToolbar}
      onTouchStart={showToolbar}
    >
      {/* Top Reading Progress Bar */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-transparent z-50">
        <div 
          className="h-full bg-primary/80 transition-all duration-300 ease-out"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Top bar */}
      <div className={`absolute top-0 left-0 right-0 z-40 transition-all duration-500 ease-out ${toolbarVisible ? "translate-y-0 opacity-100" : "-translate-y-full opacity-0 pointer-events-none"}`}>
        <div className="bg-background/80 backdrop-blur-xl border-b border-border/50 shadow-sm pt-1">
          <div className="px-2 sm:px-4 h-14 sm:h-16 flex items-center gap-1 sm:gap-2">
            <Link 
              to={`/subject/${resource.subject_id}`} 
              className="w-10 h-10 rounded-xl hover:bg-muted flex items-center justify-center transition-all active:scale-90" 
              aria-label="Back"
              onClick={() => vibrateLight()}
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            
            <button
              onClick={() => { setSidebarOpen(!sidebarOpen); vibrateLight(); }}
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all active:scale-90 z-[70] ${sidebarOpen ? "bg-primary text-primary-foreground shadow-lg" : "hover:bg-muted text-foreground"}`}
              aria-label="Thumbnails"
            >
              <LayoutPanelLeft className="w-5 h-5" />
            </button>

            <div className="flex-1 min-w-0 px-2">
              <h1 className="font-heading font-semibold text-foreground truncate text-sm sm:text-base leading-tight">
                {resource.title}
              </h1>
              <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider hidden sm:block">
                Digital Resource • {numPages} Pages
              </p>
            </div>

            <div className="flex items-center gap-1 sm:gap-2">
              <button
                onClick={() => { setSearchOpen(!searchOpen); vibrateLight(); }}
                className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all active:scale-90 ${searchOpen ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" : "hover:bg-muted text-foreground"}`}
                aria-label="Search"
              >
                <Search className="w-5 h-5" />
              </button>
              
              {resource.allow_download && (
                <a 
                  href={resource.pdf_url} 
                  download 
                  target="_blank" 
                  rel="noreferrer" 
                  className="w-10 h-10 rounded-xl hover:bg-muted flex items-center justify-center transition-all active:scale-90 hidden sm:flex" 
                  aria-label="Download"
                  onClick={() => vibrateMedium()}
                >
                  <Download className="w-5 h-5" />
                </a>
              )}
              <ThemeToggle />
            </div>
          </div>

          {/* Search bar expanded */}
          {searchOpen && (
            <div className="border-t border-border/50 bg-background/95 backdrop-blur-md animate-in slide-in-from-top duration-300">
              <div className="px-4 py-3 flex items-center gap-3">
                <div className="relative flex-1 group">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                  <Input
                    autoFocus
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") jumpToHit(activeHit + (e.shiftKey ? -1 : 1));
                      if (e.key === "Escape") setSearchOpen(false);
                    }}
                    placeholder="Find text in document..."
                    className="pl-10 h-11 bg-muted/30 border-none rounded-xl focus-visible:ring-2 focus-visible:ring-primary/20"
                  />
                </div>
                <div className="flex items-center gap-1">
                  <div className="text-[11px] font-bold text-muted-foreground tabular-nums px-2 bg-muted/50 rounded-lg h-11 flex items-center min-w-[70px] justify-center">
                    {searchHits.length ? `${activeHit + 1}/${searchHits.length}` : "0/0"}
                  </div>
                  <Button size="icon" variant="ghost" className="h-11 w-11 rounded-xl" disabled={!searchHits.length} onClick={() => jumpToHit(activeHit - 1)}>
                    <ChevronUp className="w-5 h-5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-11 w-11 rounded-xl" disabled={!searchHits.length} onClick={() => jumpToHit(activeHit + 1)}>
                    <ChevronDown className="w-5 h-5" />
                  </Button>
                </div>
              </div>

              {query.length > 1 && searchHits.length > 0 && (
                <div className="max-h-56 overflow-auto border-t border-border/40 bg-background/50 custom-scrollbar">
                  {searchHits.map((h, i) => (
                    <button
                      key={i}
                      onClick={() => jumpToHit(i)}
                      className={`w-full text-left px-5 py-3 text-xs sm:text-sm hover:bg-primary/5 transition-colors border-b border-border/30 last:border-none flex items-start gap-4 ${i === activeHit ? "bg-primary/10 border-l-4 border-l-primary" : ""}`}
                    >
                      <span className="bg-muted px-2 py-0.5 rounded text-[10px] font-bold text-muted-foreground shrink-0 mt-0.5">PAGE {h.page}</span>
                      <span className="text-foreground/80 line-clamp-2 italic">...{h.snippet}...</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden pt-14 sm:pt-16">
        {/* Thumbnails Sidebar */}
        <div 
          className={`fixed inset-y-0 left-0 h-full w-[280px] bg-background/95 backdrop-blur-2xl border-r border-border/50 transition-all duration-500 ease-in-out flex flex-col z-[80] ${sidebarOpen ? "translate-x-0 opacity-100 shadow-2xl visible" : "-translate-x-full opacity-0 shadow-none invisible"}`}
        >
          <div className="p-4 border-b border-border/50 flex items-center justify-between bg-muted/30">
            <div className="flex items-center gap-2">
              <LayoutPanelLeft className="w-4 h-4 text-primary" />
              <span className="text-[11px] font-bold uppercase tracking-widest text-foreground">Document Map</span>
            </div>
            <Button size="icon" variant="ghost" className="h-9 w-9 rounded-xl hover:bg-destructive/10 hover:text-destructive transition-colors" onClick={() => setSidebarOpen(false)}>
              <X className="w-5 h-5" />
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-5 custom-scrollbar bg-background/50">
            {Array.from({ length: numPages }, (_, i) => i + 1).map((pageNum) => (
              <LazyThumbnail 
                key={pageNum}
                pageNum={pageNum}
                currentPage={currentPage}
                pdf={pdfObject}
                onClick={() => { scrollToPage(pageNum); setSidebarOpen(window.innerWidth < 1024 ? false : true); vibrateLight(); }}
              />
            ))}
          </div>
        </div>

        {/* Sidebar Overlay for Mobile */}
        {sidebarOpen && (
          <div 
            className="fixed inset-0 bg-background/40 backdrop-blur-[2px] z-[75] animate-in fade-in duration-300 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* PDF Viewport */}
        <div 
          ref={scrollContainerRef}
          className={`flex-1 overflow-auto custom-scrollbar scroll-smooth relative bg-gradient-to-b from-muted/10 to-background/5 transition-all duration-500 ease-in-out ${sidebarOpen ? "lg:ml-[280px]" : ""}`}
        >
          <div ref={containerRef} className="flex flex-col items-center py-10 px-4 sm:py-12 sm:px-10 max-w-[100vw]">
            <Document
              file={resource.pdf_url}
              onLoadSuccess={onLoaded}
              options={PDF_OPTIONS}
              onLoadError={(error) => {
                console.error("PDF Load Error:", error);
                toast.error("Unable to render PDF", {
                  description: "There might be an issue with the file or your connection.",
                });
              }}
              loading={
                <div className="flex flex-col items-center justify-center p-20 gap-6 animate-in fade-in zoom-in-95 duration-700">
                  <div className="relative">
                    <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
                    <div className="relative w-16 h-16 rounded-full bg-gradient-to-tr from-primary to-primary/60 flex items-center justify-center shadow-xl shadow-primary/20">
                      <Loader2 className="w-8 h-8 animate-spin text-primary-foreground" />
                    </div>
                  </div>
                  <div className="text-center space-y-2">
                    <p className="text-base font-semibold text-foreground">Preparing your resource</p>
                    <p className="text-xs text-muted-foreground animate-pulse max-w-[200px]">Optimizing pages for a smooth reading experience...</p>
                  </div>
                </div>
              }
              error={
                <div className="flex flex-col items-center justify-center p-12 gap-4 bg-destructive/5 rounded-3xl border border-destructive/20 max-w-md mx-auto mt-20">
                  <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center text-destructive">
                    <X className="w-8 h-8" />
                  </div>
                  <h3 className="text-lg font-bold text-foreground">Failed to load PDF</h3>
                  <p className="text-sm text-muted-foreground text-center">
                    The document couldn't be loaded. This might be due to a network error or an invalid file format.
                  </p>
                  <Button onClick={() => window.location.reload()} variant="outline" className="rounded-xl mt-2">
                    Try Reloading
                  </Button>
                </div>
              }
            >
              {numPages > 0 && Array.from({ length: numPages }).map((_, i) => (
                <LazyPage
                  key={`${i + 1}-${scale}`}
                  pageNum={i + 1}
                  width={width}
                  scale={scale}
                  highlightTerm={highlightTerm}
                  onVisible={setCurrentPage}
                />
              ))}
            </Document>
          </div>
        </div>
      </div>

      {/* Dynamic Bottom Controls */}
      <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-40 transition-all duration-500 ease-out ${toolbarVisible ? "translate-y-0 opacity-100" : "translate-y-24 opacity-0 pointer-events-none"}`}>
        <div className="bg-background/90 backdrop-blur-2xl border border-border/50 shadow-2xl rounded-2xl p-1.5 flex items-center gap-1 sm:gap-1.5 ring-1 ring-black/5 dark:ring-white/5">
          
          <div className="flex items-center gap-0.5 mr-1">
            <Button 
              size="icon" 
              variant="ghost" 
              className="h-10 w-10 sm:h-11 sm:w-11 rounded-xl active:scale-90" 
              onClick={() => { scrollToPage(Math.max(1, currentPage - 1)); vibrateLight(); }}
              disabled={currentPage <= 1}
            >
              <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6" />
            </Button>
            
            <button 
              onClick={() => { setIsJumpInputOpen(!isJumpInputOpen); vibrateLight(); }}
              className={`px-3 sm:px-4 h-10 sm:h-11 rounded-xl text-xs sm:text-sm font-bold tabular-nums transition-colors flex items-center gap-1.5 sm:gap-2 hover:bg-muted ${isJumpInputOpen ? "bg-primary/10 text-primary" : "text-foreground"}`}
            >
              {currentPage} <span className="text-muted-foreground/50">/</span> {numPages}
            </button>

            <Button 
              size="icon" 
              variant="ghost" 
              className="h-10 w-10 sm:h-11 sm:w-11 rounded-xl active:scale-90" 
              onClick={() => { scrollToPage(Math.min(numPages, currentPage + 1)); vibrateLight(); }}
              disabled={currentPage >= numPages}
            >
              <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6" />
            </Button>
          </div>

          <div className="w-px h-6 bg-border/60 mx-0.5 hidden sm:block" />

          <div className="hidden sm:flex items-center gap-0.5">
            <Button 
              size="icon" 
              variant="ghost" 
              className="h-11 w-11 rounded-xl active:scale-90" 
              onClick={() => { vibrateLight(); setScale((s) => Math.max(0.4, +(s - 0.2).toFixed(2))); }}
            >
              <ZoomOut className="w-4 h-4" />
            </Button>
            <div className="text-[11px] font-bold w-12 text-center text-muted-foreground select-none">
              {Math.round(scale * 100)}%
            </div>
            <Button 
              size="icon" 
              variant="ghost" 
              className="h-11 w-11 rounded-xl active:scale-90" 
              onClick={() => { vibrateLight(); setScale((s) => Math.min(3, +(s + 0.2).toFixed(2))); }}
            >
              <ZoomIn className="w-4 h-4" />
            </Button>
          </div>

          <div className="w-px h-6 bg-border/60 mx-0.5 hidden sm:block" />

          <Button 
            size="icon" 
            variant="ghost" 
            className="h-10 w-10 sm:h-11 sm:w-11 rounded-xl active:scale-90 hidden sm:flex" 
            onClick={() => {
              const el = document.documentElement;
              if (document.fullscreenElement) document.exitFullscreen();
              else el.requestFullscreen();
              vibrateMedium();
            }}
          >
            <Maximize className="w-4 h-4" />
          </Button>
        </div>

        {/* Jump to page dialog */}
        {isJumpInputOpen && (
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-4 w-48 bg-background/95 backdrop-blur-xl border border-border/50 shadow-2xl rounded-2xl p-4 animate-in zoom-in-95 fade-in duration-200">
            <form onSubmit={handleJumpToPage} className="space-y-3">
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-1">Jump to Page</label>
              <div className="flex gap-2">
                <Input
                  autoFocus
                  type="number"
                  min={1}
                  max={numPages}
                  value={jumpPage}
                  onChange={(e) => setJumpPage(e.target.value)}
                  placeholder="e.g. 42"
                  className="h-10 bg-muted/30 border-none rounded-xl text-center font-bold"
                />
                <Button type="submit" size="icon" className="h-10 w-10 shrink-0 rounded-xl">
                  <ChevronRight className="w-5 h-5" />
                </Button>
              </div>
            </form>
          </div>
        )}
      </div>

      <ErrorBoundary name="AI Assistant">
        <AIAssistant pdfText={pdfText} currentPage={currentPage} pageTexts={pageTexts} />
      </ErrorBoundary>
      
      {/* Search results highligh CSS */}
      <style>{`
        .pdf-hl {
          background-color: hsl(var(--primary) / 0.4);
          border-bottom: 2px solid hsl(var(--primary));
          border-radius: 2px;
          color: inherit;
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: hsl(var(--border) / 0.8);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: hsl(var(--muted-foreground) / 0.5);
        }
      `}</style>
    </div>
  );
}
