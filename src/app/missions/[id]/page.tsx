"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Old mission detail UI removed — agents are the product */
export default function MissionDetailRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/agents");
  }, [router]);
  return null;
}
