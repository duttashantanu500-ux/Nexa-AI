"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Missions removed from product — redirect to Agents */
export default function MissionsRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/agents");
  }, [router]);
  return null;
}
