import type { LucideIcon } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const toneClasses = {
  default: "bg-primary/10 text-primary",
  positive: "bg-emerald-100 text-emerald-700",
  warning: "bg-amber-100 text-amber-700",
  accent: "bg-sky-100 text-sky-700",
};

export function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: string | number;
  detail?: string;
  icon: LucideIcon;
  tone?: keyof typeof toneClasses;
}) {
  return (
    <Card className="border-border/80 shadow-none">
      <CardContent className="flex items-start justify-between gap-4 p-5">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <p className="mt-2 text-3xl font-bold tracking-tight">{value}</p>
          {detail ? <p className="mt-1 text-xs text-muted-foreground">{detail}</p> : null}
        </div>
        <span className={cn("rounded-xl p-2.5", toneClasses[tone])}>
          <Icon className="size-5" aria-hidden="true" />
        </span>
      </CardContent>
    </Card>
  );
}
