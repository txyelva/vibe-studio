import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { useStore } from "../store";

export default function ProjectDetail() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { projects, switchProject, config, refreshConfig, updateProject } = useStore();
  const [loading, setLoading] = useState(true);

  const project = projects.find((p) => p.id === projectId);

  useEffect(() => {
    if (!projectId) return;
    void switchProject(projectId).then(() => setLoading(false));
  }, [projectId, switchProject]);

  if (loading) {
    return (
      <div style={{ width: "100%", height: "100%", backgroundColor: "#0c0c0c", display: "flex", alignItems: "center", justifyContent: "center", color: "#6a6a6a" }}>
        加载中...
      </div>
    );
  }

  if (!project) {
    return (
      <div style={{ width: "100%", height: "100%", backgroundColor: "#0c0c0c", display: "flex", alignItems: "center", justifyContent: "center", color: "#6a6a6a" }}>
        项目不存在
      </div>
    );
  }

  const allModels: Array<{ ref: string; label: string }> = [];
  for (const [pid, pc] of Object.entries(config?.providers ?? {})) {
    for (const m of pc.models) {
      allModels.push({ ref: `${pid}/${m.id}`, label: `${pc.name} / ${m.name}` });
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {/* Header */}
      <div style={{ height: 64, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 24px", backgroundColor: "#080808", borderBottom: "1px solid #2f2f2f" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={() => navigate("/projects")} style={{ width: 28, height: 28, backgroundColor: "transparent", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ width: 14, height: 14, backgroundImage: "url(/images/arrowleft.png)", backgroundSize: "contain", backgroundRepeat: "no-repeat" }} />
          </button>
          <div>
            <div style={{ fontSize: 14, fontWeight: "bold", color: "#fff" }}>{project.name}</div>
            <div style={{ fontSize: 10, color: "#6a6a6a" }}>{project.model}</div>
          </div>
        </div>

        <button onClick={() => navigate(`/projects/${projectId}/thread`)} style={{ padding: "8px 16px", backgroundColor: "rgba(0,255,136,0.1)", border: "1px solid #00ff88", color: "#00ff88", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
          Open Thread →
        </button>
      </div>

      {/* Content */}
      <ProjectManagePanel project={project} allModels={allModels} onUpdate={async (data) => { await updateProject(project.id, data); await refreshConfig(); }} />
    </div>
  );
}

function ProjectManagePanel({ project, allModels, onUpdate }: { project: { id: string; name: string; path: string; model: string }; allModels: Array<{ ref: string; label: string }>; onUpdate: (data: Partial<{ name: string; path: string; model: string }>) => Promise<void>; }) {
  const [name, setName] = useState(project.name);
  const [path, setPath] = useState(project.path);
  const [model, setModel] = useState(project.model);
  const [saving, setSaving] = useState(false);

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: 32 }}>
      <div style={{ maxWidth: 640, display: "flex", flexDirection: "column", gap: 20 }}>
        <div style={{ padding: 20, backgroundColor: "#141414", border: "1px solid #2f2f2f" }}>
          <div style={{ fontSize: 12, fontWeight: "bold", color: "#fff", marginBottom: 16, textTransform: "uppercase", letterSpacing: 1 }}>项目设置</div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label style={{ fontSize: 11, color: "#6a6a6a" }}>名称</label>
              <input value={name} onChange={(e) => setName(e.target.value)} style={{ padding: "10px 12px", backgroundColor: "#0c0c0c", border: "1px solid #2f2f2f", color: "#fff", fontFamily: "inherit", fontSize: 13 }} />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label style={{ fontSize: 11, color: "#6a6a6a" }}>路径</label>
              <input value={path} onChange={(e) => setPath(e.target.value)} style={{ padding: "10px 12px", backgroundColor: "#0c0c0c", border: "1px solid #2f2f2f", color: "#fff", fontFamily: "inherit", fontSize: 13 }} />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label style={{ fontSize: 11, color: "#6a6a6a" }}>默认模型</label>
              <select value={model} onChange={(e) => setModel(e.target.value)} style={{ padding: "10px 12px", backgroundColor: "#0c0c0c", border: "1px solid #2f2f2f", color: "#fff", fontFamily: "inherit", fontSize: 13 }}>
                <option value="">-- 选择模型 --</option>
                {allModels.map((m) => (<option key={m.ref} value={m.ref}>{m.label}</option>))}
              </select>
            </div>

            <button onClick={() => { setSaving(true); void onUpdate({ name, path, model }).then(() => setSaving(false)); }} disabled={saving} style={{ marginTop: 8, padding: "10px 16px", backgroundColor: "#00ff88", border: "none", color: "#0c0c0c", fontWeight: "bold", fontSize: 13, cursor: "pointer", opacity: saving ? 0.6 : 1, fontFamily: "inherit" }}>
              保存修改
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
