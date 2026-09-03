-- =====================================================================
-- Zen's Kantin — Skema Konsolidasi (setara baseline + v9 + v10 + v11)
-- =====================================================================
-- File ini adalah HASIL AKHIR skema setelah SEMUA migrasi sebelumnya
-- diterapkan — ditulis ulang jadi SATU definisi bersih per objek (tiap
-- tabel/function/policy hanya didefinisikan SEKALI dalam bentuk
-- finalnya), bukan sekadar menempelkan riwayat perubahan satu per satu.
-- Sebelumnya file ini (dan folder prisma/migrations/) berisi 4 berkas
-- terpisah yang saling menambah/menimpa (get_period_stats misalnya
-- didefinisikan ulang 4 kali) — isinya SAMA PERSIS secara fungsional,
-- cuma sekarang lebih ringkas & gampang dibaca karena riwayat
-- pengeditannya sudah dirapikan jadi satu bentuk akhir.
--
-- 100% idempotent — aman dijalankan berkali-kali, baik di project BARU
-- maupun project yang SUDAH pernah menjalankan versi lama file ini
-- (baseline, atau baseline+v9, atau baseline+v9+v10+v11) — tidak akan
-- menghapus/menduplikasi apa pun, hasil akhirnya identik.
--
-- Cara pakai:
--   • Project baru : jalankan file ini sekali saja, sudah lengkap.
--   • Project lama : aman menjalankan file ini di atas database yang
--                     sudah ada — semua objek idempotent (create table
--                     if not exists, create or replace function, drop+
--                     create policy, insert ... on conflict do nothing).
--   • Lewat Prisma  : lihat folder prisma/migrations/, isinya sama
--                     persis dengan file ini — tinggal `prisma migrate deploy`.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Extensions
-- ---------------------------------------------------------------------
create extension if not exists pgcrypto;
-- pg_cron TIDAK dibuat lewat SQL di sini — aktifkan lewat Supabase
-- Dashboard > Database > Extensions kalau mau reset log otomatis
-- (lihat blok cron di bagian bawah file ini, sudah dibuat aman/opsional).

-- ---------------------------------------------------------------------
-- 2. Enum types
-- ---------------------------------------------------------------------
do $$ begin
  create type user_role as enum ('admin', 'kasir', 'pelanggan');
exception when duplicate_object then null; end $$;

do $$ begin
  create type user_status as enum ('active', 'pending', 'block');
exception when duplicate_object then null; end $$;

do $$ begin
  -- 'tidak_dibayar' dipertahankan di enum ini (bukan dihapus) supaya baris
  -- pesanan LAMA yang sudah kadung berstatus itu (dari sebelum v10) tetap
  -- valid — fitur untuk MEMBUAT status baru dengan nilai ini sudah dihapus
  -- total dari UI & API, jadi tidak akan pernah ada baris BARU dengan
  -- status ini lagi.
  create type payment_status as enum ('pending', 'paid', 'cancelled', 'tidak_dibayar');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- 3. Tabel inti (bentuk akhir — sudah mencakup seluruh kolom yang dulu
--    ditambahkan bertahap lewat alter table di v9/v10)
-- ---------------------------------------------------------------------

create table if not exists profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  nama text not null,
  username text not null unique,
  google_id text,
  role user_role not null default 'pelanggan',
  status user_status not null default 'pending',
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_profiles_status on profiles (status);
create index if not exists idx_profiles_role on profiles (role);

create table if not exists app_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references profiles (id)
);

-- tampilkan_info_pembayaran/tampilkan_teks/info_teks/tampilkan_gambar/
-- info_gambar_url (v9): info pembayaran yang bisa ditampilkan ke
-- pelanggan (teks dan/atau gambar, mis. nomor rekening / kode QRIS)
-- sambil menunggu kasir konfirmasi.
create table if not exists payment_methods (
  id uuid primary key default gen_random_uuid(),
  nama text not null,
  is_active boolean not null default true,
  tampilkan_info_pembayaran boolean not null default false,
  tampilkan_teks boolean not null default false,
  info_teks text,
  tampilkan_gambar boolean not null default false,
  info_gambar_url text,
  created_at timestamptz not null default now()
);

create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  nama text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  nama text not null,
  gambar_url text,
  stok integer not null default 0 check (stok >= 0),
  modal numeric(12, 2) not null default 0 check (modal >= 0),
  harga_jual numeric(12, 2) not null default 0 check (harga_jual >= 0),
  is_active boolean not null default true,
  kategori_id uuid references categories (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_products_kategori on products (kategori_id);

-- dikonfirmasi_pelanggan/dikonfirmasi_pelanggan_at (v9): klaim "saya sudah
-- membayar" dari pelanggan — cuma penanda, tetap menunggu konfirmasi kasir
-- seperti biasa.
-- disampingkan (v10): kasir bisa "menyampingkan" pesanan pending yang
-- pelanggannya mau bayar belakangan, supaya tidak tercampur dengan
-- antrian pesanan baru — cuma penanda urutan tampilan, TIDAK memengaruhi
-- laporan/statistik sama sekali.
create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles (id) on delete set null,
  nama_pemesan text not null,
  produk_id uuid references products (id) on delete set null,
  nama_produk text not null,
  qty integer not null default 1 check (qty > 0),
  modal_satuan numeric(12, 2) not null default 0,
  harga_satuan numeric(12, 2) not null default 0,
  modal_total numeric(12, 2) generated always as (modal_satuan * qty) stored,
  harga_total numeric(12, 2) generated always as (harga_satuan * qty) stored,
  pembayaran_id uuid references payment_methods (id),
  nama_pembayaran text,
  status_pembayaran payment_status not null default 'pending',
  bukti_bayar_url text,
  kasir_id uuid references profiles (id),
  catatan text,
  group_id uuid not null default gen_random_uuid(),
  dikonfirmasi_pelanggan boolean not null default false,
  dikonfirmasi_pelanggan_at timestamptz,
  disampingkan boolean not null default false,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);
