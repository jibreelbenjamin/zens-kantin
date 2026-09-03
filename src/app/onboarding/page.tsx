import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OnboardingForm } from "./onboarding-form";
import { BrandIcon } from "@/components/shared/brand-icon";
import { APP_NAME } from "@/lib/constants";

export default async function OnboardingPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("id").eq("id", user.id).maybeSingle();
  if (profile) redirect("/");

  const googleName = (user.user_metadata?.full_name || user.user_metadata?.name || "") as string;
  const avatar = (user.user_metadata?.avatar_url || user.user_metadata?.picture || null) as string | null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-secondary/40 p-6">
      <div className="w-full max-w-md space-y-6 rounded-xl border bg-card p-8 shadow-sm">
        <div className="space-y-1 text-center">
          <div className="mb-3 flex items-center justify-center gap-2 font-display text-lg font-semibold text-primary">
            <BrandIcon className="h-5 w-5" /> {APP_NAME}
          </div>
          <h1 className="font-display text-xl font-semibold">Lengkapi profil kamu</h1>
          <p className="text-sm text-muted-foreground">
            Akun Google kamu ({user.email}) berhasil terverifikasi. Isi data berikut untuk
            menyelesaikan pendaftaran.
          </p>
        </div>
        <OnboardingForm defaultName={googleName} avatarUrl={avatar} />
      </div>
    </div>
  );
}
