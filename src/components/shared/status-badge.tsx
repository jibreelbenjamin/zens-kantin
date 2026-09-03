import { Badge } from "@/components/ui/badge";

const MAP: Record<string, { label: string; variant: "success" | "warning" | "destructive" | "secondary" }> = {
  active: { label: "Aktif", variant: "success" },
  pending: { label: "Menunggu", variant: "warning" },
  block: { label: "Diblokir", variant: "destructive" },
  paid: { label: "Sudah Bayar", variant: "success" },
  cancelled: { label: "Dibatalkan", variant: "destructive" },
  tidak_dibayar: { label: "Tidak Dibayar", variant: "destructive" },
  admin: { label: "Admin", variant: "secondary" },
  kasir: { label: "Kasir", variant: "secondary" },
  pelanggan: { label: "Pelanggan", variant: "secondary" },
};

export function StatusBadge({ value }: { value: string }) {
  const cfg = MAP[value] ?? { label: value, variant: "secondary" as const };
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}