create index if not exists idx_orders_status on orders (status_pembayaran);
create index if not exists idx_orders_created on orders (created_at desc);
create index if not exists idx_orders_user on orders (user_id);
create index if not exists idx_orders_group on orders (group_id);
create index if not exists idx_orders_disampingkan on orders (disampingkan) where status_pembayaran = 'pending';

create table if not exists stock_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles (id),
  produk_id uuid references products (id),
  nama_produk text not null,
  total_beli numeric(12, 2) not null default 0,
  qty integer not null check (qty > 0),
  harga_beli_satuan numeric(12, 2) generated always as (
    case when qty > 0 then round(total_beli / qty, 2) else 0 end
  ) stored,
  remaining_qty integer not null default 0 check (remaining_qty >= 0 and remaining_qty <= qty),
  gambar_url text,
  created_at timestamptz not null default now()
);
create index if not exists idx_stock_created on stock_entries (created_at desc);
create index if not exists idx_stock_entries_fifo on stock_entries (produk_id, created_at)
  where remaining_qty > 0;

create table if not exists stock_writeoffs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles (id),
  produk_id uuid references products (id),
  nama_produk text not null,
  qty integer not null check (qty > 0),
  kembalikan_kerugian boolean not null default false,
  kerugian numeric(12, 2) not null default 0,
  keterangan text,
  created_at timestamptz not null default now()
);
create index if not exists idx_writeoffs_created on stock_writeoffs (created_at desc);

create table if not exists expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles (id),
  nama text not null,
  nominal numeric(12, 2) not null default 0 check (nominal >= 0),
  keterangan text,
  gambar_url text,
  created_at timestamptz not null default now()
);
create index if not exists idx_expenses_created on expenses (created_at desc);

-- special_incomes (v9): kebalikan dari Pengeluaran Khusus (mis. jual
-- barang bekas, sewa tempat, donasi). Ikut MENAMBAH keuntungan di
-- laporan. Struktur & pola RLS-nya sengaja sama persis dengan expenses.
create table if not exists special_incomes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles (id),
  nama text not null,
  nominal numeric(12, 2) not null default 0 check (nominal >= 0),
  keterangan text,
  gambar_url text,
  created_at timestamptz not null default now()
);
create index if not exists idx_special_incomes_created on special_incomes (created_at desc);

create table if not exists saved_customers (
  id uuid primary key default gen_random_uuid(),
  nama text not null unique,
  created_at timestamptz not null default now()
);

-- ip_address/user_agent/perangkat/kota/wilayah/negara (v9): pencatatan log
-- dipindah sepenuhnya ke level aplikasi (Route Handler, lihat
-- src/lib/activity-log.ts) — itulah satu-satunya tempat yang punya akses
-- ke Request (IP & User-Agent). Tidak ada lagi trigger DB otomatis yang
-- menulis log dari dalam database.
create table if not exists activity_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles (id) on delete set null,
  nama_user text,
  aksi text not null,
  deskripsi text,
  ip_address text,
  user_agent text,
  perangkat text,
  kota text,
  wilayah text,
  negara text,
  created_at timestamptz not null default now()
);
create index if not exists idx_logs_created on activity_logs (created_at desc);

-- Jaga-jaga untuk project yang sudah pernah menjalankan versi LAMA file
-- ini sebelum tabel di atas mendapat kolom-kolom baru (v9/v10) — kalau
-- create table di atas di-skip karena tabelnya sudah ada duluan (dari
-- baseline lama), pastikan kolom barunya tetap menyusul lewat alter di
-- sini. Tidak berpengaruh apa-apa untuk project baru (kolomnya sudah ada
-- dari create table di atas, alter ... if not exists jadi no-op).
alter table payment_methods add column if not exists tampilkan_info_pembayaran boolean not null default false;
alter table payment_methods add column if not exists tampilkan_teks boolean not null default false;
alter table payment_methods add column if not exists info_teks text;
alter table payment_methods add column if not exists tampilkan_gambar boolean not null default false;
alter table payment_methods add column if not exists info_gambar_url text;
alter table orders add column if not exists dikonfirmasi_pelanggan boolean not null default false;
alter table orders add column if not exists dikonfirmasi_pelanggan_at timestamptz;
alter table orders add column if not exists disampingkan boolean not null default false;
alter table activity_logs add column if not exists ip_address text;
alter table activity_logs add column if not exists user_agent text;
alter table activity_logs add column if not exists perangkat text;
alter table activity_logs add column if not exists kota text;
alter table activity_logs add column if not exists wilayah text;
alter table activity_logs add column if not exists negara text;

