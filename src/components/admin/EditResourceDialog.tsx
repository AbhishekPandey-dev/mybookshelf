import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import type { Resource, Subject } from "@/types";

interface Props {
  resource: Resource;
  subjects: Subject[];
  onClose: () => void;
  onSaved: () => void;
}

type FormState = {
  title: string;
  description: string;
  subject_id: string;
  content_type: "full" | "unit" | "part";
  unit_number: string;
  cover_emoji: string;
  allow_download: boolean;
};

export default function EditResourceDialog({ resource, subjects, onClose, onSaved }: Props) {
  const [form, setForm] = useState<FormState>({
    title: resource.title,
    description: resource.description ?? "",
    subject_id: resource.subject_id,
    content_type: resource.content_type,
    unit_number: resource.unit_number ?? "",
    cover_emoji: resource.cover_emoji ?? "📄",
    allow_download: resource.allow_download,
  });
  const [busy, setBusy] = useState(false);

  const save = async (): Promise<void> => {
    setBusy(true);
    try {
      const { error } = await supabase
        .from("resources")
        .update({
          title: form.title,
          description: form.description || null,
          subject_id: form.subject_id,
          content_type: form.content_type,
          unit_number: form.unit_number || null,
          cover_emoji: form.cover_emoji || "📄",
          allow_download: form.allow_download,
        })
        .eq("id", resource.id);
      if (error) throw error;
      toast.success("Saved");
      onSaved();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-heading">Edit Resource</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Subject</Label>
            <Select value={form.subject_id} onValueChange={(v) => setForm({ ...form, subject_id: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {subjects.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.icon} {s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Content Type</Label>
            <Select value={form.content_type} onValueChange={(v) => setForm({ ...form, content_type: v as FormState["content_type"] })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="full">Full Book</SelectItem>
                <SelectItem value="unit">Unit</SelectItem>
                <SelectItem value="part">Chapter / Part</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {form.content_type !== "full" && (
            <div className="space-y-1.5">
              <Label>Unit / Part Number</Label>
              <Input value={form.unit_number} onChange={(e) => setForm({ ...form, unit_number: e.target.value })} />
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="flex items-center justify-between py-1">
            <Label className="cursor-pointer">Allow download</Label>
            <Switch checked={form.allow_download} onCheckedChange={(v) => setForm({ ...form, allow_download: v })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={busy}>Save Changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
