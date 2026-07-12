export type SupabasePublicConfig = {
  url: string;
  publishableKey: string;
};

function clean(value: string | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

/**
 * Read public Supabase settings lazily so importing a module never makes a
 * local/demo build fail. The legacy anon-key name remains a compatibility
 * fallback; new projects should use the publishable key.
 */
export function getSupabasePublicConfig(): SupabasePublicConfig | null {
  if (process.env.NEXT_PUBLIC_DEMO_MODE === "true") {
    return null;
  }

  const url = clean(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const publishableKey =
    clean(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) ??
    clean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  if (!url || !publishableKey) {
    return null;
  }

  return { url, publishableKey };
}

export function isSupabaseConfigured() {
  return getSupabasePublicConfig() !== null;
}

export function isDemoMode() {
  return !isSupabaseConfigured();
}
