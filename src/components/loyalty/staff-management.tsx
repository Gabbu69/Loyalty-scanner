"use client";

import { ShieldCheck, UserPlus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/app/page-header";
import { useLoyalty } from "@/components/app/loyalty-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { StaffMember, StaffRole } from "@/lib/data/types";
import { getErrorMessage } from "@/lib/errors";
import { formatDateTime } from "@/lib/format";

export function StaffManagement() {
  const { snapshot, updateStaff, mode } = useLoyalty();
  const staff = snapshot?.staff ?? [];
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<StaffRole>("staff");
  const [busy, setBusy] = useState(false);

  async function invite() {
    if (!name.trim() || !email.includes("@")) {
      toast.error("Enter a staff name and valid email.");
      return;
    }
    const next: StaffMember = { id: crypto.randomUUID(), displayName: name.trim(), email: email.trim().toLowerCase(), role, active: true, createdAt: new Date().toISOString() };
    setBusy(true);
    try {
      await updateStaff([...staff, next]);
      setName(""); setEmail(""); setRole("staff"); setOpen(false);
      toast.success(mode === "demo" ? "Demo staff member added" : "Staff account added or invited");
    } catch (error) {
      toast.error(getErrorMessage(error, "The staff account could not be added."));
    } finally {
      setBusy(false);
    }
  }

  async function toggle(member: StaffMember) {
    if (member.isCurrent) {
      toast.error("The current owner cannot deactivate their own account.");
      return;
    }
    setBusy(true);
    try {
      await updateStaff(staff.map((item) => item.id === member.id ? { ...item, active: !item.active } : item));
      toast.success(member.active ? "Staff access deactivated" : "Staff access restored");
    } catch (error) {
      toast.error(getErrorMessage(error, "Staff access could not be updated."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Access control" title="Staff accounts" description="Individual accounts keep every scan, redemption, and adjustment attributable to the person who performed it." action={
        <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button disabled={busy}><UserPlus />Add staff</Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>Add a staff account</DialogTitle><DialogDescription>{mode === "demo" ? "This adds a local demo account." : "A new user receives an invitation; an existing Auth user is linked to this store."}</DialogDescription></DialogHeader><div className="space-y-4 py-2"><div className="space-y-2"><Label htmlFor="staff-name">Display name</Label><Input id="staff-name" value={name} onChange={(event) => setName(event.target.value)} /></div><div className="space-y-2"><Label htmlFor="staff-email">Email</Label><Input id="staff-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></div><div className="space-y-2"><Label>Role</Label><Select value={role} onValueChange={(value) => setRole(value as StaffRole)}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="staff">Staff - scan and serve customers</SelectItem><SelectItem value="owner">Owner - full program access</SelectItem></SelectContent></Select></div></div><DialogFooter><Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button><Button onClick={() => void invite()} disabled={busy}>{busy ? "Adding..." : "Add staff"}</Button></DialogFooter></DialogContent></Dialog>
      } />

      <div className="grid gap-4">
        {staff.map((member) => (
          <Card key={member.id} className="shadow-none"><CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center"><span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary/10 font-bold text-primary">{member.displayName.slice(0, 1).toUpperCase()}</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="truncate font-semibold">{member.displayName}</p><Badge variant={member.role === "owner" ? "default" : "secondary"} className="capitalize">{member.role}</Badge>{member.isCurrent ? <Badge variant="outline">You</Badge> : null}<Badge variant="outline" className={member.active ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-slate-50 text-slate-600"}>{member.active ? "Active" : "Inactive"}</Badge></div><p className="mt-1 truncate text-sm text-muted-foreground">{member.email}</p><p className="mt-1 text-xs text-muted-foreground">Added {formatDateTime(member.createdAt, snapshot?.settings.timezone)}</p></div><Button variant="outline" disabled={busy || member.isCurrent} onClick={() => void toggle(member)}>{member.active ? "Deactivate" : "Restore access"}</Button></CardContent></Card>
        ))}
      </div>
      <Card className="border-primary/20 bg-primary/[0.035] shadow-none"><CardContent className="flex gap-3 p-5"><ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" /><div><p className="font-semibold">Accountability is always on</p><p className="mt-1 text-sm leading-6 text-muted-foreground">Point changes are written with the signed-in staff ID. Deactivated memberships are checked on each sensitive request, even if an older login session still exists.</p></div></CardContent></Card>
    </div>
  );
}
