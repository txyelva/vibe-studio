export interface FileNode {
  name: string;
  path: string;
  type: "file" | "dir";
  children?: FileNode[];
}

export interface ModelInfo {
  id: string;
  name: string;
}

export interface ProviderConfig {
  name: string;
  base_url: string;
  api_type: "openai" | "anthropic";
  api_key: string;
  models: ModelInfo[];
}

export interface AppConfig {
  setup_complete: boolean;
  primary_model: string;
  fallback_models: string[];
  workspace: string;
  providers: Record<string, ProviderConfig>;
  tool_permissions?: {
    default_mode: "allow" | "deny" | "prompt";
    tool_modes: Record<string, "allow" | "deny" | "prompt">;
  };
}

export interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  project_id?: string;
  message_count: number;
  model?: string;  // 对话使用的模型 (provider/model_id)，未设置时使用主模型
}

export interface Project {
  id: string;
  name: string;
  path: string;
  model: string;
  created_at: string;
}

export type AgentEvent =
  | { type: "start"; message: string }
  | { type: "thinking"; text: string }
  | { type: "assistant_message"; text: string }
  | { type: "tool_start"; name: string; args: Record<string, unknown> }
  | { type: "tool_end"; name: string; result: Record<string, unknown> }
  | { type: "approval_required"; approval_id: string; tool_name: string; args: Record<string, unknown>; message: string }
  | { type: "approval_resolved"; approval_id: string; tool_name: string; approved: boolean; reason?: string | null }
  | { type: "file_changed"; path: string; old_content?: string; new_content?: string }
  | { type: "error"; text: string }
  | { type: "done" }
  | { type: "stopped" }
  | { type: "cleared" }
  | { type: "pong" }
  | { type: "conversation_created"; conversation_id: string; model?: string }
  | { type: "conversation_loaded"; conversation_id: string; messages: Array<{ role: string; content: string | unknown[] }>; model?: string }
  | { type: "status"; model?: { full: string; provider: string; model_id: string; provider_info?: { name: string; api_type: string }; is_custom?: boolean }; primary_model: string; workspace: string }
  | { type: "model_changed"; model: string }
  | { type: "model_set"; model: string };

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  thinking?: string;
  unverifiedContent?: string;
  events?: AgentEvent[];
  isStreaming?: boolean;
  executedTools?: boolean;
  fileChanges?: Array<{ path: string; old_content?: string; new_content?: string }>;
}

export interface PendingApproval {
  approvalId: string;
  toolName: string;
  args: Record<string, unknown>;
  message: string;
}
