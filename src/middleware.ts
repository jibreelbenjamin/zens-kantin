import { NextResponse, type NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { updateSession } from "@/lib/supabase/middleware";
import { sessionFingerprint, signUnlockToken, verifyUnlockToken } from "@/lib/kasir-token";
import { KASIR_UNLOCK_COOKIE, KASIR_PIN_VERSION_CACHE_MS, unlockCookieOptions } from "@/lib/constants";

const PUBLIC_PATHS = ["/login", "/auth/callback"];

function roleHome(role: string) {
  if (role === "admin") return "/admin";
  if (role === "kasir") return "/kasir";
  return "/order";
}

// Mode lockdown: kalau env APP_LOCKDOWN="true", SELURUH pengguna (admin,
// kasir, pelanggan, bahkan yang belum login) tidak bisa memakai aplikasi
// sama sekali — dicek PALING AWAL, sebelum sesi/auth/role apa pun. Route
// halaman di-rewrite ke /maintenance (URL di address bar tetap sama, tidak
// redirect, jadi tidak ada risiko redirect loop), route /api dijawab 503
// JSON supaya fetch() dari client component tidak meledak nunggu HTML.
const APP_LOCKDOWN = process.env.APP_LOCKDOWN === "true";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (APP_LOCKDOWN) {
    if (pathname.startsWith("/api")) {
      return NextResponse.json({ error: "Aplikasi sedang dalam pemeliharaan. Coba lagi nanti." }, { status: 503 });
    }
    if (pathname !== "/maintenance") {
      const url = request.nextUrl.clone();
      url.pathname = "/maintenance";
      return NextResponse.rewrite(url);
    }
    return NextResponse.next();
  }

  const { supabaseResponse, supabase, user, profile, accessToken } = await updateSession(request);

  // Route API menangani otorisasi (401/403 JSON) sendiri lewat requireRole().
  // Jangan redirect di sini — fetch() dari client component mengharapkan
  // JSON, bukan halaman HTML hasil redirect.
  if (pathname.startsWith("/api")) return supabaseResponse;

  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  if (!user) {
    if (isPublic) return supabaseResponse;
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  const redirectTo = (path: string) => {
    const url = request.nextUrl.clone();
    url.pathname = path;
    return NextResponse.redirect(url);
  };

  if (!profile) {
    if (pathname.startsWith("/onboarding")) return supabaseResponse;
    return redirectTo("/onboarding");
  }

  if (profile.status === "pending" && pathname !== "/pending") return redirectTo("/pending");
  if (profile.status === "block" && pathname !== "/blocked") return redirectTo("/blocked");

  if (profile.status === "active") {
    if (["/onboarding", "/login", "/pending", "/blocked"].some((p) => pathname === p)) {
      return redirectTo(roleHome(profile.role));
    }
    if (pathname.startsWith("/admin") && profile.role !== "admin") return redirectTo(roleHome(profile.role));
    if (pathname.startsWith("/kasir") && profile.role !== "kasir") return redirectTo(roleHome(profile.role));
    if (pathname.startsWith("/order") && profile.role !== "pelanggan") return redirectTo(roleHome(profile.role));

    // Gerbang layar PIN kasir: halaman terpisah (/kasir/lock), bukan overlay
    // yang ditumpuk di atas konten. Diputuskan DI SINI (sebelum halaman
    // manapun di bawah /kasir sempat mengambil/mengirim data) — jadi kalau
    // belum ada PIN yang benar, konten pesanan dkk. tidak pernah ikut
    // ter-render sama sekali, bukan cuma disembunyikan di client yang bisa
    // dibongkar lewat Inspect Element.
    //
    // Yang menentukan "sudah membuka PIN" adalah TOKEN BERTANDA TANGAN di
    // cookie HttpOnly (lihat lib/kasir-token.ts), bukan cookie penanda yang
    // isinya "1" — penanda seperti itu bisa dibuat sendiri siapa pun lewat
    // DevTools > Application > Cookies dan langsung melewati seluruh gerbang
    // ini tanpa tahu PIN-nya. Token juga terikat ke akun, sesi login, dan
    // versi PIN yang sedang berlaku, jadi tidak bisa dipindah ke browser/akun
    // lain dan otomatis mati begitu admin mengganti PIN.
    if (profile.role === "kasir" && pathname.startsWith("/kasir")) {
      const claims = await verifyUnlockToken(request.cookies.get(KASIR_UNLOCK_COOKIE)?.value, {
        userId: user.id,
        sessionId: await sessionFingerprint(accessToken),
        pinVersion: await pinVersion(supabase),
      });

      if (pathname === "/kasir/lock") {
        if (claims) {
          const next = request.nextUrl.searchParams.get("next");
          return redirectTo(next && next.startsWith("/kasir") ? next : "/kasir");
        }
      } else if (!claims) {
        const url = request.nextUrl.clone();
        url.pathname = "/kasir/lock";
        url.searchParams.set("next", pathname);
        return NextResponse.redirect(url);
      } else if (claims.e - Math.floor(Date.now() / 1000) < claims.l / 2) {
        // Perpanjangan bergulir: selama kasir masih benar-benar memakai
        // aplikasi, umur token disegarkan di sini — jadi masa berlakunya
        // dihitung dari aktivitas NYATA yang sampai ke server, bukan cuma
        // dari idle timer di browser (yang jalannya di client dan bisa
        // dimatikan lewat DevTools). Kalau tabletnya benar-benar ditinggal,
        // tidak ada request yang datang, token habis sendiri sesuai interval
        // yang admin atur dan layar terkunci lagi.
        supabaseResponse.cookies.set(
          KASIR_UNLOCK_COOKIE,
          await signUnlockToken({ ...claims, e: Math.floor(Date.now() / 1000) + claims.l }),
          unlockCookieOptions(claims.l)
        );
      }
    }
  }

  return supabaseResponse;
}

/**
 * Versi PIN yang sedang berlaku, dibaca lewat RPC get_kasir_pin_version.
 * Di-cache sebentar di memori instance supaya tidak menambah satu query ke
 * database untuk SETIAP request halaman kasir; konsekuensinya, perubahan PIN
 * baru menendang sesi kasir yang sedang terbuka paling lambat beberapa detik
 * setelah disimpan, bukan seketika. Kalau query-nya gagal dan belum ada nilai
 * yang pernah terbaca, sengaja mengembalikan penanda yang MUSTAHIL cocok
 * dengan token mana pun (bukan string kosong, yang justru cocok dengan token
 * dari deployment yang PIN-nya belum pernah diganti) — kegagalan harus
 * berujung terkunci, bukan terbuka.
 */
let pinVersionCache: { value: string; at: number } | null = null;

async function pinVersion(supabase: SupabaseClient): Promise<string> {
  if (pinVersionCache && Date.now() - pinVersionCache.at < KASIR_PIN_VERSION_CACHE_MS) {
    return pinVersionCache.value;
  }
  const { data, error } = await supabase.rpc("get_kasir_pin_version");
  if (error) {
    // PGRST202 = function-nya belum ada di database (migrasi SQL belum
    // dijalankan). Itu bukan kegagalan yang mencurigakan, cuma fitur
    // pencabutan token yang belum aktif — jangan sampai seluruh kasir
    // terkunci total gara-gara itu; perlakukan seperti "belum pernah ganti
    // PIN". Kegagalan lain (jaringan, permission) tetap fail-closed.
    if (error.code === "PGRST202") return "";
    return pinVersionCache?.value ?? "\u0000gagal-baca-versi-pin";
  }
  const value = typeof data === "string" ? data : "";
  pinVersionCache = { value, at: Date.now() };
  return value;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
