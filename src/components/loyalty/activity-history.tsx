"use client";

import { Download, History } from "lucide-react";
import { useMemo, useState } from "react";

import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { useLoyalty } from "@/components/app/loyalty-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { activityLabel, formatDateTime } from "@/lib/format";

export function ActivityHistory() {
  const { snapshot } = useLoyalty();
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("all");
  const items = useMemo(() => (snapshot?.activity ?? []).filter((item) => {
    const matchesKind = kind === "all" || item.kind === kind;
    const normalized = query.trim().toLowerCase();
    const matchesQuery = !normalized || [item.memberName, item.memberCode, item.staffName].some((value) => value.toLowerCase().includes(normalized));
    return matchesKind && matchesQuery;
  }), [kind, query, snapshot]);

  function exportCsv() {
    if (!snapshot) return;
    const rows = [
      ["Date", "Customer", "Member code", "Type", "Points", "Balance", "Staff", "Reason", "Status"],
      ...snapshot.activity.map((item) => [item.createdAt, item.memberName, item.memberCode, item.kind, String(item.delta), String(item.balanceAfter), item.staffName, item.reason ?? "", item.status]),
    ];
    const csv = rows.map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `loyalty-activity-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Audit trail" title="Points activity" description="Every accepted, blocked, redeemed, or corrected loyalty action appears here." action={<Button variant="outline" onClick={exportCsv}><Download />Export CSV</Button>} />
      <Card className="grid gap-3 p-4 shadow-none sm:grid-cols-[1fr_14rem]">
        <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search customer, code, or staff" className="h-11" />
        <Select value={kind} onValueChange={setKind}>
          <SelectTrigger className="h-11 w-full"><SelectValue placeholder="All activity" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All activity</SelectItem>
            <SelectItem value="earn">Visit points</SelectItem>
            <SelectItem value="redeem">Rewards</SelectItem>
            <SelectItem value="blocked">Blocked duplicates</SelectItem>
            <SelectItem value="adjustment">Adjustments</SelectItem>
            <SelectItem value="reversal">Reversals</SelectItem>
            <SelectItem value="reissue">Card reissues</SelectItem>
          </SelectContent>
        </Select>
      </Card>
      {items.length === 0 ? <EmptyState icon={History} title="No matching activity" description="Try another search or activity type." /> : (
        <Card className="divide-y overflow-hidden shadow-none">
          {items.map((item) => (
            <div key={item.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:p-5">
              <span className={`flex size-11 shrink-0 items-center justify-center rounded-full font-bold ${item.status === "blocked" ? "bg-amber-100 text-amber-800" : item.kind === "redeem" ? "bg-sky-100 text-sky-800" : "bg-emerald-100 text-emerald-800"}`}>{item.memberName.slice(0, 1)}</span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate font-semibold">{item.memberName}</p>
                  <Badge variant={item.status === "blocked" ? "outline" : "secondary"}>{activityLabel(item.kind)}</Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(item.createdAt, snapshot?.settings.timezone)} - {item.staffName}</p>
                {item.reason ? <p className="mt-1 text-sm text-muted-foreground">{item.reason}</p> : null}
              </div>
              <div className="flex items-center justify-between gap-6 sm:block sm:text-right">
                <p className={`text-xl font-bold ${item.delta > 0 ? "text-emerald-700" : item.delta < 0 ? "text-sky-700" : "text-muted-foreground"}`}>{item.delta > 0 ? "+" : ""}{item.delta}</p>
                <p className="text-xs text-muted-foreground">Balance {item.balanceAfter}</p>
              </div>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
