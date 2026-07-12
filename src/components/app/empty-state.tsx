import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Card, CardContent } from "@/components/ui/card";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <Card className="border-dashed shadow-none">
      <CardContent className="flex min-h-64 flex-col items-center justify-center p-8 text-center">
        <span className="mb-4 rounded-2xl bg-muted p-3 text-muted-foreground">
          <Icon className="size-6" aria-hidden="true" />
        </span>
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="mt-1 max-w-md text-sm leading-6 text-muted-foreground">{description}</p>
        {action ? <div className="mt-5">{action}</div> : null}
      </CardContent>
    </Card>
  );
}
