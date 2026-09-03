import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { KASIR_UNLOCK_COOKIE } from "@/lib/constants";

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

  const { supabaseResponse, user, profile } = await updateSession(request);

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
    // manapun di bawah /kasir sempat mengambil/mengirim data) berdasarkan
    // cookie HttpOnly kasir_unlocked — jadi kalau belum ada PIN yang benar,
    // konten pesanan dkk. tidak pernah ikut ter-render sama sekali, bukan
    // cuma disembunyikan di client yang bisa dibongkar lewat Inspect Element.
    if (profile.role === "kasir" && pathname.startsWith("/kasir")) {
      const unlocked = request.cookies.get(KASIR_UNLOCK_COOKIE)?.value === "1";
      if (pathname === "/kasir/lock") {
        if (unlocked) {
          const next = request.nextUrl.searchParams.get("next");
          return redirectTo(next && next.startsWith("/kasir") ? next : "/kasir");
        }
      } else if (!unlocked) {
        const url = request.nextUrl.clone();
        url.pathname = "/kasir/lock";
        url.searchParams.set("next", pathname);
        return NextResponse.redirect(url);
      }
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
