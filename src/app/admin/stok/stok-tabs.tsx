"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataTable, type ServerTableState } from "@/components/shared/data-table";
import { columns } from "./columns";
import { writeoffColumns } from "./writeoff-columns";
import { StokFormDialog } from "./stok-form-dialog";
import { WriteoffFormDialog } from "./writeoff-form-dialog";
import type { StockEntry, StockWriteoff } from "@/types/database";

export function StokTabs({
  entries, entriesServer, writeoffs, writeoffsServer, products, tab,
}: {
  entries: StockEntry[];
  entriesServer?: ServerTableState;
  writeoffs: StockWriteoff[];
  writeoffsServer?: ServerTableState;
  products: { id: string; nama: string; modal: number; stok: number }[];
  tab?: "masuk" | "hapus";
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Tab aktif ikut disimpan di URL supaya tidak lompat balik ke "Input Stok"
  // saat tabel penghapusan pindah halaman dan server merender ulang.
  function selectTab(value: string) {
    const next = new URLSearchParams(searchParams.toString());
    if (value === "masuk") next.delete("tab");
    else next.set("tab", value);
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  return (
    <Tabs value={tab ?? "masuk"} onValueChange={selectTab}>
      <TabsList>
        <TabsTrigger value="masuk">Input Stok</TabsTrigger>
        <TabsTrigger value="hapus">Penghapusan Stok</TabsTrigger>
      </TabsList>
      <TabsContent value="masuk">
        <DataTable
          columns={columns}
          data={entries}
          server={entriesServer}
          searchPlaceholder="Cari produk..."
          emptyMessage="Belum ada riwayat input stok."
          toolbar={() => <StokFormDialog products={products} />}
        />
      </TabsContent>
      <TabsContent value="hapus">
        <DataTable
          columns={writeoffColumns}
          data={writeoffs}
          server={writeoffsServer}
          searchPlaceholder="Cari produk..."
          emptyMessage="Belum ada riwayat penghapusan stok."
          toolbar={() => <WriteoffFormDialog products={products} />}
        />
      </TabsContent>
    </Tabs>
  );
}
