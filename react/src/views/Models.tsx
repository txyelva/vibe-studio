import { useEffect, useState } from "react";
import { useStore } from "../store";
import { useMobile } from "../hooks/useMobile";
import { 
  modelsApi, 
  ProviderPreset, 
  ProviderConfig, 
  ModelUsage,
  formatNumber, 
  formatPrice, 
  calculateUsagePercent 
} from "../api/models";

export default function Models() {
  const isMobile = useMobile(768);
  const { config, refreshConfig } = useStore();
  const [providers, setProviders] = useState<ProviderConfig[]>([]);
  const [presets, setPresets] = useState<ProviderPreset[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<ProviderConfig | null>(null);
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [usage, setUsage] = useState<ModelUsage | null>(null);
  const [loading, setLoading] = useState(true);
  const [usageLoading, setUsageLoading] = useState(false);
  const [error, setError] = useState("");
  
  // 添加 Provider Modal 状态
  const [showAddModal, setShowAddModal] = useState(false);
  const [addStep, setAddStep] = useState<"select" | "auth" | "config">("select");
  const [selectedPreset, setSelectedPreset] = useState<ProviderPreset | null>(null);
  const [authType, setAuthType] = useState<string>("api_key");
  const [newProviderForm, setNewProviderForm] = useState({
    name: "",
    apiKey: "",
    baseUrl: "",
    selectedModels: [] as string[],
  });
  const [isCreating, setIsCreating] = useState(false);
  
  // 编辑 Modal 状态
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "",
    apiKey: "",
    baseUrl: "",
    modelsText: "",
  });
  const [isUpdating, setIsUpdating] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{success: boolean; message?: string; error?: string} | null>(null);

  // 加载 Providers 和 Presets
  useEffect(() => {
    const loadData = async () => {
      try {
        const [providersData, presetsData] = await Promise.all([
          modelsApi.getProviders(),
          modelsApi.getProviderPresets(),
        ]);
        setProviders(providersData.providers);
        setPresets(presetsData.providers);
        
        // 默认选中第一个或主模型对应的 provider
        if (providersData.providers.length > 0) {
          const primary = providersData.providers.find(p => p.is_primary);
          setSelectedProvider(primary || providersData.providers[0]);
        }
      } catch (e: any) {
        setError(e.message || "Failed to load models");
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  // 加载用量信息
  useEffect(() => {
    if (!selectedProvider || selectedProvider.models.length === 0) return;
    
    const modelId = selectedProvider.models[0].id;
    const modelRef = `${selectedProvider.id}/${modelId}`;
    setSelectedModel(modelRef);
    
    const loadUsage = async () => {
      setUsageLoading(true);
      try {
        const data = await modelsApi.getModelUsage(modelRef);
        setUsage(data);
      } catch (e: any) {
        console.error("Failed to load usage:", e);
      } finally {
        setUsageLoading(false);
      }
    };
    loadUsage();
  }, [selectedProvider]);

  const handleSetPrimary = async (modelRef: string) => {
    try {
      await modelsApi.setPrimaryModel(modelRef);
      await refreshConfig();
      // 刷新列表
      const data = await modelsApi.getProviders();
      setProviders(data.providers);
      const updated = data.providers.find(p => p.id === selectedProvider?.id);
      if (updated) setSelectedProvider(updated);
    } catch (e: any) {
      alert(e.message || "Failed to set primary model");
    }
  };

  const handleTestConnection = async () => {
    if (!selectedProvider) return;
    setIsTesting(true);
    setTestResult(null);
    try {
      const result = await modelsApi.testProvider(selectedProvider.id);
      setTestResult(result);
    } catch (e: any) {
      setTestResult({ success: false, error: e.message });
    } finally {
      setIsTesting(false);
    }
  };

  const handleDeleteProvider = async () => {
    if (!selectedProvider) return;
    if (!confirm(`确定删除 "${selectedProvider.name}" 吗？`)) return;
    
    try {
      await modelsApi.deleteProvider(selectedProvider.id);
      const data = await modelsApi.getProviders();
      setProviders(data.providers);
      setSelectedProvider(data.providers[0] || null);
      await refreshConfig();
    } catch (e: any) {
      alert(e.message || "Failed to delete provider");
    }
  };

  const handleAddProvider = async () => {
    if (!selectedPreset) return;
    
    setIsCreating(true);
    try {
      const result = await modelsApi.createProvider({
        provider_id: selectedPreset.id,
        name: newProviderForm.name || selectedPreset.name,
        api_key: newProviderForm.apiKey,
        auth_type: authType,
        base_url: newProviderForm.baseUrl || undefined,
        selected_models: newProviderForm.selectedModels.length > 0 
          ? newProviderForm.selectedModels 
          : selectedPreset.models.map(m => m.id),
      });
      
      // 刷新列表
      const data = await modelsApi.getProviders();
      setProviders(data.providers);
      setSelectedProvider(data.providers.find(p => p.id === result.provider_id) || null);
      
      // 关闭 modal
      setShowAddModal(false);
      setAddStep("select");
      setSelectedPreset(null);
      setNewProviderForm({ name: "", apiKey: "", baseUrl: "", selectedModels: [] });
      
      await refreshConfig();
    } catch (e: any) {
      alert(e.message || "Failed to create provider");
    } finally {
      setIsCreating(false);
    }
  };

  const handleUpdateProvider = async () => {
    if (!selectedProvider) return;

    const parsedModels = editForm.modelsText
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [idPart, ...nameParts] = line.split("|");
        const id = idPart.trim();
        const name = (nameParts.join("|").trim() || id);
        return { id, name };
      });
    
    setIsUpdating(true);
    try {
      await modelsApi.updateProvider(selectedProvider.id, {
        name: editForm.name,
        api_key: editForm.apiKey || undefined,
        base_url: editForm.baseUrl || undefined,
        models: parsedModels,
      });
      
      const data = await modelsApi.getProviders();
      setProviders(data.providers);
      const updated = data.providers.find(p => p.id === selectedProvider.id);
      if (updated) setSelectedProvider(updated);
      
      setShowEditModal(false);
    } catch (e: any) {
      alert(e.message || "Failed to update provider");
    } finally {
      setIsUpdating(false);
    }
  };

  const openEditModal = () => {
    if (!selectedProvider) return;
    setEditForm({
      name: selectedProvider.name,
      apiKey: "",
      baseUrl: selectedProvider.base_url,
      modelsText: selectedProvider.models.map((model) => `${model.id}${model.name !== model.id ? ` | ${model.name}` : ""}`).join("\n"),
    });
    setTestResult(null);
    setShowEditModal(true);
  };

  if (loading) {
    return (
      <div style={{ display: "flex", height: "100%", alignItems: "center", justifyContent: "center", color: "#6a6a6a" }}>
        Loading models...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: "flex", height: "100%", alignItems: "center", justifyContent: "center", color: "#ff4444" }}>
        {error}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", height: "100%", overflow: "hidden" }}>
      {/* 左侧 Provider 列表 */}
      <div
        style={{
          width: isMobile ? (selectedProvider ? 0 : "100%") : 320,
          height: "100%",
          backgroundColor: "#080808",
          borderRight: isMobile ? "none" : "1px solid #2f2f2f",
          display: isMobile && selectedProvider ? "none" : "flex",
          flexDirection: "column",
          fontFamily: "'JetBrains Mono', monospace",
        }}
      >
        {/* Header */}
        <div
          style={{
            height: 64,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 20px",
            borderBottom: "1px solid #2f2f2f",
          }}
        >
          <span style={{ fontSize: 14, fontWeight: "bold", color: "#fff" }}>Models</span>
          <button
            onClick={() => setShowAddModal(true)}
            style={{
              padding: "6px 12px",
              backgroundColor: "#00ff88",
              border: "none",
              color: "#0c0c0c",
              fontSize: 12,
              fontWeight: "bold",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            + Add
          </button>
        </div>

        {/* Provider List */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {providers.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: "#6a6a6a" }}>
              <p>No models configured</p>
              <button
                onClick={() => setShowAddModal(true)}
                style={{
                  marginTop: 16,
                  padding: "10px 20px",
                  backgroundColor: "#00ff88",
                  border: "none",
                  color: "#0c0c0c",
                  fontSize: 13,
                  fontWeight: "bold",
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                Add Your First Model
              </button>
            </div>
          ) : (
            providers.map((provider) => {
              const isSelected = selectedProvider?.id === provider.id;
              
              return (
                <button
                  key={provider.id}
                  onClick={() => setSelectedProvider(provider)}
                  style={{
                    width: "100%",
                    padding: "16px 20px",
                    backgroundColor: isSelected ? "#141414" : "transparent",
                    border: "none",
                    borderLeft: isSelected ? "3px solid #00ff88" : "3px solid transparent",
                    borderBottom: "1px solid #2f2f2f",
                    cursor: "pointer",
                    textAlign: "left",
                    fontFamily: "inherit",
                    display: "flex",
                    flexDirection: "column",
                    gap: 4,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: "bold", color: isSelected ? "#fff" : "#8a8a8a" }}>
                      {provider.name}
                    </span>
                    {provider.is_primary && (
                      <span
                        style={{
                          padding: "2px 6px",
                          backgroundColor: "rgba(0,255,136,0.1)",
                          color: "#00ff88",
                          fontSize: 9,
                          border: "1px solid rgba(0,255,136,0.3)",
                        }}
                      >
                        PRIMARY
                      </span>
                    )}
                  </div>
                  <span style={{ fontSize: 11, color: "#6a6a6a" }}>
                    {provider.models.length} models · {provider.api_type}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* 右侧 Provider 详情 */}
      <div
        style={{
          flex: 1,
          height: "100%",
          backgroundColor: "#0c0c0c",
          display: isMobile && !selectedProvider ? "none" : "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {selectedProvider ? (
          <>
            {/* Mobile Back Button */}
            {isMobile && (
              <button
                onClick={() => setSelectedProvider(null)}
                style={{
                  padding: "12px 16px",
                  backgroundColor: "#080808",
                  border: "none",
                  borderBottom: "1px solid #2f2f2f",
                  color: "#8a8a8a",
                  fontSize: 13,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  textAlign: "left",
                }}
              >
                ← Back to Models
              </button>
            )}

            {/* Header */}
            <div
              style={{
                padding: "24px 32px",
                borderBottom: "1px solid #2f2f2f",
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: 16,
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8, flexWrap: "wrap" }}>
                  <h1 style={{ margin: 0, fontSize: 24, color: "#fff", fontWeight: "bold" }}>
                    {selectedProvider.name}
                  </h1>
                  {selectedProvider.is_primary && (
                    <span
                      style={{
                        padding: "4px 10px",
                        backgroundColor: "rgba(0,255,136,0.1)",
                        color: "#00ff88",
                        fontSize: 11,
                        border: "1px solid rgba(0,255,136,0.3)",
                        fontWeight: "bold",
                      }}
                    >
                      PRIMARY PROVIDER
                    </span>
                  )}
                </div>
                <p style={{ margin: 0, fontSize: 13, color: "#6a6a6a" }}>
                  {selectedProvider.base_url}
                </p>
              </div>
              
              <div style={{ display: "flex", gap: 10 }}>
                <button
                  onClick={openEditModal}
                  style={{
                    padding: "10px 20px",
                    backgroundColor: "transparent",
                    border: "1px solid #2f2f2f",
                    color: "#8a8a8a",
                    fontSize: 13,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    whiteSpace: "nowrap",
                  }}
                >
                  Edit
                </button>
                <button
                  onClick={handleDeleteProvider}
                  style={{
                    padding: "10px 20px",
                    backgroundColor: "transparent",
                    border: "1px solid #ff4444",
                    color: "#ff4444",
                    fontSize: 13,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    whiteSpace: "nowrap",
                  }}
                >
                  Delete
                </button>
              </div>
            </div>

            {/* Content */}
            <div style={{ flex: 1, overflowY: "auto", padding: "24px 32px" }}>
              {/* Models Grid */}
              <div style={{ marginBottom: 32 }}>
                <h3 style={{ margin: "0 0 16px 0", fontSize: 14, color: "#fff", textTransform: "uppercase" }}>
                  Available Models
                </h3>
                <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
                  {selectedProvider.models.map((model) => {
                    const modelRef = `${selectedProvider.id}/${model.id}`;
                    const isPrimaryModel = config?.primary_model === modelRef;
                    
                    return (
                      <div
                        key={model.id}
                        onClick={() => {
                          setSelectedModel(modelRef);
                          modelsApi.getModelUsage(modelRef).then(setUsage);
                        }}
                        style={{
                          padding: 16,
                          backgroundColor: selectedModel === modelRef ? "#1a1a1a" : "#141414",
                          border: selectedModel === modelRef ? "1px solid #00ff88" : "1px solid #2f2f2f",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                        }}
                      >
                        <div>
                          <div style={{ fontSize: 14, fontWeight: "bold", color: "#fff", marginBottom: 4 }}>
                            {model.name}
                          </div>
                          <div style={{ fontSize: 11, color: "#6a6a6a" }}>{model.id}</div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          {isPrimaryModel && (
                            <span
                              style={{
                                padding: "2px 8px",
                                backgroundColor: "rgba(0,255,136,0.1)",
                                color: "#00ff88",
                                fontSize: 10,
                                border: "1px solid rgba(0,255,136,0.3)",
                              }}
                            >
                              PRIMARY
                            </span>
                          )}
                          {!isPrimaryModel && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSetPrimary(modelRef);
                              }}
                              style={{
                                padding: "4px 10px",
                                backgroundColor: "transparent",
                                border: "1px solid #3f3f3f",
                                color: "#8a8a8a",
                                fontSize: 10,
                                cursor: "pointer",
                                fontFamily: "inherit",
                              }}
                            >
                              Set Primary
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Usage Info */}
              {usageLoading ? (
                <div style={{ color: "#6a6a6a", padding: 40, textAlign: "center" }}>
                  Loading usage data...
                </div>
              ) : usage ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                  <h3 style={{ margin: 0, fontSize: 14, color: "#fff", textTransform: "uppercase" }}>
                    Usage: {usage.model_id}
                  </h3>
                  
                  {/* Subscription Status */}
                  {usage.subscription_status !== "none" && (
                    <div style={{ padding: 20, backgroundColor: "#141414", border: "1px solid #2f2f2f" }}>
                      <h4 style={{ margin: "0 0 16px 0", fontSize: 12, color: "#fff" }}>SUBSCRIPTION</h4>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 24 }}>
                        <div>
                          <div style={{ fontSize: 11, color: "#6a6a6a", marginBottom: 4 }}>Status</div>
                          <div style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            padding: "4px 10px",
                            backgroundColor: usage.subscription_status === "active" ? "rgba(0,255,136,0.1)" : "rgba(255,136,0,0.1)",
                            color: usage.subscription_status === "active" ? "#00ff88" : "#ff8800",
                            fontSize: 12,
                            fontWeight: "bold",
                            border: `1px solid ${usage.subscription_status === "active" ? "rgba(0,255,136,0.3)" : "rgba(255,136,0,0.3)"}`,
                          }}>
                            <span style={{
                              width: 6,
                              height: 6,
                              borderRadius: "50%",
                              backgroundColor: usage.subscription_status === "active" ? "#00ff88" : "#ff8800",
                            }} />
                            {usage.subscription_status.toUpperCase()}
                          </div>
                        </div>
                        {usage.subscription_plan && (
                          <div>
                            <div style={{ fontSize: 11, color: "#6a6a6a", marginBottom: 4 }}>Plan</div>
                            <div style={{ fontSize: 14, color: "#fff", textTransform: "capitalize" }}>
                              {usage.subscription_plan}
                            </div>
                          </div>
                        )}
                        {usage.subscription_expires && (
                          <div>
                            <div style={{ fontSize: 11, color: "#6a6a6a", marginBottom: 4 }}>Expires</div>
                            <div style={{ fontSize: 14, color: "#fff" }}>{usage.subscription_expires}</div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Usage Stats */}
                  <div style={{ padding: 20, backgroundColor: "#141414", border: "1px solid #2f2f2f" }}>
                    <h4 style={{ margin: "0 0 16px 0", fontSize: 12, color: "#fff" }}>USAGE STATISTICS</h4>
                    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(4, 1fr)", gap: 16 }}>
                      <div>
                        <div style={{ fontSize: 11, color: "#6a6a6a", marginBottom: 4 }}>Total Requests</div>
                        <div style={{ fontSize: 20, fontWeight: "bold", color: "#fff" }}>
                          {formatNumber(usage.total_requests)}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, color: "#6a6a6a", marginBottom: 4 }}>Total Tokens</div>
                        <div style={{ fontSize: 20, fontWeight: "bold", color: "#00ff88" }}>
                          {formatNumber(usage.total_tokens)}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, color: "#6a6a6a", marginBottom: 4 }}>Input Tokens</div>
                        <div style={{ fontSize: 16, color: "#fff" }}>{formatNumber(usage.input_tokens)}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, color: "#6a6a6a", marginBottom: 4 }}>Output Tokens</div>
                        <div style={{ fontSize: 16, color: "#fff" }}>{formatNumber(usage.output_tokens)}</div>
                      </div>
                    </div>
                  </div>

                  {/* Quota */}
                  {usage.has_limit && usage.limit_value && (
                    <div style={{ padding: 20, backgroundColor: "#141414", border: "1px solid #2f2f2f" }}>
                      <h4 style={{ margin: "0 0 16px 0", fontSize: 12, color: "#fff" }}>
                        QUOTA ({usage.limit_type.toUpperCase()})
                      </h4>
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                          <span style={{ fontSize: 13, color: "#8a8a8a" }}>
                            {formatNumber(usage.used_value)} / {formatNumber(usage.limit_value)} {usage.limit_unit}
                          </span>
                          <span style={{ fontSize: 13, color: "#fff", fontWeight: "bold" }}>
                            {calculateUsagePercent(usage.used_value, usage.limit_value)}%
                          </span>
                        </div>
                        <div style={{ height: 8, backgroundColor: "#1a1a1a", borderRadius: 4, overflow: "hidden" }}>
                          <div style={{
                            width: `${calculateUsagePercent(usage.used_value, usage.limit_value)}%`,
                            height: "100%",
                            backgroundColor: calculateUsagePercent(usage.used_value, usage.limit_value) > 80 ? "#ff4444" : "#00ff88",
                            transition: "width 0.3s ease",
                          }} />
                        </div>
                      </div>
                      {usage.remaining_value !== null && (
                        <div style={{ fontSize: 12, color: "#6a6a6a" }}>
                          {formatNumber(usage.remaining_value)} {usage.limit_unit} remaining
                        </div>
                      )}
                    </div>
                  )}

                  {/* Pricing */}
                  {(usage.input_price !== null || usage.output_price !== null) && (
                    <div style={{ padding: 20, backgroundColor: "#141414", border: "1px solid #2f2f2f" }}>
                      <h4 style={{ margin: "0 0 16px 0", fontSize: 12, color: "#fff" }}>PRICING</h4>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 24 }}>
                        <div>
                          <div style={{ fontSize: 11, color: "#6a6a6a", marginBottom: 4 }}>Input</div>
                          <div style={{ fontSize: 14, color: "#fff" }}>{formatPrice(usage.input_price)}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 11, color: "#6a6a6a", marginBottom: 4 }}>Output</div>
                          <div style={{ fontSize: 14, color: "#fff" }}>{formatPrice(usage.output_price)}</div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </>
        ) : (
          <div style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            color: "#6a6a6a",
            gap: 16,
          }}>
            <div style={{ fontSize: 48, opacity: 0.3 }}>🤖</div>
            <div style={{ fontSize: 14 }}>Select a provider or add a new one</div>
            <button
              onClick={() => setShowAddModal(true)}
              style={{
                padding: "12px 24px",
                backgroundColor: "#00ff88",
                border: "none",
                color: "#0c0c0c",
                fontSize: 14,
                fontWeight: "bold",
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              Add Model Provider
            </button>
          </div>
        )}
      </div>

      {/* Add Provider Modal */}
      {showAddModal && (
        <div style={{
          position: "fixed",
          inset: 0,
          backgroundColor: "rgba(0,0,0,0.8)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000,
          padding: 20,
        }} onClick={() => !isCreating && setShowAddModal(false)}>
          <div style={{
            width: 500,
            maxWidth: "100%",
            maxHeight: "90vh",
            backgroundColor: "#141414",
            border: "1px solid #2f2f2f",
            display: "flex",
            flexDirection: "column",
          }} onClick={e => e.stopPropagation()}>
            {/* Modal Header */}
            <div style={{
              padding: "20px 24px",
              borderBottom: "1px solid #2f2f2f",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}>
              <h2 style={{ margin: 0, fontSize: 16, color: "#fff" }}>
                {addStep === "select" && "Select Provider"}
                {addStep === "auth" && "Authentication"}
                {addStep === "config" && "Configuration"}
              </h2>
              <button
                onClick={() => !isCreating && setShowAddModal(false)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#6a6a6a",
                  fontSize: 20,
                  cursor: "pointer",
                }}
              >
                ×
              </button>
            </div>

            {/* Modal Content */}
            <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
              {/* Step 1: Select Provider */}
              {addStep === "select" && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 12 }}>
                  {presets.map((preset) => (
                    <button
                      key={preset.id}
                      onClick={() => {
                        setSelectedPreset(preset);
                        setNewProviderForm(prev => ({
                          ...prev,
                          name: preset.name,
                          baseUrl: preset.base_url,
                          selectedModels: preset.models.map(m => m.id),
                        }));
                        setAuthType(preset.auth_types[0] || "api_key");
                        setAddStep("auth");
                      }}
                      style={{
                        padding: 16,
                        backgroundColor: "#0c0c0c",
                        border: "1px solid #2f2f2f",
                        color: "#fff",
                        cursor: "pointer",
                        fontFamily: "inherit",
                        textAlign: "left",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = "#00ff88";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = "#2f2f2f";
                      }}
                    >
                      <div style={{ fontSize: 13, fontWeight: "bold", marginBottom: 4 }}>{preset.name}</div>
                      <div style={{ fontSize: 11, color: "#6a6a6a" }}>{preset.models.length} models</div>
                    </button>
                  ))}
                </div>
              )}

              {/* Step 2: Authentication */}
              {addStep === "auth" && selectedPreset && (
                <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                  <div style={{ padding: 12, backgroundColor: "#0c0c0c", border: "1px solid #2f2f2f" }}>
                    <div style={{ fontSize: 12, color: "#6a6a6a" }}>Selected Provider</div>
                    <div style={{ fontSize: 16, fontWeight: "bold", color: "#fff" }}>{selectedPreset.name}</div>
                  </div>

                  {selectedPreset.auth_types.length > 1 && (
                    <div>
                      <label style={{ display: "block", fontSize: 12, color: "#6a6a6a", marginBottom: 8 }}>
                        Authentication Type
                      </label>
                      <div style={{ display: "flex", gap: 10 }}>
                        {selectedPreset.auth_types.map((type) => (
                          <button
                            key={type}
                            onClick={() => setAuthType(type)}
                            style={{
                              flex: 1,
                              padding: "10px",
                              backgroundColor: authType === type ? "#00ff88" : "#0c0c0c",
                              border: "1px solid #2f2f2f",
                              color: authType === type ? "#0c0c0c" : "#fff",
                              cursor: "pointer",
                              fontFamily: "inherit",
                              fontWeight: authType === type ? "bold" : "normal",
                            }}
                          >
                            {type === "api_key" ? "API Key" : "OAuth"}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {authType === "api_key" ? (
                    <div>
                      <label style={{ display: "block", fontSize: 12, color: "#6a6a6a", marginBottom: 8 }}>
                        API Key <a href={selectedPreset.docs_url} target="_blank" rel="noopener noreferrer" style={{ color: "#00ff88" }}>Get Key →</a>
                      </label>
                      <input
                        type="password"
                        value={newProviderForm.apiKey}
                        onChange={(e) => setNewProviderForm({ ...newProviderForm, apiKey: e.target.value })}
                        placeholder="sk-..."
                        style={{
                          width: "100%",
                          padding: "12px",
                          backgroundColor: "#0c0c0c",
                          border: "1px solid #2f2f2f",
                          color: "#fff",
                          fontSize: 14,
                          fontFamily: "inherit",
                          boxSizing: "border-box",
                        }}
                      />
                    </div>
                  ) : (
                    <div style={{ padding: 20, backgroundColor: "#0c0c0c", border: "1px solid #2f2f2f", textAlign: "center" }}>
                      <div style={{ fontSize: 14, color: "#fff", marginBottom: 8 }}>OAuth Authentication</div>
                      <div style={{ fontSize: 12, color: "#6a6a6a" }}>
                        Coming soon. Please use API Key for now.
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Step 3: Configuration */}
              {addStep === "config" && selectedPreset && (
                <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 12, color: "#6a6a6a", marginBottom: 8 }}>
                      Display Name
                    </label>
                    <input
                      type="text"
                      value={newProviderForm.name}
                      onChange={(e) => setNewProviderForm({ ...newProviderForm, name: e.target.value })}
                      style={{
                        width: "100%",
                        padding: "12px",
                        backgroundColor: "#0c0c0c",
                        border: "1px solid #2f2f2f",
                        color: "#fff",
                        fontSize: 14,
                        fontFamily: "inherit",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: 12, color: "#6a6a6a", marginBottom: 8 }}>
                      Base URL (Optional)
                    </label>
                    <input
                      type="text"
                      value={newProviderForm.baseUrl}
                      onChange={(e) => setNewProviderForm({ ...newProviderForm, baseUrl: e.target.value })}
                      placeholder={selectedPreset.base_url}
                      style={{
                        width: "100%",
                        padding: "12px",
                        backgroundColor: "#0c0c0c",
                        border: "1px solid #2f2f2f",
                        color: "#fff",
                        fontSize: 14,
                        fontFamily: "inherit",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: 12, color: "#6a6a6a", marginBottom: 8 }}>
                      Select Models
                    </label>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {selectedPreset.models.map((model) => (
                        <label
                          key={model.id}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            padding: "10px 12px",
                            backgroundColor: "#0c0c0c",
                            border: "1px solid #2f2f2f",
                            cursor: "pointer",
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={newProviderForm.selectedModels.includes(model.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setNewProviderForm({
                                  ...newProviderForm,
                                  selectedModels: [...newProviderForm.selectedModels, model.id],
                                });
                              } else {
                                setNewProviderForm({
                                  ...newProviderForm,
                                  selectedModels: newProviderForm.selectedModels.filter((id) => id !== model.id),
                                });
                              }
                            }}
                          />
                          <span style={{ fontSize: 13, color: "#fff" }}>{model.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: "20px 24px",
              borderTop: "1px solid #2f2f2f",
              display: "flex",
              justifyContent: "space-between",
            }}>
              {addStep !== "select" ? (
                <button
                  onClick={() => setAddStep(addStep === "config" ? "auth" : "select")}
                  disabled={isCreating}
                  style={{
                    padding: "10px 20px",
                    backgroundColor: "transparent",
                    border: "1px solid #2f2f2f",
                    color: "#8a8a8a",
                    fontSize: 13,
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  ← Back
                </button>
              ) : (
                <div />
              )}
              
              {addStep === "select" && (
                <button
                  onClick={() => setShowAddModal(false)}
                  style={{
                    padding: "10px 20px",
                    backgroundColor: "transparent",
                    border: "1px solid #2f2f2f",
                    color: "#8a8a8a",
                    fontSize: 13,
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  Cancel
                </button>
              )}
              
              {addStep === "auth" && (
                <button
                  onClick={() => setAddStep("config")}
                  disabled={authType === "api_key" && !newProviderForm.apiKey}
                  style={{
                    padding: "10px 20px",
                    backgroundColor: "#00ff88",
                    border: "none",
                    color: "#0c0c0c",
                    fontSize: 13,
                    fontWeight: "bold",
                    cursor: "pointer",
                    fontFamily: "inherit",
                    opacity: authType === "api_key" && !newProviderForm.apiKey ? 0.5 : 1,
                  }}
                >
                  Next →
                </button>
              )}
              
              {addStep === "config" && (
                <button
                  onClick={handleAddProvider}
                  disabled={isCreating || newProviderForm.selectedModels.length === 0}
                  style={{
                    padding: "10px 20px",
                    backgroundColor: "#00ff88",
                    border: "none",
                    color: "#0c0c0c",
                    fontSize: 13,
                    fontWeight: "bold",
                    cursor: "pointer",
                    fontFamily: "inherit",
                    opacity: isCreating || newProviderForm.selectedModels.length === 0 ? 0.5 : 1,
                  }}
                >
                  {isCreating ? "Adding..." : "Add Provider"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Edit Provider Modal */}
      {showEditModal && selectedProvider && (
        <div style={{
          position: "fixed",
          inset: 0,
          backgroundColor: "rgba(0,0,0,0.8)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000,
          padding: 20,
        }} onClick={() => !isUpdating && setShowEditModal(false)}>
          <div style={{
            width: 500,
            maxWidth: "100%",
            maxHeight: "90vh",
            backgroundColor: "#141414",
            border: "1px solid #2f2f2f",
            display: "flex",
            flexDirection: "column",
          }} onClick={e => e.stopPropagation()}>
            {/* Modal Header */}
            <div style={{
              padding: "20px 24px",
              borderBottom: "1px solid #2f2f2f",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}>
              <h2 style={{ margin: 0, fontSize: 16, color: "#fff" }}>
                Edit {selectedProvider.name}
              </h2>
              <button
                onClick={() => !isUpdating && setShowEditModal(false)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#6a6a6a",
                  fontSize: 20,
                  cursor: "pointer",
                }}
              >
                ×
              </button>
            </div>

            {/* Modal Content */}
            <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, color: "#6a6a6a", marginBottom: 8 }}>
                    Display Name
                  </label>
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "12px",
                      backgroundColor: "#0c0c0c",
                      border: "1px solid #2f2f2f",
                      color: "#fff",
                      fontSize: 14,
                      fontFamily: "inherit",
                      boxSizing: "border-box",
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 12, color: "#6a6a6a", marginBottom: 8 }}>
                    API Key (leave empty to keep current)
                  </label>
                  <input
                    type="password"
                    value={editForm.apiKey}
                    onChange={(e) => setEditForm({ ...editForm, apiKey: e.target.value })}
                    placeholder="••••••"
                    style={{
                      width: "100%",
                      padding: "12px",
                      backgroundColor: "#0c0c0c",
                      border: "1px solid #2f2f2f",
                      color: "#fff",
                      fontSize: 14,
                      fontFamily: "inherit",
                      boxSizing: "border-box",
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 12, color: "#6a6a6a", marginBottom: 8 }}>
                    Base URL
                  </label>
                  <input
                    type="text"
                    value={editForm.baseUrl}
                    onChange={(e) => setEditForm({ ...editForm, baseUrl: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "12px",
                      backgroundColor: "#0c0c0c",
                      border: "1px solid #2f2f2f",
                      color: "#fff",
                      fontSize: 14,
                      fontFamily: "inherit",
                      boxSizing: "border-box",
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 12, color: "#6a6a6a", marginBottom: 8 }}>
                    Models / Endpoint IDs
                  </label>
                  <textarea
                    value={editForm.modelsText}
                    onChange={(e) => setEditForm({ ...editForm, modelsText: e.target.value })}
                    rows={6}
                    placeholder={"每行一个模型\n示例：\ndoubao-pro-32k | Doubao Pro\nep-202604032105-abcde | 我的豆包接入点"}
                    style={{
                      width: "100%",
                      padding: "12px",
                      backgroundColor: "#0c0c0c",
                      border: "1px solid #2f2f2f",
                      color: "#fff",
                      fontSize: 14,
                      fontFamily: "inherit",
                      boxSizing: "border-box",
                      resize: "vertical",
                      minHeight: 120,
                    }}
                  />
                  <div style={{ fontSize: 11, color: "#6a6a6a", marginTop: 8, lineHeight: "1.6" }}>
                    每行格式：`模型ID` 或 `模型ID | 显示名称`。
                    {selectedProvider.id === "volcengine" && (
                      <span> 火山引擎这里通常要填你在方舟控制台创建的推理接入点 ID，而不是通用模型名。</span>
                    )}
                  </div>
                </div>

                {/* Test Connection */}
                <div style={{ padding: "16px", backgroundColor: "#0c0c0c", border: "1px solid #2f2f2f" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: testResult ? 12 : 0 }}>
                    <span style={{ fontSize: 13, color: "#8a8a8a" }}>Test Connection</span>
                    <button
                      onClick={handleTestConnection}
                      disabled={isTesting}
                      style={{
                        padding: "6px 12px",
                        backgroundColor: "transparent",
                        border: "1px solid #2f2f2f",
                        color: "#00ff88",
                        fontSize: 12,
                        cursor: "pointer",
                        fontFamily: "inherit",
                      }}
                    >
                      {isTesting ? "Testing..." : "Test"}
                    </button>
                  </div>
                  {testResult && (
                    <div style={{
                      padding: "10px 12px",
                      backgroundColor: testResult.success ? "rgba(0,255,136,0.1)" : "rgba(255,68,68,0.1)",
                      border: `1px solid ${testResult.success ? "rgba(0,255,136,0.3)" : "rgba(255,68,68,0.3)"}`,
                      color: testResult.success ? "#00ff88" : "#ff4444",
                      fontSize: 12,
                    }}>
                      {testResult.success ? testResult.message : testResult.error}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: "20px 24px",
              borderTop: "1px solid #2f2f2f",
              display: "flex",
              justifyContent: "flex-end",
              gap: 10,
            }}>
              <button
                onClick={() => setShowEditModal(false)}
                disabled={isUpdating}
                style={{
                  padding: "10px 20px",
                  backgroundColor: "transparent",
                  border: "1px solid #2f2f2f",
                  color: "#8a8a8a",
                  fontSize: 13,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateProvider}
                disabled={isUpdating}
                style={{
                  padding: "10px 20px",
                  backgroundColor: "#00ff88",
                  border: "none",
                  color: "#0c0c0c",
                  fontSize: 13,
                  fontWeight: "bold",
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                {isUpdating ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
