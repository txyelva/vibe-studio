import { useState } from "react";
import { useNavigate } from "react-router";
import { api } from "../api";
import { useStore } from "../store";

const PROVIDERS = [
  { id: "anthropic", label: "Claude", sub: "Anthropic" },
  { id: "openai", label: "GPT / o3", sub: "OpenAI" },
  { id: "deepseek", label: "DeepSeek", sub: "深度求索" },
  { id: "kimi_coding", label: "Kimi Coding", sub: "编程专用" },
  { id: "moonshot", label: "Kimi 通用", sub: "月之暗面" },
  { id: "qwen", label: "千问", sub: "阿里云" },
  { id: "zhipu", label: "智谱 GLM", sub: "智谱 AI" },
  { id: "ollama", label: "Ollama", sub: "本地模型" },
];

export default function Onboarding() {
  const { refreshConfig } = useStore();
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedProvider, setSelectedProvider] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [workspace, setWorkspace] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const providerInfo = PROVIDERS.find((p) => p.id === selectedProvider);

  async function handleConfirm() {
    if (!selectedProvider) return;
    if (selectedProvider !== "ollama" && !apiKey.trim()) {
      setError("请输入 API Key");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const builtinRes = await api.getBuiltinProviders();
      const p = builtinRes.providers[selectedProvider];
      if (!p) throw new Error(`未知 provider: ${selectedProvider}`);
      const defaultModel = p.models[0]?.id ?? "default";

      const result = await api.setup({
        provider_id: selectedProvider,
        model_id: defaultModel,
        api_key: apiKey.trim() || "not-needed",
        workspace: workspace.trim(),
      });

      if (!result.success) {
        throw new Error("保存配置失败，请重试");
      }

      setStep(3);
      await refreshConfig();
      navigate("/", { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "配置失败，请重试");
    } finally {
      setLoading(false);
    }
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
          width: 720,
          maxWidth: "90%",
          backgroundColor: "#101010",
          border: "1px solid #2f2f2f",
          padding: 48,
          display: "flex",
          flexDirection: "column",
          gap: 32,
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 28,
                height: 28,
                backgroundImage: "url(/images/terminal.png)",
                backgroundSize: "contain",
                backgroundRepeat: "no-repeat",
              }}
            />
            <span style={{ fontSize: 28, fontWeight: "bold", color: "#fff", letterSpacing: 1 }}>VIBE STUDIO</span>
          </div>
          <span style={{ fontSize: 14, color: "#8a8a8a" }}>AI 编程助手，支持任意大模型</span>
        </div>

        <div style={{ width: "100%", height: 1, backgroundColor: "#2f2f2f" }} />

        {/* Step indicator */}
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center" }}>
          {[1, 2, 3].map((s, i) => (
            <div key={s} style={{ display: "flex", alignItems: "center" }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: step >= s ? "#00ff88" : "#141414",
                  border: step >= s ? "none" : "1px solid #3f3f3f",
                }}
              >
                <span style={{ fontSize: 13, fontWeight: "bold", color: step >= s ? "#0c0c0c" : "#6a6a6a" }}>{s}</span>
              </div>
              {i < 2 && <div style={{ width: 60, height: 2, backgroundColor: step > s ? "#00ff88" : "#2f2f2f" }} />}
            </div>
          ))}
        </div>

        {/* Content */}
        {step === 3 ? (
          <div style={{ textAlign: "center", color: "#fff", padding: "24px 0" }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: "50%",
                backgroundColor: "#00ff88",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 16px",
                fontSize: 22,
                color: "#0c0c0c",
                fontWeight: "bold",
              }}
            >
              ✓
            </div>
            <h2 style={{ fontSize: 18, marginBottom: 6 }}>配置完成</h2>
            <p style={{ fontSize: 12, color: "#8a8a8a" }}>正在进入 Dashboard...</p>
          </div>
        ) : step === 1 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <h2 style={{ fontSize: 16, color: "#fff", margin: 0 }}>选择 AI 模型</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
              {PROVIDERS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSelectedProvider(p.id)}
                  style={{
                    padding: "12px 8px",
                    backgroundColor: selectedProvider === p.id ? "rgba(0,255,136,0.08)" : "#141414",
                    border: selectedProvider === p.id ? "1px solid #00ff88" : "1px solid #2f2f2f",
                    color: selectedProvider === p.id ? "#00ff88" : "#fff",
                    cursor: "pointer",
                    fontFamily: "inherit",
                    textAlign: "left",
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 3 }}>{p.label}</div>
                  <div style={{ fontSize: 10, color: "#6a6a6a" }}>{p.sub}</div>
                </button>
              ))}
            </div>
            <button
              onClick={() => selectedProvider && setStep(2)}
              disabled={!selectedProvider}
              style={{
                width: "100%",
                padding: "12px",
                backgroundColor: "#00ff88",
                border: "none",
                color: "#0c0c0c",
                fontWeight: "bold",
                fontSize: 13,
                cursor: selectedProvider ? "pointer" : "not-allowed",
                opacity: selectedProvider ? 1 : 0.4,
                fontFamily: "inherit",
              }}
            >
              下一步
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <h2 style={{ fontSize: 16, color: "#fff", margin: 0 }}>配置 {providerInfo?.label}</h2>

            {selectedProvider === "ollama" ? (
              <div style={{ padding: 14, backgroundColor: "#141414", border: "1px solid #2f2f2f", color: "#8a8a8a", fontSize: 12 }}>
                Ollama 本地运行，无需 API Key，请确保已安装并启动（默认端口 11434）
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <label style={{ fontSize: 11, color: "#6a6a6a" }}>API Key</label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk-..."
                  style={{
                    padding: "12px 14px",
                    backgroundColor: "#141414",
                    border: "1px solid #2f2f2f",
                    color: "#fff",
                    fontFamily: "inherit",
                    fontSize: 13,
                    outline: "none",
                  }}
                />
                <span style={{ fontSize: 10, color: "#6a6a6a" }}>API Key 只保存在本地，不会上传到任何服务器</span>
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 11, color: "#6a6a6a" }}>工作区目录（可选）</label>
              <input
                type="text"
                value={workspace}
                onChange={(e) => setWorkspace(e.target.value)}
                placeholder="/path/to/your/project"
                style={{
                  padding: "12px 14px",
                  backgroundColor: "#141414",
                  border: "1px solid #2f2f2f",
                  color: "#fff",
                  fontFamily: "inherit",
                  fontSize: 13,
                  outline: "none",
                }}
              />
            </div>

            {error && <span style={{ color: "#ff4444", fontSize: 12 }}>{error}</span>}

            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => setStep(1)}
                style={{
                  flex: 1,
                  padding: "12px",
                  backgroundColor: "transparent",
                  border: "1px solid #2f2f2f",
                  color: "#8a8a8a",
                  fontSize: 13,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                返回
              </button>
              <button
                onClick={() => void handleConfirm()}
                disabled={loading}
                style={{
                  flex: 2,
                  padding: "12px",
                  backgroundColor: "#00ff88",
                  border: "none",
                  color: "#0c0c0c",
                  fontWeight: "bold",
                  fontSize: 13,
                  cursor: "pointer",
                  opacity: loading ? 0.6 : 1,
                  fontFamily: "inherit",
                }}
              >
                {loading ? "保存中..." : "完成配置"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
