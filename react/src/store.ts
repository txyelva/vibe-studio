import { create } from "zustand";
import type { AppConfig, ChatMessage, FileNode, Conversation, Project, AgentEvent, PendingApproval } from "./types";
import { AgentSocket, api } from "./api";

function formatStatusMessage(event: AgentEvent): string {
  if (event.type !== "status") return "";
  
  const model = event.model;
  const lines = [
    "🤖 **Vibe Studio Status**",
    "",
    `🧠 **Model**: ${model?.full || "Unknown"}`,
    `   Provider: ${model?.provider || "Unknown"} (${model?.provider_info?.api_type || "unknown"})`,
    `   Model ID: ${model?.model_id || "Unknown"}`,
    model?.is_custom ? "   ⚠️ Using conversation-specific model (not primary)" : "",
    "",
    `📌 **Primary Model**: ${event.primary_model || "Not set"}`,
    `📁 **Workspace**: ${event.workspace || "Not set"}`,
  ].filter(Boolean);
  
  return lines.join("\n");
}

let socket: AgentSocket | null = null;

function createSocket(
  set: (fn: (s: AppState) => Partial<AppState>) => void,
  get: () => AppState
) {
  if (socket) return;

  socket = new AgentSocket();

  socket.onOpen = () => set(() => ({ wsConnected: true }));
  socket.onClose = () => set(() => ({ wsConnected: false }));

  socket.onEvent = (event) => {
    set((state) => {
      const msgs = [...state.messages];
      const last = msgs[msgs.length - 1];

      switch (event.type) {
        case "conversation_created": {
          return { currentConversationId: event.conversation_id };
        }
        case "status": {
          // /status 命令返回的状态信息，显示为系统消息
          const statusMsg: ChatMessage = {
            id: crypto.randomUUID(),
            role: "assistant",
            content: formatStatusMessage(event),
          };
          return { messages: [...state.messages, statusMsg], isAgentRunning: false };
        }
        case "model_changed":
        case "model_set": {
          // 模型切换成功，更新对话的模型
          return { isAgentRunning: false };
        }
        case "conversation_loaded": {
          const loadedMessages: ChatMessage[] = [];
          for (const m of event.messages) {
            if (typeof m.content === "string") {
              loadedMessages.push({
                id: crypto.randomUUID(),
                role: m.role as "user" | "assistant",
                content: m.content,
              });
            }
          }
          return {
            currentConversationId: event.conversation_id,
            messages: loadedMessages,
          };
        }
        case "thinking": {
          if (!last || last.role !== "assistant") return {};
          msgs[msgs.length - 1] = { ...last, thinking: (last.thinking ?? "") + event.text };
          return { messages: msgs };
        }
        case "assistant_message": {
          if (!last || last.role !== "assistant") return {};
          msgs[msgs.length - 1] = { ...last, content: event.text, unverifiedContent: event.text };
          return { messages: msgs };
        }
        case "tool_start":
        case "tool_end": {
          if (!last || last.role !== "assistant") return {};
          const executedTools =
            event.type === "tool_end" &&
            !(typeof event.result === "object" && event.result !== null && "permission_denied" in event.result && (event.result as Record<string, unknown>).permission_denied === true)
              ? true
              : last.executedTools;
          msgs[msgs.length - 1] = { ...last, events: [...(last.events ?? []), event], executedTools };
          return { messages: msgs };
        }
        case "approval_required": {
          const pendingApproval = {
            approvalId: event.approval_id,
            toolName: event.tool_name,
            args: event.args,
            message: event.message,
          };
          if (!last || last.role !== "assistant") return { pendingApproval };
          msgs[msgs.length - 1] = { ...last, events: [...(last.events ?? []), event] };
          return { messages: msgs, pendingApproval };
        }
        case "approval_resolved": {
          if (!last || last.role !== "assistant") return { pendingApproval: null };
          msgs[msgs.length - 1] = { ...last, events: [...(last.events ?? []), event] };
          return { messages: msgs, pendingApproval: null };
        }
        case "file_changed": {
          if (!last || last.role !== "assistant") return {};
          msgs[msgs.length - 1] = {
            ...last,
            events: [...(last.events ?? []), event],
            fileChanges: [...(last.fileChanges ?? []), event],
          };
          void get().loadFiles();
          const sel = state.selectedFile;
          if (sel && sel.path === event.path && event.new_content != null) {
            return { messages: msgs, selectedFile: { path: event.path, content: event.new_content } };
          }
          return { messages: msgs };
        }
        case "done": {
          if (!last || last.role !== "assistant") return { isAgentRunning: false };
          let content = last.content;
          let unverifiedContent = last.unverifiedContent;
          if (!content.trim()) {
            if (last.executedTools) content = "已完成本地操作，详细过程见上方工具执行记录。";
            else if ((last.thinking ?? "").trim()) content = "本次只生成了思考或计划，没有实际执行本地操作。";
          }
          if (!last.executedTools) {
            if (content.trim()) {
              unverifiedContent = content;
            }
            content = "本次没有任何工具执行记录，不能视为已经完成本地操作。下方思考内容和未验证结论仅代表模型判断。";
          }
          msgs[msgs.length - 1] = { ...last, content, unverifiedContent, isStreaming: false };
          return { messages: msgs, isAgentRunning: false, pendingApproval: null };
        }
        case "error": {
          if (!last || last.role !== "assistant") return {};
          msgs[msgs.length - 1] = {
            ...last,
            content: last.content + `\n\n❌ ${event.text}`,
            isStreaming: false,
          };
          return { messages: msgs, isAgentRunning: false, pendingApproval: null };
        }
        default:
          return {};
      }
    });
  };

  socket.connect();
}

