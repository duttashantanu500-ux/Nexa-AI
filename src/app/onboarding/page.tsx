"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { loadAppState, saveAppState, addMemory } from "@/lib/conversationStore";
import { persistOnboardingCloud } from "@/lib/auth";
import { UserType, BusinessContext, UserProfile } from "@/types";

const USER_TYPES: { id: UserType; label: string; emoji: string; desc: string }[] = [
  { id: "founder", label: "Founder", emoji: "🚀", desc: "Building a startup or new venture" },
  { id: "business_owner", label: "Business Owner", emoji: "🏢", desc: "Running an established business" },
  { id: "agency", label: "Agency", emoji: "🎨", desc: "Serving clients with services" },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<"type" | "details">("type");
  const [userType, setUserType] = useState<UserType | null>(null);
  const [form, setForm] = useState<BusinessContext>({});
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [user, setUser] = useState<UserProfile | null>(null);

  useEffect(() => {
    const state = loadAppState();
    if (!state.user) {
      router.replace("/signup");
      return;
    }
    if (state.user.onboardingCompleted) {
      router.replace("/home");
      return;
    }
    setUser(state.user);
    setForm((prev) => ({ ...prev, name: state.user?.name }));
  }, [router]);

  const update = (key: keyof BusinessContext, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleTypeSelect = (type: UserType) => {
    setUserType(type);
    setStep("details");
  };

  const analyzeWebsiteIfProvided = async (): Promise<string | undefined> => {
    const site = (form.website || "").trim();
    if (!site) return undefined;
    setAnalyzing(true);
    try {
      const res = await fetch("/api/analyze-website", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: site }),
      });
      const data = await res.json();
      return data.summary || undefined;
    } catch {
      return undefined;
    } finally {
      setAnalyzing(false);
    }
  };

  const handleFinish = async () => {
    if (!userType || !user) return;
    setLoading(true);

    const websiteSummary = await analyzeWebsiteIfProvided();
    const context: BusinessContext = {
      ...form,
      websiteSummary,
    };

    let memories = loadAppState().memories || [];
    if (context.businessName) {
      memories = addMemory(memories, `Business name: ${context.businessName}`, "business", 9, "onboarding");
    }
    if (context.industry) {
      memories = addMemory(memories, `Industry: ${context.industry}`, "industry", 8, "onboarding");
    }
    if (context.targetCustomer || context.targetCustomers || context.targetClients) {
      memories = addMemory(
        memories,
        `Target: ${context.targetCustomer || context.targetCustomers || context.targetClients}`,
        "target_customer",
        9,
        "onboarding"
      );
    }
    if (context.mainGoal) {
      memories = addMemory(memories, `Main goal: ${context.mainGoal}`, "goal", 9, "onboarding");
    }
    if (context.whatBuilding) {
      memories = addMemory(memories, `Building: ${context.whatBuilding}`, "product", 8, "onboarding");
    }
    if (websiteSummary) {
      memories = addMemory(memories, `Website summary: ${websiteSummary.slice(0, 280)}`, "website", 6, "onboarding");
    }

    const updatedUser: UserProfile = {
      ...user,
      userType,
      name: form.name || user.name,
      onboardingCompleted: true,
    };

    saveAppState({
      user: updatedUser,
      businessContext: context,
      memories,
      currentWorkspace: "strategy",
      currentConversationId: null,
      conversations: [],
    });

    try {
      await persistOnboardingCloud({
        user: updatedUser,
        businessContext: context,
        memories,
      });
    } catch (err) {
      console.error("[Nexa] cloud onboarding sync failed", err);
    }

    setLoading(false);
    router.push("/home");
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted text-sm">Loading…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-4 py-12">
      <div className="max-w-xl mx-auto space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">Welcome to Nexa</h1>
          <p className="text-muted text-sm">
            {step === "type"
              ? "What are you building?"
              : "A few details so Nexa can operate for your business."}
          </p>
        </div>

        {step === "type" && (
          <div className="space-y-3">
            {USER_TYPES.map((t) => (
              <button
                key={t.id}
                onClick={() => handleTypeSelect(t.id)}
                className="w-full flex items-start gap-4 p-4 rounded-xl border border-border bg-card hover:bg-sidebar transition text-left"
              >
                <span className="text-2xl">{t.emoji}</span>
                <div>
                  <div className="font-medium">{t.label}</div>
                  <div className="text-sm text-muted">{t.desc}</div>
                </div>
              </button>
            ))}
          </div>
        )}

        {step === "details" && userType && (
          <div className="space-y-5">
            <button onClick={() => setStep("type")} className="text-sm text-muted hover:text-foreground">
              ← Back
            </button>

            <Field label="Your name" value={form.name || ""} onChange={(v) => update("name", v)} placeholder="First name" />

            {userType === "founder" && (
              <>
                <Field label="Startup / business name" value={form.businessName || ""} onChange={(v) => update("businessName", v)} />
                <Field label="Industry" value={form.industry || ""} onChange={(v) => update("industry", v)} placeholder="e.g. Fashion, SaaS, Health" />
                <Field label="What are you building?" value={form.whatBuilding || ""} onChange={(v) => update("whatBuilding", v)} textarea />
                <Field label="Target customer" value={form.targetCustomer || ""} onChange={(v) => update("targetCustomer", v)} />
                <Field label="Current stage" value={form.stage || ""} onChange={(v) => update("stage", v)} placeholder="Idea / MVP / Early revenue / Growth" />
                <Field label="Main goal" value={form.mainGoal || ""} onChange={(v) => update("mainGoal", v)} textarea />
                <Field label="Website (optional)" value={form.website || ""} onChange={(v) => update("website", v)} placeholder="https://" />
              </>
            )}

            {userType === "business_owner" && (
              <>
                <Field label="Business name" value={form.businessName || ""} onChange={(v) => update("businessName", v)} />
                <Field label="Industry" value={form.industry || ""} onChange={(v) => update("industry", v)} />
                <Field label="Business type" value={form.businessType || ""} onChange={(v) => update("businessType", v)} placeholder="Retail, Service, Online store…" />
                <Field label="Products / services" value={form.productsServices || ""} onChange={(v) => update("productsServices", v)} textarea />
                <Field label="Target customers" value={form.targetCustomers || ""} onChange={(v) => update("targetCustomers", v)} />
                <Field label="Location / market" value={form.location || ""} onChange={(v) => update("location", v)} />
                <Field label="Main goal" value={form.mainGoal || ""} onChange={(v) => update("mainGoal", v)} textarea />
                <Field label="Website (optional)" value={form.website || ""} onChange={(v) => update("website", v)} placeholder="https://" />
              </>
            )}

            {userType === "agency" && (
              <>
                <Field label="Agency name" value={form.businessName || ""} onChange={(v) => update("businessName", v)} />
                <Field label="Agency type" value={form.agencyType || ""} onChange={(v) => update("agencyType", v)} placeholder="Marketing, Design, Development…" />
                <Field label="Services" value={form.servicesOffered || ""} onChange={(v) => update("servicesOffered", v)} textarea />
                <Field label="Industries served" value={form.industriesServed || ""} onChange={(v) => update("industriesServed", v)} />
                <Field label="Target clients" value={form.targetClients || ""} onChange={(v) => update("targetClients", v)} />
                <Field label="Main growth goal" value={form.mainGoal || ""} onChange={(v) => update("mainGoal", v)} textarea />
                <Field label="Website (optional)" value={form.website || ""} onChange={(v) => update("website", v)} placeholder="https://" />
              </>
            )}

            <button
              onClick={handleFinish}
              disabled={loading || analyzing || !form.businessName}
              className="w-full rounded-lg bg-accent text-background py-3 text-sm font-medium hover:opacity-90 transition disabled:opacity-50 mt-4"
            >
              {analyzing ? "Reviewing website…" : loading ? "Setting up Nexa…" : "Enter Nexa"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  textarea,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  textarea?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium">{label}</label>
      {textarea ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={3}
          className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring resize-none"
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
      )}
    </div>
  );
}
