import { LaporanClient } from "./laporan-client";

export default function LaporanPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Laporan</h1>
        <p className="text-sm text-muted-foreground">Ringkasan modal & keuntungan kantin. Pilih periode lalu ekspor ke CSV.</p>
      </div>
      <LaporanClient />
    </div>
  );
}
