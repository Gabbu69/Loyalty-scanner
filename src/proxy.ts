import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { isProtectedRoute } from "@/lib/auth/types";
import { getSupabasePublicConfig } from "@/lib/supabase/env";

function copySessionCookies(from: NextResponse, to: NextResponse) {
  from.cookies.getAll().forEach((cookie) => to.cookies.set(cookie));
  ["cache-control", "expires", "pragma"].forEach((name) => {
    const value = from.headers.get(name);
    if (value) to.headers.set(name, value);
  });
  return to;
}

function applyRefreshHeaders(response: NextResponse, source: unknown) {
  if (!source) return;

  if (source instanceof Headers) {
    source.forEach((value, name) => response.headers.set(name, value));
    return;
  }

  if (Array.isArray(source)) {
    source.forEach((entry) => {
      if (Array.isArray(entry) && entry.length === 2) {
        response.headers.set(String(entry[0]), String(entry[1]));
      }
    });
    return;
  }

  if (typeof source === "object") {
    Object.entries(source as Record<string, unknown>).forEach(([name, value]) => {
      if (typeof value === "string") response.headers.set(name, value);
    });
  }
}

export async function proxy(request: NextRequest) {
  const config = getSupabasePublicConfig();
  if (!config) {
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(config.url, config.publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, ...refreshHeaderArgs: unknown[]) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
        applyRefreshHeaders(response, refreshHeaderArgs[0]);
      },
    },
  });

  // Proxy refreshes the cookie and offers early redirects. Server layouts,
  // actions and route handlers still call requireStaff/requireOwner.
  const { data, error } = await supabase.auth.getClaims();
  const userId = error ? null : data?.claims?.sub;
  const pathname = request.nextUrl.pathname;

  if (!userId && isProtectedRoute(pathname)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    loginUrl.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
    return copySessionCookies(response, NextResponse.redirect(loginUrl));
  }

  if (userId && pathname === "/login") {
    const { data: membership } = await supabase
      .from("staff_memberships")
      .select("is_active")
      .eq("user_id", userId)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();

    if (membership?.is_active === true) {
      const scanUrl = request.nextUrl.clone();
      scanUrl.pathname = "/scan";
      scanUrl.search = "";
      return copySessionCookies(response, NextResponse.redirect(scanUrl));
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|txt|xml|webmanifest)$).*)",
  ],
};