-- Project yang sudah pernah menjalankan migrasi jauh lebih lama (sebelum
-- baseline konsolidasi ini ada) mungkin masih punya trigger log otomatis
-- di database — dihapus di sini karena pencatatan log sudah sepenuhnya
-- dipindah ke level aplikasi (lihat komentar di tabel activity_logs).
drop trigger if exists trg_log_daftar on profiles;
drop function if exists log_daftar();
drop trigger if exists trg_log_pesanan on orders;
drop function if exists log_pesanan_masuk();
drop trigger if exists trg_log_pembayaran on orders;
drop function if exists log_pembayaran();

-- ---------------------------------------------------------------------
-- 4. Helper function untuk RLS (hindari infinite recursion di policy profiles)
-- ---------------------------------------------------------------------
create or replace function current_role_v() returns text
  language sql stable security definer set search_path = public as $$
  select role::text from profiles where id = auth.uid();
$$;

create or replace function is_staff() returns boolean
  language sql stable security definer set search_path = public as $$
  select coalesce((select role in ('admin', 'kasir') from profiles where id = auth.uid()), false);
$$;

create or replace function is_admin() returns boolean
  language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'admin' from profiles where id = auth.uid()), false);
$$;

-- ---------------------------------------------------------------------
-- 5. Row Level Security
-- Prinsip: SEMUA tulis-menulis (insert/update/delete) untuk data sensitif
-- (profiles, products, payment_methods, app_settings, stock_entries)
-- dilakukan lewat route Next.js dengan service_role key (lihat src/lib/
-- supabase/require-role.ts) sehingga otomatis melewati RLS. RLS di sini
-- fokus pada SELECT (siapa boleh baca apa) sebagai lapisan pertahanan.
-- Pesanan (orders) ditulis lewat function SECURITY DEFINER
-- (create_order_batch, confirm_payment, dst) yang memvalidasi role di
-- dalam function itu sendiri.
-- ---------------------------------------------------------------------
alter table profiles enable row level security;
alter table app_settings enable row level security;
alter table payment_methods enable row level security;
alter table categories enable row level security;
alter table products enable row level security;
alter table orders enable row level security;
alter table stock_entries enable row level security;
alter table stock_writeoffs enable row level security;
alter table expenses enable row level security;
alter table special_incomes enable row level security;
alter table saved_customers enable row level security;
alter table activity_logs enable row level security;

drop policy if exists "profiles_select" on profiles;
create policy "profiles_select" on profiles for select
  using (id = auth.uid() or is_staff());

-- app_settings: TIDAK ada policy select/write untuk role authenticated/anon.
-- PIN kasir hanya bisa dibaca/diubah lewat route server (service_role),
-- supaya kasir tidak bisa melihat PIN langsung dari client.

drop policy if exists "payment_methods_select" on payment_methods;
create policy "payment_methods_select" on payment_methods for select
  using (auth.uid() is not null);

drop policy if exists "categories_select" on categories;
create policy "categories_select" on categories for select
  using (auth.uid() is not null);

drop policy if exists "products_select" on products;
create policy "products_select" on products for select
  using (auth.uid() is not null);

drop policy if exists "orders_select" on orders;
create policy "orders_select" on orders for select
  using (user_id = auth.uid() or is_staff());

drop policy if exists "stock_entries_select" on stock_entries;
create policy "stock_entries_select" on stock_entries for select
  using (is_staff());

drop policy if exists "stock_writeoffs_select" on stock_writeoffs;
create policy "stock_writeoffs_select" on stock_writeoffs for select
  using (is_staff());

drop policy if exists "expenses_select" on expenses;
create policy "expenses_select" on expenses for select using (is_admin());

drop policy if exists "special_incomes_select" on special_incomes;
create policy "special_incomes_select" on special_incomes for select using (is_admin());
-- insert/update/delete lewat route service-role admin, konsisten dengan pola expenses.

drop policy if exists "saved_customers_select" on saved_customers;
create policy "saved_customers_select" on saved_customers for select using (is_staff());

drop policy if exists "activity_logs_select" on activity_logs;
create policy "activity_logs_select" on activity_logs for select
  using (is_admin());

-- ---------------------------------------------------------------------
-- 6. Function login by username, & transaksi inti (order/pembayaran)
-- ---------------------------------------------------------------------

-- Login pakai username: cari email terkait supaya bisa signInWithPassword.
-- SECURITY DEFINER karena anon (belum login) perlu memanggil ini.
create or replace function get_email_by_username(p_username text) returns text
  language sql stable security definer set search_path = public as $$
  select email from profiles where username = lower(p_username) limit 1;
$$;
revoke all on function get_email_by_username(text) from public;
-- service_role WAJIB ikut di-grant: `revoke all ... from public` di atas juga
-- mencabut default privileges Supabase, dan /api/auth/login memanggil function
-- ini dari server memakai service_role key. Tanpa grant ini, setiap login
-- username/password ditolak dengan 42501 permission denied for function.
grant execute on function get_email_by_username(text) to anon, authenticated, service_role;

-- Satu checkout bisa berisi beberapa produk sekaligus (satu keranjang),
-- semua baris berbagi group_id yang sama. Kasir/admin juga bisa memakai
-- ini untuk pesanan "walk-in" (pelanggan tanpa akun, user_id NULL) lewat
-- parameter nama pemesan manual. Modal dihitung FIFO dari batch stok
-- (stock_entries.remaining_qty) yang benar-benar terpakai.
create or replace function create_order_batch(
  p_items jsonb, -- [{"produk_id": "...", "qty": 2}, ...]
  p_pembayaran_id uuid,
  p_nama_pemesan text default null
) returns setof orders
  language plpgsql security definer set search_path = public as $$
