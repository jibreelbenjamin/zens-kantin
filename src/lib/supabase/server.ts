import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { SESSION_MAX_AGE_SECONDS } from "@/lib/constants";

type CookieToSet = { name: string; value: string; options: CookieOptions };

/** Client Supabase untuk dipakai di Server Components / Route Handlers / Server Actions. */
export function createClient() {
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, {
                ...options,
                // Sesi login bertahan 30 hari sesuai kebutuhan aplikasi.
                maxAge: SESSION_MAX_AGE_SECONDS,
              })
            );
          } catch {
            // Dipanggil dari Server Component tanpa akses cookie write — aman diabaikan,
            // middleware yang akan melakukan refresh sesi.
          }
        },
      },
    }
  );
}

/**
 * Client dengan service_role key — HANYA dipakai di route handler server-side
 * (mis. set password setelah onboarding, admin membuat/mengubah user).
 * JANGAN PERNAH diimpor dari client component.
 */
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
