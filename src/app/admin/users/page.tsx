import { createClient } from "@/lib/supabase/server";
import { fetchTablePage, type SearchParams } from "@/lib/table-query";
import type { Profile } from "@/types/database";
import { UsersTable } from "./users-table";

export default async function UsersPage({ searchParams }: { searchParams: SearchParams }) {
  const supabase = createClient();
  const { rows: users, server } = await fetchTablePage<Profile>(supabase, "profiles", searchParams, {
    searchColumns: ["nama", "username", "email"],
    sortColumns: ["nama", "email", "role", "status", "created_at"],
    filterColumns: ["role", "status"],
    defaultSort: { column: "created_at", ascending: false },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Pengguna</h1>
        <p className="text-sm text-muted-foreground">Kelola seluruh akun: admin, kasir, dan pelanggan.</p>
      </div>
      <UsersTable data={users} server={server} />
    </div>
  );
}
