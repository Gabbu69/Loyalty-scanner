"use client";

import Link from "next/link";
import { Search, UserRoundPlus, Users } from "lucide-react";
import { useMemo, useState } from "react";

import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { useLoyalty } from "@/components/app/loyalty-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { displayPhone } from "@/lib/format";

export function CustomerDirectory() {
  const { snapshot, loading } = useLoyalty();
  const [query, setQuery] = useState("");
  const members = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return (snapshot?.members ?? []).filter((member) => {
      if (!normalized) return member.status === "active";
      return [member.fullName, member.memberCode, member.phone ?? "", member.maskedPhone ?? ""].some((value) =>
        value.toLowerCase().includes(normalized),
      );
    });
  }, [query, snapshot]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Customer directory"
        title="Find a loyalty member"
        description="Search by name, phone, or member code. Customer details stay private and never appear inside the QR code."
        action={
          <Button asChild className="w-full sm:w-auto">
            <Link href="/customers/new">
              <UserRoundPlus />
              Add customer
            </Link>
          </Button>
        }
      />

      <Card className="shadow-none">
        <CardContent className="p-4 sm:p-5">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
            <span className="sr-only">Search customers</span>
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search name, phone, or LS-code"
              className="h-12 pl-10 text-base"
            />
          </label>
        </CardContent>
      </Card>

      {!loading && members.length === 0 ? (
        <EmptyState
          icon={Users}
          title={query ? "No matching customer" : "No customers yet"}
          description={
            query
              ? "Try a different name, phone number, or loyalty code."
              : "Create the first customer and issue their QR loyalty ID in under a minute."
          }
          action={
            <Button asChild>
              <Link href="/customers/new">Create customer</Link>
            </Button>
          }
        />
      ) : (
        <Card className="overflow-hidden shadow-none">
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Member code</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell className="font-semibold">{member.fullName}</TableCell>
                    <TableCell><Badge variant="secondary" className="font-mono">{member.memberCode}</Badge></TableCell>
                    <TableCell className="text-muted-foreground">{displayPhone(member)}</TableCell>
                    <TableCell className="text-right text-lg font-bold">{member.pointBalance}</TableCell>
                    <TableCell>
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/customers/${member.id}`}>Open</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="divide-y md:hidden">
            {members.map((member) => (
              <Link
                key={member.id}
                href={`/customers/${member.id}`}
                className="flex min-h-20 items-center gap-3 p-4 transition-colors hover:bg-muted/60"
              >
                <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10 font-bold text-primary">
                  {member.fullName.slice(0, 1).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{member.fullName}</span>
                  <span className="block text-xs text-muted-foreground">{member.memberCode} - {displayPhone(member)}</span>
                </span>
                <span className="text-right">
                  <span className="block text-xl font-bold">{member.pointBalance}</span>
                  <span className="block text-[11px] text-muted-foreground">points</span>
                </span>
              </Link>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