interface AppState {
  config: AppConfig | null;
  loadingConfig: boolean;
  fileTree: FileNode[];
  selectedFile: { path: string; content: string } | null;
  loadingFile: boolean;
  messages: ChatMessage[];
  pendingApproval: PendingApproval | null;
  isAgentRunning: boolean;
  wsConnected: boolean;
  showSettings: boolean;
  showOnboarding: boolean;

  conversations: Conversation[];
  currentConversationId: string | null;
  loadingConversations: boolean;

  projects: Project[];
  currentProjectId: string | null;
  loadingProjects: boolean;

  // Auth state
  isAuthenticated: boolean;
  username: string | null;
  setAuthenticated: (user: string | null) => void;
  logout: () => void;

  loadConfig: () => Promise<void>;
  refreshConfig: () => Promise<void>;
  loadFiles: () => Promise<void>;
  openFile: (path: string) => Promise<void>;
  sendMessage: (text: string) => void;
  respondToApproval: (approved: boolean, reason?: string) => void;
  clearChat: () => void;
  setShowSettings: (v: boolean) => void;

  loadConversations: (projectId?: string) => Promise<void>;
  createConversation: (projectId?: string, model?: string) => Promise<string | undefined>;
  loadConversation: (id: string) => Promise<void>;
  switchConversation: (id: string) => Promise<void>;
  deleteConversation: (id: string) => Promise<void>;
  updateConversationTitle: (id: string, title: string) => Promise<void>;

  loadProjects: () => Promise<void>;
  createProject: (data: { name: string; path: string; model: string }) => Promise<void>;
  switchProject: (id: string) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  updateProject: (id: string, data: Partial<{ name: string; path: string; model: string }>) => Promise<void>;
}

