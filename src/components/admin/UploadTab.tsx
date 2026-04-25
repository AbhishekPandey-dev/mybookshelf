import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { UploadCloud, FileText, Trash2, Loader2, CheckCircle2, Copy, Plus } from "lucide-react";
import { toast } from "sonner";
import { colorOptions } from "@/lib/colorMap";
import type { Subject } from "@/types";

const EMOJI_OPTIONS = ["📚","📖","📕","📗","📘","📙","🧪","🔬","🧮","🌍","🎨","🎵","💻","⚛️","📐","🧠","✏️","🔭","🌱","⚙️"];

interface Props {
  subjects: Subject[];
  onDone: () => void;
}

export default function UploadTab({ subjects, onDone }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState<{ link: string; title: string } | null>(null);
  const [subjectId, setSubjectId] = useState("");
  const [showNewSubject, setShowNewSubject] = useState(false);
  const [newSubject, setNewSubject] = useState({ name: "", icon: "📚", color: "indigo" });
  const [title, setTitle] = useState("");
  const [contentType, setContentType] = useState<"full" | "unit" | "part">("unit");
  const [unitNumber, setUnitNumber] = useState("");
  const [description, setDescription] = useState("");
  const [gradeLevel, setGradeLevel] = useState("");
  const [allowDownload, setAllowDownload] = useState(true);

  const onPickFile = (f: File | null): void => {
    if (!f) return;
    if (f.type !== "application/pdf") { toast.error("Please select a PDF file"); return; }
    setFile(f);
    if (!title) setTitle(f.name.replace(/\.pdf$/i, ""));
    setSuccess(null);
  };

  const createSubject = async (): Promise<void> => {
    if (!newSubject.name.trim()) { toast.error("Subject name required"); return; }
    try {
      const { data, error } = await supabase.from("subjects")
        .insert({ name: newSubject.name.trim(), icon: newSubject.icon, color: newSubject.color, order_index: subjects.length })
        .select().single();
      if (error) throw error;
      toast.success("Subject created");
      setShowNewSubject(false);
      setNewSubject({ name: "", icon: "📚", color: "indigo" });
      setSubjectId(data.id);
      onDone();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  const upload = async (): Promise<void> => {
    if (!file) { toast.error("Please select a PDF"); return; }
    if (!subjectId) { toast.error("Please choose a subject"); return; }
    if (!title.trim()) { toast.error("Title required"); return; }
    setBusy(true);
    try {
      const path = `${subjectId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const { error: upErr } = await supabase.storage.from("pdfs").upload(path, file, { contentType: "application/pdf" });
      if (upErr) throw upErr;
      const { data: { publicUrl } } = supabase.storage.from("pdfs").getPublicUrl(path);
      const { data: peers } = await supabase.from("resources").select("id").eq("subject_id", subjectId);
      const { data: inserted, error: insErr } = await supabase.from("resources")
        .insert({ 
          subject_id: subjectId, 
          title: title.trim(), 
          description: description.trim() || null, 
          content_type: contentType, 
          unit_number: contentType !== "full" ? unitNumber.trim() || null : null, 
          grade_level: gradeLevel.trim() || null,
          pdf_url: publicUrl, 
          pdf_path: path, 
          allow_download: allowDownload, 
          cover_emoji: "📄", 
          cover_color: "indigo", 
          order_index: peers?.length ?? 0 
        })
        .select().single();
      if (insErr) throw insErr;
      setSuccess({ link: `${window.location.origin}/read/${inserted.id}`, title: title.trim() });
      setFile(null); setTitle(""); setUnitNumber(""); setDescription(""); setGradeLevel("");
      onDone();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally { setBusy(false); }
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="font-heading font-bold text-3xl text-foreground mb-1">Upload PDF</h1>
        <p className="text-muted-foreground text-sm">Add a new resource for your students.</p>
      </div>
      <Card
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); onPickFile(e.dataTransfer.files?.[0] ?? null); }}
        onClick={() => document.getElementById("pdf-file-input")?.click()}
        className={`p-10 text-center cursor-pointer border-2 border-dashed transition-all ${dragOver ? "border-primary bg-primary-soft" : "border-border hover:border-primary/50"}`}
      >
        <input id="pdf-file-input" type="file" accept="application/pdf" className="hidden" onChange={(e) => onPickFile(e.target.files?.[0] ?? null)} />
        <UploadCloud className={`w-14 h-14 mx-auto mb-4 ${dragOver ? "text-primary" : "text-muted-foreground"}`} />
        <p className="font-heading font-semibold text-foreground mb-1">Drop your PDF here or click to browse</p>
        <p className="text-sm text-muted-foreground">PDF files only · Max 50 MB</p>
      </Card>

      {file && (
        <Card className="p-4 flex items-center gap-3 animate-fade-in">
          <div className="w-10 h-10 rounded-input bg-primary-soft text-primary flex items-center justify-center"><FileText className="w-5 h-5" /></div>
          <div className="flex-1 min-w-0">
            <div className="font-medium truncate">{file.name}</div>
            <div className="text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(2)} MB</div>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setFile(null)}><Trash2 className="w-4 h-4" /></Button>
        </Card>
      )}

      {file && (
        <Card className="p-6 space-y-5 animate-fade-in">
          <div className="space-y-1.5">
            <Label>Subject</Label>
            <Select value={subjectId} onValueChange={(v) => v === "__new__" ? setShowNewSubject(true) : setSubjectId(v)}>
              <SelectTrigger><SelectValue placeholder="Choose a subject" /></SelectTrigger>
              <SelectContent>
                {subjects.map((s) => <SelectItem key={s.id} value={s.id}>{s.icon} {s.name}</SelectItem>)}
                <SelectItem value="__new__"><span className="text-primary font-medium">+ New Subject</span></SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="title">Title</Label>
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Algebra Basics" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="grade">Grade Level (optional)</Label>
            <Input id="grade" value={gradeLevel} onChange={(e) => setGradeLevel(e.target.value)} placeholder="e.g. Grade 10" />
          </div>
          <div className="space-y-1.5">
            <Label>Content Type</Label>
            <div className="grid grid-cols-3 gap-2">
              {(["full", "unit", "part"] as const).map((t) => (
                <button key={t} type="button" onClick={() => setContentType(t)}
                  className={`h-12 rounded-button border text-sm font-medium press transition-smooth ${contentType === t ? "border-primary bg-primary-soft text-primary" : "border-border bg-card text-foreground hover:border-primary/40"}`}>
                  {{ full: "Full Book", unit: "Unit", part: "Chapter / Part" }[t]}
                </button>
              ))}
            </div>
          </div>
          {contentType !== "full" && (
            <div className="space-y-1.5 animate-fade-in">
              <Label htmlFor="unit">Unit / Part Number</Label>
              <Input id="unit" value={unitNumber} onChange={(e) => setUnitNumber(e.target.value)} placeholder="e.g. Unit 3" />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="desc">Short Description (optional)</Label>
            <Textarea id="desc" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="A short note for students…" />
          </div>
          <div className="flex items-center justify-between py-2">
            <Label htmlFor="allow-download" className="cursor-pointer">Allow students to download?</Label>
            <Switch id="allow-download" checked={allowDownload} onCheckedChange={setAllowDownload} />
          </div>
          <Button onClick={upload} disabled={busy} size="lg" className="w-full">
            {busy ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Uploading…</> : <>Upload & Publish</>}
          </Button>
        </Card>
      )}

      {success && (
        <Card className="p-5 bg-success/10 border-success/30 animate-scale-in">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-success text-success-foreground flex items-center justify-center"><CheckCircle2 className="w-6 h-6" /></div>
            <div className="flex-1 min-w-0">
              <div className="font-heading font-semibold text-foreground">Published!</div>
              <div className="text-sm text-muted-foreground truncate">"{success.title}" is now live.</div>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-card rounded-input border border-border p-2">
            <code className="flex-1 text-xs text-muted-foreground truncate px-2">{success.link}</code>
            <Button size="sm" onClick={async () => { await navigator.clipboard.writeText(success.link); toast.success("Link copied!"); }}><Copy className="w-3.5 h-3.5 mr-1" /> Copy Link</Button>
          </div>
        </Card>
      )}

      <Dialog open={showNewSubject} onOpenChange={setShowNewSubject}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-heading">New Subject</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input value={newSubject.name} onChange={(e) => setNewSubject({ ...newSubject, name: e.target.value })} placeholder="e.g. Mathematics" />
            </div>
            <div className="space-y-1.5">
              <Label>Icon</Label>
              <div className="flex flex-wrap gap-2">
                {EMOJI_OPTIONS.map((e) => (
                  <button key={e} type="button" onClick={() => setNewSubject({ ...newSubject, icon: e })}
                    className={`w-10 h-10 rounded-input text-xl press transition-smooth ${newSubject.icon === e ? "bg-primary-soft ring-2 ring-primary" : "bg-muted hover:bg-muted/70"}`}>{e}</button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Color</Label>
              <div className="flex flex-wrap gap-2">
                {colorOptions.map((c) => (
                  <button key={c.name} type="button" onClick={() => setNewSubject({ ...newSubject, color: c.name })}
                    className={`w-9 h-9 rounded-full ${c.bg} press transition-smooth ${newSubject.color === c.name ? "ring-2 ring-offset-2 ring-foreground scale-110" : ""}`}
                    aria-label={c.name} />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowNewSubject(false)}>Cancel</Button>
            <Button onClick={createSubject}><Plus className="w-4 h-4 mr-1" /> Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
