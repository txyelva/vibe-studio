import type { AppConfig, FileNode, Conversation, Project } from "./types";

const BASE = "";

function getToken(): string | null {
  return localStorage.getItem("vibe_token");
}

async function get<T>(path: string): Promise<T> {
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;
  
  const res = await fetch(`${BASE}${path}`, { headers });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<T>;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;
  
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<T>;
}

async function patch<T>(path: string, body: unknown): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;
  
  const res = await fetch(`${BASE}${path}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<T>;
}

async function del<T>(path: string): Promise<T> {
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;
  
  const res = await fetch(`${BASE}${path}`, { 
    method: "DELETE",
    headers,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<T>;
}

export const api = {
  getConfig: () => get<AppConfig>("/api/config"),

  setup: (data: { provider_id: string; model_id: string; api_key: string; workspace: string }) =>
    post<{ success: boolean }>("/api/setup", data),

  getBuiltinProviders: () =>
    get<{ providers: Record<string, { name: string; base_url: string; api_type: string; env_key: string; models: Array<{ id: string; name: string }> }> }>(
      "/api/providers/builtin"
    ),

  addProvider: (data: {
    provider_id: string;
    name: string;
    base_url: string;
    api_type: string;
    api_key: string;
    models: Array<{ id: string; name: string }>;
  }) => post<{ success: boolean }>("/api/providers", data),

  deleteProvider: (providerId: string) =>
    del<{ success: boolean }>(`/api/providers/${providerId}`),

  testProvider: (providerId: string) =>
    post<{ success: boolean; error?: string }>(`/api/providers/${providerId}/test`, {}),

  setModel: (model: string, fallbacks: string[]) =>
    post<{ success: boolean }>("/api/config/model", { model, fallbacks }),

  setWorkspace: (workspace: string) =>
    post<{ success: boolean; workspace: string }>("/api/config/workspace", { workspace }),

  getFiles: (path = ".") =>
    get<{ tree: FileNode[]; workspace: string }>(`/api/files?path=${encodeURIComponent(path)}`),

  readFile: (path: string) =>
    get<{ content: string; path: string }>(`/api/files/read?path=${encodeURIComponent(path)}`),

  getConversations: (projectId?: string) =>
    get<{ conversations: Conversation[] }>(`/api/conversations${projectId ? `?project_id=${projectId}` : ""}`),

  createConversation: (title?: string, projectId?: string, model?: string) =>
    post<{ success: boolean; conversation: Conversation }>("/api/conversations", { title: title || "新对话", project_id: projectId, model }),

  getConversation: (id: string) =>
    get<{ conversation: { id: string; title: string; created_at: string; updated_at: string; messages: Array<{ role: string; content: string | unknown[] }> } }>(`/api/conversations/${id}`),

  deleteConversation: (id: string) =>
    del<{ success: boolean }>(`/api/conversations/${id}`),

  updateConversationTitle: (id: string, title: string) =>
    patch<{ success: boolean; conversation: Conversation }>(`/api/conversations/${id}/title`, { title }),

  getProjects: () => get<{ projects: Project[] }>("/api/projects"),
  createProject: (data: { name: string; path: string; model: string }) =>
    post<{ success: boolean; project: Project }>("/api/projects", data),
  getProject: (id: string) => get<{ project: Project }>(`/api/projects/${id}`),
  updateProject: (id: string, data: Partial<{ name: string; path: string; model: string }>) =>
    patch<{ success: boolean; project: Project }>(`/api/projects/${id}`, data),
  deleteProject: (id: string) => del<{ success: boolean }>(`/api/projects/${id}`),
  switchProject: (id: string) => post<{ success: boolean; project: Project }>(`/api/projects/${id}/switch`, {}),
  
  // 工具发现
  discoverTools: () => get<{ tools: Array<{ id: string; name: string; description: string; icon: string; is_installed: boolean; install_path: string | null }> }>("/api/discover-tools"),
};

export class AgentSocket {
  private ws: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  onEvent?: (event: import("./types").AgentEvent) => void;
  onOpen?: () => void;
  onClose?: () => void;

  connect() {
    const protocol = location.protocol === "https:" ? "wss:" : "ws:";
    const url = `${protocol}//${location.host}/ws/agent`;
    this.ws = new WebSocket(url);

    this.ws.onopen = () => this.onOpen?.();
    this.ws.onclose = () => {
      this.onClose?.();
      this.reconnectTimer = setTimeout(() => this.connect(), 3000);
    };
    this.ws.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data as string) as import("./types").AgentEvent;
        this.onEvent?.(event);
      } catch {}
    };
  }

  send(message: string, conversationId?: string, workspace?: string, projectId?: string, model?: string) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: "chat", message, conversation_id: conversationId, workspace, project_id: projectId, model }));
    }
  }

  setModel(conversationId: string, model: string) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: "set_model", conversation_id: conversationId, model }));
    }
  }

  loadConversation(conversationId: string) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: "load_conversation", conversation_id: conversationId }));
    }
  }

  clear() {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: "clear" }));
    }
  }

  disconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.close();
  }
}
