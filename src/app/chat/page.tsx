"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Legacy chatbot module removed — redirect to Home operator */
export default function ChatRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/home");
  }, [router]);
  return (
    <div className="min-h-screen flex items-center justify-center text-sm text-muted">
      Redirecting…
    </div>
  );
}
