"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  loadAppState,
  saveAppState,
  loadMessages,
  saveMessages,
  createId,
  createConversation,
  getRelevantMemories,
  generateConversationTitle,
  hasAssistantForRequest,
  addMessage,
} from "@/lib/conversationStore";
import { WORKSPACE_EMPTY_STATE } from "@/lib/prompts";
import {
  AppState,
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

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("timeout")), ms);
    promise.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      }
    );
  });
}

function displayTitle(title: string) {
  if (!title || /^new conversation$/i.test(title) || /^new chat$/i.test(title)) {
    return "Untitled";
  }
  return title;
}

export default function ChatPage() {
  const router = useRouter();
  const [state, setState] = useState<AppState | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [lastErrorRequestId, setLastErrorRequestId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileSidebar, setMobileSidebar] = useState(false);
  const [pendingImage, setPendingImage] = useState<{ dataUrl: string; name: string } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const requestInFlight = useRef<string | null>(null);

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
    if (s.currentConversationId) {
      setMessages(loadMessages(s.currentConversationId));
    }
  }, [router]);

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

  const createNewConversation = () => {
    if (!state?.user) return;
    const conv = createConversation({
      userId: state.user.id,
      workspace: state.currentWorkspace,
    });
    persistState({
      conversations: [conv, ...(state.conversations || []).filter((c) => c.id !== conv.id)],
      currentConversationId: conv.id,
      currentWorkspace: state.currentWorkspace,
    });
    setMessages([]);
    setLastErrorRequestId(null);
    setMobileSidebar(false);
  };

  const selectConversation = (id: string) => {
    const conv = state?.conversations.find((c) => c.id === id);
    if (!conv) return;
    persistState({ currentConversationId: id, currentWorkspace: conv.workspace });
    setMessages(loadMessages(id));
    setLastErrorRequestId(null);
    setMobileSidebar(false);
  };

  const switchWorkspace = (ws: WorkspaceId) => {
    if (!state) return;
    const currentConv = state.conversations.find((c) => c.id === state.currentConversationId);
    if (!currentConv || currentConv.workspace !== ws) {
      persistState({ currentWorkspace: ws, currentConversationId: null });
      setMessages([]);
      setLastErrorRequestId(null);
    } else {
      persistState({ currentWorkspace: ws });
    }
  };

  const runGeneration = async (params: {
    conversationId: string;
    workspace: WorkspaceId;
    requestId: string;
    imageDataUrl?: string;
    history: Message[];
  }) => {
    if (!state?.user) return;

    const businessContext = state.businessContext;
    const memories = getRelevantMemories(state.memories || []).map((m) => ({
      content: m.content,
      category: m.category,
    }));

    const recent = params.history
      .filter((m) => m.role === "user" || m.role === "assistant")
      .slice(-12)
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

    const websiteContent = businessContext?.websiteSummary || undefined;

    let responseText = "";
    let failed = false;

    try {
      const apiRes = await withTimeout(
        fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workspace: params.workspace,
            userType: state.user.userType,
            businessContext,
            memories,
            recentMessages: recent,
            userName: state.user.name,
            websiteContent,
            imageDataUrl: params.imageDataUrl,
            requestId: params.requestId,
          }),
        }),
        28000
      );

      const apiData = await apiRes.json().catch(() => ({}));
      responseText = (apiData && apiData.content) || "";

      const looksBroken =
        !responseText ||
        responseText === "__USE_BROWSER_ENGINE__" ||
        /could not reach any AI provider/i.test(responseText) ||
        /Invalid API Key/i.test(responseText) ||
        /GROQ_API_KEY|GEMINI_API_KEY|OPENAI_API_KEY|DEEPSEEK/i.test(responseText);

      if (looksBroken || !apiRes.ok || apiData.success === false) {
        failed = true;
        responseText = "Something went wrong while generating your response. Please try again.";
      }
    } catch {
      failed = true;
      responseText = "Generation timed out. Please try again.";
    }

    // Ownership: only attach to original conversationId + requestId
    if (!hasAssistantForRequest(params.conversationId, params.requestId)) {
      const assistantMessage: Message = {
        id: createId(),
        conversationId: params.conversationId,
        role: "assistant",
        content: responseText,
        createdAt: new Date().toISOString(),
        requestId: params.requestId,
        status: failed ? "error" : "complete",
      };
      const finalMessages = addMessage(params.conversationId, assistantMessage);

      const latest = loadAppState();
      if (latest.currentConversationId === params.conversationId) {
        setMessages(finalMessages);
        if (failed) setLastErrorRequestId(params.requestId);
        else setLastErrorRequestId(null);
      }

      const conversations = (latest.conversations || []).map((c) =>
        c.id === params.conversationId
          ? {
              ...c,
              updatedAt: new Date().toISOString(),
              messageCount: finalMessages.length,
            }
          : c
      );
      saveAppState({ conversations });
      setState((prev) => (prev ? { ...prev, conversations } : prev));
    }
  };

  const handleSend = async () => {
    if ((!input.trim() && !pendingImage) || !state?.user || isGenerating) return;
    if (requestInFlight.current) return;

    const workspaceAtSend = state.currentWorkspace;
    let conversationId = state.currentConversationId;

    if (!conversationId) {
      const conv = createConversation({
        userId: state.user.id,
        workspace: workspaceAtSend,
      });
      conversationId = conv.id;
      persistState({
        conversations: [conv, ...(state.conversations || [])],
        currentConversationId: conv.id,
        currentWorkspace: workspaceAtSend,
      });
    }

    const requestId = createId();
    requestInFlight.current = requestId;

    const currentImage = pendingImage;
    const userContent = input.trim() || (currentImage ? "[Image attached]" : "");
    const userMessage: Message = {
      id: createId(),
      conversationId,
      role: "user",
      content: userContent,
      createdAt: new Date().toISOString(),
      requestId,
      status: "complete",
      attachments: currentImage
        ? [
            {
              id: createId(),
              type: "image",
              name: currentImage.name,
              url: currentImage.dataUrl,
              mimeType: "image/*",
            },
          ]
        : undefined,
    };

    const existing = loadMessages(conversationId);
    const newMessages = [...existing, userMessage];
    saveMessages(conversationId, newMessages);
    setMessages(newMessages);
    setInput("");
    setPendingImage(null);
    setIsGenerating(true);
    setLastErrorRequestId(null);

    // Auto-title once after first meaningful message
    if (existing.length === 0) {
      const title = generateConversationTitle(userMessage.content);
      const conversations = (loadAppState().conversations || []).map((c) =>
        c.id === conversationId
          ? { ...c, title, updatedAt: new Date().toISOString(), messageCount: 1 }
          : c
      );
      saveAppState({ conversations });
      setState((prev) => (prev ? { ...prev, conversations } : prev));
    }

    try {
      await runGeneration({
        conversationId,
        workspace: workspaceAtSend,
        requestId,
        imageDataUrl: currentImage?.dataUrl,
        history: newMessages,
      });
    } finally {
      setIsGenerating(false);
      requestInFlight.current = null;
    }
  };

  const handleRetry = async () => {
    if (!state?.user || !state.currentConversationId || isGenerating) return;
    if (requestInFlight.current) return;

    const conversationId = state.currentConversationId;
    const workspace = state.currentWorkspace;
    const msgs = loadMessages(conversationId);
    const lastUser = [...msgs].reverse().find((m) => m.role === "user");
    if (!lastUser) return;

    // Remove failed assistant replies for this user message
    const cleaned = msgs.filter(
      (m) =>
        !(m.role === "assistant" && m.requestId === lastUser.requestId && m.status === "error")
    );
    saveMessages(conversationId, cleaned);
    setMessages(cleaned);

    // New attempt id, but keep association via same user message context
    const attemptId = createId();
    // Rewrite user message requestId so ownership tracks this attempt
    const remapped = cleaned.map((m) =>
      m.id === lastUser.id ? { ...m, requestId: attemptId } : m
    );
    saveMessages(conversationId, remapped);
    setMessages(remapped);

    requestInFlight.current = attemptId;
    setIsGenerating(true);
    setLastErrorRequestId(null);

    try {
      await runGeneration({
        conversationId,
        workspace,
        requestId: attemptId,
        imageDataUrl: lastUser.attachments?.find((a) => a.type === "image")?.url,
        history: remapped,
      });
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

  if (!state || !state.user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted text-sm">Loading Nexa…</p>
      </div>
    );
  }

  const currentConv = state.conversations.find((c) => c.id === state.currentConversationId);
  const workspaceConvs = (state.conversations || [])
    .filter((c) => c.workspace === state.currentWorkspace)
    .filter((c) => {
      if (c.id === state.currentConversationId) return true;
      if ((c.messageCount || 0) > 0) return true;
      if (c.title && !/^new conversation$/i.test(c.title)) return true;
      return false;
    });

  const emptyPrompt =
    WORKSPACE_EMPTY_STATE[state.currentWorkspace] || "What are you working on?";

  const Sidebar = (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-sidebar-border">
        <button
          onClick={createNewConversation}
          className="w-full flex items-center gap-2 rounded-lg bg-accent text-background px-3 py-2 text-sm font-medium"
        >
          <Plus className="w-4 h-4" /> New chat
        </button>
      </div>
      <div className="p-2 flex flex-wrap gap-1 border-b border-sidebar-border">
        {WORKSPACES.map((w) => (
          <button
            key={w.id}
            onClick={() => switchWorkspace(w.id)}
            className={cn(
              "text-xs px-2 py-1 rounded-md",
              state.currentWorkspace === w.id
                ? "bg-accent/15 text-foreground"
                : "text-muted hover:bg-sidebar"
            )}
          >
            {w.emoji} {w.name}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {workspaceConvs.map((c) => (
          <button
            key={c.id}
            onClick={() => selectConversation(c.id)}
            className={cn(
              "w-full text-left text-sm px-3 py-2 rounded-lg truncate flex items-center gap-2",
              state.currentConversationId === c.id ? "bg-sidebar-border" : "hover:bg-sidebar"
            )}
          >
            <MessageSquare className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{displayTitle(c.title)}</span>
          </button>
        ))}
        {workspaceConvs.length === 0 && (
          <p className="text-xs text-muted px-2 py-3">No chats in this workspace yet.</p>
        )}
      </div>
      <div className="p-2 border-t border-sidebar-border space-y-1">
        <button
          onClick={() => router.push("/settings")}
          className="w-full flex items-center gap-2 text-sm px-3 py-2 rounded-lg hover:bg-sidebar"
        >
          <Settings className="w-4 h-4" /> Settings
        </button>
        <button
          onClick={() => router.push("/login")}
          className="w-full flex items-center gap-2 text-sm px-3 py-2 rounded-lg hover:bg-sidebar"
        >
          <LogOut className="w-4 h-4" /> Log out
        </button>
      </div>
    </div>
  );

  return (
    <div className="h-screen flex bg-background overflow-hidden">
      <aside
        className={cn(
          "hidden md:flex flex-col border-r border-sidebar-border bg-sidebar transition-all",
          sidebarOpen ? "w-64" : "w-0 overflow-hidden"
        )}
      >
        {Sidebar}
      </aside>

      {mobileSidebar && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="w-72 max-w-[85vw] bg-sidebar border-r border-sidebar-border flex flex-col">
            <div className="flex items-center justify-between p-3 border-b border-sidebar-border">
              <span className="font-semibold">Nexa</span>
              <button onClick={() => setMobileSidebar(false)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            {Sidebar}
          </div>
          <div className="flex-1 bg-black/40" onClick={() => setMobileSidebar(false)} />
        </div>
      )}

      <main className="flex-1 flex flex-col min-w-0">
        <header className="flex items-center gap-3 px-4 h-14 border-b border-border shrink-0">
          <button className="md:hidden p-1.5" onClick={() => setMobileSidebar(true)}>
            <PanelLeft className="w-5 h-5" />
          </button>
          <button className="hidden md:flex p-1.5" onClick={() => setSidebarOpen(!sidebarOpen)}>
            <PanelLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">
              {WORKSPACES.find((w) => w.id === state.currentWorkspace)?.emoji}{" "}
              {WORKSPACES.find((w) => w.id === state.currentWorkspace)?.name}
            </div>
            {currentConv && (currentConv.messageCount > 0 || !/^new conversation$/i.test(currentConv.title)) && (
              <div className="text-xs text-muted truncate">{displayTitle(currentConv.title)}</div>
            )}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
            {messages.length === 0 && !isGenerating && (
              <div className="text-center py-16 space-y-3">
                <h1 className="text-xl font-semibold">Nexa</h1>
                <p className="text-sm text-muted">{emptyPrompt}</p>
              </div>
            )}

            {messages.map((m) => (
              <div
                key={m.id}
                className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}
              >
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap",
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
              <div className="text-sm text-muted animate-pulse px-1">Nexa is thinking…</div>
            )}

            {!isGenerating && lastErrorRequestId && (
              <div className="flex items-center gap-3 text-sm">
                <span className="text-muted">Something went wrong.</span>
                <button
                  onClick={handleRetry}
                  className="rounded-lg border border-border px-3 py-1.5 hover:bg-sidebar"
                >
                  Retry
                </button>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        <div className="border-t border-border p-4">
          <div className="max-w-3xl mx-auto">
            {pendingImage && (
              <div className="mb-2 flex items-center gap-2 rounded-lg border border-border bg-card p-2">
                <img src={pendingImage.dataUrl} alt="preview" className="h-14 w-14 rounded object-cover" />
                <span className="text-xs text-muted truncate flex-1">{pendingImage.name}</span>
                <button onClick={() => setPendingImage(null)} className="p-1">
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
                    setPendingImage({ dataUrl: reader.result as string, name: file.name });
                  };
                  reader.readAsDataURL(file);
                  e.target.value = "";
                }}
              />
              <button
                className="p-2 rounded-lg text-muted hover:text-foreground"
                type="button"
                onClick={() => fileInputRef.current?.click()}
              >
                <ImageIcon className="w-5 h-5" />
              </button>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={`Message Nexa in ${
                  WORKSPACES.find((w) => w.id === state.currentWorkspace)?.name
                }…`}
                rows={1}
                className="flex-1 resize-none bg-transparent text-sm outline-none max-h-40 py-2.5 placeholder:text-muted"
              />
              <button
                onClick={handleSend}
                disabled={(!input.trim() && !pendingImage) || isGenerating}
                className="p-2.5 rounded-xl bg-accent text-background disabled:opacity-30"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
            <p className="text-[11px] text-muted text-center mt-2">
              Nexa — your AI business growth partner
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
