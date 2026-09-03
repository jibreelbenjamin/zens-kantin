/**
 * Helper pagination sisi server untuk DataTable.
 *
 * Halaman admin membaca `searchParams` (page, per, q, sort, dir, f_<kolom>),
 * lalu helper ini menerjemahkannya jadi query Supabase yang cuma mengambil
 * satu halaman data plus jumlah total baris (`count: "exact"`). Dengan begitu
 * tabel besar (pesanan, log, stok) tidak lagi dikirim utuh ke browser.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export const PAGE_SIZES = [10, 20, 30, 50, 100];
export const DEFAULT_PAGE_SIZE = 10;

export type SearchParams = Record<string, string | string[] | undefined>;

export type TableQueryConfig = {
  /** Kolom teks yang ikut dicari saat pengguna mengetik di kotak pencarian. */
  searchColumns?: string[];
  /** Kolom yang boleh dipakai ORDER BY. Kolom hasil hitungan tidak masuk sini. */
  sortColumns?: string[];
  /** Kolom yang boleh difilter lewat faceted filter (klausa IN). */
  filterColumns?: string[];
  defaultSort?: { column: string; ascending?: boolean };
  defaultPageSize?: number;
  /** Awalan nama parameter URL — dipakai kalau satu halaman punya >1 tabel. */
  prefix?: string;
};

export type TableParams = {
  pageIndex: number;
  pageSize: number;
  q: string;
  sort: string | null;
  dir: "asc" | "desc";
  filters: Record<string, string[]>;
};

function readAll(searchParams: SearchParams, key: string): string[] {
  const raw = searchParams[key];
  if (raw === undefined) return [];
  return Array.isArray(raw) ? raw : [raw];
}

function readOne(searchParams: SearchParams, key: string): string | undefined {
  return readAll(searchParams, key)[0];
}

/** Baca state tabel dari URL, sudah divalidasi terhadap whitelist di config. */
export function parseTableParams(searchParams: SearchParams, config: TableQueryConfig = {}): TableParams {
  const p = config.prefix ?? "";
  const defaultPageSize = config.defaultPageSize ?? DEFAULT_PAGE_SIZE;

  const pageSizeRaw = Number(readOne(searchParams, `${p}per`));
  const pageSize = PAGE_SIZES.includes(pageSizeRaw) ? pageSizeRaw : defaultPageSize;

  const pageRaw = Number(readOne(searchParams, `${p}page`));
  const pageIndex = Number.isFinite(pageRaw) && pageRaw >= 1 ? Math.floor(pageRaw) - 1 : 0;

  const sortRaw = readOne(searchParams, `${p}sort`) ?? null;
  const sort = sortRaw && (config.sortColumns ?? []).includes(sortRaw) ? sortRaw : null;
  const dir = readOne(searchParams, `${p}dir`) === "asc" ? "asc" : "desc";

  const filters: Record<string, string[]> = {};
  for (const col of config.filterColumns ?? []) {
    const values = readAll(searchParams, `${p}f_${col}`).filter(Boolean);
    if (values.length) filters[col] = values;
  }

  return { pageIndex, pageSize, q: (readOne(searchParams, `${p}q`) ?? "").trim(), sort, dir, filters };
}

/** Ubah string "true"/"false" jadi boolean supaya cocok dengan kolom boolean. */
function coerce(values: string[]): (string | boolean)[] {
  return values.map((v) => (v === "true" ? true : v === "false" ? false : v));
}

/**
 * Tempelkan pencarian + faceted filter ke query. Dipakai bareng oleh query
 * data per halaman dan query agregat (mis. total nominal) supaya angkanya
 * konsisten dengan apa yang sedang difilter pengguna.
 */
export function applyTableFilters<Q extends { or: any; in: any }>(
  query: Q,
  params: TableParams,
  config: TableQueryConfig = {}
): Q {
  let q = query;
  const searchColumns = config.searchColumns ?? [];
  if (params.q && searchColumns.length) {
    // Nilai dikutip supaya koma di kata kunci tidak dibaca sebagai pemisah
    // klausa PostgREST; kutip dan backslash dibuang karena tidak bisa diescape.
    const needle = params.q.replace(/["\\]/g, "");
    q = q.or(searchColumns.map((c) => `${c}.ilike."%${needle}%"`).join(","));
  }
  for (const [col, values] of Object.entries(params.filters)) {
    q = q.in(col, coerce(values));
  }
  return q;
}

export type TablePage<T> = {
  rows: T[];
  /** State yang dikirim ke <DataTable server={...}> supaya UI ikut URL. */
  server: {
    rowCount: number;
    pageIndex: number;
    pageSize: number;
    q: string;
    sort: string | null;
    dir: "asc" | "desc";
    filters: Record<string, string[]>;
    sortColumns: string[];
    prefix: string;
  };
  params: TableParams;
};

/** Ambil satu halaman data beserta total barisnya. */
export async function fetchTablePage<T>(
  supabase: SupabaseClient<any, any, any>,
  table: string,
  searchParams: SearchParams,
  config: TableQueryConfig = {},
  select = "*"
): Promise<TablePage<T>> {
  const params = parseTableParams(searchParams, config);

  let query: any = supabase.from(table).select(select, { count: "exact" });
  query = applyTableFilters(query, params, config);

  const sortColumn = params.sort ?? config.defaultSort?.column;
  if (sortColumn) {
    const ascending = params.sort ? params.dir === "asc" : config.defaultSort?.ascending ?? false;
    query = query.order(sortColumn, { ascending });
  }
  // Tie-break supaya urutan baris stabil antar halaman saat nilai kolom sama.
  if (sortColumn !== "id") query = query.order("id", { ascending: true });

  const from = params.pageIndex * params.pageSize;
  const { data, count } = await query.range(from, from + params.pageSize - 1);

  return {
    rows: (data ?? []) as T[],
    params,
    server: {
      rowCount: count ?? 0,
      pageIndex: params.pageIndex,
      pageSize: params.pageSize,
      q: params.q,
      sort: params.sort,
      dir: params.dir,
      filters: params.filters,
      sortColumns: config.sortColumns ?? [],
      prefix: config.prefix ?? "",
    },
  };
}

/**
 * Jumlahkan satu kolom numerik dengan filter yang sama seperti tabel, supaya
 * ringkasan "Total tercatat" mencerminkan seluruh data yang cocok — bukan cuma
 * baris yang kebetulan tampil di halaman aktif.
 */
export async function sumColumn(
  supabase: SupabaseClient<any, any, any>,
  table: string,
  column: string,
  params: TableParams,
  config: TableQueryConfig = {}
): Promise<number> {
  let query: any = supabase.from(table).select(column);
  query = applyTableFilters(query, params, config);
  const { data } = await query;
  return ((data ?? []) as Record<string, number>[]).reduce((sum, row) => sum + (row[column] ?? 0), 0);
}
