import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { useStore } from "../store";

interface LocalTool {
  id: string;
  name: string;
  description: string;
  icon: string;
  is_installed: boolean;
  install_path: string | null;
}

// 常用路径快捷选项
const QUICK_PATHS = [
  { label: "Home", path: "~", icon: "🏠" },
  { label: "Documents", path: "~/Documents", icon: "📄" },
  { label: "Downloads", path: "~/Downloads", icon: "⬇️" },
  { label: "Desktop", path: "~/Desktop", icon: "🖥️" },
];

export default function Projects() {
  const { projects, config, createProject, deleteProject } = useStore();
  const navigate = useNavigate();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({ 
    name: "", 
    path: "", 
    model: config?.primary_model || "" 
  });
  const [creating, setCreating] = useState(false);
  const [localTools, setLocalTools] = useState<LocalTool[]>([]);
  const [loadingTools, setLoadingTools] = useState(false);
  const [showToolsSection, setShowToolsSection] = useState(true);
  const [pathError, setPathError] = useState("");

  const allModels: Array<{ ref: string; label: string }> = [];
  for (const [pid, pc] of Object.entries(config?.providers ?? {})) {
    for (const m of pc.models) {
      allModels.push({ ref: `${pid}/${m.id}`, label: `${pc.name} / ${m.name}` });
    }
  }

  // Load local tools
  useEffect(() => {
    loadLocalTools();
  }, []);

  async function loadLocalTools() {
    setLoadingTools(true);
    try {
      const token = localStorage.getItem("vibe_token");
      const response = await fetch("/api/discover-tools", {
        headers: { "Authorization": `Bearer ${token || ""}` }
      });
      if (!response.ok) throw new Error("Failed to fetch tools");
      const data = await response.json();
      setLocalTools(data.tools || []);
    } catch (e) {
      console.error("Failed to load local tools:", e);
      setLocalTools([]);
    } finally {
      setLoadingTools(false);
    }
  }

  function validatePath(path: string): boolean {
    if (!path.trim()) {
      setPathError("Path is required");
      return false;
    }
    // 简单验证：路径不能以 / 结尾（除非是根目录）
    if (path.endsWith("/") && path !== "/") {
      setPathError("Path should not end with /");
      return false;
    }
    setPathError("");
    return true;
  }

  async function handleCreate() {
    if (!createForm.name || !validatePath(createForm.path) || !createForm.model) return;
    
    // 展开 ~ 为 home 目录
    let resolvedPath = createForm.path;
    if (resolvedPath.startsWith("~/")) {
      resolvedPath = resolvedPath.replace("~", "/Users/" + (config?.username || "user"));
    } else if (resolvedPath === "~") {
      resolvedPath = "/Users/" + (config?.username || "user");
    }
    
    setCreating(true);
    try {
      await createProject({ ...createForm, path: resolvedPath });
      setShowCreateModal(false);
      setCreateForm({ name: "", path: "", model: config?.primary_model || "" });
      setPathError("");
    } catch (e) {
      console.error("Create project failed:", e);
    } finally {
      setCreating(false);
    }
  }

  function handlePathChange(value: string) {
    setCreateForm((f) => ({ ...f, path: value }));
    if (value) validatePath(value);
  }

  function selectQuickPath(path: string) {
    setCreateForm((f) => ({ ...f, path }));
    setPathError("");
  }

  function handleImportFromTool(tool: LocalTool) {
    if (tool.install_path) {
      setCreateForm((f) => ({
        ...f,
        path: tool.install_path!,
        name: tool.name,
      }));
      setShowCreateModal(true);
      setPathError("");
    }
  }

  const installedTools = localTools.filter(t => t.is_installed);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {/* Header */}
      <div style={{ height: 64, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 24px", backgroundColor: "#080808", borderBottom: "1px solid #2f2f2f" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 16, height: 16, backgroundImage: "url(/images/folder.png)", backgroundSize: "contain", backgroundRepeat: "no-repeat" }} />
          <span style={{ fontSize: 14, fontWeight: "bold", color: "#fff" }}>Projects</span>
        </div>
        <button onClick={() => setShowCreateModal(true)} style={{ padding: "8px 14px", backgroundColor: "#00ff88", border: "none", color: "#0c0c0c", fontSize: 12, fontWeight: "bold", cursor: "pointer", fontFamily: "inherit" }}>
          + New Project
        </button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: "auto", padding: 32 }}>
        {/* AI Tools Section */}
        {installedTools.length > 0 && (
          <div style={{ marginBottom: 32 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, cursor: "pointer" }} onClick={() => setShowToolsSection(!showToolsSection)}>
              <span style={{ fontSize: 12, color: "#00ff88" }}>{showToolsSection ? "▼" : "▶"}</span>
              <span style={{ fontSize: 14, fontWeight: "bold", color: "#fff" }}>AI Tools Detected</span>
              <span style={{ fontSize: 11, color: "#6a6a6a", marginLeft: 8 }}>({installedTools.length})</span>
            </div>
            
            {showToolsSection && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
                {installedTools.map((tool) => (
                  <div key={tool.id} style={{ padding: 16, backgroundColor: "#0c0c0c", border: "1px solid #2f2f2f", display: "flex", flexDirection: "column", gap: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 24 }}>{tool.icon}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: "bold", color: "#fff" }}>{tool.name}</div>
                        <div style={{ fontSize: 11, color: "#6a6a6a" }}>{tool.description}</div>
                      </div>
                    </div>
                    {tool.install_path && (
                      <div style={{ fontSize: 10, color: "#4a4a4a", wordBreak: "break-all" }}>{tool.install_path}</div>
                    )}
                    <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                      <button onClick={() => handleImportFromTool(tool)} style={{ flex: 1, padding: "6px 12px", backgroundColor: "transparent", border: "1px solid #00ff88", color: "#00ff88", fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>
                        Import as Project
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Projects Section */}
        <div style={{ marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 14, fontWeight: "bold", color: "#fff" }}>Projects</span>
          <span style={{ fontSize: 11, color: "#6a6a6a" }}>{projects.length} total</span>
        </div>

        {projects.length === 0 ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "60px 0", gap: 16, color: "#6a6a6a" }}>
            <div style={{ fontSize: 14 }}>No projects yet</div>
            <button onClick={() => setShowCreateModal(true)} style={{ padding: "10px 18px", backgroundColor: "#00ff88", border: "none", color: "#0c0c0c", fontSize: 13, fontWeight: "bold", cursor: "pointer", fontFamily: "inherit" }}>
              Create First Project
            </button>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16 }}>
            {projects.map((p) => (
              <div key={p.id} onClick={() => navigate(`/projects/${p.id}/thread`)} style={{ padding: 24, backgroundColor: "#141414", border: "1px solid #2f2f2f", cursor: "pointer", transition: "border-color 0.15s" }} onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#00ff88")} onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#2f2f2f")}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                  <div style={{ width: 32, height: 32, backgroundImage: "url(/images/gitbranch.png)", backgroundSize: "contain", backgroundRepeat: "no-repeat" }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: "bold", color: "#fff" }}>{p.name}</div>
                    <div style={{ fontSize: 11, color: "#6a6a6a" }}>{p.model}</div>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); if (confirm(`Delete project "${p.name}"?`)) deleteProject(p.id); }} style={{ padding: "4px 10px", backgroundColor: "transparent", border: "1px solid #2f2f2f", color: "#ff4444", fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>
                    Delete
                  </button>
                </div>
                <div style={{ fontSize: 12, color: "#8a8a8a", marginBottom: 16, wordBreak: "break-all" }}>{p.path}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }} onClick={() => setShowCreateModal(false)}>
          <div style={{ width: 520, maxWidth: "90vw", maxHeight: "90vh", overflowY: "auto", backgroundColor: "#141414", border: "1px solid #2f2f2f", padding: 24, display: "flex", flexDirection: "column", gap: 14 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 14, fontWeight: "bold", color: "#fff" }}>New Project</div>

            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label style={{ fontSize: 11, color: "#6a6a6a" }}>Project Name</label>
              <input value={createForm.name} onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))} placeholder="my-project" style={{ padding: "10px 12px", backgroundColor: "#0c0c0c", border: "1px solid #2f2f2f", color: "#fff", fontFamily: "inherit", fontSize: 13 }} />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label style={{ fontSize: 11, color: "#6a6a6a" }}>Project Path</label>
              <input value={createForm.path} onChange={(e) => handlePathChange(e.target.value)} placeholder="/path/to/project or ~/Documents/my-project" style={{ padding: "10px 12px", backgroundColor: "#0c0c0c", border: pathError ? "1px solid #ff4444" : "1px solid #2f2f2f", color: "#fff", fontFamily: "inherit", fontSize: 13 }} />
              {pathError && <span style={{ fontSize: 11, color: "#ff4444" }}>{pathError}</span>}
              
              {/* 快捷路径 */}
              <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                {QUICK_PATHS.map((p) => (
                  <button key={p.path} onClick={() => selectQuickPath(p.path)} style={{ padding: "6px 12px", backgroundColor: "#1a1a1a", border: "1px solid #2f2f2f", color: "#8a8a8a", fontSize: 11, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 4 }}>
                    <span>{p.icon}</span> {p.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label style={{ fontSize: 11, color: "#6a6a6a" }}>Default Model</label>
              <select value={createForm.model} onChange={(e) => setCreateForm((f) => ({ ...f, model: e.target.value }))} style={{ padding: "10px 12px", backgroundColor: "#0c0c0c", border: "1px solid #2f2f2f", color: "#fff", fontFamily: "inherit", fontSize: 13 }}>
                <option value="">-- Select Model --</option>
                {allModels.map((m) => (<option key={m.ref} value={m.ref}>{m.label}</option>))}
              </select>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 6 }}>
              <button onClick={() => setShowCreateModal(false)} style={{ padding: "10px 16px", backgroundColor: "transparent", border: "1px solid #2f2f2f", color: "#8a8a8a", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
              <button onClick={() => void handleCreate()} disabled={creating || !createForm.name || !createForm.path || !createForm.model} style={{ padding: "10px 16px", backgroundColor: "#00ff88", border: "none", color: "#0c0c0c", fontWeight: "bold", fontSize: 13, cursor: "pointer", opacity: creating || !createForm.name || !createForm.path || !createForm.model ? 0.5 : 1, fontFamily: "inherit" }}>
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
