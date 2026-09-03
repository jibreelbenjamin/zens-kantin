import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { logActivity } from "@/lib/activity-log";
import { ACTIVITY_ACTIONS, LOGIN_LOCKOUT_MAX_ATTEMPTS, LOGIN_LOCKOUT_WINDOW_MINUTES } from "@/lib/constants";

/**
 * Login username & password — SATU route server-side yang menangani semua
 * sekaligus: cek jeda (lockout) percobaan gagal, resolusi username->email,
 * verifikasi password, dan pencatatan log (sukses MAUPUN gagal).
 *
 * Kenapa dipindah ke sini (sebelumnya login dilakukan langsung dari
 * browser lewat supabase-js, lalu fetch terpisah ke /api/auth/log): begitu
 * signInWithPassword() selesai di browser, penyimpanan sesi ke cookie
 * (lewat @supabase/ssr) tidak selalu sempat tersinkron SEBELUM fetch log
 * berikutnya dikirim — request log jadi dianggap tidak login (401) dan
 * gagal DIAM-DIAM (fetch tidak melempar error untuk status non-2xx, cuma
 * di-.catch(() => {}) di client). Login gagal (password salah) juga sama
 * sekali tidak pernah dicatat sebelumnya. Dengan semuanya dilakukan di
 * server dalam satu request ini, tidak ada lagi ketergantungan pada
 * timing cookie — token sesi dikembalikan langsung ke client untuk
 * di-setSession(), dan log dicatat di sini dengan akses penuh (admin
 * client), baik hasilnya sukses atau gagal.
 */
export async function POST(request: Request) {
  try {
    const { username, password } = await request.json();
    const cleanUsername = String(username ?? "").trim().toLowerCase();
    if (!cleanUsername || !password) {
      return NextResponse.json({ error: "Username & password wajib diisi." }, { status: 400 });
    }

    const admin = createAdminClient();

    const lockout = await checkLockout(admin, cleanUsername);
    if (lockout.locked) {
      return NextResponse.json(
        {
          error: `Terlalu banyak percobaan gagal. Coba lagi dalam ${Math.ceil(lockout.retryAfterSeconds / 60)} menit.`,
          locked: true,
          retryAfterSeconds: lockout.retryAfterSeconds,
        },
        { status: 429 }
      );
    }

    // Resolusi username -> email lewat RPC security-definer yang sama
    // dipakai login-form sebelumnya (aman dipanggil dari admin client juga).
    //
    // PENTING (v19, bug diperbaiki): sebelumnya baris ini HANYA membaca
    // `data` dan mengabaikan `error` sama sekali — kalau RPC ini gagal
    // dieksekusi (mis. SUPABASE_SERVICE_ROLE_KEY salah/kosong/kadaluarsa,
    // function belum ke-deploy karena migrasi belum lengkap, atau error
    // jaringan/permission apa pun ke Supabase), `error` berisi detailnya
    // tapi `data` (email) juga otomatis null — jatuh ke cabang `if (!email)`
    // yang SAMA seperti "username tidak ditemukan", sehingga user selalu
    // melihat pesan "Username atau password salah" walau username & password
    // yang diketik sudah 100% benar, dan setiap percobaan itu ikut memakan
    // jatah lockout (LOGIN_LOCKOUT_MAX_ATTEMPTS) sampai akhirnya malah
    // "terkunci" tanpa pernah tahu akar masalahnya. Login Google tidak
    // terdampak sama sekali karena jalurnya tidak pernah memanggil RPC ini
    // (cuma butuh anon key) — makanya gejalanya persis "Google bisa,
    // username/password tidak bisa". Sekarang error dicek eksplisit &
    // dibedakan dari "username memang tidak ada": dicatat ke log server
    // (bukan activity_logs, supaya tidak ikut memakan jatah lockout untuk
    // kegagalan yang bukan salah kredensial) dan direspons sebagai error
    // sistem (500) dengan pesan yang jelas, bukan dituduhkan ke user.
    const { data: email, error: rpcError } = await admin.rpc("get_email_by_username", { p_username: cleanUsername });
    if (rpcError) {
      console.error("[api/auth/login] RPC get_email_by_username gagal:", rpcError.message);
      return NextResponse.json(
        { error: "Tidak bisa terhubung ke server saat memproses login. Coba lagi sebentar lagi atau hubungi admin." },
        { status: 500 }
      );
    }
    if (!email) {
      await logActivity({
        admin, userId: null, namaUser: cleanUsername,
        aksi: ACTIVITY_ACTIONS.LOGIN_GAGAL,
        deskripsi: "Percobaan login gagal — username tidak ditemukan",
        request,
      });
      return NextResponse.json({ error: "Username atau password salah." }, { status: 401 });
    }

    const { data: authData, error: authError } = await admin.auth.signInWithPassword({ email, password });
    if (authError || !authData.session) {
      // Sama seperti RPC di atas: authError BUKAN selalu berarti "password
      // salah" — status selain 400 (mis. "Invalid API key", masalah
      // jaringan ke Supabase Auth, dst.) berarti ada masalah sistem, bukan
      // kredensial yang salah. Cuma status 400 ("Invalid login credentials",
      // respons resmi GoTrue untuk password salah) yang dihitung sebagai
      // percobaan gagal & memakan jatah lockout — selain itu dicatat sebagai
      // error sistem supaya tidak menyesatkan user maupun mengunci mereka
      // gara-gara masalah yang bukan salah mereka.
      const isWrongCredentials = authError?.status === 400 || authError?.code === "invalid_credentials";
      if (authError && !isWrongCredentials) {
        console.error("[api/auth/login] signInWithPassword gagal (bukan salah kredensial):", authError.status, authError.message);
        return NextResponse.json(
          { error: "Tidak bisa terhubung ke server saat memproses login. Coba lagi sebentar lagi atau hubungi admin." },
          { status: 500 }
        );
      }

      const { data: profile } = await admin.from("profiles").select("id").eq("username", cleanUsername).maybeSingle();
      // nama_user sengaja diisi USERNAME YANG DIKETIK (bukan nama asli
      // profil) — supaya pengecekan lockout di bawah (checkLockout, yang
      // mencocokkan berdasarkan nama_user) konsisten & akurat untuk kasus
      // "password salah" ini juga, bukan cuma kasus "username tidak ada".
      await logActivity({
        admin,
        userId: profile?.id ?? null,
        namaUser: cleanUsername,
        aksi: ACTIVITY_ACTIONS.LOGIN_GAGAL,
        deskripsi: "Percobaan login gagal — password salah",
        request,
      });
      return NextResponse.json({ error: "Username atau password salah." }, { status: 401 });
    }

    const { data: profile } = await admin.from("profiles").select("nama").eq("id", authData.user.id).maybeSingle();
    await logActivity({
      admin,
      userId: authData.user.id,
      namaUser: profile?.nama ?? authData.user.email ?? cleanUsername,
      aksi: ACTIVITY_ACTIONS.LOGIN,
      deskripsi: "Masuk dengan username & password",
      request,
    });

    return NextResponse.json({
      session: {
        access_token: authData.session.access_token,
        refresh_token: authData.session.refresh_token,
      },
    });
  } catch (err) {
    // Sebelumnya `catch {}` tanpa parameter — error aslinya dibuang total,
    // jadi tidak ada jejak sama sekali di log server untuk debug kalau ini
    // sampai terjadi (mis. SUPABASE_SERVICE_ROLE_KEY kosong bikin
    // createAdminClient() melempar error sebelum sempat masuk try block di
    // atas). Sekarang errornya dicatat ke console server.
    console.error("[api/auth/login] Error tak terduga:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Terjadi kesalahan. Coba lagi." }, { status: 500 });
  }
}

