import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SESSION_MAX_AGE_SECONDS } from "@/lib/constants";

type CookieToSet = { name: string; value: string; options: CookieOptions };

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, {
              ...options,
              maxAge: SESSION_MAX_AGE_SECONDS,
            })
          );
        },
      },
    }
  );

  // Wajib dipanggil supaya token refresh tetap berjalan (jangan dihapus).
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let profile: { role: string; status: string } | null = null;
  if (user) {
    const { data } = await supabase
      .from("profiles")
      .select("role,status")
      .eq("id", user.id)
      .maybeSingle();
    profile = data;
  }

  // Access token dikembalikan supaya middleware bisa mengikat token pembuka
  // kunci kasir ke SESI login ini (lewat klaim session_id di dalamnya, lihat
  // sessionFingerprint di lib/kasir-token.ts). getSession() di sini hanya
  // membaca cookie yang sudah ada, tidak menambah request ke Supabase —
  // keaslian penggunanya sudah diverifikasi getUser() di atas.
  const { data: { session } } = await supabase.auth.getSession();

  return { supabaseResponse, supabase, user, profile, accessToken: session?.access_token ?? null };
}
