"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  loadAppState,
  saveAppState,
  loadMessages,
  saveMessages,
  createId,
  getRelevantMemories,
} from "@/lib/storage";
import { fetchWebsiteContent, hideProviderNames } from "@/lib/ai";
import { buildSystemPrompt, generateConversationTitle } from "@/lib/prompts";
import {
  AppState,
  Conversation,
  Message,
  WorkspaceId,
  WORKSPACES,
} from "@/types";
import {
  Plus,
  MessageSquare,
  Settings,
  LogOut,
  Send,
  PanelLeft,
  X,
  Image as ImageIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function ChatPage() {
  const router = useRouter();
  const [state, setState] = useState<AppState | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileSidebar, setMobileSidebar] = useState(false);
  const [pendingImage, setPendingImage] = useState<{ dataUrl: string; name: string } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const requestInFlight = useRef<string | null>(null); // prevent duplicates

  // Load state
  useEffect(() => {
    const s = loadAppState();
    if (!s.user) {
      router.replace("/signup");
      return;
    }
    if (!s.user.onboardingCompleted) {
      router.replace("/onboarding");
      return;
    }
    setState(s);

    // Load messages for current conversation
    if (s.currentConversationId) {
      setMessages(loadMessages(s.currentConversationId));
    }
  }, [router]);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isGenerating]);

  const persistState = useCallback((partial: Partial<AppState>) => {
    setState((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...partial };
      saveAppState(next);
      return next;
    });
  }, []);

  const createNewConversation = (workspace?: WorkspaceId) => {
    if (!state?.user) return;
    const ws = workspace || state.currentWorkspace;
    const conv: Conversation = {
      id: createId(),
      userId: state.user.id,
      workspace: ws,
      title: "New conversation",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messageCount: 0,
    };

    const conversations = [conv, ...state.conversations];
    persistState({
      conversations,
      currentConversationId: conv.id,
      currentWorkspace: ws,
    });
    setMessages([]);
    setMobileSidebar(false);
  };

  const selectConversation = (id: string) => {
    const conv = state?.conversations.find((c) => c.id === id);
    if (!conv) return;
    persistState({
      currentConversationId: id,
      currentWorkspace: conv.workspace,
    });
    setMessages(loadMessages(id));
    setMobileSidebar(false);
  };

  const switchWorkspace = (ws: WorkspaceId) => {
    const nextConversation = state?.conversations.find(
      (conversation) => conversation.workspace === ws
    );
    persistState({
      currentWorkspace: ws,
      currentConversationId: nextConversation?.id || null,
    });
    setMessages(nextConversation ? loadMessages(nextConversation.id) : []);
    setMobileSidebar(false);
  };

  const handleSend = async () => {
    if ((!input.trim() && !pendingImage) || !state?.user || isGenerating) return;

    let conversationId = state.currentConversationId;

    // Auto-create conversation if none
    if (!conversationId) {
      const conv: Conversation = {
        id: createId(),
        userId: state.user.id,
        workspace: state.currentWorkspace,
        title: "New conversation",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        messageCount: 0,
      };
      conversationId = conv.id;
      const conversations = [conv, ...state.conversations];
      persistState({
        conversations,
        currentConversationId: conv.id,
      });
    }

    const requestId = createId();
    if (requestInFlight.current) return; // hard block
    requestInFlight.current = requestId;

    const currentImage = pendingImage; // capture before clearing
    const userContent = input.trim() || (currentImage ? "[Image attached]" : "");
    const userMessage: Message = {
      id: createId(),
      conversationId,
      role: "user",
      content: userContent,
      createdAt: new Date().toISOString(),
      requestId,
      attachments: currentImage
        ? [{ id: createId(), type: "image", name: currentImage.name, url: currentImage.dataUrl, mimeType: "image/*" }]
        : undefined,
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    saveMessages(conversationId, newMessages);
    setInput("");
    setPendingImage(null);
    setIsGenerating(true);

    // Auto title on first message
    if (messages.length === 0) {
      const title = generateConversationTitle(userMessage.content);
      const conversations = state.conversations.map((c) =>
        c.id === conversationId
          ? { ...c, title, updatedAt: new Date().toISOString(), messageCount: 1 }
          : c
      );
      // If it was just created it might not be in state yet
      if (!state.conversations.find((c) => c.id === conversationId)) {
        conversations.unshift({
          id: conversationId,
          userId: state.user.id,
          workspace: state.currentWorkspace,
          title,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          messageCount: 1,
        });
      }
      persistState({ conversations });
    }

    try {
      const recent = newMessages
        .filter((m) => m.role === "user" || m.role === "assistant")
        .slice(-12)
        .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

      const relevantMemories = getRelevantMemories(state.memories || []).map(
        (m) => ({ content: m.content, category: m.category })
      );

      // Detect URL for website analysis
      let websiteContent: string | undefined;
      const urlMatch = userMessage.content.match(
        /https?:\/\/[^\s]+/i
      );
      if (urlMatch && /analyze|review|website|landing|page|site|compare/i.test(userMessage.content)) {
        websiteContent = await fetchWebsiteContent(urlMatch[0]);
      }

      const aiRequest = {
        workspace: state.currentWorkspace,
        userType: state.user.userType,
        businessContext: state.businessContext,
        memories: relevantMemories,
        recentMessages: recent,
        userName: state.user.name,
        websiteContent,
        imageDataUrl: currentImage?.dataUrl,
      };

      let responseText: string;
      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(aiRequest),
        });
        if (!response.ok) throw new Error("Nexa Intelligence API unavailable");
        const data = (await response.json()) as { content?: string };
        if (!data.content) throw new Error("Nexa Intelligence returned no content");
        responseText = data.content;
      } catch (error) {
        console.error("Nexa Intelligence API request failed:", error);
        const { generateBrowserResponse } = await import("@/lib/browser-ai/chat-engine");
        const systemPrompt = buildSystemPrompt({
          workspace: aiRequest.workspace,
          userType: aiRequest.userType,
          businessContext: aiRequest.businessContext,
          memories: aiRequest.memories,
          userName: aiRequest.userName,
        });
        responseText = hideProviderNames(await generateBrowserResponse({
          systemPrompt,
          messages: recent.map((message) => ({ ...message })),
        }));
      }

      // Final dedup check
      const currentMsgs = loadMessages(conversationId);
      const alreadyHasResponse = currentMsgs.some(
        (m) => m.role === "assistant" && m.requestId === requestId
      );

      if (!alreadyHasResponse) {
        const assistantMessage: Message = {
          id: createId(),
          conversationId,
          role: "assistant",
          content: responseText,
          createdAt: new Date().toISOString(),
          requestId,
        };

        const finalMessages = [...currentMsgs, assistantMessage];
        setMessages(finalMessages);
        saveMessages(conversationId, finalMessages);

        // Update conversation timestamp
        const conversations = (state.conversations || []).map((c) =>
          c.id === conversationId
            ? {
                ...c,
                updatedAt: new Date().toISOString(),
                messageCount: finalMessages.length,
              }
            : c
        );
        persistState({ conversations });
      }
    } catch (err) {
      console.error(err);
      const errorMsg: Message = {
        id: createId(),
        conversationId,
        role: "assistant",
        content: "Something went wrong generating a response. Please try again.",
        createdAt: new Date().toISOString(),
        requestId,
      };
      const finalMessages = [...newMessages, errorMsg];
      setMessages(finalMessages);
      saveMessages(conversationId, finalMessages);
    } finally {
      setIsGenerating(false);
      requestInFlight.current = null;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleLogout = () => {
    // Keep data but clear session feel
    router.push("/login");
  };

  if (!state || !state.user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted text-sm">Loading Nexa Intelligence…</p>
      </div>
    );
  }

  const currentConv = state.conversations.find(
    (c) => c.id === state.currentConversationId
  );
  const workspaceConvs = state.conversations.filter(
    (c) => c.workspace === state.currentWorkspace
  );

  return (
    <div className="h-screen flex bg-background overflow-hidden">
      {/* Desktop Sidebar */}
      <aside
        className={cn(
          "hidden md:flex flex-col border-r border-sidebar-border bg-sidebar transition-all duration-200",
          sidebarOpen ? "w-64" : "w-0 overflow-hidden"
        )}
      >
        <SidebarContent
          state={state}
          workspaceConvs={workspaceConvs}
          onNew={() => createNewConversation()}
          onSelect={selectConversation}
          onWorkspace={switchWorkspace}
          onSettings={() => router.push("/settings")}
          onLogout={handleLogout}
        />
      </aside>

      {/* Mobile Sidebar */}
      {mobileSidebar && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="w-72 max-w-[85vw] bg-sidebar border-r border-sidebar-border flex flex-col">
            <div className="flex items-center justify-between p-3 border-b border-sidebar-border">
              <span className="font-semibold">Nexa Intelligence</span>
              <button onClick={() => setMobileSidebar(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <SidebarContent
              state={state}
              workspaceConvs={workspaceConvs}
              onNew={() => createNewConversation()}
              onSelect={selectConversation}
              onWorkspace={switchWorkspace}
              onSettings={() => {
                setMobileSidebar(false);
                router.push("/settings");
              }}
              onLogout={handleLogout}
            />
          </div>
          <div
            className="flex-1 bg-black/40"
            onClick={() => setMobileSidebar(false)}
          />
        </div>
      )}

      {/* Main area */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="flex items-center gap-3 px-4 h-14 border-b border-border shrink-0">
          <button
            className="md:hidden p-1.5 rounded-md hover:bg-sidebar"
            onClick={() => setMobileSidebar(true)}
          >
            <PanelLeft className="w-5 h-5" />
          </button>
          <button
            className="hidden md:flex p-1.5 rounded-md hover:bg-sidebar"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            <PanelLeft className="w-5 h-5" />
          </button>

          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">
              {WORKSPACES.find((w) => w.id === state.currentWorkspace)?.emoji}{" "}
              {WORKSPACES.find((w) => w.id === state.currentWorkspace)?.name}
            </div>
            {currentConv && currentConv.title !== "New conversation" && (
              <div className="text-xs text-muted truncate">
                {currentConv.title}
              </div>
            )}
          </div>
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
            {messages.length === 0 && !isGenerating && (
              <EmptyState
                workspace={state.currentWorkspace}
                name={state.user.name}
                businessName={state.businessContext?.businessName}
              />
            )}

            {messages.map((m) => (
              <div
                key={m.id}
                className={cn(
                  "flex",
                  m.role === "user" ? "justify-end" : "justify-start"
                )}
              >
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm prose-nexa",
                    m.role === "user"
                      ? "bg-[var(--user-bubble)] text-[var(--user-bubble-fg)]"
                      : "bg-transparent text-foreground"
                  )}
                >
                  {m.attachments?.map((att) =>
                    att.type === "image" ? (
                      <img
                        key={att.id}
                        src={att.url}
                        alt={att.name}
                        className="mb-2 max-h-64 rounded-lg object-contain"
                      />
                    ) : null
                  )}
                  {m.content}
                </div>
              </div>
            ))}

            {isGenerating && (
              <div className="flex justify-start">
                <div className="text-sm text-muted animate-pulse px-1">
                  Nexa is thinking…
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Composer */}
        <div className="border-t border-border p-4">
          <div className="max-w-3xl mx-auto">
            {pendingImage && (
              <div className="mb-2 flex items-center gap-2 rounded-lg border border-border bg-card p-2">
                <img src={pendingImage.dataUrl} alt="preview" className="h-14 w-14 rounded object-cover" />
                <span className="text-xs text-muted truncate flex-1">{pendingImage.name}</span>
                <button
                  onClick={() => setPendingImage(null)}
                  className="p-1 rounded hover:bg-sidebar"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
            <div className="relative flex items-end gap-2 rounded-2xl border border-border bg-card p-2 shadow-sm">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = () => {
                    setPendingImage({
                      dataUrl: reader.result as string,
                      name: file.name,
                    });
                  };
                  reader.readAsDataURL(file);
                  e.target.value = "";
                }}
              />
              <button
                className="p-2 rounded-lg text-muted hover:text-foreground hover:bg-sidebar transition"
                title="Attach image"
                onClick={() => fileInputRef.current?.click()}
                type="button"
              >
                <ImageIcon className="w-5 h-5" />
              </button>

              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={`Message Nexa Intelligence in ${WORKSPACES.find((w) => w.id === state.currentWorkspace)?.name}…`}
                rows={1}
                className="flex-1 resize-none bg-transparent text-sm outline-none max-h-40 py-2.5 placeholder:text-muted"
                style={{ minHeight: "42px" }}
              />

              <button
                onClick={handleSend}
                disabled={(!input.trim() && !pendingImage) || isGenerating}
                className="p-2.5 rounded-xl bg-accent text-background disabled:opacity-30 hover:opacity-90 transition"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
            <p className="text-[11px] text-muted text-center mt-2">
              Nexa Intelligence is focused on business growth for founders, owners & agencies.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

function SidebarContent({
  state,
  workspaceConvs,
  onNew,
  onSelect,
  onWorkspace,
  onSettings,
  onLogout,
}: {
  state: AppState;
  workspaceConvs: Conversation[];
  onNew: () => void;
  onSelect: (id: string) => void;
  onWorkspace: (ws: WorkspaceId) => void;
  onSettings: () => void;
  onLogout: () => void;
}) {
  return (
    <>
      <div className="p-3">
        <div className="flex items-center gap-2 px-2 mb-4">
          <span className="font-semibold text-lg tracking-tight">Nexa Intelligence</span>
        </div>

        <button
          onClick={onNew}
          className="w-full flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm hover:bg-background transition"
        >
          <Plus className="w-4 h-4" />
          New Conversation
        </button>
      </div>

      <div className="px-3 mb-2">
        <p className="text-[11px] font-medium text-muted uppercase tracking-wider px-2 mb-1.5">
          Workspaces
        </p>
        <div className="space-y-0.5">
          {WORKSPACES.map((ws) => (
            <button
              key={ws.id}
              onClick={() => onWorkspace(ws.id)}
              className={cn(
                "w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition",
                state.currentWorkspace === ws.id
                  ? "bg-card font-medium"
                  : "hover:bg-card/60 text-muted hover:text-foreground"
              )}
            >
              <span>{ws.emoji}</span>
              <span className="truncate">{ws.name}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3">
        <p className="text-[11px] font-medium text-muted uppercase tracking-wider px-2 mb-1.5 mt-3">
          Conversations
        </p>
        <div className="space-y-0.5">
          {workspaceConvs.length === 0 && (
            <p className="text-xs text-muted px-2 py-2">No conversations yet</p>
          )}
          {workspaceConvs.map((c) => (
            <button
              key={c.id}
              onClick={() => onSelect(c.id)}
              className={cn(
                "w-full flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-left transition truncate",
                state.currentConversationId === c.id
                  ? "bg-card font-medium"
                  : "hover:bg-card/60 text-muted hover:text-foreground"
              )}
            >
              <MessageSquare className="w-3.5 h-3.5 shrink-0 opacity-60" />
              <span className="truncate">{c.title}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="p-3 border-t border-sidebar-border space-y-0.5">
        <button
          onClick={onSettings}
          className="w-full flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-muted hover:text-foreground hover:bg-card transition"
        >
          <Settings className="w-4 h-4" />
          Settings
        </button>
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-muted hover:text-foreground hover:bg-card transition"
        >
          <LogOut className="w-4 h-4" />
          Log out
        </button>
      </div>
    </>
  );
}

function EmptyState({
  workspace,
  name,
  businessName,
}: {
  workspace: WorkspaceId;
  name: string;
  businessName?: string;
}) {
  const ws = WORKSPACES.find((w) => w.id === workspace)!;

  const suggestions: Record<WorkspaceId, string[]> = {
    marketing: [
      "Help me create a simple customer acquisition plan",
      "Review my positioning and messaging",
      "What marketing channels should I focus on first?",
    ],
    sales: [
      "Write a cold outreach sequence for my offer",
      "Help me handle the price objection",
      "Improve my sales conversation flow",
    ],
    strategy: [
      "Help me think through pricing",
      "What should I prioritize this quarter?",
      "Analyze my business model strengths and risks",
    ],
    content_brand: [
      "Write 5 LinkedIn posts for this week",
      "Improve my landing page headline and CTA",
      "Help me define a clearer brand voice",
    ],
    personal_growth: [
      "Help me design a better weekly planning system",
      "I'm feeling scattered — help me refocus",
      "How should I protect deep work time as a founder?",
    ],
  };

  return (
    <div className="text-center py-16 space-y-6">
      <div>
        <div className="text-3xl mb-2">{ws.emoji}</div>
        <h2 className="text-xl font-semibold">{ws.name}</h2>
        <p className="text-sm text-muted mt-1 max-w-md mx-auto">
          {ws.description}
        </p>
      </div>

      <p className="text-sm text-muted">
        Hi {name}
        {businessName ? ` · ${businessName}` : ""}. What are you working on?
      </p>

      <div className="flex flex-col gap-2 max-w-md mx-auto">
        {suggestions[workspace].map((s) => (
          <div
            key={s}
            className="text-left text-sm rounded-xl border border-border px-4 py-3 text-muted"
          >
            {s}
          </div>
        ))}
      </div>
    </div>
  );
}
