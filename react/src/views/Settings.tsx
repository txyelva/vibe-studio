import { useEffect, useState } from "react";
import { api } from "../api";
import { useStore } from "../store";

const API_TYPES = [
  { value: "openai", label: "OpenAI 兼容" },
  { value: "anthropic", label: "Anthropic 格式" },
];

export default function Settings() {
  const { config, refreshConfig } = useStore();
  const [, setBuiltins] = useState<Record<string, any>>({});
  const [activeTab, setActiveTab] = useState<"providers" | "appearance" | "account">("providers");

  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState({ provider_id: "", name: "", base_url: "", api_type: "openai", api_key: "" });
  const [addingProvider, setAddingProvider] = useState(false);
  const [testResult, setTestResult] = useState<{ [k: string]: { ok: boolean; msg: string } }>({});

  useEffect(() => {
    void api.getBuiltinProviders().then((r) => setBuiltins(r.providers));
  }, []);

  async function handleTest(providerId: string) {
    setTestResult((r) => ({ ...r, [providerId]: { ok: false, msg: "测试中..." } }));
    const res = await api.testProvider(providerId);
    setTestResult((r) => ({ ...r, [providerId]: { ok: res.success, msg: res.success ? "连接成功 ✓" : (res.error ?? "失败") } }));
  }

  async function handleAddProvider() {
    if (!addForm.provider_id || !addForm.base_url) return;
    setAddingProvider(true);
    await api.addProvider({ ...addForm, models: [] });
    await refreshConfig();
    setAddForm({ provider_id: "", name: "", base_url: "", api_type: "openai", api_key: "" });
    setShowAddForm(false);
    setAddingProvider(false);
  }

  async function handleDelete(pid: string) {
    await api.deleteProvider(pid);
    await refreshConfig();
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {/* Header */}
      <div
        style={{
          height: 64,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 24px",
          backgroundColor: "#080808",
          borderBottom: "1px solid #2f2f2f",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 16,
              height: 16,
              backgroundImage: "url(/images/settings.png)",
              backgroundSize: "contain",
              backgroundRepeat: "no-repeat",
            }}
          />
          <span style={{ fontSize: 14, fontWeight: "bold", color: "#fff" }}>Settings</span>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* Sidebar Tabs */}
        <div
          style={{
            width: 200,
            backgroundColor: "#080808",
            borderRight: "1px solid #2f2f2f",
            display: "flex",
            flexDirection: "column",
            padding: "16px 12px",
            gap: 4,
          }}
        >
          {[
            { key: "providers", label: "Providers" },
            { key: "appearance", label: "Appearance" },
            { key: "account", label: "Account" },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              style={{
                width: "100%",
                padding: "10px 12px",
                backgroundColor: activeTab === tab.key ? "rgba(0,255,136,0.08)" : "transparent",
                border: "none",
                borderLeft: activeTab === tab.key ? "2px solid #00ff88" : "2px solid transparent",
                color: activeTab === tab.key ? "#00ff88" : "#8a8a8a",
                fontSize: 12,
                cursor: "pointer",
                fontFamily: "inherit",
                textAlign: "left",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Panel */}
        <div style={{ flex: 1, overflowY: "auto", padding: 32 }}>
          {activeTab === "providers" && (
            <div style={{ maxWidth: 640, display: "flex", flexDirection: "column", gap: 24 }}>
              {/* Providers */}
              <div style={{ padding: 20, backgroundColor: "#141414", border: "1px solid #2f2f2f" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                  <div style={{ fontSize: 12, fontWeight: "bold", color: "#fff", textTransform: "uppercase", letterSpacing: 1 }}>模型 Provider</div>
                  <button
                    onClick={() => setShowAddForm(!showAddForm)}
                    style={{
                      padding: "6px 12px",
                      backgroundColor: "transparent",
                      border: "1px solid #2f2f2f",
                      color: "#00ff88",
                      fontSize: 11,
                      cursor: "pointer",
                      fontFamily: "inherit",
                    }}
                  >
                    + 添加
                  </button>
                </div>

                {showAddForm && (
                  <div style={{ padding: 16, backgroundColor: "#0c0c0c", border: "1px solid #2f2f2f", display: "flex", flexDirection: "column", gap: 10, marginBottom: 12 }}>
                    <p style={{ fontSize: 12, color: "#8a8a8a", margin: 0 }}>添加自定义 Provider</p>
                    {[
                      { key: "provider_id", label: "ID", placeholder: "my-provider" },
                      { key: "name", label: "名称", placeholder: "我的模型" },
                      { key: "base_url", label: "API 地址", placeholder: "https://api.xxx.com/v1" },
                      { key: "api_key", label: "API Key", placeholder: "sk-..." },
                    ].map(({ key, label, placeholder }) => (
                      <div key={key} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        <label style={{ fontSize: 11, color: "#6a6a6a" }}>{label}</label>
                        <input
                          value={addForm[key as keyof typeof addForm]}
                          onChange={(e) => setAddForm((f) => ({ ...f, [key]: e.target.value }))}
                          placeholder={placeholder}
                          style={{
                            padding: "8px 10px",
                            backgroundColor: "#141414",
                            border: "1px solid #2f2f2f",
                            color: "#fff",
                            fontFamily: "inherit",
                            fontSize: 12,
                          }}
                        />
                      </div>
                    ))}
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      <label style={{ fontSize: 11, color: "#6a6a6a" }}>API 类型</label>
                      <select
                        value={addForm.api_type}
                        onChange={(e) => setAddForm((f) => ({ ...f, api_type: e.target.value }))}
                        style={{
                          padding: "8px 10px",
                          backgroundColor: "#141414",
                          border: "1px solid #2f2f2f",
                          color: "#fff",
                          fontFamily: "inherit",
                          fontSize: 12,
                        }}
                      >
                        {API_TYPES.map((t) => (
                          <option key={t.value} value={t.value}>
                            {t.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <button
                      onClick={() => void handleAddProvider()}
                      disabled={addingProvider}
                      style={{
                        padding: "10px",
                        backgroundColor: "#00ff88",
                        border: "none",
                        color: "#0c0c0c",
                        fontWeight: "bold",
                        fontSize: 12,
                        cursor: "pointer",
                        opacity: addingProvider ? 0.6 : 1,
                        fontFamily: "inherit",
                      }}
                    >
                      添加 Provider
                    </button>
                  </div>
                )}

                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {Object.entries(config?.providers ?? {}).map(([pid, pc]) => {
                    const tr = testResult[pid];
                    return (
                      <div key={pid} style={{ padding: 12, backgroundColor: "#0c0c0c", border: "1px solid #2f2f2f" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>{pc.name}</div>
                            <div style={{ fontSize: 10, color: "#6a6a6a", marginTop: 2 }}>{pid}</div>
                          </div>
                          <div style={{ display: "flex", gap: 6 }}>
                            <button
                              onClick={() => void handleTest(pid)}
                              style={{
                                padding: "4px 10px",
                                backgroundColor: "transparent",
                                border: "1px solid #2f2f2f",
                                color: "#8a8a8a",
                                fontSize: 11,
                                cursor: "pointer",
                                fontFamily: "inherit",
                              }}
                            >
                              测试
                            </button>
                            <button
                              onClick={() => void handleDelete(pid)}
                              style={{
                                padding: "4px 10px",
                                backgroundColor: "transparent",
                                border: "1px solid #2f2f2f",
                                color: "#ff4444",
                                fontSize: 11,
                                cursor: "pointer",
                                fontFamily: "inherit",
                              }}
                            >
                              删除
                            </button>
                          </div>
                        </div>
                        {tr && <div style={{ marginTop: 6, fontSize: 11, color: tr.ok ? "#00ff88" : "#ff4444" }}>{tr.msg}</div>}
                        <div style={{ marginTop: 4, fontSize: 10, color: "#6a6a6a" }}>{pc.base_url}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {activeTab === "appearance" && (
            <div style={{ maxWidth: 640 }}>
              <div style={{ padding: 20, backgroundColor: "#141414", border: "1px solid #2f2f2f" }}>
                <div style={{ fontSize: 12, fontWeight: "bold", color: "#fff", marginBottom: 12, textTransform: "uppercase", letterSpacing: 1 }}>Appearance</div>
                <p style={{ fontSize: 13, color: "#6a6a6a", margin: 0 }}>主题、皮肤等设置即将上线...</p>
              </div>
            </div>
          )}

          {activeTab === "account" && (
            <div style={{ maxWidth: 640 }}>
              <div style={{ padding: 20, backgroundColor: "#141414", border: "1px solid #2f2f2f" }}>
                <div style={{ fontSize: 12, fontWeight: "bold", color: "#fff", marginBottom: 12, textTransform: "uppercase", letterSpacing: 1 }}>Account</div>
                <p style={{ fontSize: 13, color: "#6a6a6a", margin: 0 }}>账号系统即将上线...</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
