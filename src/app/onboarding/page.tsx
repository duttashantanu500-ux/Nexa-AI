"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { loadAppState, saveAppState, addMemory } from "@/lib/storage";
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
  const [user, setUser] = useState<UserProfile | null>(null);

  useEffect(() => {
    const state = loadAppState();
    if (!state.user) {
      router.replace("/signup");
      return;
    }
    if (state.user.onboardingCompleted) {
      router.replace("/chat");
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

  const handleFinish = () => {
    if (!userType || !user) return;
    setLoading(true);

    // Build initial memories from onboarding
    let memories = loadAppState().memories || [];

    if (form.businessName) {
      memories = addMemory(memories, `Business name: ${form.businessName}`, "business", 9, "onboarding");
    }
    if (form.industry) {
      memories = addMemory(memories, `Industry: ${form.industry}${form.subIndustry ? ` / ${form.subIndustry}` : ""}`, "industry", 8, "onboarding");
    }
    if (form.targetCustomer || form.targetCustomers) {
      memories = addMemory(memories, `Target customer: ${form.targetCustomer || form.targetCustomers}`, "target_customer", 9, "onboarding");
    }
    if (form.mainGoal) {
      memories = addMemory(memories, `Main goal: ${form.mainGoal}`, "goal", 9, "onboarding");
    }
    if (form.biggestChallenge) {
      memories = addMemory(memories, `Biggest challenge: ${form.biggestChallenge}`, "challenge", 8, "onboarding");
    }
    if (form.whatBuilding) {
      memories = addMemory(memories, `Building: ${form.whatBuilding}`, "product", 8, "onboarding");
    }
    if (form.problemSolved) {
      memories = addMemory(memories, `Problem solved: ${form.problemSolved}`, "value_prop", 8, "onboarding");
    }

    const updatedUser: UserProfile = {
      ...user,
      userType,
      name: form.name || user.name,
      onboardingCompleted: true,
    };

    saveAppState({
      user: updatedUser,
      businessContext: form,
      memories,
      currentWorkspace: "strategy",
    });

    setLoading(false);
    router.push("/chat");
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
              ? "First, tell us who you are."
              : "Help Nexa understand your business."}
          </p>
        </div>

        {step === "type" && (
          <div className="space-y-3">
            <p className="text-sm font-medium text-center mb-4">What best describes you?</p>
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

            <p className="text-xs text-muted text-center pt-4">
              Nexa is currently built for founders, business owners and agencies.
              <br />
              Other professions are not supported at this time.
            </p>
          </div>
        )}

        {step === "details" && userType && (
          <div className="space-y-5">
            <button
              onClick={() => setStep("type")}
              className="text-sm text-muted hover:text-foreground"
            >
              ← Change type
            </button>

            {/* Common fields */}
            <Field label="What should Nexa call you?" value={form.name || ""} onChange={(v) => update("name", v)} placeholder="Your first name" />
            <Field label="Age (optional)" value={form.age || ""} onChange={(v) => update("age", v)} placeholder="e.g. 28" />

            {userType === "founder" && (
              <>
                <Field label="Startup / Business name" value={form.businessName || ""} onChange={(v) => update("businessName", v)} />
                <Field label="Industry" value={form.industry || ""} onChange={(v) => update("industry", v)} placeholder="e.g. SaaS, Fintech, E-commerce" />
                <Field label="Sub-industry (optional)" value={form.subIndustry || ""} onChange={(v) => update("subIndustry", v)} />
                <Field label="What are you building?" value={form.whatBuilding || ""} onChange={(v) => update("whatBuilding", v)} textarea />
                <Field label="What problem does it solve?" value={form.problemSolved || ""} onChange={(v) => update("problemSolved", v)} textarea />
                <Field label="Target customer" value={form.targetCustomer || ""} onChange={(v) => update("targetCustomer", v)} />
                <Field label="Current stage" value={form.stage || ""} onChange={(v) => update("stage", v)} placeholder="Idea / MVP / Early revenue / Growth..." />
                <Field label="Website (optional)" value={form.website || ""} onChange={(v) => update("website", v)} placeholder="https://" />
                <Field label="Main business goal right now" value={form.mainGoal || ""} onChange={(v) => update("mainGoal", v)} textarea />
                <Field label="Biggest current challenge" value={form.biggestChallenge || ""} onChange={(v) => update("biggestChallenge", v)} textarea />
              </>
            )}

            {userType === "business_owner" && (
              <>
                <Field label="Business name" value={form.businessName || ""} onChange={(v) => update("businessName", v)} />
                <Field label="Industry" value={form.industry || ""} onChange={(v) => update("industry", v)} />
                <Field label="Sub-industry (optional)" value={form.subIndustry || ""} onChange={(v) => update("subIndustry", v)} />
                <Field label="Business type" value={form.businessType || ""} onChange={(v) => update("businessType", v)} placeholder="e.g. Retail, Service, Online store" />
                <Field label="Products / Services" value={form.productsServices || ""} onChange={(v) => update("productsServices", v)} textarea />
                <Field label="Target customers" value={form.targetCustomers || ""} onChange={(v) => update("targetCustomers", v)} />
                <Field label="Location / Market" value={form.location || ""} onChange={(v) => update("location", v)} />
                <Field label="Website (optional)" value={form.website || ""} onChange={(v) => update("website", v)} />
                <Field label="Main business goal" value={form.mainGoal || ""} onChange={(v) => update("mainGoal", v)} textarea />
                <Field label="Biggest current challenge" value={form.biggestChallenge || ""} onChange={(v) => update("biggestChallenge", v)} textarea />
              </>
            )}

            {userType === "agency" && (
              <>
                <Field label="Agency name" value={form.businessName || ""} onChange={(v) => update("businessName", v)} />
                <Field label="Agency type" value={form.agencyType || ""} onChange={(v) => update("agencyType", v)} placeholder="e.g. Marketing, Design, Development" />
                <Field label="Industry / Focus" value={form.industry || ""} onChange={(v) => update("industry", v)} />
                <Field label="Services offered" value={form.servicesOffered || ""} onChange={(v) => update("servicesOffered", v)} textarea />
                <Field label="Industries you serve" value={form.industriesServed || ""} onChange={(v) => update("industriesServed", v)} />
                <Field label="Target clients" value={form.targetClients || ""} onChange={(v) => update("targetClients", v)} />
                <Field label="Location / Market" value={form.location || ""} onChange={(v) => update("location", v)} />
                <Field label="Website (optional)" value={form.website || ""} onChange={(v) => update("website", v)} />
                <Field label="Main growth goal" value={form.mainGoal || ""} onChange={(v) => update("mainGoal", v)} textarea />
                <Field label="Biggest current challenge" value={form.biggestChallenge || ""} onChange={(v) => update("biggestChallenge", v)} textarea />
              </>
            )}

            <button
              onClick={handleFinish}
              disabled={loading || !form.businessName}
              className="w-full rounded-lg bg-accent text-background py-3 text-sm font-medium hover:opacity-90 transition disabled:opacity-50 mt-4"
            >
              {loading ? "Setting up Nexa…" : "Enter Nexa"}
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
