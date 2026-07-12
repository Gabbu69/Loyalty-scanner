"use client";

import { RotateCcw, Save, Store } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/app/page-header";
import { useLoyalty } from "@/components/app/loyalty-provider";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ProgramSettings as Settings } from "@/lib/data/types";

export function ProgramSettings() {
  const { snapshot, updateSettings, resetDemo, mode } = useLoyalty();
  if (!snapshot?.settings) return null;

  return (
    <ProgramSettingsEditor
      key={snapshot.settings.storeId}
      initialSettings={snapshot.settings}
      updateSettings={updateSettings}
      resetDemo={resetDemo}
      mode={mode}
    />
  );
}

function ProgramSettingsEditor({
  initialSettings,
  updateSettings,
  resetDemo,
  mode,
}: {
  initialSettings: Settings;
  updateSettings: (settings: Settings) => Promise<Settings>;
  resetDemo: () => Promise<void>;
  mode: "demo" | "production";
}) {
  const [form, setForm] = useState<Settings>(initialSettings);
  const [saving, setSaving] = useState(false);

  function set<K extends keyof Settings>(key: K, value: Settings[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function save() {
    const current = form;
    if (!current) return;
    if (!current.storeName.trim()) {
      toast.error("Store name is required.");
      return;
    }
    if (current.pointsPerVisit < 1 || current.cooldownMinutes < 1 || current.rewardCost < 1) {
      toast.error("Points, cooldown, and reward cost must be at least 1.");
      return;
    }
    setSaving(true);
    await updateSettings(current);
    setSaving(false);
    toast.success("Loyalty program updated");
  }

  return (
    <div className="space-y-7">
      <PageHeader eyebrow="Owner settings" title="Configure the loyalty program" description="These server-owned rules decide how every scan and redemption is processed." action={<Button onClick={save} disabled={saving}><Save />{saving ? "Saving..." : "Save changes"}</Button>} />

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="shadow-none">
          <CardHeader><CardTitle className="flex items-center gap-2"><Store className="size-5 text-primary" />Store details</CardTitle><CardDescription>Shown to staff and on customer loyalty cards.</CardDescription></CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2"><Label htmlFor="store-name">Store name</Label><Input id="store-name" value={form.storeName} onChange={(event) => set("storeName", event.target.value)} className="h-11" /></div>
            <div className="space-y-2"><Label htmlFor="timezone">Reporting timezone</Label><Select value={form.timezone} onValueChange={(value) => set("timezone", value)}><SelectTrigger id="timezone" className="h-11 w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Asia/Manila">Asia/Manila</SelectItem><SelectItem value="Asia/Singapore">Asia/Singapore</SelectItem><SelectItem value="UTC">UTC</SelectItem></SelectContent></Select></div>
          </CardContent>
        </Card>

        <Card className="shadow-none">
          <CardHeader><CardTitle>Visit points</CardTitle><CardDescription>The scanner never accepts a staff-entered point amount.</CardDescription></CardHeader>
          <CardContent className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2"><Label htmlFor="points">Points per valid visit</Label><Input id="points" type="number" min={1} max={1000} value={form.pointsPerVisit} onChange={(event) => set("pointsPerVisit", Number(event.target.value))} className="h-11" /></div>
            <div className="space-y-2"><Label htmlFor="cooldown">Duplicate cooldown (minutes)</Label><Input id="cooldown" type="number" min={1} max={10080} value={form.cooldownMinutes} onChange={(event) => set("cooldownMinutes", Number(event.target.value))} className="h-11" /></div>
          </CardContent>
        </Card>

        <Card className="shadow-none xl:col-span-2">
          <CardHeader className="flex-row items-start justify-between space-y-0">
            <div><CardTitle>Customer reward</CardTitle><CardDescription className="mt-1">The first version supports one active reward threshold.</CardDescription></div>
            <Button type="button" variant={form.rewardEnabled ? "default" : "outline"} size="sm" onClick={() => set("rewardEnabled", !form.rewardEnabled)}>{form.rewardEnabled ? "Enabled" : "Disabled"}</Button>
          </CardHeader>
          <CardContent className="grid gap-5 sm:grid-cols-[1fr_14rem]">
            <div className="space-y-2"><Label htmlFor="reward-name">Reward name</Label><Input id="reward-name" value={form.rewardName} onChange={(event) => set("rewardName", event.target.value)} disabled={!form.rewardEnabled} className="h-11" /></div>
            <div className="space-y-2"><Label htmlFor="reward-cost">Point cost</Label><Input id="reward-cost" type="number" min={1} value={form.rewardCost} onChange={(event) => set("rewardCost", Number(event.target.value))} disabled={!form.rewardEnabled} className="h-11" /></div>
            <div className="sm:col-span-2"><Badge variant="secondary">Customers cannot redeem below zero balance</Badge></div>
          </CardContent>
        </Card>
      </div>

      {mode === "demo" ? (
        <Card className="border-amber-200 bg-amber-50/70 shadow-none">
          <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div><p className="font-semibold text-amber-950">Reset demo data</p><p className="mt-1 text-sm text-amber-900/75">Restore the sample customers, points, and activity on this device.</p></div>
            <AlertDialog>
              <AlertDialogTrigger asChild><Button variant="outline" className="border-amber-300 bg-white text-amber-950"><RotateCcw />Reset demo</Button></AlertDialogTrigger>
              <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Reset all demo data?</AlertDialogTitle><AlertDialogDescription>Any customers or points created in demo mode will be replaced with the original sample data.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Keep data</AlertDialogCancel><AlertDialogAction onClick={() => void resetDemo()}>Reset demo</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
