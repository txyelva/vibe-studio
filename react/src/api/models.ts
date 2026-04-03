const API_BASE = "/api";

export interface ModelInfo {
  id: string;
  name: string;
  provider: string;
  provider_name: string;
  api_type: string;
}

export interface ProviderPreset {
  id: string;
  name: string;
  api_type: string;
  base_url: string;
  auth_types: string[];
  models: { id: string; name: string }[];
  oauth_api_type?: string;
  oauth_base_url?: string;
  oauth_models?: { id: string; name: string }[];
  docs_url: string;
}

export interface ProviderConfig {
  id: string;
  name: string;
  api_type: string;
  base_url: string;
  auth_type: string;
  models: { id: string; name: string }[];
  is_primary: boolean;
  oauth?: {
    access_token?: string;
    refresh_token?: string;
    expires_at?: number;
    account_id?: string;
  };
}

export interface CreateModelRequest {
  provider_id: string;
  name?: string;
  api_key?: string;
  auth_type: string;
  base_url?: string;
  selected_models: string[];
}

export interface OAuthStatus {
  connected: boolean;
  auth_type: string;
  expires_at?: number;
  account_id?: string;
  login?: {
    status: string;
    error?: string;
    account_email?: string;
    account_plan?: string;
  };
}

export interface ModelUsage {
  model: string;
  provider: string;
  model_id: string;
  total_requests: number;
  total_tokens: number;
  input_tokens: number;
  output_tokens: number;
  has_limit: boolean;
  limit_type: string;
  limit_value: number | null;
  limit_unit: string;
  used_value: number;
  remaining_value: number | null;
  subscription_status: string;
  subscription_plan: string;
  subscription_expires: string | null;
  input_price: number | null;
  output_price: number | null;
}

async function get<T>(path: string): Promise<T> {
  const headers: Record<string, string> = {};
  const token = localStorage.getItem("vibe_token");
  if (token) headers["Authorization"] = `Bearer ${token}`;
  
  const res = await fetch(`${API_BASE}${path}`, { headers });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<T>;
}

async function post<T>(path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const token = localStorage.getItem("vibe_token");
  if (token) headers["Authorization"] = `Bearer ${token}`;
  
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<T>;
}

async function patch<T>(path: string, body: unknown): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const token = localStorage.getItem("vibe_token");
  if (token) headers["Authorization"] = `Bearer ${token}`;
  
  const res = await fetch(`${API_BASE}${path}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<T>;
}

async function del<T>(path: string): Promise<T> {
  const headers: Record<string, string> = {};
  const token = localStorage.getItem("vibe_token");
  if (token) headers["Authorization"] = `Bearer ${token}`;
  
  const res = await fetch(`${API_BASE}${path}`, {
    method: "DELETE",
    headers,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<T>;
}

export const modelsApi = {
  // 获取 Provider 预设
  getProviderPresets: () => get<{ providers: ProviderPreset[] }>("/models/providers/presets"),
  
  // 获取已配置的 Provider 列表
  getProviders: () => get<{ providers: ProviderConfig[] }>("/models"),
  
  // 获取单个 Provider
  getProvider: (providerId: string) => get<{ provider: ProviderConfig }>(`/models/${providerId}`),
  
  // 创建新 Provider
  createProvider: (req: CreateModelRequest) => 
    post<{ success: boolean; provider_id: string; provider: ProviderConfig }>("/models", req),
  
  // 更新 Provider
  updateProvider: (providerId: string, updates: Partial<ProviderConfig>) =>
    patch<{ success: boolean; provider: ProviderConfig }>(`/models/${providerId}`, updates),
  
  // 删除 Provider
  deleteProvider: (providerId: string) => del<{ success: boolean }>(`/models/${providerId}`),
  
  // 测试 Provider 连接
  testProvider: (providerId: string) =>
    post<{ success: boolean; message?: string; error?: string }>(`/models/${providerId}/test`),

  startProviderOAuth: (providerId: string) =>
    post<{ success: boolean; session_id: string; auth_url: string }>(`/models/${providerId}/oauth/start`),

  getProviderOAuthStatus: (providerId: string, sessionId?: string) =>
    get<OAuthStatus>(`/models/${providerId}/oauth/status${sessionId ? `?session_id=${encodeURIComponent(sessionId)}` : ""}`),

  disconnectProviderOAuth: (providerId: string) =>
    post<{ success: boolean }>(`/models/${providerId}/oauth/disconnect`),
  
  // 获取模型用量信息
  getModelUsage: (modelRef: string) => 
    get<ModelUsage>(`/models/usage?model_ref=${encodeURIComponent(modelRef)}`),
  
  // 设置主模型
  setPrimaryModel: (modelRef: string) => 
    post<{ success: boolean; primary_model: string }>(`/models/set-primary?model_ref=${encodeURIComponent(modelRef)}`),
};

// 格式化数字
export function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + "M";
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + "K";
  }
  return num.toString();
}

// 格式化价格
export function formatPrice(price: number | null): string {
  if (price === null || price === undefined) return "-";
  return `$${price.toFixed(3)}/1K tokens`;
}

// 计算使用百分比
export function calculateUsagePercent(used: number, total: number | null): number {
  if (!total || total <= 0) return 0;
  return Math.min(100, Math.round((used / total) * 100));
}
