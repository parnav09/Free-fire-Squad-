import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();

export const isSupabaseConfigured = Boolean(supabaseUrl && supabasePublishableKey);

/**
 * Browser client only. A publishable key is safe to expose when RLS is correctly
 * configured. Never replace it with a secret/service-role key.
 *
 * The client remains null until the project URL and publishable key are configured.
 * All shared-data access must remain protected by database RLS policies.
 */
export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabasePublishableKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

/**
 * Checks the Supabase REST gateway itself, without querying application tables.
 * Any HTTP response proves the gateway is reachable; 5xx and network failures
 * indicate that the service is currently unavailable.
 */
export async function checkSupabaseServer(): Promise<"connected" | "offline"> {
  if (!supabaseUrl || !supabasePublishableKey) return "offline";
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/`, {
      method: "GET",
      headers: {
        apikey: supabasePublishableKey,
        Authorization: `Bearer ${supabasePublishableKey}`,
      },
      cache: "no-store",
      signal: controller.signal,
    });
    return response.status < 500 ? "connected" : "offline";
  } catch {
    return "offline";
  } finally {
    window.clearTimeout(timeout);
  }
}
