import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { TeacherSettings } from "@/types";

interface Props {
  settings: TeacherSettings | null;
  onChange: () => void;
}

export default function SettingsTab({ settings, onChange }: Props) {
  const { user } = useAuth();
  const [form, setForm] = useState({ site_name: "", tagline: "", teacher_name: "" });
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (settings) {
      setForm({
        site_name: settings.site_name || "",
        tagline: settings.tagline || "",
        teacher_name: settings.teacher_name || "",
      });
    }
  }, [settings]);

  const save = async (): Promise<void> => {
    if (!settings) return;
    setBusy(true);
    try {
      const { error } = await supabase
        .from("teacher_settings")
        .update({ site_name: form.site_name, tagline: form.tagline, teacher_name: form.teacher_name, updated_at: new Date().toISOString() })
        .eq("id", settings.id);
      if (error) throw error;
      if (password.trim().length >= 6) {
        const { error: pErr } = await supabase.auth.updateUser({ password });
        if (pErr) throw pErr;
        setPassword("");
      }
      toast.success("Settings saved");
      onChange();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div>
        <h1 className="font-heading font-bold text-3xl text-foreground mb-1">Settings</h1>
        <p className="text-muted-foreground text-sm">Customize your site and account.</p>
      </div>
      <Card className="p-6 space-y-5">
        <div className="space-y-1.5">
          <Label>Site Name</Label>
          <Input value={form.site_name} onChange={(e) => setForm({ ...form, site_name: e.target.value })} placeholder="MyBookshelf" />
        </div>
        <div className="space-y-1.5">
          <Label>Tagline</Label>
          <Input value={form.tagline} onChange={(e) => setForm({ ...form, tagline: e.target.value })} placeholder="Learn anywhere, anytime." />
        </div>
        <div className="space-y-1.5">
          <Label>Your Name</Label>
          <Input value={form.teacher_name} onChange={(e) => setForm({ ...form, teacher_name: e.target.value })} placeholder="Mr. / Ms. ..." />
        </div>
        <div className="space-y-1.5">
          <Label>Change Password</Label>
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Leave blank to keep current" minLength={6} />
          <p className="text-xs text-muted-foreground">Signed in as {user?.email}</p>
        </div>
        <Button onClick={save} disabled={busy} size="lg" className="w-full">
          {busy ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving…</> : "Save Changes"}
        </Button>
      </Card>
    </div>
  );
}