declare
  v_profile profiles;
  v_payment payment_methods;
  v_group_id uuid := gen_random_uuid();
  v_user_id uuid;
  v_nama text;
  v_item jsonb;
  v_product products;
  v_produk_id uuid;
  v_qty integer;
  v_order orders;
  v_batch record;
  v_to_consume integer;
  v_consumed integer;
  v_total_cost numeric;
  v_weighted_modal numeric;
begin
  select * into v_profile from profiles where id = auth.uid();
  if v_profile is null or v_profile.status <> 'active' then
    raise exception 'Akun tidak diizinkan membuat pesanan.';
  end if;

  if v_profile.role = 'pelanggan' then
    v_user_id := v_profile.id;
    v_nama := v_profile.nama;
  elsif v_profile.role in ('kasir', 'admin') then
    v_user_id := null;
    v_nama := coalesce(nullif(trim(p_nama_pemesan), ''), 'Pelanggan Langsung');
    if v_nama <> 'Pelanggan Langsung' then
      insert into saved_customers (nama) values (v_nama) on conflict (nama) do nothing;
    end if;
  else
    raise exception 'Akun tidak diizinkan membuat pesanan.';
  end if;

  select * into v_payment from payment_methods where id = p_pembayaran_id and is_active = true;
  if v_payment is null then
    raise exception 'Metode pembayaran tidak valid.';
  end if;

  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'Keranjang kosong.';
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_produk_id := (v_item ->> 'produk_id')::uuid;
    v_qty := (v_item ->> 'qty')::integer;

    if v_qty is null or v_qty <= 0 then
      raise exception 'Jumlah pesanan tidak valid.';
    end if;

    select * into v_product from products where id = v_produk_id and is_active = true for update;
    if v_product is null then
      raise exception 'Produk tidak ditemukan atau sudah tidak tersedia.';
    end if;
    if v_product.stok < v_qty then
      raise exception 'Stok % tidak cukup (sisa %).', v_product.nama, v_product.stok;
    end if;

    -- Konsumsi FIFO: ambil dari batch stok_entries TERLAMA dulu.
    v_to_consume := v_qty;
    v_total_cost := 0;
    for v_batch in
      select id, remaining_qty, harga_beli_satuan
      from stock_entries
      where produk_id = v_produk_id and remaining_qty > 0
      order by created_at asc
      for update
    loop
      exit when v_to_consume <= 0;
      v_consumed := least(v_batch.remaining_qty, v_to_consume);
      update stock_entries set remaining_qty = remaining_qty - v_consumed where id = v_batch.id;
      v_total_cost := v_total_cost + (v_consumed * v_batch.harga_beli_satuan);
      v_to_consume := v_to_consume - v_consumed;
    end loop;

    if v_to_consume > 0 then
      -- Batch FIFO tidak cukup menutupi qty (mis. data lama) — sisanya
      -- pakai modal produk saat ini sebagai fallback.
      v_total_cost := v_total_cost + (v_to_consume * v_product.modal);
    end if;

    v_weighted_modal := round(v_total_cost / v_qty, 2);

    update products set stok = stok - v_qty, updated_at = now() where id = v_produk_id;

    insert into orders (
      group_id, user_id, nama_pemesan, produk_id, nama_produk, qty,
      modal_satuan, harga_satuan, pembayaran_id, nama_pembayaran
    ) values (
      v_group_id, v_user_id, v_nama, v_product.id, v_product.nama, v_qty,
      v_weighted_modal, v_product.harga_jual, v_payment.id, v_payment.nama
    ) returning * into v_order;

    return next v_order;
  end loop;

  return;
end;
$$;
revoke all on function create_order_batch(jsonb, uuid, text) from public;
grant execute on function create_order_batch(jsonb, uuid, text) to authenticated;

create or replace function confirm_payment(p_order_id uuid, p_bukti_bayar_url text default null)
returns orders
  language plpgsql security definer set search_path = public as $$
declare
  v_caller profiles;
  v_order orders;
begin
  select * into v_caller from profiles where id = auth.uid();
  if v_caller is null or v_caller.status <> 'active' or v_caller.role not in ('kasir', 'admin') then
    raise exception 'Akun tidak diizinkan mengonfirmasi pembayaran.';
  end if;

  update orders
    set status_pembayaran = 'paid', paid_at = now(), kasir_id = v_caller.id,
        bukti_bayar_url = coalesce(p_bukti_bayar_url, bukti_bayar_url)
    where id = p_order_id and status_pembayaran <> 'paid'
    returning * into v_order;

  if v_order is null then
    raise exception 'Pesanan tidak ditemukan atau sudah lunas.';
  end if;

  return v_order;
end;
$$;
revoke all on function confirm_payment(uuid, text) from public;
grant execute on function confirm_payment(uuid, text) to authenticated;

create or replace function confirm_payment_batch(p_order_ids uuid[], p_bukti_bayar_url text default null)
returns setof orders
  language plpgsql security definer set search_path = public as $$
declare
  v_caller profiles;
  v_id uuid;
  v_order orders;