async function checkLockout(admin: ReturnType<typeof createAdminClient>, username: string) {
  const since = new Date(Date.now() - LOGIN_LOCKOUT_WINDOW_MINUTES * 60 * 1000).toISOString();

  // PENTING: sebelumnya fungsi ini cuma menghitung JUMLAH percobaan gagal
  // (count) lalu, kalau sudah melewati batas, selalu mengembalikan
  // retryAfterSeconds = LOGIN_LOCKOUT_WINDOW_MINUTES * 60 (durasi PENUH
  // jendela waktu) — padahal seharusnya itu SISA waktu jeda, bukan durasi
  // penuh. Akibatnya tampilan cooldown di client selalu "reset" ke 5:00
  // setiap kali route ini dipanggil ulang (mis. attempt baru setelah
  // refresh halaman), bukannya melanjutkan hitung mundur yang sebenarnya.
  //
  // Perbaikannya: ambil created_at dari percobaan-percobaan gagal yang
  // relevan, urutkan dari yang TERBARU, lalu ambil percobaan ke-N (N =
  // LOGIN_LOCKOUT_MAX_ATTEMPTS) — begitu percobaan itu "kedaluwarsa" dari
  // jendela waktu (created_at + WINDOW), jumlah percobaan dalam jendela
  // otomatis turun di bawah batas lagi. Waktu itulah retry-after yang
  // SEBENARNYA, dan nilainya makin kecil tiap kali dihitung ulang seiring
  // waktu berjalan — bukan selalu nilai tetap.
  //
  // v18: HANYA per-username (sebelumnya juga per alamat IP — dihapus,
  // lihat catatan LOGIN_LOCKOUT_* di lib/constants.ts untuk alasannya).
  const { data } = await admin
    .from("activity_logs")
    .select("created_at")
    .eq("aksi", ACTIVITY_ACTIONS.LOGIN_GAGAL)
    .eq("nama_user", username)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(LOGIN_LOCKOUT_MAX_ATTEMPTS);
  const rows = data ?? [];

  if (rows.length < LOGIN_LOCKOUT_MAX_ATTEMPTS) {
    return { locked: false as const, retryAfterSeconds: 0 };
  }
  // rows sudah terurut terbaru -> terlama (desc), jadi elemen terakhir di
  // sini adalah percobaan ke-N yang terbaru (yang paling lama di antara N
  // percobaan terbaru tsb) — itulah "ambang" yang menentukan kapan jeda berakhir.
  const boundary = rows[rows.length - 1];
  const unlockAt = new Date(boundary.created_at).getTime() + LOGIN_LOCKOUT_WINDOW_MINUTES * 60 * 1000;

  if (unlockAt > Date.now()) {
    return { locked: true as const, retryAfterSeconds: Math.ceil((unlockAt - Date.now()) / 1000) };
  }
  return { locked: false as const, retryAfterSeconds: 0 };
}
