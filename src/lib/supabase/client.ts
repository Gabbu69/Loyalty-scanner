"use client";

import { createBrowserClient } from "@supabase/ssr";

import { getSupabasePublicConfig } from "@/lib/supabase/env";

type BrowserSupabaseClient = ReturnType<typeof createBrowserClient>;

let browserClient: BrowserSupabaseClient | null = null;
let browserClientConfig: string | null = null;

/**
 * Returns null in demo mode. Callers must keep the demo data path available
 * instead of assuming that deployment credentials exist.
 */
export function createClient(): BrowserSupabaseClient | null {
  const config = getSupabasePublicConfig();
  if (!config) {
    return null;
  }

  const configKey = `${config.url}\n${config.publishableKey}`;
  if (!browserClient || browserClientConfig !== configKey) {
    browserClient = createBrowserClient(config.url, config.publishableKey);
    browserClientConfig = configKey;
  }

  return browserClient;
}

export const getSupabaseBrowserClient = createClient;
