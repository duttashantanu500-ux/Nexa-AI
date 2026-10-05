"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import { hydrateLocalFromCloud } from "@/lib/auth";

export default function AuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [hint, setHint] = useState("Finishing sign-in…");

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
        const errorDesc =
          url.searchParams.get("error_description") ||
          url.searchParams.get("error");

        const existing = await sb.auth.getSession();
        if (existing.data.session?.user && !code && !tokenHash) {
          setHint("You are signed in. Redirecting…");
          await finish(sb, existing.data.session.user.id, type, url);
          return;
        }

        if (errorDesc && !code && !tokenHash) {
          if (existing.data.session?.user) {
            await finish(sb, existing.data.session.user.id, type, url);
            return;
          }
          setError(
            /expired|invalid/i.test(errorDesc)
              ? "This link has expired. Please sign in or request a new email."
              : "Could not complete sign-in from this link. Try logging in with your email and password."
          );
          return;
        }

        if (code) {
          const { error: exchErr } = await sb.auth.exchangeCodeForSession(code);
          if (exchErr) {
            const again = await sb.auth.getSession();
            if (!again.data.session?.user) {
              setError(
                exchErr.message?.includes("expired")
                  ? "This link has expired. Please try again."
                  : "Email confirmed. Please log in with your email and password."
              );
              return;
            }
          }
        } else if (tokenHash && type) {
          const otpType =
            type === "recovery" ? "recovery" : type === "email" ? "email" : "signup";
          const { error: otpErr } = await sb.auth.verifyOtp({
            token_hash: tokenHash,
            type: otpType as "signup" | "recovery" | "email",
          });
          if (otpErr) {
            const again = await sb.auth.getSession();
            if (!again.data.session?.user) {
              setError(
                "This link is invalid or already used. Please log in with your email and password."
              );
              return;
            }
          }
        } else {
          await sb.auth.getSession();
        }

        const { data: userData, error: userErr } = await sb.auth.getUser();
        if (userErr || !userData.user) {
          setError("Email confirmed. Please log in with your email and password.");
          return;
        }

        await finish(sb, userData.user.id, type, url);
      } catch {
        try {
          const sb2 = getSupabase();
          const s = await sb2?.auth.getSession();
          if (s?.data.session?.user) {
            router.replace("/home");
            return;
          }
        } catch {
          /* */
        }
        setError("Email confirmed. Please log in with your email and password.");
      }
    };

    async function finish(
      sb: NonNullable<ReturnType<typeof getSupabase>>,
      userId: string,
      type: string | null,
      url: URL
    ) {
      try {
        const { data: userData } = await sb.auth.getUser();
        const user = userData.user;
        if (user) {
          await sb.from("profiles").upsert({
            id: userId,
            email: user.email,
            name:
              user.user_metadata?.name ||
              user.user_metadata?.full_name ||
              user.email?.split("@")[0] ||
              "User",
          });
        }
      } catch {
        /* must not block */
      }

      try {
        await hydrateLocalFromCloud(userId);
      } catch {
        /* */
      }

      if (type === "recovery" || url.searchParams.get("next") === "reset") {
        router.replace("/auth/reset-password");
        return;
      }

      try {
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
        router.replace("/home");
      }
    }

    void run();
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 dark:bg-zinc-950">
      <div className="max-w-sm space-y-3 text-center">
        <div className="text-2xl font-semibold text-indigo-600">Nexa</div>
        {error ? (
          <div className="space-y-3">
            <p className="text-sm text-zinc-700 dark:text-zinc-300">{error}</p>
            <a href="/login" className="text-sm text-indigo-600 hover:underline">
              Go to log in
            </a>
          </div>
        ) : (
          <p className="text-sm text-zinc-500">{hint}</p>
        )}
      </div>
    </div>
  );
}
