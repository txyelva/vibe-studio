const API_BASE = "/api";

export interface AuthStatus {
  enabled: boolean;
  setup_required: boolean;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  username: string;
}

export const authApi = {
  // 获取认证状态
  async getStatus(): Promise<AuthStatus> {
    const res = await fetch(`${API_BASE}/auth/status`);
    if (!res.ok) throw new Error("Failed to get auth status");
    return res.json();
  },

  // 首次设置管理员账号
  async setup(username: string, password: string): Promise<LoginResponse> {
    const res = await fetch(`${API_BASE}/auth/setup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Setup failed");
    }
    return res.json();
  },

  // 登录
  async login(username: string, password: string): Promise<LoginResponse> {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Login failed");
    }
    return res.json();
  },

  // 获取当前用户信息
  async getMe(token: string): Promise<{ username: string }> {
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error("Failed to get user info");
    return res.json();
  },

  // 修改密码
  async changePassword(
    token: string,
    oldPassword: string,
    newPassword: string
  ): Promise<void> {
    const res = await fetch(`${API_BASE}/auth/change-password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ old_password: oldPassword, new_password: newPassword }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Change password failed");
    }
  },
};

// 本地存储 token
export const setToken = (token: string) => {
  localStorage.setItem("vibe_token", token);
};

export const getToken = (): string | null => {
  return localStorage.getItem("vibe_token");
};

export const removeToken = () => {
  localStorage.removeItem("vibe_token");
};
