"use client";

import Link from "next/link";
import { ArrowLeft, Check, UserRoundPlus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/app/page-header";
import { useLoyalty } from "@/components/app/loyalty-provider";
import { LoyaltyCard } from "@/components/loyalty/loyalty-card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { IssuedCard } from "@/lib/data/types";
import { normalizePhilippinePhone } from "@/lib/loyalty/phone";

export function NewCustomerForm() {
  const { snapshot, createMember } = useLoyalty();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [issued, setIssued] = useState<IssuedCard | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (fullName.trim().length < 2) {
      toast.error("Enter the customer's full name.");
      return;
    }
    const normalizedPhone = phone.trim() ? normalizePhilippinePhone(phone) : null;
    if (phone.trim() && !normalizedPhone) {
      toast.error("Enter a valid phone number or leave it blank.");
      return;
    }
    setSaving(true);
    try {
      const card = await createMember({ fullName: fullName.trim(), phone: normalizedPhone });
      setIssued(card);
      toast.success("Customer created");
    } finally {
      setSaving(false);
    }
  }

  function createAnother() {
    setFullName("");
    setPhone("");
    setIssued(null);
  }

  if (issued) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <PageHeader eyebrow="Customer created" title="Their loyalty ID is ready" description="Share, download, or print this card now. For security, a replacement generates a new QR and revokes the old one." />
        <Alert className="border-emerald-200 bg-emerald-50"><Check className="text-emerald-700" /><AlertTitle className="text-emerald-950">{issued.member.fullName} has been enrolled</AlertTitle><AlertDescription className="text-emerald-900">Member code {issued.member.memberCode} starts with 0 points.</AlertDescription></Alert>
        <LoyaltyCard issuedCard={issued} storeName={snapshot?.settings.storeName ?? "Loyalty Scan"} />
        <div className="grid gap-3 sm:grid-cols-2"><Button variant="outline" size="lg" onClick={createAnother}><UserRoundPlus />Create another</Button><Button size="lg" asChild><Link href={`/customers/${issued.member.id}`}>Open customer profile</Link></Button></div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader eyebrow="Quick enrollment" title="Create a customer loyalty ID" description="Only a name is required. A phone number is optional and is never stored inside the QR code." action={<Button variant="outline" asChild><Link href="/customers"><ArrowLeft />Customers</Link></Button>} />
      <Card className="shadow-none">
        <CardHeader><CardTitle>Customer details</CardTitle><CardDescription>Staff should confirm the spelling before generating the card.</CardDescription></CardHeader>
        <CardContent>
          <form className="space-y-5" onSubmit={submit}>
            <div className="space-y-2"><Label htmlFor="full-name">Full name <span className="text-destructive">*</span></Label><Input id="full-name" autoComplete="name" value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="e.g. Mika Santos" className="h-12 text-base" maxLength={100} required /></div>
            <div className="space-y-2"><Label htmlFor="phone">Phone number <span className="font-normal text-muted-foreground">(optional)</span></Label><Input id="phone" type="tel" autoComplete="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="0917 555 0123" className="h-12 text-base" /><p className="text-xs leading-5 text-muted-foreground">Used for customer lookup and card recovery only. No marketing messages are sent.</p></div>
            <Alert><UserRoundPlus /><AlertTitle>Fast and private</AlertTitle><AlertDescription>The generated QR contains only an opaque random token. It does not reveal the customer&apos;s name, phone, or points.</AlertDescription></Alert>
            <Button type="submit" size="lg" className="h-14 w-full text-base" disabled={saving}>{saving ? "Creating loyalty ID..." : "Create loyalty ID"}</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
