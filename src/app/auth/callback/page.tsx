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
        setError("Something went wrong. Please try signing in again.");
        return;
      }

      try {
        const url = new URL(window.location.href);
        const code = url.searchParams.get("code");
        const tokenHash = url.searchParams.get("token_hash");
        const type = url.searchParams.get("type");

        // PKCE / OAuth / email confirmation: exchange code for session
        if (code) {
          const { error: exchErr } = await sb.auth.exchangeCodeForSession(code);
          if (exchErr) {
            setError(
              exchErr.message?.includes("expired")
                ? "This link has expired. Please try again."
                : "Could not complete sign-in. Please try again."
            );
            return;
          }
        } else if (tokenHash && type) {
          const { error: otpErr } = await sb.auth.verifyOtp({
            token_hash: tokenHash,
            type: type as "signup" | "recovery" | "email",
          });
          if (otpErr) {
            setError("This link is invalid or expired. Please try again.");
            return;
          }
        } else {
          // Hash-based implicit flow fallback
          await sb.auth.getSession();
        }

        const { data: userData, error: userErr } = await sb.auth.getUser();
        if (userErr || !userData.user) {
          setError("Could not complete sign-in. Please try again.");
          return;
        }

        const user = userData.user;
        const userId = user.id;

        await sb.from("profiles").upsert({
          id: userId,
          email: user.email,
          name:
            user.user_metadata?.name ||
            user.user_metadata?.full_name ||
            user.email?.split("@")[0] ||
            "User",
        });

        await hydrateLocalFromCloud(userId);

        // Password recovery lands here with type=recovery
        if (type === "recovery" || url.searchParams.get("next") === "reset") {
          router.replace("/auth/reset-password");
          return;
        }

        const { data: profile } = await sb
          .from("profiles")
          .select("onboarding_completed")
          .eq("id", userId)
          .maybeSingle();

        if (profile?.onboarding_completed) {
          router.replace("/home");
        } else {
          router.replace("/onboarding");
        }
      } catch {
        setError("Sign-in failed. Please try again.");
      }
    };

    void run();
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 dark:bg-zinc-950">
      <div className="space-y-3 text-center">
        <div className="text-2xl font-semibold text-indigo-600">Nexa</div>
        {error ? (
          <div className="space-y-3">
            <p className="text-sm text-red-500">{error}</p>
            <a href="/login" className="text-sm text-indigo-600 hover:underline">
              Back to login
            </a>
          </div>
        ) : (
          <p className="text-sm text-zinc-500">Finishing sign-in…</p>
        )}
      </div>
    </div>
  );
}
