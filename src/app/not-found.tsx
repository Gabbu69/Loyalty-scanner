import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function NotFound() {
  return <main className="flex min-h-dvh items-center justify-center bg-muted/40 p-4"><Card className="max-w-md shadow-none"><CardContent className="p-8 text-center"><p className="text-sm font-semibold uppercase tracking-widest text-primary">404</p><h1 className="mt-2 text-2xl font-bold">Page not found</h1><p className="mt-2 text-sm text-muted-foreground">The page may have moved or the customer link is no longer available.</p><Button asChild className="mt-6"><Link href="/scan">Return to scanner</Link></Button></CardContent></Card></main>;
}
