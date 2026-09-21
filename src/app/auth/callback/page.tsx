"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import { hydrateLocalFromCloud } from "@/lib/auth";

export default function AuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState("");

  useEffect(() => {
    const run = async () => {
      const sb = getSupabase();
      if (!sb) {
        setError("Supabase is not configured.");
        return;
      }

      try {
        // Exchange code / pick up session from URL
        const { data, error: sessErr } = await sb.auth.getSession();
        if (sessErr) {
          setError(sessErr.message);
          return;
        }

        let userId = data.session?.user?.id;

        if (!userId) {
          // Some flows need explicit exchange from hash/query
          const { data: userData } = await sb.auth.getUser();
          userId = userData.user?.id;
        }

        if (!userId) {
          setError("Could not complete sign-in.");
          return;
        }

        // Ensure profile row exists
        const user = (await sb.auth.getUser()).data.user;
        if (user) {
          await sb.from("profiles").upsert({
            id: user.id,
            email: user.email,
            name:
              user.user_metadata?.name ||
              user.user_metadata?.full_name ||
              user.email?.split("@")[0] ||
              "User",
          });
        }

        await hydrateLocalFromCloud(userId);

        const { data: profile } = await sb
          .from("profiles")
          .select("onboarding_completed")
          .eq("id", userId)
          .maybeSingle();

        if (profile?.onboarding_completed) {
          router.replace("/chat");
        } else {
          router.replace("/onboarding");
        }
      } catch (e: any) {
        setError(e?.message || "Sign-in failed.");
      }
    };

    run();
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="text-center space-y-3">
        <div className="text-2xl font-semibold">Nexa</div>
        {error ? (
          <p className="text-sm text-red-500">{error}</p>
        ) : (
          <p className="text-sm text-muted">Finishing sign-in…</p>
        )}
      </div>
    </div>
  );
}
