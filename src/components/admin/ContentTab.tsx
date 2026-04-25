import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  BookOpen,
  UploadCloud,
  FileText,
  Trash2,
  Edit,
  ChevronUp,
  ChevronDown,
  Sparkles,
  Settings2
} from "lucide-react";
import { toast } from "sonner";
import { getColor } from "@/lib/colorMap";
import type { Subject, Resource, TeacherSettings } from "@/types";
import EditResourceDialog from "./EditResourceDialog";

interface Props {
  subjects: Subject[];
  resources: Resource[];
  settings: TeacherSettings | null;
  onChange: () => void;
}

function StatCard({
  label,
  value,
  icon: Icon,
  small,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  small?: boolean;
}) {
  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-input bg-primary-soft text-primary flex items-center justify-center flex-shrink-0">
          <Icon className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground">{label}</div>
          <div
            className={`font-heading font-bold text-foreground truncate ${small ? "text-base" : "text-2xl"}`}
          >
            {value}
          </div>
        </div>
      </div>
    </Card>
  );
}

function typeBadge(t: string): { label: string; cls: string } {
  const map: Record<string, { label: string; cls: string }> = {
    full: { label: "Full Book", cls: "bg-primary-soft text-primary" },
    unit: { label: "Unit", cls: "bg-emerald-100 text-emerald-700" },
    part: { label: "Chapter", cls: "bg-amber-100 text-amber-700" },
  };
  return map[t] ?? { label: t, cls: "bg-muted text-muted-foreground" };
}

export default function ContentTab({
  subjects,
  resources,
  onChange,
}: Props) {
  const [editing, setEditing] = useState<Resource | null>(null);

  const stats = useMemo(() => {
    const lastUpload = resources.reduce<Date | null>((acc, r) => {
      const d = r.created_at ? new Date(r.created_at) : null;
      if (!d) return acc;
      if (!acc || d > acc) return d;
      return acc;
    }, null);
    return {
      subjectCount: subjects.length,
      pdfCount: resources.length,
      lastUpload: lastUpload
        ? lastUpload.toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
            year: "numeric",
          })
        : "—",
    };
  }, [subjects, resources]);

  const del = async (r: Resource): Promise<void> => {
    if (!confirm(`Delete "${r.title}"?`)) return;
    try {
      if (r.pdf_path)
        await supabase.storage.from("pdfs").remove([r.pdf_path]);
      const { error } = await supabase
        .from("resources")
        .delete()
        .eq("id", r.id);
      if (error) throw error;
      toast.success("Deleted");
      onChange();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to delete");
    }
  };

  const move = async (r: Resource, dir: -1 | 1): Promise<void> => {
    const peers = resources
      .filter((x) => x.subject_id === r.subject_id)
      .sort((a, b) => a.order_index - b.order_index);
    const idx = peers.findIndex((x) => x.id === r.id);
    const swap = peers[idx + dir];
    if (!swap) return;
    try {
      await supabase
        .from("resources")
        .update({ order_index: swap.order_index })
        .eq("id", r.id);
      await supabase
        .from("resources")
        .update({ order_index: r.order_index })
        .eq("id", swap.id);
      onChange();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to reorder");
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading font-bold text-3xl text-foreground mb-1">
          Dashboard
        </h1>
        <p className="text-muted-foreground text-sm">
          Manage your subjects and uploaded PDFs.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3 sm:gap-5">
        <StatCard label="Subjects" value={stats.subjectCount} icon={BookOpen} />
        <StatCard label="PDFs" value={stats.pdfCount} icon={FileText} />
        <StatCard
          label="Last Upload"
          value={stats.lastUpload}
          icon={UploadCloud}
          small
        />
      </div>

      <div>
        <h2 className="font-heading font-bold text-xl text-foreground mb-3">
          My Content
        </h2>
        {subjects.length === 0 ? (
          <Card className="p-12 text-center border-dashed">
            <BookOpen className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground mb-4">
              No subjects yet. Upload your first PDF to get started.
            </p>
          </Card>
        ) : (
          <Accordion
            type="multiple"
            defaultValue={subjects.map((s) => s.id)}
            className="space-y-3"
          >
            {subjects.map((s) => {
              const items = resources.filter((r) => r.subject_id === s.id);
              const color = getColor(s.color);
              return (
                <AccordionItem key={s.id} value={s.id} className="border-0">
                  <Card className="overflow-hidden p-0">
                    <AccordionTrigger className="hover:no-underline px-5 py-4 [&[data-state=open]]:border-b [&[data-state=open]]:border-border">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div
                          className={`w-10 h-10 rounded-input ${color.bg} flex items-center justify-center text-xl flex-shrink-0`}
                        >
                          {s.icon}
                        </div>
                        <div className="text-left flex-1 min-w-0">
                          <div className="font-heading font-semibold text-foreground truncate">
                            {s.name}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {items.length} PDF{items.length === 1 ? "" : "s"}
                          </div>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      {items.length === 0 ? (
                        <div className="p-5 text-sm text-muted-foreground text-center">
                          No PDFs in this subject yet.
                        </div>
                      ) : (
                        <div className="divide-y divide-border">
                          {items.map((r, i) => {
                            const badge = typeBadge(r.content_type);
                            return (
                              <div
                                key={r.id}
                                className="px-5 py-4 flex items-center gap-4 flex-wrap hover:bg-muted/40 transition-smooth group"
                              >
                                <div className="w-12 h-12 rounded-xl bg-gray-50 dark:bg-gray-800/50 flex items-center justify-center text-2xl flex-shrink-0 group-hover:scale-110 transition-transform duration-300 shadow-sm border border-border/50">
                                  {r.cover_emoji || "📄"}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="font-heading font-bold text-foreground truncate text-sm sm:text-base">
                                    {r.title}
                                  </div>
                                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                    <span
                                      className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-lg border border-current opacity-70 ${badge.cls}`}
                                    >
                                      {badge.label}
                                    </span>
                                    {r.grade_level && (
                                      <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                                        {r.grade_level}
                                      </span>
                                    )}
                                    {r.unit_number && (
                                      <span className="text-xs font-medium text-muted-foreground bg-muted/50 px-2 py-0.5 rounded">
                                        {r.unit_number}
                                      </span>
                                    )}
                                    {r.ai_processed ? (
                                      <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/50">
                                        <Sparkles className="w-2.5 h-2.5" /> AI Ready
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-900/50 animate-pulse">
                                        <Settings2 className="w-2.5 h-2.5" /> Processing
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8 rounded-full"
                                    onClick={() => move(r, -1)}
                                    disabled={i === 0}
                                    aria-label="Move up"
                                  >
                                    <ChevronUp className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8 rounded-full"
                                    onClick={() => move(r, 1)}
                                    disabled={i === items.length - 1}
                                    aria-label="Move down"
                                  >
                                    <ChevronDown className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8 rounded-full hover:bg-indigo-50 dark:hover:bg-indigo-950 hover:text-indigo-600 dark:hover:text-indigo-400"
                                    onClick={() => setEditing(r)}
                                    aria-label="Edit"
                                  >
                                    <Edit className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8 rounded-full text-destructive hover:text-white hover:bg-destructive"
                                    onClick={() => del(r)}
                                    aria-label="Delete"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </AccordionContent>
                  </Card>
                </AccordionItem>
              );
            })}
          </Accordion>
        )}
      </div>

      {editing && (
        <EditResourceDialog
          resource={editing}
          subjects={subjects}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            onChange();
          }}
        />
      )}
    </div>
  );
}
