import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { getSupabasePublicConfig } from "@/lib/supabase/env";

export type ServerSupabaseClient = ReturnType<typeof createServerClient>;

/**
 * A request-scoped Supabase client. It deliberately returns null when the
 * app is running without credentials so static builds and demo mode work.
 */
export async function createClient(): Promise<ServerSupabaseClient | null> {
  const config = getSupabasePublicConfig();
  if (!config) {
    return null;
  }

  const cookieStore = await cookies();

  return createServerClient(config.url, config.publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Components cannot write response cookies. src/proxy.ts
          // refreshes them before protected Server Components are rendered.
        }
      },
    },
  });
}

export const createServerSupabaseClient = createClient;
