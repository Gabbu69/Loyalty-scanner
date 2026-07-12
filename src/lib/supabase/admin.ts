import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { getSupabasePublicConfig } from "@/lib/supabase/env";

let adminClient: SupabaseClient | null = null;
let adminClientConfig: string | null = null;

function getServerSecret() {
  // SUPABASE_SECRET_KEY is preferred for new projects. The legacy service
  // role value is supported only in this server-only module for migrations.
  return (
    process.env.SUPABASE_SECRET_KEY?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    null
  );
}

/**
 * Server-only elevated client for tightly scoped owner/admin operations.
 * The secret is never exported and no NEXT_PUBLIC secret is accepted.
 */
export function getSupabaseAdminClient(): SupabaseClient | null {
  const publicConfig = getSupabasePublicConfig();
  const secret = getServerSecret();
  if (!publicConfig || !secret) {
    return null;
  }

  const configKey = `${publicConfig.url}\n${secret}`;
  if (!adminClient || adminClientConfig !== configKey) {
    adminClient = createClient(publicConfig.url, secret, {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
    });
    adminClientConfig = configKey;
  }

  return adminClient;
}