begin
  select * into v_caller from profiles where id = auth.uid();
  if v_caller is null or v_caller.status <> 'active' or v_caller.role not in ('kasir', 'admin') then
    raise exception 'Akun tidak diizinkan mengonfirmasi pembayaran.';
  end if;

  foreach v_id in array p_order_ids loop
    update orders
      set status_pembayaran = 'paid', paid_at = now(), kasir_id = v_caller.id,
          bukti_bayar_url = coalesce(p_bukti_bayar_url, bukti_bayar_url)
      where id = v_id and status_pembayaran <> 'paid'
      returning * into v_order;
    if v_order is not null then
      return next v_order;
    end if;
  end loop;
  return;
end;
$$;
revoke all on function confirm_payment_batch(uuid[], text) from public;
grant execute on function confirm_payment_batch(uuid[], text) to authenticated;

-- Klaim "saya sudah membayar" dari pelanggan sendiri (v9) — cuma penanda,
-- tetap menunggu konfirmasi kasir seperti biasa lewat confirm_payment(_batch).
create or replace function confirm_customer_paid(p_group_id uuid)
returns setof orders
  language plpgsql security definer set search_path = public as $$
declare
  v_user_id uuid := auth.uid();
  v_count integer;
begin
  if v_user_id is null then
    raise exception 'Harus login.';
  end if;

  select count(*) into v_count from orders where group_id = p_group_id and user_id = v_user_id;
  if v_count = 0 then
    raise exception 'Pesanan tidak ditemukan.';
  end if;

  return query
    update orders
      set dikonfirmasi_pelanggan = true, dikonfirmasi_pelanggan_at = now()
      where group_id = p_group_id and user_id = v_user_id and status_pembayaran = 'pending'
      returning *;
