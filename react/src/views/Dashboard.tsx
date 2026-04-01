import { useState } from "react";
import { useNavigate } from "react-router";
import { useStore } from "../store";
import { useMobile } from "../hooks/useMobile";

export default function Dashboard() {
  const { projects, config, conversations, createProject, deleteProject, switchProject, currentProjectId, isAgentRunning } = useStore();
  const navigate = useNavigate();
  const isMobile = useMobile(768);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({ name: "", path: "", model: config?.primary_model || "" });
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState("");

  const allModels: Array<{ ref: string; label: string }> = [];
  for (const [pid, pc] of Object.entries(config?.providers ?? {})) {
    for (const m of pc.models) {
      allModels.push({ ref: `${pid}/${m.id}`, label: `${pc.name} / ${m.name}` });
    }
  }

  async function handleCreate() {
    if (!createForm.name || !createForm.path || !createForm.model) return;
    setCreating(true);
    await createProject(createForm);
    setCreating(false);
    setShowCreateModal(false);
    setCreateForm({ name: "", path: "", model: config?.primary_model || "" });
  }

  function openProject(id: string) {
    void switchProject(id);
    navigate(`/projects/${id}/thread`);
  }

  const stats = [
    { label: "项目总数", value: String(projects.length), color: "#fff" },
    { label: "当前模型", value: config?.primary_model ? config.primary_model.split("/").pop() : "未配置", color: "#00ff88" },
    { label: "对话数量", value: String(conversations.length), color: "#fff" },
    { label: "工作区", value: config?.workspace ? config.workspace.split("/").pop() : "-", color: "#fff" },
  ];

  const filteredProjects = projects.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.path.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {/* Header */}
      <div
        style={{
          height: isMobile ? "auto" : 64,
          minHeight: 64,
          display: "flex",
          flexDirection: isMobile ? "column" : "row",
          alignItems: isMobile ? "stretch" : "center",
          justifyContent: "space-between",
          padding: isMobile ? "12px 16px" : "0 24px",
          gap: isMobile ? 12 : 0,
          backgroundColor: "#080808",
          borderBottom: "1px solid #2f2f2f",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 16,
              height: 16,
              backgroundImage: "url(/images/search.png)",
              backgroundSize: "contain",
              backgroundRepeat: "no-repeat",
            }}
          />
          <div>
            <span style={{ fontSize: 14, fontWeight: "bold", color: "#fff" }}>Dashboard</span>
            <div style={{ fontSize: 10, color: "#6a6a6a", marginTop: 1 }}>Overview & Projects</div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ position: "relative", flex: isMobile ? 1 : undefined }}>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search projects..."
              style={{
                width: isMobile ? "100%" : 220,
                padding: "8px 12px 8px 32px",
                backgroundColor: "#0c0c0c",
                border: "1px solid #2f2f2f",
                color: "#fff",
                fontFamily: "inherit",
                fontSize: 12,
                borderRadius: 0,
                boxSizing: "border-box",
              }}
            />
            <div
              style={{
                position: "absolute",
                left: 10,
                top: "50%",
                transform: "translateY(-50%)",
                width: 12,
                height: 12,
                backgroundImage: "url(/images/search.png)",
                backgroundSize: "contain",
                backgroundRepeat: "no-repeat",
                opacity: 0.5,
              }}
            />
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            style={{
              padding: "8px 14px",
              backgroundColor: "#00ff88",
              border: "none",
              color: "#0c0c0c",
              fontSize: 12,
              fontWeight: "bold",
              cursor: "pointer",
              fontFamily: "inherit",
              whiteSpace: "nowrap",
            }}
          >
            + New
          </button>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: "auto", padding: 32 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          {/* Stats row */}
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(4, 1fr)", gap: 12 }}>
            {stats.map((s, i) => (
              <div
                key={i}
                style={{
                  padding: 20,
                  backgroundColor: "#141414",
                  border: "1px solid #2f2f2f",
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                }}
              >
                <div style={{ fontSize: 11, color: "#6a6a6a", textTransform: "uppercase", letterSpacing: 0.5 }}>{s.label}</div>
                <div style={{ fontSize: 20, fontWeight: "bold", color: s.color, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {s.value}
                </div>
              </div>
            ))}
          </div>

          {/* Projects section */}
          <div>
            <div
              style={{
                display: "flex",
                flexDirection: isMobile ? "column" : "row",
                alignItems: isMobile ? "flex-start" : "center",
                justifyContent: "space-between",
                marginBottom: 16,
                paddingBottom: 12,
                borderBottom: "1px solid #2f2f2f",
                gap: isMobile ? 8 : 0,
              }}
            >
              <div style={{ fontSize: 13, fontWeight: "bold", color: "#fff", textTransform: "uppercase", letterSpacing: 1 }}>Projects</div>
              {projects.length > 0 && (
                <button
                  onClick={() => navigate("/projects")}
                  style={{
                    fontSize: 11,
                    color: "#00ff88",
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  View All →
                </button>
              )}
            </div>

            {filteredProjects.length === 0 ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "48px 0", gap: 16, color: "#6a6a6a" }}>
                <div style={{ fontSize: 14 }}>{projects.length === 0 ? "暂无项目" : "未找到匹配项目"}</div>
                {projects.length === 0 && (
                  <button
                    onClick={() => setShowCreateModal(true)}
                    style={{
                      padding: "10px 18px",
                      backgroundColor: "#00ff88",
                      border: "none",
                      color: "#0c0c0c",
                      fontSize: 13,
                      fontWeight: "bold",
                      cursor: "pointer",
                      fontFamily: "inherit",
                    }}
                  >
                    创建第一个项目
                  </button>
                )}
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(360px, 1fr))", gap: 16 }}>
                {filteredProjects.map((p) => (
                  <ProjectCard
                    key={p.id}
                    project={p}
                    isActive={p.id === currentProjectId}
                    isRunning={p.id === currentProjectId && isAgentRunning}
                    onOpen={() => openProject(p.id)}
                    onDelete={() => {
                      if (confirm(`确定删除项目 "${p.name}" 吗？`)) {
                        void deleteProject(p.id);
                      }
                    }}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Recent conversations */}
          <div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 16,
                paddingBottom: 12,
                borderBottom: "1px solid #2f2f2f",
              }}
            >
              <div style={{ fontSize: 13, fontWeight: "bold", color: "#fff", textTransform: "uppercase", letterSpacing: 1 }}>Recent Activity</div>
            </div>
            <div style={{ padding: 20, backgroundColor: "#141414", border: "1px solid #2f2f2f" }}>
              {conversations.slice(0, 5).map((c) => (
                <div
                  key={c.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "12px 0",
                    borderBottom: "1px solid #1a1a1a",
                  }}
                >
                  <span style={{ fontSize: 13, color: "#8a8a8a" }}>{c.title}</span>
                  <span style={{ fontSize: 11, color: "#6a6a6a" }}>{new Date(c.updated_at).toLocaleString("zh-CN")}</span>
                </div>
              ))}
              {conversations.length === 0 && <div style={{ fontSize: 13, color: "#6a6a6a", padding: "16px 0" }}>暂无对话</div>}
            </div>
          </div>
        </div>
      </div>

      {/* Footer system bar */}
      <div
        style={{
          height: 40,
          backgroundColor: "#080808",
          borderTop: "1px solid #2f2f2f",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 24px",
          fontSize: 11,
          color: "#6a6a6a",
        }}
      >
        <div style={{ display: "flex", gap: 24 }}>
          <span>CPU 12%</span>
          <span>Memory 34%</span>
          <span>Uptime 2h 14m</span>
          <span>Network 1.2 MB/s</span>
        </div>
        <button
          style={{
            padding: "4px 10px",
            backgroundColor: "transparent",
            border: "1px solid #ff4444",
            color: "#ff4444",
            fontSize: 10,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          Emergency Stop
        </button>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
          }}
          onClick={() => setShowCreateModal(false)}
        >
          <div
            style={{
              width: 480,
              maxWidth: "90vw",
              backgroundColor: "#141414",
              border: "1px solid #2f2f2f",
              padding: 24,
              display: "flex",
              flexDirection: "column",
              gap: 14,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: 14, fontWeight: "bold", color: "#fff" }}>新建项目</div>

            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label style={{ fontSize: 11, color: "#6a6a6a" }}>项目名称</label>
              <input
                value={createForm.name}
                onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="my-awesome-project"
                style={{
                  padding: "10px 12px",
                  backgroundColor: "#0c0c0c",
                  border: "1px solid #2f2f2f",
                  color: "#fff",
                  fontFamily: "inherit",
                  fontSize: 13,
                }}
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label style={{ fontSize: 11, color: "#6a6a6a" }}>项目路径</label>
              <input
                value={createForm.path}
                onChange={(e) => setCreateForm((f) => ({ ...f, path: e.target.value }))}
                placeholder="/Users/..."
                style={{
                  padding: "10px 12px",
                  backgroundColor: "#0c0c0c",
                  border: "1px solid #2f2f2f",
                  color: "#fff",
                  fontFamily: "inherit",
                  fontSize: 13,
                }}
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label style={{ fontSize: 11, color: "#6a6a6a" }}>默认模型</label>
              <select
                value={createForm.model}
                onChange={(e) => setCreateForm((f) => ({ ...f, model: e.target.value }))}
                style={{
                  padding: "10px 12px",
                  backgroundColor: "#0c0c0c",
                  border: "1px solid #2f2f2f",
                  color: "#fff",
                  fontFamily: "inherit",
                  fontSize: 13,
                }}
              >
                <option value="">-- 选择模型 --</option>
                {allModels.map((m) => (
                  <option key={m.ref} value={m.ref}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 6 }}>
              <button
                onClick={() => setShowCreateModal(false)}
                style={{
                  padding: "10px 16px",
                  backgroundColor: "transparent",
                  border: "1px solid #2f2f2f",
                  color: "#8a8a8a",
                  fontSize: 13,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                取消
              </button>
              <button
                onClick={() => void handleCreate()}
                disabled={creating || !createForm.name || !createForm.path || !createForm.model}
                style={{
                  padding: "10px 16px",
                  backgroundColor: "#00ff88",
                  border: "none",
                  color: "#0c0c0c",
                  fontWeight: "bold",
                  fontSize: 13,
                  cursor: "pointer",
                  opacity: creating || !createForm.name || !createForm.path || !createForm.model ? 0.5 : 1,
                  fontFamily: "inherit",
                }}
              >
                创建
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ProjectCard({
  project,
  isActive,
  isRunning,
  onOpen,
  onDelete,
}: {
  project: { id: string; name: string; path: string; model: string };
  isActive: boolean;
  isRunning: boolean;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const isMobile = useMobile(768);
  const status = isRunning ? "RUNNING" : isActive ? "ACTIVE" : "IDLE";
  const statusColor = isRunning ? "#00ff88" : isActive ? "#00ff88" : "#6a6a6a";
  const task = isRunning ? "Processing agent task..." : isActive ? "Ready to work" : "No active tasks";
  const progress = isRunning ? 45 : isActive ? 100 : 0;
  
  // 截断路径显示
  const displayPath = project.path.length > 40 ? project.path.slice(0, 37) + "..." : project.path;

  return (
    <div
      style={{
        padding: isMobile ? 16 : 20,
        backgroundColor: "#141414",
        border: isActive ? "1px solid rgba(0,255,136,0.3)" : "1px solid #2f2f2f",
        display: "flex",
        flexDirection: "column",
        gap: 12,
        minWidth: 0,
        overflow: "hidden",
      }}
    >
      {/* Top row */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0, flex: 1, overflow: "hidden" }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 6,
              backgroundColor: isActive ? "rgba(0,255,136,0.1)" : "#1a1a1a",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 14,
              color: isActive ? "#00ff88" : "#6a6a6a",
              flexShrink: 0,
            }}
          >
            ▶
          </div>
          <div style={{ minWidth: 0, flex: 1, overflow: "hidden" }}>
            <div style={{ fontSize: 15, fontWeight: "bold", color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {project.name}
            </div>
            <div 
              style={{ 
                fontSize: 11, 
                color: "#6a6a6a", 
                marginTop: 2, 
                overflow: "hidden", 
                textOverflow: "ellipsis", 
                whiteSpace: "nowrap",
              }}
              title={project.path}
            >
              {displayPath}
            </div>
          </div>
        </div>
        <div
          style={{
            padding: "3px 8px",
            backgroundColor: isRunning ? "rgba(0,255,136,0.1)" : "transparent",
            border: "1px solid",
            borderColor: statusColor,
            color: statusColor,
            fontSize: 10,
            fontWeight: "bold",
            letterSpacing: 0.5,
            flexShrink: 0,
            whiteSpace: "nowrap",
          }}
        >
          [{status}]
        </div>
      </div>

      {/* Task description */}
      <div style={{ fontSize: 13, color: "#8a8a8a" }}>{task}</div>

      {/* Progress bar */}
      <div>
        <div
          style={{
            height: 4,
            backgroundColor: "#1a1a1a",
            borderRadius: 2,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${progress}%`,
              height: "100%",
              backgroundColor: statusColor,
              boxShadow: isActive ? `0 0 8px ${statusColor}40` : "none",
              transition: "width 0.3s ease",
            }}
          />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 11, color: "#6a6a6a" }}>
          <span>{progress}% complete</span>
          <span>{isRunning ? "started just now" : isActive ? "ready" : "idle"}</span>
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: 10, marginTop: 4 }}>
        <div style={{ display: "flex", gap: 10, flex: 1 }}>
          <button
            onClick={onOpen}
            style={{
              flex: 1,
              padding: "10px 16px",
              backgroundColor: "#00ff88",
              border: "none",
              color: "#0c0c0c",
              fontSize: isMobile ? 14 : 12,
              fontWeight: "bold",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            打开
          </button>
          <button
            style={{
              flex: 1,
              padding: "10px 16px",
              backgroundColor: "transparent",
              border: "1px solid #2f2f2f",
              color: "#8a8a8a",
              fontSize: isMobile ? 14 : 12,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            ⏸ 暂停
          </button>
        </div>
        <button
          onClick={onDelete}
          style={{
            padding: "10px 16px",
            backgroundColor: "transparent",
            border: "1px solid #2f2f2f",
            color: "#ff4444",
            fontSize: isMobile ? 14 : 12,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          删除
        </button>
      </div>
    </div>
  );
}