export const useStore = create<AppState>((set, get) => ({
  config: null,
  loadingConfig: true,
  fileTree: [],
  selectedFile: null,
  loadingFile: false,
  messages: [],
  pendingApproval: null,
  isAgentRunning: false,
  wsConnected: false,
  showSettings: false,
  showOnboarding: false,

  conversations: [],
  currentConversationId: null,
  loadingConversations: false,

  projects: [],
  currentProjectId: null,
  loadingProjects: false,

  // Auth
  isAuthenticated: false,
  username: null,
  setAuthenticated: (user: string | null) => {
    set(() => ({
      isAuthenticated: !!user,
      username: user,
    }));
  },
  logout: () => {
    localStorage.removeItem("vibe_token");
    set(() => ({
      isAuthenticated: false,
      username: null,
    }));
    window.location.href = "/login";
  },

  loadConfig: async () => {
    set(() => ({ loadingConfig: true }));
    try {
      const cfg = await api.getConfig();
      set(() => ({
        config: cfg,
        showOnboarding: !cfg.setup_complete,
        loadingConfig: false,
      }));
      if (cfg.setup_complete) {
        void get().loadFiles();
        void get().loadConversations();
        void get().loadProjects();
        createSocket(set, get);
      }
    } catch (e) {
      console.error("loadConfig failed:", e);
      set(() => ({ loadingConfig: false, showOnboarding: true }));
    }
  },

  refreshConfig: async () => {
    try {
      const cfg = await api.getConfig();
      set(() => ({
        config: cfg,
        showOnboarding: !cfg.setup_complete,
      }));
      if (cfg.setup_complete) {
        void get().loadFiles();
        // 根据 workspace 自动匹配当前项目
        const projects = get().projects;
        if (cfg.workspace && projects.length > 0) {
          const matched = projects.find((p) => p.path === cfg.workspace);
          if (matched) {
            set(() => ({ currentProjectId: matched.id }));
          }
        }
        createSocket(set, get);
      }
    } catch (e) {
      console.error("refreshConfig failed:", e);
    }
  },

  loadFiles: async () => {
    try {
      const { tree } = await api.getFiles();
      set(() => ({ fileTree: tree }));
    } catch (e) {
      console.error("loadFiles failed:", e);
    }
  },

  openFile: async (path: string) => {
    set(() => ({ loadingFile: true }));
    try {
      const { content } = await api.readFile(path);
      set(() => ({ selectedFile: { path, content }, loadingFile: false }));
    } catch (e) {
      console.error("openFile failed:", e);
      set(() => ({ loadingFile: false }));
    }
  },

  sendMessage: (text: string) => {
    if (!socket || get().isAgentRunning) return;

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
    };
    const assistantMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: "",
      thinking: "",
      events: [],
      isStreaming: true,
      executedTools: false,
      fileChanges: [],
    };

    set((s) => ({
      messages: [...s.messages, userMsg, assistantMsg],
      isAgentRunning: true,
    }));

    const cfg = get().config;
    const convId = get().currentConversationId ?? undefined;
    const projectId = get().currentProjectId ?? undefined;
    socket.send(text, convId, cfg?.workspace, projectId);
  },

  respondToApproval: (approved: boolean, reason?: string) => {
    const approval = get().pendingApproval;
    if (!socket || !approval) return;
    socket.respondToApproval(approval.approvalId, approved, reason);
  },

  clearChat: () => {
    socket?.clear();
    set(() => ({ messages: [], currentConversationId: null, pendingApproval: null }));
  },

  setShowSettings: (v) => set(() => ({ showSettings: v })),

  loadConversations: async (projectId?: string) => {
    set(() => ({ loadingConversations: true }));
    try {
      const { conversations } = await api.getConversations(projectId);
      set(() => ({ conversations, loadingConversations: false }));
    } catch (e) {
      console.error("loadConversations failed:", e);
      set(() => ({ loadingConversations: false }));
    }
  },

  createConversation: async (projectId?: string, model?: string) => {
    try {
      const { conversation } = await api.createConversation("新对话", projectId, model);
      set((s) => ({
        conversations: [conversation, ...s.conversations],
        currentConversationId: conversation.id,
        messages: [],
        pendingApproval: null,
      }));
      return conversation.id;
    } catch (e) {
      console.error("createConversation failed:", e);
      return undefined;
    }
  },

  loadConversation: async (id: string) => {
    try {
      const { conversation } = await api.getConversation(id);
      if (conversation) {
        // 转换消息格式
        const messages: ChatMessage[] = conversation.messages.map((m: any) => ({
          id: crypto.randomUUID(),
          role: m.role as "user" | "assistant",
          content: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
        }));
        set(() => ({
          currentConversationId: id,
          messages,
          pendingApproval: null,
        }));
      }
    } catch (e) {
      console.error("loadConversation failed:", e);
    }
  },

  switchConversation: async (id: string) => {
    set(() => ({ currentConversationId: id, messages: [], pendingApproval: null }));
    // 通过 API 加载对话消息
    await get().loadConversation(id);
    // 同时通过 socket 通知后端（保持兼容性）
    socket?.loadConversation(id);
    void get().loadConversations();
  },

  deleteConversation: async (id: string) => {
    try {
      await api.deleteConversation(id);
      set((s) => {
        const nextConversations = s.conversations.filter((c) => c.id !== id);
        const nextConvId = s.currentConversationId === id ? null : s.currentConversationId;
        const nextMessages = s.currentConversationId === id ? [] : s.messages;
        return {
          conversations: nextConversations,
          currentConversationId: nextConvId,
          messages: nextMessages,
        };
      });
    } catch (e) {
      console.error("deleteConversation failed:", e);
    }
  },

  updateConversationTitle: async (id: string, title: string) => {
    try {
      await api.updateConversationTitle(id, title);
      set((s) => ({
        conversations: s.conversations.map((c) =>
          c.id === id ? { ...c, title } : c
        ),
      }));
    } catch (e) {
      console.error("updateConversationTitle failed:", e);
    }
  },

  loadProjects: async () => {
    set(() => ({ loadingProjects: true }));
    try {
      const { projects } = await api.getProjects();
      const cfg = get().config;
      let currentProjectId = get().currentProjectId;
      if (!currentProjectId && cfg?.workspace) {
        const matched = projects.find((p) => p.path === cfg.workspace);
        if (matched) currentProjectId = matched.id;
      }
      set(() => ({ projects, currentProjectId, loadingProjects: false }));
    } catch (e) {
      console.error("loadProjects failed:", e);
      set(() => ({ loadingProjects: false }));
    }
  },

  createProject: async (data) => {
    try {
      const { project } = await api.createProject(data);
      set((s) => ({
        projects: [...s.projects, project],
        currentProjectId: project.id,
      }));
      await get().refreshConfig();
    } catch (e) {
      console.error("createProject failed:", e);
    }
  },

  switchProject: async (id) => {
    try {
      await api.switchProject(id);
      set(() => ({ currentProjectId: id }));
      await get().refreshConfig();
      void get().loadFiles();
    } catch (e) {
      console.error("switchProject failed:", e);
    }
  },

  deleteProject: async (id) => {
    try {
      await api.deleteProject(id);
      set((s) => {
        const nextProjects = s.projects.filter((p) => p.id !== id);
        const nextProjectId = s.currentProjectId === id ? (nextProjects[0]?.id ?? null) : s.currentProjectId;
        return { projects: nextProjects, currentProjectId: nextProjectId };
      });
      await get().refreshConfig();
    } catch (e) {
      console.error("deleteProject failed:", e);
    }
  },

  updateProject: async (id, data) => {
    try {
      const { project } = await api.updateProject(id, data);
      set((s) => ({
        projects: s.projects.map((p) => (p.id === id ? project : p)),
      }));
      await get().refreshConfig();
    } catch (e) {
      console.error("updateProject failed:", e);
    }
  },
}));
