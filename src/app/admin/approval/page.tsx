import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ApprovalList } from "./approval-list";

export default async function ApprovalPage() {
  const supabase = createClient();
  const { data: pendingUsers } = await supabase
    .from("profiles")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Approval Pendaftaran</h1>
        <p className="text-sm text-muted-foreground">Setujui atau blokir akun pelanggan baru yang mendaftar lewat Google.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Menunggu Persetujuan</CardTitle>
          <CardDescription>{pendingUsers?.length ?? 0} akun menunggu keputusan kamu.</CardDescription>
        </CardHeader>
        <CardContent>
          <ApprovalList users={pendingUsers ?? []} />
        </CardContent>
      </Card>
    </div>
  );
}