end;
$$;
revoke all on function confirm_customer_paid(uuid) from public;
grant execute on function confirm_customer_paid(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 7. Stok: retract (tarik kembali stok masuk) & write-off (hapus/rusak)
-- ---------------------------------------------------------------------

-- retract_stock_entry: syaratnya batch belum tersentuh sama sekali
-- (remaining_qty = qty), supaya konsisten dengan pelacakan FIFO per-batch.
create or replace function retract_stock_entry(p_entry_id uuid)
returns stock_entries
  language plpgsql security definer set search_path = public as $$
declare
  v_caller profiles;
  v_entry stock_entries;
begin
  select * into v_caller from profiles where id = auth.uid();
  if v_caller is null or v_caller.status <> 'active' or v_caller.role not in ('kasir', 'admin') then
    raise exception 'Akun tidak diizinkan menarik kembali stok.';
  end if;

  select * into v_entry from stock_entries where id = p_entry_id for update;
  if v_entry is null then
    raise exception 'Entri stok tidak ditemukan.';
  end if;
  if v_entry.remaining_qty < v_entry.qty then
    raise exception 'Sebagian stok dari input ini sudah terjual/terpakai, tidak bisa ditarik kembali sepenuhnya.';
  end if;

  update products set stok = stok - v_entry.qty, updated_at = now() where id = v_entry.produk_id;
  delete from stock_entries where id = p_entry_id;

  return v_entry;
end;
$$;
revoke all on function retract_stock_entry(uuid) from public;
grant execute on function retract_stock_entry(uuid) to authenticated;

-- create_stock_writeoff: menghapuskan stok (rusak/hilang/kadaluarsa).
-- v18: MURNI mengurangi stok — tidak ada perhitungan/pengembalian kerugian
-- di sini sama sekali. Input stok sudah dihitung sebagai kerugian penuh
-- saat itu juga (lihat get_period_stats), jadi write-off tidak pernah
-- mengubah angka kerugian yang sudah tercatat. (Kolom kembalikan_kerugian
-- & kerugian di tabel stock_writeoffs TETAP disimpan apa adanya untuk
-- riwayat lama sebelum v18 — fungsi ini sekarang selalu mengisinya false/0.)
create or replace function create_stock_writeoff(
  p_produk_id uuid, p_qty integer, p_keterangan text default null
) returns stock_writeoffs
  language plpgsql security definer set search_path = public as $$
declare
  v_caller profiles;
  v_product products;
  v_writeoff stock_writeoffs;
begin
  select * into v_caller from profiles where id = auth.uid();
  if v_caller is null or v_caller.status <> 'active' or v_caller.role not in ('kasir', 'admin') then
    raise exception 'Akun tidak diizinkan menghapus stok.';
  end if;

  if p_qty is null or p_qty <= 0 then
    raise exception 'Jumlah tidak valid.';
  end if;

  select * into v_product from products where id = p_produk_id for update;
  if v_product is null then
    raise exception 'Produk tidak ditemukan.';
  end if;
  if v_product.stok < p_qty then
    raise exception 'Stok % tidak cukup (sisa %).', v_product.nama, v_product.stok;
  end if;

  update products set stok = stok - p_qty, updated_at = now() where id = p_produk_id;

  insert into stock_writeoffs (user_id, produk_id, nama_produk, qty, kembalikan_kerugian, kerugian, keterangan)
    values (v_caller.id, v_product.id, v_product.nama, p_qty, false, 0, p_keterangan)
    returning * into v_writeoff;

  return v_writeoff;
end;
$$;
-- Hapus overload versi lama (4 argumen, dengan p_kembalikan_kerugian) —
-- create-or-replace TIDAK mengganti fungsi kalau daftar argumennya beda,
-- jadi tanpa drop ini overload lama akan tetap nyangkut & masih bisa
-- dipanggil di database yang sudah lebih dulu menjalankan schema.sql versi sebelum v18.
drop function if exists create_stock_writeoff(uuid, integer, boolean, text);
revoke all on function create_stock_writeoff(uuid, integer, text) from public;
grant execute on function create_stock_writeoff(uuid, integer, text) to authenticated;

-- Membatalkan pencatatan write-off — stok otomatis pulih, kerugian
-- otomatis ikut pulih karena barisnya tidak lagi terhitung di laporan.
create or replace function delete_stock_writeoff(p_id uuid)
returns void
  language plpgsql security definer set search_path = public as $$
declare
  v_caller profiles;
  v_writeoff stock_writeoffs;
begin
  select * into v_caller from profiles where id = auth.uid();
  if v_caller is null or v_caller.status <> 'active' or v_caller.role not in ('kasir', 'admin') then
    raise exception 'Akun tidak diizinkan menghapus data ini.';
  end if;

  select * into v_writeoff from stock_writeoffs where id = p_id;
  if v_writeoff is null then
    raise exception 'Data penghapusan stok tidak ditemukan.';
  end if;

  if v_writeoff.produk_id is not null then
    update products set stok = stok + v_writeoff.qty, updated_at = now() where id = v_writeoff.produk_id;
  end if;

  delete from stock_writeoffs where id = p_id;
end;
$$;
revoke all on function delete_stock_writeoff(uuid) from public;
grant execute on function delete_stock_writeoff(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 8. Pengaturan kunci PIN kasir
-- ---------------------------------------------------------------------
create or replace function get_lock_interval_minutes()
returns integer
  language sql stable security definer set search_path = public as $$
  select coalesce((select value::integer from app_settings where key = 'kasir_lock_interval_minutes'), 3);
$$;
revoke all on function get_lock_interval_minutes() from public;
grant execute on function get_lock_interval_minutes() to authenticated;

-- ---------------------------------------------------------------------
-- 9. Laporan: statistik per periode & ringkasan bulanan
--
-- Model akuntansi: input stok (stock_entries.total_beli) dihitung sebagai
-- kerugian/pengeluaran penuh SAAT ITU JUGA (uang sudah keluar begitu
-- belanja stok, bukan ditunggu sampai laku), dikurangi kerugian yang
-- "dikembalikan" lewat penghapusan stok (stock_writeoffs.kembalikan_
-- kerugian). Kolom `modal` (biaya pokok pesanan) dikembalikan untuk
-- referensi margin saja, TIDAK dikurangkan lagi terpisah di untung
-- (sudah tercakup di kerugian_stok saat stoknya dibeli).
--
-- `saldo` (v11) — saldo KAS KUMULATIF kantin per akhir periode (p_end),
-- BUKAN cuma dalam rentang p_start..p_end seperti kolom lain. Dihitung
-- dari SELURUH riwayat sejak awal (created_at < p_end): total pendapatan
-- lunas + pemasukan khusus, dikurangi pengeluaran khusus dan belanja
-- stok bersih (belanja − kerugian yang dikembalikan). Ini "uang yang
-- benar-benar ada di kantin saat ini" — beda dari Keuntungan Bersih
-- (`untung`) yang cuma untung/rugi PADA periode itu saja.
-- `pendapatan_pending` (v11) — total nilai rupiah pesanan yang masih
-- pending pada periode ini, dipasangkan dengan `jumlah_pending`, supaya
-- kartu "Pesanan Belum Dibayar" bisa menampilkan nominal, bukan cuma
-- jumlah pesanan.
-- ---------------------------------------------------------------------
drop function if exists get_period_stats(timestamptz, timestamptz);

create or replace function get_period_stats(p_start timestamptz, p_end timestamptz)
returns table (
  modal numeric, pendapatan numeric, pengeluaran numeric, kerugian_stok numeric,
  pemasukan_khusus numeric, untung numeric, saldo numeric, pendapatan_pending numeric,
  jumlah_pesanan bigint, jumlah_pending bigint, jumlah_dibatalkan bigint
)
  language sql stable set search_path = public as $$
  select
    coalesce(o.modal, 0) as modal,
    coalesce(o.pendapatan, 0) as pendapatan,
    coalesce(e.pengeluaran, 0) as pengeluaran,
    coalesce(s.belanja_stok, 0) - coalesce(w.kerugian_dikembalikan, 0) as kerugian_stok,
    coalesce(i.pemasukan_khusus, 0) as pemasukan_khusus,
    coalesce(o.pendapatan, 0) - coalesce(e.pengeluaran, 0)
      - (coalesce(s.belanja_stok, 0) - coalesce(w.kerugian_dikembalikan, 0))
      + coalesce(i.pemasukan_khusus, 0) as untung,
    coalesce(ca.pendapatan_all, 0) + coalesce(ca.pemasukan_all, 0)
      - coalesce(ca.pengeluaran_all, 0)
      - (coalesce(ca.belanja_all, 0) - coalesce(ca.kerugian_dikembalikan_all, 0)) as saldo,
    coalesce(o.pendapatan_pending, 0) as pendapatan_pending,
    coalesce(o.jumlah_pesanan, 0) as jumlah_pesanan,
    coalesce(o.jumlah_pending, 0) as jumlah_pending,
    coalesce(o.jumlah_dibatalkan, 0) as jumlah_dibatalkan
  from (
    select
      -- 'tidak_dibayar' dipertahankan di filter modal (bukan cuma 'paid')
      -- supaya baris LAMA dari sebelum v10 tetap terhitung akurat sebagai
      -- biaya pokok — fitur pembuatan statusnya sendiri sudah dihapus.
      sum(modal_total) filter (where status_pembayaran in ('paid', 'tidak_dibayar')) as modal,
      sum(harga_total) filter (where status_pembayaran = 'paid') as pendapatan,
      sum(harga_total) filter (where status_pembayaran = 'pending') as pendapatan_pending,
      count(*) filter (where status_pembayaran = 'paid') as jumlah_pesanan,
      count(*) filter (where status_pembayaran = 'pending') as jumlah_pending,
      count(*) filter (where status_pembayaran = 'cancelled') as jumlah_dibatalkan
    from orders
    where created_at >= p_start and created_at < p_end
  ) o
  cross join (
    select sum(nominal) as pengeluaran from expenses where created_at >= p_start and created_at < p_end
  ) e
  cross join (
    select sum(total_beli) as belanja_stok from stock_entries
    where created_at >= p_start and created_at < p_end
  ) s
  cross join (
    select sum(kerugian) as kerugian_dikembalikan from stock_writeoffs
    where kembalikan_kerugian = true and created_at >= p_start and created_at < p_end
  ) w
  cross join (
    select sum(nominal) as pemasukan_khusus from special_incomes
    where created_at >= p_start and created_at < p_end
  ) i
  cross join (
    select
      (select sum(harga_total) from orders where status_pembayaran = 'paid' and created_at < p_end) as pendapatan_all,
      (select sum(nominal) from special_incomes where created_at < p_end) as pemasukan_all,
      (select sum(nominal) from expenses where created_at < p_end) as pengeluaran_all,
      (select sum(total_beli) from stock_entries where created_at < p_end) as belanja_all,
      (select sum(kerugian) from stock_writeoffs where kembalikan_kerugian = true and created_at < p_end) as kerugian_dikembalikan_all
  ) ca;
$$;
grant execute on function get_period_stats(timestamptz, timestamptz) to authenticated;

drop function if exists get_monthly_summary(integer);

create or replace function get_monthly_summary(p_months integer default 6)
returns table (
  bulan date, modal numeric, pendapatan numeric, pengeluaran numeric, kerugian_stok numeric,
  pemasukan_khusus numeric, untung numeric, jumlah_pesanan bigint
)
  language sql stable set search_path = public as $$
  with bulan_series as (
    select (date_trunc('month', now()) - (n || ' months')::interval)::date as bulan
    from generate_series(0, greatest(p_months, 1) - 1) as n
  ),
  order_agg as (
    select date_trunc('month', created_at)::date as bulan,
      sum(modal_total) filter (where status_pembayaran in ('paid', 'tidak_dibayar')) as modal,
      sum(harga_total) filter (where status_pembayaran = 'paid') as pendapatan,
      count(*) filter (where status_pembayaran = 'paid') as jumlah_pesanan
    from orders
    where created_at >= date_trunc('month', now()) - ((greatest(p_months, 1) - 1) || ' months')::interval
    group by 1
  ),
  expense_agg as (
    select date_trunc('month', created_at)::date as bulan, sum(nominal) as pengeluaran
    from expenses
    where created_at >= date_trunc('month', now()) - ((greatest(p_months, 1) - 1) || ' months')::interval
    group by 1
  ),
  stock_agg as (
    select date_trunc('month', created_at)::date as bulan, sum(total_beli) as belanja_stok
    from stock_entries
    where created_at >= date_trunc('month', now()) - ((greatest(p_months, 1) - 1) || ' months')::interval
    group by 1
  ),
  writeoff_agg as (
    select date_trunc('month', created_at)::date as bulan, sum(kerugian) as kerugian_dikembalikan
    from stock_writeoffs
    where kembalikan_kerugian = true
      and created_at >= date_trunc('month', now()) - ((greatest(p_months, 1) - 1) || ' months')::interval
    group by 1
  ),
  income_agg as (
    select date_trunc('month', created_at)::date as bulan, sum(nominal) as pemasukan_khusus
    from special_incomes
    where created_at >= date_trunc('month', now()) - ((greatest(p_months, 1) - 1) || ' months')::interval
    group by 1
  )
  select
    bs.bulan,
    coalesce(oa.modal, 0) as modal,
    coalesce(oa.pendapatan, 0) as pendapatan,
    coalesce(ea.pengeluaran, 0) as pengeluaran,
    coalesce(sa.belanja_stok, 0) - coalesce(wa.kerugian_dikembalikan, 0) as kerugian_stok,
    coalesce(ia.pemasukan_khusus, 0) as pemasukan_khusus,
    coalesce(oa.pendapatan, 0) - coalesce(ea.pengeluaran, 0)
      - (coalesce(sa.belanja_stok, 0) - coalesce(wa.kerugian_dikembalikan, 0))
      + coalesce(ia.pemasukan_khusus, 0) as untung,
    coalesce(oa.jumlah_pesanan, 0) as jumlah_pesanan
  from bulan_series bs
  left join order_agg oa on oa.bulan = bs.bulan
  left join expense_agg ea on ea.bulan = bs.bulan
  left join stock_agg sa on sa.bulan = bs.bulan
  left join writeoff_agg wa on wa.bulan = bs.bulan
  left join income_agg ia on ia.bulan = bs.bulan
  order by bs.bulan;
$$;
grant execute on function get_monthly_summary(integer) to authenticated;

-- ---------------------------------------------------------------------
-- 10. Trigger: updated_at otomatis, stok masuk, & integritas stok pesanan
-- ---------------------------------------------------------------------
create or replace function set_updated_at() returns trigger
  language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_updated_at on profiles;
create trigger trg_profiles_updated_at before update on profiles
  for each row execute function set_updated_at();

drop trigger if exists trg_products_updated_at on products;
create trigger trg_products_updated_at before update on products
  for each row execute function set_updated_at();

-- Stok masuk -> tambah stok & perbarui modal terbaru produk terkait.
-- PENTING: harga per unit dihitung MANUAL di sini (dari total_beli/qty),
-- bukan dibaca dari new.harga_beli_satuan — kolom GENERATED itu baru
-- dihitung Postgres SETELAH trigger BEFORE selesai, jadi kalau dibaca
-- di sini nilainya masih NULL (bug lama, sudah diperbaiki).
create or replace function apply_stock_entry() returns trigger
  language plpgsql security definer set search_path = public as $$
declare
  v_harga_satuan numeric(12, 2);
begin
  new.remaining_qty := new.qty;
  v_harga_satuan := case when new.qty > 0 then round(new.total_beli / new.qty, 2) else 0 end;

  update products
    set stok = stok + new.qty, modal = v_harga_satuan, updated_at = now()
    where id = new.produk_id;

  return new;
end;
$$;

drop trigger if exists trg_stock_entry_apply on stock_entries;
create trigger trg_stock_entry_apply before insert on stock_entries
  for each row execute function apply_stock_entry();

-- Pesanan dibatalkan (status -> 'cancelled'): stok produk dikembalikan.
-- Berlaku di level tabel supaya konsisten untuk SEMUA jalur perubahan
-- status, bukan cuma satu tempat di kode aplikasi.
create or replace function handle_order_cancel_stock() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if new.produk_id is not null then
    if new.status_pembayaran = 'cancelled' and old.status_pembayaran <> 'cancelled' then
      update products set stok = stok + new.qty, updated_at = now() where id = new.produk_id;
    elsif old.status_pembayaran = 'cancelled' and new.status_pembayaran <> 'cancelled' then
      update products set stok = stok - new.qty, updated_at = now() where id = new.produk_id;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_order_cancel_stock on orders;
create trigger trg_order_cancel_stock
  after update of status_pembayaran on orders
  for each row execute function handle_order_cancel_stock();

-- ---------------------------------------------------------------------
-- 11. Storage (gambar produk, bukti bayar, struk pengeluaran, dll)
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
  values ('kantin-images', 'kantin-images', true)
  on conflict (id) do nothing;

drop policy if exists "kantin_images_read" on storage.objects;
create policy "kantin_images_read" on storage.objects for select
  using (bucket_id = 'kantin-images');

drop policy if exists "kantin_images_insert" on storage.objects;
create policy "kantin_images_insert" on storage.objects for insert
  with check (
    bucket_id = 'kantin-images'
    and auth.uid() in (select id from profiles where status = 'active')
  );

drop policy if exists "kantin_images_update" on storage.objects;
create policy "kantin_images_update" on storage.objects for update
  using (
    bucket_id = 'kantin-images'
    and auth.uid() in (select id from profiles where status = 'active')
  );

drop policy if exists "kantin_images_delete" on storage.objects;
create policy "kantin_images_delete" on storage.objects for delete
  using (
    bucket_id = 'kantin-images'
    and auth.uid() in (select id from profiles where status = 'active')
  );

-- ---------------------------------------------------------------------
-- 12. Realtime publication
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'orders'
  ) then
    alter publication supabase_realtime add table orders;
  end if;
exception when others then
  raise notice 'Gagal menambahkan orders ke publication realtime — tambahkan manual lewat Database > Replication.';
end $$;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'products'
  ) then
    alter publication supabase_realtime add table products;
  end if;
