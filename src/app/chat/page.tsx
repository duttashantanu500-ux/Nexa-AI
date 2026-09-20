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
import { fetchWebsiteContent } from "@/lib/ai";
import { generateConversationTitle } from "@/lib/prompts";
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
    if (s.currentConversationId) setMessages(loadMessages(s.currentConversationId));
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
    const conv: Conversation = {
      id: createId(),
      userId: state.user.id,
      workspace: state.currentWorkspace,
      title: "New conversation",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messageCount: 0,
    };
    persistState({
      conversations: [conv, ...state.conversations],
      currentConversationId: conv.id,
    });
    setMessages([]);
    setMobileSidebar(false);
  };

  const selectConversation = (id: string) => {
    const conv = state?.conversations.find((c) => c.id === id);
    if (!conv) return;
    persistState({ currentConversationId: id, currentWorkspace: conv.workspace });
    setMessages(loadMessages(id));
    setMobileSidebar(false);
  };

  const switchWorkspace = (ws: WorkspaceId) => {
    const currentConv = state?.conversations.find((c) => c.id === state.currentConversationId);
    if (currentConv && currentConv.workspace !== ws) {
      persistState({ currentWorkspace: ws, currentConversationId: null });
      setMessages([]);
    } else {
      persistState({ currentWorkspace: ws });
    }
  };

  const handleSend = async () => {
    if ((!input.trim() && !pendingImage) || !state?.user || isGenerating) return;

    let conversationId = state.currentConversationId;
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
      persistState({
        conversations: [conv, ...state.conversations],
        currentConversationId: conv.id,
      });
    }

    const requestId = createId();
    if (requestInFlight.current) return;
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

    if (messages.length === 0) {
      const title = generateConversationTitle(userMessage.content);
      const conversations = state.conversations.map((c) =>
        c.id === conversationId
          ? { ...c, title, updatedAt: new Date().toISOString(), messageCount: 1 }
          : c
      );
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

      const relevantMemories = getRelevantMemories(state.memories || []).map((m) => ({
        content: m.content,
        category: m.category,
      }));

      let websiteContent: string | undefined;
      const urlMatch = userMessage.content.match(/https?:\/\/[^\s)]+/i);
      if (urlMatch) {
        try {
          websiteContent = await withTimeout(fetchWebsiteContent(urlMatch[0]), 8000);
        } catch {
          websiteContent = undefined;
        }
      }

      let responseText = "";
      try {
        const apiRes = await withTimeout(
          fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              workspace: state.currentWorkspace,
              userType: state.user.userType,
              businessContext: state.businessContext,
              memories: relevantMemories,
              recentMessages: recent,
              userName: state.user.name,
              websiteContent,
              imageDataUrl: currentImage?.dataUrl,
            }),
          }),
          20000
        );

        const apiData = await apiRes.json().catch(() => ({}));
        responseText = (apiData && apiData.content) || "";

        const looksBroken =
          !responseText ||
          responseText === "__USE_BROWSER_ENGINE__" ||
          /could not reach any AI provider/i.test(responseText) ||
          /Invalid API Key/i.test(responseText) ||
          /no credits remaining/i.test(responseText) ||
          /GROQ_API_KEY|GEMINI_API_KEY|OPENAI_API_KEY/i.test(responseText);

        if (looksBroken || !apiRes.ok) {
          try {
            const { NexaBrowserAI } = await import("@/lib/browser-ai/chat-engine.js");
            if (!(window as any).__nexaBrowserAI) {
              (window as any).__nexaBrowserAI = new NexaBrowserAI({
                systemPrompt:
                  "You are Nexa, a practical AI business growth partner for founders, business owners and agencies. Write in plain natural language. Keep punctuation light. Be useful and specific.",
              });
            }
            const browserAI = (window as any).__nexaBrowserAI;
            let prompt = userMessage.content;
            if (websiteContent) prompt += "\n\nWebsite content to use:\n" + websiteContent.slice(0, 6000);
            if (currentImage) {
              prompt +=
                "\n\nThe user attached an image. Give practical business feedback based on what they asked.";
            }
            responseText = await withTimeout(browserAI.sendMessage(prompt), 10000);
          } catch (browserErr) {
            console.error("Browser engine failed:", browserErr);
            responseText =
              "I could not finish that reply just now. Please try again in a moment.";
          }
        }

        if (
          !responseText ||
          responseText === "__USE_BROWSER_ENGINE__" ||
          /could not reach any AI provider/i.test(responseText) ||
          /GROQ_API_KEY|GEMINI_API_KEY|OPENAI_API_KEY/i.test(responseText)
        ) {
          responseText =
            "I could not finish that reply just now. Please try again in a moment.";
        }
      } catch (err) {
        console.error("Chat API error:", err);
        responseText =
          "I could not finish that reply just now. Please try again in a moment.";
      }

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
        content: "I could not finish that reply just now. Please try again in a moment.",
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

  if (!state || !state.user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted text-sm">Loading Nexa…</p>
      </div>
    );
  }

  const currentConv = state.conversations.find((c) => c.id === state.currentConversationId);
  const workspaceConvs = state.conversations.filter((c) => c.workspace === state.currentWorkspace);

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
            <span className="truncate">{c.title}</span>
          </button>
        ))}
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
            {currentConv && currentConv.title !== "New conversation" && (
              <div className="text-xs text-muted truncate">{currentConv.title}</div>
            )}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
            {messages.length === 0 && !isGenerating && (
              <div className="text-center py-16 space-y-3">
                <h1 className="text-xl font-semibold">Nexa</h1>
                <p className="text-sm text-muted">
                  Hi {state.user.name}
                  {state.businessContext?.businessName
                    ? ` · ${state.businessContext.businessName}`
                    : ""}
                  . What are you working on?
                </p>
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
            <div ref={messagesEndRef} />
          </div>
        </div>

        <div className="border-t border-border p-4">
          <div className="max-w-3xl mx-auto">
            {pendingImage && (
              <div className="mb-2 flex items-center gap-2 rounded-lg border border-border bg-card p-2">
                <img
                  src={pendingImage.dataUrl}
                  alt="preview"
                  className="h-14 w-14 rounded object-cover"
                />
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
              Nexa is focused on business growth for founders, owners and agencies.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
