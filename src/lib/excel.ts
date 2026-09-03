// Pakai xlsx-js-style (bukan "xlsx" biasa) — versi gratis SheetJS bisa
// MEMBACA style tapi diam-diam TIDAK MENULISKAN style (font/warna/border)
// ke file .xlsx yang dihasilkan. xlsx-js-style adalah fork dengan API
// yang sama persis, tapi beneran menuliskan style-nya — makanya file yang
// diunduh sekarang bisa punya judul berwarna, header tabel gelap, border,
// dan garis zebra, bukan cuma teks polos hitam-putih.
import * as XLSX from "xlsx-js-style";

const COLOR_PRIMARY = "1F5C4A"; // deep jade — warna utama aplikasi
const COLOR_PRIMARY_LIGHT = "E4EEEA"; // tint jade untuk baris subjudul
const COLOR_ZEBRA = "F6F8F7"; // baris data genap, sedikit lebih gelap dari putih
const COLOR_BORDER = "D8DEDC";
const COLOR_WHITE = "FFFFFF";
const COLOR_MUTED = "6B7280";

function thinBorder(rgb: string) {
  const side = { style: "thin" as const, color: { rgb } };
  return { top: side, bottom: side, left: side, right: side };
}

function autoWidth(rows: Record<string, string | number>[]) {
  if (!rows.length) return [];
  const headers = Object.keys(rows[0]);
  return headers.map((h) => {
    const maxLen = Math.max(h.length, ...rows.map((r) => String(r[h] ?? "").length));
    return { wch: Math.min(Math.max(maxLen + 2, 10), 40) };
  });
}

function applyCurrencyFormat(
  worksheet: XLSX.WorkSheet,
  headers: string[],
  currencyColumns: string[],
  headerRowIndex: number,
  rowCount: number
) {
  currencyColumns.forEach((colName) => {
    const colIdx = headers.indexOf(colName);
    if (colIdx === -1) return;
    for (let r = headerRowIndex + 1; r <= headerRowIndex + rowCount; r++) {
      const ref = XLSX.utils.encode_cell({ r, c: colIdx });
      const cell = worksheet[ref];
      if (cell && typeof cell.v === "number") cell.z = "#,##0";
    }
  });
}

/**
 * Bangun satu sheet dengan: pita judul berwarna + subjudul tanggal ekspor,
 * header tabel gelap dengan teks putih, autofilter, border tipis di semua
 * sel data, garis zebra selang-seling, dan kolom uang diformat ribuan.
 */
function buildSheet(title: string, rows: Record<string, string | number>[], currencyColumns: string[] = []) {
  const data = rows.length ? rows : [{ Info: "Tidak ada data" }];
  const headers = Object.keys(data[0]);
  const lastCol = Math.max(headers.length - 1, 0);
  const headerRowIdx = 3; // baris ke-4 (0-indexed: 3) — setelah judul, subjudul, dan baris kosong

  const generatedAt = `Diekspor ${new Date().toLocaleString("id-ID", { dateStyle: "long", timeStyle: "short" })} WIB`;

  const worksheet = XLSX.utils.aoa_to_sheet([[title], [generatedAt], []]);
  XLSX.utils.sheet_add_json(worksheet, data, { origin: "A4", skipHeader: false });

  worksheet["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: lastCol } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: lastCol } },
  ];

  const titleStyle = {
    font: { bold: true, sz: 14, color: { rgb: COLOR_WHITE } },
    fill: { fgColor: { rgb: COLOR_PRIMARY } },
    alignment: { vertical: "center", horizontal: "left" },
  };
  const subtitleStyle = {
    font: { italic: true, sz: 9, color: { rgb: COLOR_MUTED } },
    fill: { fgColor: { rgb: COLOR_PRIMARY_LIGHT } },
    alignment: { vertical: "center", horizontal: "left" },
  };
  for (let c = 0; c <= lastCol; c++) {
    const titleRef = XLSX.utils.encode_cell({ r: 0, c });
    if (!worksheet[titleRef]) worksheet[titleRef] = { t: "s", v: "" };
    worksheet[titleRef].s = titleStyle;

    const subtitleRef = XLSX.utils.encode_cell({ r: 1, c });
    if (!worksheet[subtitleRef]) worksheet[subtitleRef] = { t: "s", v: "" };
    worksheet[subtitleRef].s = subtitleStyle;
  }

  for (let c = 0; c <= lastCol; c++) {
    const ref = XLSX.utils.encode_cell({ r: headerRowIdx, c });
    if (worksheet[ref]) {
      worksheet[ref].s = {
        font: { bold: true, sz: 10, color: { rgb: COLOR_WHITE } },
        fill: { fgColor: { rgb: COLOR_PRIMARY } },
        alignment: { vertical: "center", horizontal: "center", wrapText: true },
        border: thinBorder(COLOR_BORDER),
      };
    }
  }

  for (let i = 0; i < data.length; i++) {
    const r = headerRowIdx + 1 + i;
    const isEven = i % 2 === 1;
    for (let c = 0; c <= lastCol; c++) {
      const ref = XLSX.utils.encode_cell({ r, c });
      const cell = worksheet[ref];
      if (!cell) continue;
      cell.s = {
        border: thinBorder(COLOR_BORDER),
        fill: isEven ? { fgColor: { rgb: COLOR_ZEBRA } } : undefined,
        alignment: { vertical: "center" },
      };
    }
  }

  worksheet["!autofilter"] = { ref: XLSX.utils.encode_range({ s: { r: headerRowIdx, c: 0 }, e: { r: headerRowIdx, c: lastCol } }) };
  worksheet["!cols"] = autoWidth(data);
  worksheet["!rows"] = [{ hpt: 24 }, { hpt: 16 }, { hpt: 6 }];

  applyCurrencyFormat(worksheet, headers, currencyColumns, headerRowIdx, data.length);

  return worksheet;
}

/** Unduh data sebagai file Excel (.xlsx) satu sheet — dipakai untuk laporan sederhana. */
export function downloadXlsx(filename: string, rows: Record<string, string | number>[], sheetName = "Laporan", currencyColumns: string[] = []) {
  if (!rows.length) return;
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, buildSheet(sheetName, rows, currencyColumns), sheetName);
  XLSX.writeFile(workbook, filename, { compression: true });
}

/** Unduh beberapa tabel sekaligus sebagai satu file Excel (.xlsx) multi-sheet, tiap sheet punya pita judul + header gelap + border + zebra + format angka rupiah. */
export function downloadXlsxMultiSheet(
  filename: string,
  sheets: { name: string; rows: Record<string, string | number>[]; currencyColumns?: string[] }[]
) {
  const workbook = XLSX.utils.book_new();
  for (const sheet of sheets) {
    const worksheet = buildSheet(sheet.name, sheet.rows, sheet.currencyColumns ?? []);
    XLSX.utils.book_append_sheet(workbook, worksheet, sheet.name.slice(0, 31));
  }
  XLSX.writeFile(workbook, filename, { compression: true });
}
