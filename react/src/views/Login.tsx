import { useState, useEffect } from "react";
import { authApi, setToken } from "../api/auth";
import { useMobile } from "../hooks/useMobile";

interface LoginProps {
  onLogin: () => void;
}

export default function Login({ onLogin }: LoginProps) {
  const isMobile = useMobile(768);
  const [isSetup, setIsSetup] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    username: "",
    password: "",
    confirmPassword: "",
  });

  useEffect(() => {
    // 检查认证状态
    authApi
      .getStatus()
      .then((status) => {
        setIsSetup(status.setup_required);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!form.username || !form.password) {
      setError("请输入用户名和密码");
      return;
    }

    if (isSetup && form.password !== form.confirmPassword) {
      setError("两次输入的密码不一致");
      return;
    }

    if (form.password.length < 6) {
      setError("密码至少需要 6 个字符");
      return;
    }

    try {
      const res = isSetup
        ? await authApi.setup(form.username, form.password)
        : await authApi.login(form.username, form.password);

      setToken(res.access_token);
      onLogin();
    } catch (err: any) {
      setError(err.message || (isSetup ? "设置失败" : "登录失败"));
    }
  };

  if (loading) {
    return (
      <div
        style={{
          width: "100vw",
          height: "100vh",
          backgroundColor: "#0c0c0c",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ color: "#6a6a6a", fontSize: 14 }}>Loading...</div>
      </div>
    );
  }

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        backgroundColor: "#0c0c0c",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "'JetBrains Mono', monospace",
      }}
    >
      <div
        style={{
          width: isMobile ? "calc(100% - 32px)" : 400,
          maxWidth: 400,
          backgroundColor: "#141414",
          border: "1px solid #2f2f2f",
          padding: isMobile ? 24 : 40,
          margin: "0 16px",
          boxSizing: "border-box",
        }}
      >
        {/* Logo */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
            marginBottom: isMobile ? 24 : 32,
          }}
        >
          <div
            style={{
              width: isMobile ? 28 : 32,
              height: isMobile ? 28 : 32,
              backgroundImage: "url(/images/terminal3.png)",
              backgroundSize: "contain",
              backgroundRepeat: "no-repeat",
            }}
          />
          <span style={{ fontSize: isMobile ? 18 : 20, fontWeight: "bold", color: "#fff" }}>
            VIBE STUDIO
          </span>
        </div>

        {/* Title */}
        <div
          style={{
            fontSize: 16,
            fontWeight: "bold",
            color: "#fff",
            textAlign: "center",
            marginBottom: 8,
          }}
        >
          {isSetup ? "初始化设置" : "欢迎回来"}
        </div>
        <div
          style={{
            fontSize: 12,
            color: "#6a6a6a",
            textAlign: "center",
            marginBottom: 32,
          }}
        >
          {isSetup
            ? "请设置管理员账号和密码"
            : "请输入您的账号密码继续访问"}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: isMobile ? 16 : 20 }}>
          <div>
            <label
              style={{
                display: "block",
                fontSize: isMobile ? 12 : 11,
                color: "#6a6a6a",
                marginBottom: 8,
                textTransform: "uppercase",
                letterSpacing: 0.5,
              }}
            >
              Username
            </label>
            <input
              type="text"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              placeholder="admin"
              autoFocus
              style={{
                width: "100%",
                padding: isMobile ? "14px 16px" : "12px 16px",
                backgroundColor: "#0c0c0c",
                border: "1px solid #2f2f2f",
                color: "#fff",
                fontSize: isMobile ? 16 : 14,
                fontFamily: "inherit",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          <div>
            <label
              style={{
                display: "block",
                fontSize: isMobile ? 12 : 11,
                color: "#6a6a6a",
                marginBottom: 8,
                textTransform: "uppercase",
                letterSpacing: 0.5,
              }}
            >
              Password
            </label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="••••••"
              style={{
                width: "100%",
                padding: isMobile ? "14px 16px" : "12px 16px",
                backgroundColor: "#0c0c0c",
                border: "1px solid #2f2f2f",
                color: "#fff",
                fontSize: isMobile ? 16 : 14,
                fontFamily: "inherit",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          {isSetup && (
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: isMobile ? 12 : 11,
                  color: "#6a6a6a",
                  marginBottom: 8,
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                }}
              >
                Confirm Password
              </label>
              <input
                type="password"
                value={form.confirmPassword}
                onChange={(e) =>
                  setForm({ ...form, confirmPassword: e.target.value })
                }
                placeholder="••••••"
                style={{
                  width: "100%",
                  padding: isMobile ? "14px 16px" : "12px 16px",
                  backgroundColor: "#0c0c0c",
                  border: "1px solid #2f2f2f",
                  color: "#fff",
                  fontSize: isMobile ? 16 : 14,
                  fontFamily: "inherit",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>
          )}

          {error && (
            <div
              style={{
                padding: "12px 16px",
                backgroundColor: "rgba(255,68,68,0.1)",
                border: "1px solid rgba(255,68,68,0.3)",
                color: "#ff4444",
                fontSize: 12,
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            style={{
              width: "100%",
              padding: isMobile ? "16px" : "14px",
              backgroundColor: "#00ff88",
              border: "none",
              color: "#0c0c0c",
              fontSize: isMobile ? 16 : 14,
              fontWeight: "bold",
              cursor: "pointer",
              fontFamily: "inherit",
              marginTop: 8,
            }}
          >
            {isSetup ? "创建账号" : "登录"}
          </button>
        </form>

        {/* Footer */}
        <div
          style={{
            marginTop: isMobile ? 24 : 32,
            paddingTop: 24,
            borderTop: "1px solid #2f2f2f",
            textAlign: "center",
          }}
        >
          <span style={{ fontSize: isMobile ? 12 : 11, color: "#6a6a6a" }}>
            Vibe Studio v0.1.0
          </span>
        </div>
      </div>
    </div>
  );
}
