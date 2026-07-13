"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  BarChart3,
  ChevronDown,
  LogOut,
  ScanLine,
  Settings,
  ShieldCheck,
  Store,
  UserRoundPlus,
  Users,
} from "lucide-react";
import type { ReactNode } from "react";

import { BrandMark } from "@/components/app/brand-mark";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { signOutAction } from "@/lib/auth/actions";

const primaryNav = [
  { href: "/scan", label: "Scan", icon: ScanLine },
  { href: "/customers", label: "Customers", icon: Users },
  { href: "/customers/new", label: "New customer", icon: UserRoundPlus },
  { href: "/activity", label: "Activity", icon: Activity },
];

const ownerNav = [
  { href: "/dashboard", label: "Dashboard", icon: BarChart3 },
  { href: "/settings", label: "Program settings", icon: Settings },
  { href: "/staff", label: "Staff", icon: ShieldCheck },
];

function NavItem({
  href,
  label,
  icon: Icon,
  compact = false,
}: (typeof primaryNav)[number] & { compact?: boolean }) {
  const pathname = usePathname();
  const active = pathname === href || (href !== "/scan" && pathname.startsWith(`${href}/`));
  return (
    <Link
      href={href}
      className={cn(
        "flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors",
        active
          ? "bg-primary text-primary-foreground shadow-sm"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
        compact && "min-h-12 flex-1 flex-col justify-center gap-1 rounded-none px-1 text-[11px]",
      )}
      aria-current={active ? "page" : undefined}
    >
      <Icon className={cn("size-5", compact && "size-5")} aria-hidden="true" />
      <span>{label}</span>
    </Link>
  );
}

export function AppShell({
  children,
  storeName = "Loyalty Scan",
  staffName = "Store owner",
  role = "owner",
  demo = false,
}: {
  children: ReactNode;
  storeName?: string;
  staffName?: string;
  role?: "owner" | "staff";
  demo?: boolean;
}) {
  const mobileNav =
    role === "owner"
      ? [primaryNav[0], primaryNav[1], primaryNav[3], ownerNav[0]]
      : [primaryNav[0], primaryNav[1], primaryNav[2], primaryNav[3]];

  return (
    <div className="min-h-dvh bg-muted/35">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 flex-col border-r bg-background p-5 lg:flex">
        <Link href="/scan" className="flex items-center gap-3 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <BrandMark />
          <span className="min-w-0">
            <span className="block truncate text-lg font-bold tracking-tight">{storeName}</span>
            <span className="block text-xs text-muted-foreground">Staff loyalty console</span>
          </span>
        </Link>

        <nav className="mt-8 space-y-1" aria-label="Main navigation">
          <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Daily work
          </p>
          {primaryNav.map((item) => (
            <NavItem key={item.href} {...item} />
          ))}
          {role === "owner" ? (
            <>
              <p className="mb-2 mt-6 px-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Owner tools
              </p>
              {ownerNav.map((item) => (
                <NavItem key={item.href} {...item} />
              ))}
            </>
          ) : null}
        </nav>

        <div className="mt-auto rounded-2xl border bg-muted/45 p-3">
          <div className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
              {staffName.slice(0, 1).toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{staffName}</p>
              <p className="text-xs capitalize text-muted-foreground">{role}</p>
            </div>
            <form action={signOutAction}>
              <button type="submit" aria-label="Sign out" className="rounded-lg p-2 text-muted-foreground hover:bg-background hover:text-foreground">
                <LogOut className="size-4" />
              </button>
            </form>
          </div>
        </div>
      </aside>

      <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b bg-background/95 px-4 backdrop-blur lg:hidden">
        <Link href="/scan" className="flex min-w-0 items-center gap-2.5">
          <BrandMark className="size-9 rounded-xl" />
          <span className="truncate font-bold">{storeName}</span>
        </Link>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              {staffName.split(" ")[0]}
              <ChevronDown className="size-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <span className="block truncate">{staffName}</span>
              <span className="text-xs font-normal capitalize text-muted-foreground">{role}</span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {role === "owner" ? (
              <DropdownMenuItem asChild>
                <Link href="/settings"><Settings />Settings</Link>
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuItem asChild>
              <form action={signOutAction}>
                <button type="submit" className="flex w-full items-center gap-2">
                  <LogOut />
                  Sign out
                </button>
              </form>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      <div className="lg:pl-72">
        {demo ? (
          <div className="flex items-center justify-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-xs font-medium text-amber-900">
            <Store className="size-3.5" />
            Demo mode - data stays on this device until Supabase is connected.
            <Badge variant="outline" className="hidden border-amber-300 bg-white text-amber-900 sm:inline-flex">
              Safe to explore
            </Badge>
          </div>
        ) : null}
        <main className="mx-auto w-full max-w-7xl px-4 pb-28 pt-6 sm:px-6 sm:pt-8 lg:px-8 lg:pb-10">
          {children}
        </main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 flex h-[4.75rem] items-stretch border-t bg-background/98 px-1 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_30px_rgba(15,23,42,0.05)] backdrop-blur lg:hidden" aria-label="Mobile navigation">
        {mobileNav.map((item) => (
          <NavItem key={item.href} {...item} compact />
        ))}
      </nav>
    </div>
  );
}