exception when others then
  raise notice 'Gagal menambahkan products ke publication realtime — tambahkan manual lewat Database > Replication.';
end $$;

-- ---------------------------------------------------------------------
-- 13. Data awal
-- ---------------------------------------------------------------------
insert into app_settings (key, value) values ('kasir_pin', '8888')
  on conflict (key) do nothing;
insert into app_settings (key, value) values ('kasir_lock_interval_minutes', '3')
  on conflict (key) do nothing;

insert into payment_methods (nama) values ('Tunai') on conflict do nothing;
insert into payment_methods (nama) values ('QRIS') on conflict do nothing;

-- ---------------------------------------------------------------------
-- 14. Reset log bulanan otomatis (pg_cron) — OPSIONAL
-- Butuh extension pg_cron aktif (Database > Extensions di Supabase
-- Dashboard). Kalau tidak tersedia di paket kamu, blok ini otomatis
-- dilewati (tidak error) — pakai tombol "Reset Log" manual di halaman
-- Admin > Log Aktivitas sebagai gantinya.
-- ---------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'reset-activity-logs-monthly';
    perform cron.schedule(
      'reset-activity-logs-monthly',
      '0 0 1 * *',
      $cron$ delete from public.activity_logs; $cron$
    );
  end if;
exception when others then
  raise notice 'pg_cron tidak tersedia — gunakan tombol Reset Log manual di halaman admin.';
end $$;
