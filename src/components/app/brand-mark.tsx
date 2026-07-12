import { QrCode, Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";

export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "relative inline-flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm",
        className,
      )}
      aria-hidden="true"
    >
      <QrCode className="size-6" strokeWidth={2.25} />
      <Sparkles className="absolute -right-1 -top-1 size-4 rounded-full bg-amber-300 p-0.5 text-amber-950" />
    </span>
  );
}
