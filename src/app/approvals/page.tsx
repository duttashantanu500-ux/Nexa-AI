"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import {
  loadOperatorState,
  resolveApproval,
  pushActivity,
} from "@/lib/operatorStore";
import { ApprovalRequest } from "@/types";

export default function ApprovalsPage() {
  const router = useRouter();
  const [items, setItems] = useState<ApprovalRequest[]>([]);

  const refresh = () => {
    const s = loadOperatorState();
    setItems(s.approvals || []);
  };

  useEffect(() => {
    const s = loadOperatorState();
    if (!s.user?.onboardingCompleted) {
      router.replace("/signup");
      return;
    }
    refresh();
  }, [router]);

  const act = (id: string, status: "approved" | "rejected") => {
    const user = loadOperatorState().user;
    resolveApproval(id, status);
    if (user) {
      pushActivity(
        user.id,
        status === "approved" ? "Approval granted" : "Approval rejected",
        "approval",
        id
      );
    }
    refresh();
  };

  const pending = items.filter((i) => i.status === "pending");
  const history = items.filter((i) => i.status !== "pending");

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl px-4 py-8 space-y-8">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Approvals</h1>
          <p className="text-sm text-muted">
            Review actions before Nexa proceeds. Execution is demo-only in Part 1.
          </p>
        </div>

        <section className="space-y-3">
          <h2 className="text-sm font-medium">Needs review</h2>
          {pending.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted">
              Nothing waiting for approval.
            </div>
          ) : (
            pending.map((a) => (
              <div key={a.id} className="rounded-xl border border-border bg-card p-4 space-y-3">
                <div className="text-sm font-medium">{a.title}</div>
                <p className="text-sm text-muted">{a.summary}</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => act(a.id, "approved")}
                    className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs text-white dark:bg-zinc-100 dark:text-zinc-900"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => act(a.id, "rejected")}
                    className="rounded-lg border border-border px-3 py-1.5 text-xs"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))
          )}
        </section>

        {history.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-sm font-medium">History</h2>
            {history.map((a) => (
              <div
                key={a.id}
                className="rounded-xl border border-border bg-card px-4 py-3 text-sm flex justify-between gap-3"
              >
                <span>{a.title}</span>
                <span className="text-xs text-muted capitalize">{a.status}</span>
              </div>
            ))}
          </section>
        )}
      </div>
    </AppShell>
  );
}
